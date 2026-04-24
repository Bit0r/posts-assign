-- Migration number: 0001 	 2026-04-24T10:04:52.629Z
CREATE TABLE jobs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- 要求用户操作的URLs
	urls TEXT NOT NULL,
	-- 发布任务的客户
	customer VARCHAR(255) NOT NULL,
	-- 任务描述
	`description` TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE posts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	-- 帖子内容
	content TEXT NOT NULL,
	-- 帖子标题
	title TEXT,
	-- 领取人
	claimed_by VARCHAR(255),
	-- 禁止删除已有的工作，但允许修改工作的要求和任务领取人
	job_id INTEGER NOT NULL REFERENCES jobs (id) ON DELETE RESTRICT ON UPDATE CASCADE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	-- 确保工作中的每个任务内容只能被一个用户领取
	UNIQUE (job_id, claimed_by),
	-- 确保工作中的每个任务内容唯一
	UNIQUE (job_id, content)
);

CREATE TRIGGER jobs_updated AFTER
UPDATE ON jobs FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at BEGIN
UPDATE jobs
SET
	updated_at = CURRENT_TIMESTAMP
WHERE
	id = NEW.id;

END;

CREATE TRIGGER posts_updated AFTER
UPDATE ON posts FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at BEGIN
UPDATE posts
SET
	updated_at = CURRENT_TIMESTAMP
WHERE
	id = NEW.id;

END;
