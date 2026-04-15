UPDATE posts
SET
	claimed_by = ?
WHERE
	id = (
		SELECT
			id
		FROM
			posts
		WHERE
			claimed_by IS NULL
			AND job_id = ?
		ORDER BY
			id
		LIMIT
			1
	) RETURNING *;
