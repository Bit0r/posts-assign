SELECT
	*
FROM
	posts
WHERE
	claimed_by = ?
	AND job_id = ?;
