/*
Theodore Kim
CS-UY 3083: Introduction to Databases
HW #2
*/

--Part 1
--1.1
SELECT id FROM student WHERE dept_name='Comp. Sci.'
--1.2
SELECT id, name FROM student WHERE tot_cred<60
--1.3
SELECT id 
FROM takes 
WHERE course_id='CS-101' 
	AND grade='A'
--1.4
SELECT id 
FROM takes 
WHERE course_id='CS-101' 
	AND grade='A' 
	AND semester='Fall' 
	AND year=2009
--1.5
SELECT s.id, s.name
FROM student AS s 
JOIN takes AS t ON s.id=t.id 
WHERE t.course_id='CS-101'	
	AND t.grade='A'
--1.6
SELECT s.id, s.name
FROM student AS s 
JOIN takes AS t ON s.id=t.id 
WHERE (t.course_id='CS-101'	OR t.course_id='CS-190')
	AND t.grade='A'
--1.7
SELECT i.id, i.name, c.title
FROM instructor AS i
JOIN teaches AS t ON i.id=t.id
JOIN course AS c ON t.course_id=c.course_id
WHERE t.course_id LIKE 'CS-%'
--1.8
SELECT s.id, s.name
FROM student AS s
JOIN takes AS tk ON tk.id=s.id
JOIN teaches AS tch ON tk.course_id=tch.course_id
JOIN instructor AS i ON tch.id=i.id
WHERE i.salary > 75000
--1.9
SELECT i.name, i.id
FROM instructor AS i
JOIN teaches AS t ON t.id=i.id
JOIN section AS s ON s.sec_id=t.sec_id AND s.course_id=t.course_id
WHERE s.building='Taylor'

--Part 2
--2.1
INSERT INTO Person (first_name, last_name, class)
VALUES 	('Theodore','Kim','Junior'),
		('Jin', 'Su', 'Junior'),
		('John', 'Doe', 'Senior');
INSERT INTO PhoneNumbers (first_name, last_name, phone_number)
VALUES 	('Theodore','Kim', 1111111111),
		('Jin', 'Su', 1234567891),
		('John', 'Doe', 1423657232),
		('John', 'Doe', 1860754246);
--2.2
INSERT INTO Watches (first_name, last_name, title, year, rating)
VALUES	('Theodore', 'Kim', 'The Office', 2005, 5),
		('Theodore', 'Kim', 'Star Trek', 1966, 5),
		('Jin', 'Su', 'The Simpsons', 1989, 4),
		('Jin', 'Su', 'Sesame Street', 1969, 1)

--2.3
SELECT title FROM TVSeries WHERE num_seasons > 9
--2.4
SELECT title FROM TVSeries WHERE year + num_seasons >= 2018
--2.5
SELECT first_name FROM Watches WHERE title='The Big Bang' AND year=2007
--2.6
SELECT p.*
FROM PhoneNumbers AS p
JOIN Watches AS w ON w.first_name=p.first_name AND w.last_name=p.last_name
WHERE w.title='The Big Bang' AND year=2007
--2.7
SELECT p.phone_number
FROM PhoneNumbers AS p
JOIN Watches AS w ON w.first_name=p.first_name AND w.last_name=p.last_name
WHERE w.title='The Big Bang' AND year=2007
