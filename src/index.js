import getClaimedBySQL from './sql/get_claimed_by.sql'
import getFirstUnclaimedSQL from './sql/get_first_unclaimed.sql'
import indexTemplate from './templates/index.html'
import successTemplate from './templates/success.html'

function escapeHtml(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url)

		// 辅助函数：渲染首页（支持动态注入错误信息）
		function renderIndex(errorText = '') {
			let html = indexTemplate
			html = html.replace('{{TURNSTILE_SITE_KEY}}', env.TURNSTILE_SITE_KEY)
			if (errorText) {
				html = html
					.replace('{{ERROR_MSG}}', `<div class="error-msg">${escapeHtml(errorText)}</div>`)
					.replace('{{DISABLED}}', 'disabled')
			} else {
				html = html.replace('{{ERROR_MSG}}', '').replace('{{DISABLED}}', '')
			}
			return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
		}

		// 路由 1: GET / -> 展示表单
		if (request.method === 'GET' && url.pathname === '/') {
			// 如果 URL 中没有 job_id 参数，直接提示错误
			if (!url.searchParams.has('job_id')) {
				return renderIndex('Please access via the correct link, it should contain ?job_id=...!')
			}

			// 将 job_id 保存到 cookie 中，前端表单提交时会自动带上，后端可以通过 cookie 获取到 job_id，避免用户篡改表单中的 job_id 字段
			const jobId = url.searchParams.get('job_id')
			const response = renderIndex()
			response.headers.append('Set-Cookie', `job_id=${encodeURIComponent(jobId)}; Path=/; HttpOnly`)
			return response
		}

		// 路由 2: POST /claim -> 处理领用请求
		if (request.method === 'POST' && url.pathname === '/claim') {
			try {
				// 1. 从 cookie 中获取 job_id，确保与表单提交的 worker_id 一起使用，且不被用户篡改
				const cookieHeader = request.headers.get('Cookie') ?? ''
				const cookies = Object.fromEntries(
					cookieHeader.split(';').map(cookie => {
						const [name, ...rest] = cookie.trim().split('=')
						return [name, rest.join('=')]
					}),
				)
				const jobId = cookies.job_id
				if (!jobId) {
					return renderIndex(
						'Unable to get Job ID, please make sure to access via the correct link!',
					)
				}

				// 2. 从表单数据中获取 worker_id 和 cf-turnstile-response，并进行基本的非空校验
				const formData = await request.formData()
				const workerIdRaw = formData.get('worker_id')
				const turnstileResponseRaw = formData.get('cf-turnstile-response')

				const workerId = typeof workerIdRaw === 'string' ? workerIdRaw.trim() : ''
				const turnstileResponse =
					typeof turnstileResponseRaw === 'string' ? turnstileResponseRaw : ''

				// 2.1. 基本非空校验
				if (!workerId) return renderIndex('Worker ID cannot be empty!')
				if (!turnstileResponse) return renderIndex('Please check the anti-bot verification!')
				if (!env.TURNSTILE_SECRET) {
					console.error('TURNSTILE_SECRET is missing')
					return renderIndex('Incomplete service configuration, please contact the administrator.')
				}

				// 2.2. 向 Cloudflare 校验 Turnstile (防机器刷接口)
				const ip = request.headers.get('CF-Connecting-IP')
				const verifyData = new FormData()
				verifyData.append('secret', env.TURNSTILE_SECRET)
				verifyData.append('response', turnstileResponse)
				verifyData.append('remoteip', ip)

				const verifyReq = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
					method: 'POST',
					body: verifyData,
				})

				if (!verifyReq.ok) {
					return renderIndex(
						'Verification service is temporarily unavailable, please try again later.',
					)
				}

				const verifyOutcome = await verifyReq.json()

				if (!verifyOutcome.success) {
					return renderIndex(
						'Verification expired or failed, please refresh the page and submit again!',
					)
				}

				// 3. 数据库操作 (D1)
				// 获取已经领过的评论（如果有的话），如果没有领过，则分配一条新的
				let result = await env.DB.prepare(getClaimedBySQL).bind(workerId, jobId).first()
				let finalComment = ''

				if (!result) {
					// 没领过，分配一条新的，并锁定该 Worker ID
					result = await env.DB.prepare(getFirstUnclaimedSQL).bind(workerId, jobId).first()

					if (!result) {
						return renderIndex('Sorry, the comment repository is completely empty!')
					}
				}

				// 无论是查重还是新分配，最终都能拿到一条记录，记录里有 content 和可能有 title 字段
				finalComment = result.content
				const finalTitle = result.title

				// 4. 渲染成功页面
				const finalHtml = successTemplate
					.replace('{{HAS_TITLE}}', finalTitle ? 'true' : 'false')
					.replace('{{TITLE}}', escapeHtml(finalTitle || ''))
					.replace('{{COMMENT}}', escapeHtml(finalComment))
					.replace('{{JOB_ID}}', escapeHtml(jobId))
					.replace('{{WORKER_ID}}', escapeHtml(workerId))
				return new Response(finalHtml, {
					headers: { 'Content-Type': 'text/html;charset=UTF-8' },
				})
			} catch (e) {
				console.error('Claim request failed:', e)
				return renderIndex(`Claim request failed. The error is: ${e}`)
			}
		}

		return new Response('Not Found', { status: 404 })
	},
}
