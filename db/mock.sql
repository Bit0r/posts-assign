INSERT INTO
	jobs (urls, customer)
VALUES
	('https://reddit.com,https://x.com', '客户A'),
	('https://X.com', '客户B');

INSERT INTO
	posts (content, job_id)
VALUES
	('东西很棒，非常完美', 1),
	('质量不错，价格也合理', 1),
	('物美价廉，非常满意', 1),
	('很好，下次还买', 2),
	('店主态度很好，东西也不错', 2),
	('东西不错，店主态度也很好', 2);

INSERT INTO
	posts (content, job_id, title)
VALUES
	('非常好', 1, '很棒的东西'),
	('价格也合理，东西也不错', 2, '质量不错的商品');
