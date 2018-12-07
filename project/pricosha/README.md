# PRICOSHA

This is an academic project by *[Theodore Kim](https://github.com/theo-kim)* and *[JinZhao Su](https://github.com/JinZSu)* for New York University's Introduction to Databases class (CS-UY 3083)

The purpose of this project is to create a Database interface to enable users to create a _Friend Group_, add other users as friends, and share online items with one and other. The website is coded using a MySQL database, a NodeJS backend server, and a HTML/CSS/JavaScript (JQuery) frontend.

Preview the app here: [nyu-pricosha.herokuapp.com](http://nyu-pricosha.herokuapp.com)

## Optional Features

These features are optional additions to the requirement of the project.

---
#### Avatar [![Generic badge](https://img.shields.io/badge/DATABASE-JinZhao-green.svg)](https://shields.io/)
**DESCRIPTION:** Users are able to specify a small icon picture for their account from a selection of characters upon registration. This is a googd feature to add to PriCoSha because it adds another level of personalization for each user and a means for other users to more easily identify each other. To implement this feature, a new attribute called "avatar" was added to the Person database schema which contains a *varchar(20)* representing the name of the avatar icon. 

**SQL QUERY:** All queries which called for data on individual users now include the avatar attribute field

```sql
SELECT fname, lname, email, avatar FROM Person WHERE email = ?
```

**SOURCE CODE:** All source code accessing the database is located in `/routes/api/index.js`

**SCREENSHOTS:**

---

#### Registration Page [![Generic badge](https://img.shields.io/badge/UI-Theodore-orange.svg)](https://shields.io/)
**DESCRIPTION:** New users can create an account by clicking "Sign-up" on the front page. They specify their email address, password, avatar, first name and last name, then submit the form. On successful creation of the user, PriCoSha should prompt the user to log in with their newly created credentials. If the registering user does not fill out all of the fields or does not format their inputs correctly (i.e. not an email address), PriCoSha prompts the user to correct their input. This feature is useful as it allows new users gain access to the application. To implement this feature, a new API call was defined at `POST /api/users/` which inserts a new row into the `Person` table.

**SQL QUERY**

```sql
INSERT INTO Person (email, password, avatar, fname, lname) VALUE (?, ?, ?, ?, ?)
```

**SOURCE CODE:** Backend source code for user registration in file `routes/api/index.js` on lines 51 - 80.

**SCREENSHOTS:**

---

#### Search Function [![Generic badge](https://img.shields.io/badge/UI-Theodore-orange.svg)](https://shields.io/) [![Generic badge](https://img.shields.io/badge/API-Theodore-orange.svg)](https://shields.io/)
**DESCRIPTION:** Logged in users can search for posts by Item Name using a search bar at the bottom of the page. They should click a search button, then reveal a search bar for users to input their search query. Upon typing, PriCoSha will send the search term to the API, which will look for ContentItems with item names similar to the search term. If a ContentItem is found (or not) the post feed is emptied.  If there is a ContentItem found, PriCoSha will find the found items into the user's feed.  If not matches were found, the feed becomes empty. When the search bar is closed, the page refreshes and the feed repopulates. The feature was implemented using a new API call `GET /api/search` which performs the following Database query.

**SQL QUERY**

```sql
-- Create a temporary view
CREATE OR REPLACE VIEW visible_posts AS
SELECT c.item_id
FROM ContentItem AS c
NATURAL LEFT JOIN Share 
NATURAL LEFT JOIN Friendgroup 
LEFT JOIN Belong AS b ON Friendgroup.owner_email = b.owner_email AND Friendgroup.fg_name = b.fg_name 
WHERE (b.email = ? OR c.is_pub = true OR c.email_post = ?) AND c.item_name LIKE ? 
ORDER BY post_time DESC;
		
--Get the posts themselves			
SELECT c.*, Person.fname, Person.lname, Person.avatar, Person.email
FROM ContentItem AS c
JOIN Person ON Person.email = c.email_post 
NATURAL JOIN visible_posts
ORDER BY post_time DESC;

--Get information about post tags
SELECT Tag.*, Person.fname, Person.lname, Person.email, Person.avatar
FROM Tag 
JOIN Person ON Person.email = Tag.email_tagged 
NATURAL JOIN visible_posts 
WHERE status = 1

--Get information about post rates
SELECT Rate.*, Person.fname, Person.lname, Person.email, Person.avatar
FROM Rate 
NATURAL JOIN Person 
NATURAL JOIN visible_posts

--Get information about comments
SELECT Comments.*, Person.fname, Person.lname, Person.avatar, Person.email
FROM Comments
NATURAL JOIN Person
NATURAL JOIN visible_posts
```

**SOURCE CODE:** Backend source code for user registration in file `routes/api/index.js` on lines 498 - 592.

**SCREENSHOTS**

---

#### New Group [![Generic badge](https://img.shields.io/badge/UI-JinZhao-green.svg)](https://shields.io/)
**DESCRIPTION:** Logged in users can create new groups using the new group menu function in the bottom navigation bar (or via a button in the View Groups window). Upon openning the window, the user can specify a name for the new group as well as a description of the group. If the new group name already exists for the given user, then PriCoSha prompts the users to specify a new name. The description and group name should also be within the given length specified by the database. If the name or description is too long, PriCoSha also prompts the user to specify a shorter name / description. This is good for PriCoSha as it allows users to dynamically create new FriendGroups to vary their social circles. This required no changes to the database schema.

**SQL QUERY**
```sql
--Creating a FriendGroup
INSERT INTO Friendgroup (owner_email, fg_name, description) VALUES (?, ?, ?)
```

**SOURCE CODE:** Backend source code for user registration in file `routes/api/index.js` on lines 382 - 422.

**SCREENSHOTS**

---

#### Commenting [![Generic badge](https://img.shields.io/badge/DATABASE-JinZhao-green.svg)](https://shields.io/) [![Generic badge](https://img.shields.io/badge/UI-Theodore-orange.svg)](https://shields.io/) [![Generic badge](https://img.shields.io/badge/API-JinZhao-green.svg)](https://shields.io/)
**DESCRIPTION:** Logged in users can comment on other users' content items that are visible to them and view the comments that other students made on posts. Clicking the "comment" icon on the content item opens the Comment window. It shows all of the current comments for that post (including the person that posted the comment) and an option for user to add a new comment to the post. When posting the comment, the character limit is 140 characters.  If the user submits a comment with a higher character count or an empty entry, nothing is done and PriCoSha outputs an error for the user to correct their input. This a useful addition because it allows other users to respond to ContentItem in more ways than just adding Emoji reactions and possibly start a discussion on the items. This change required a new relation in the database (see below for definition).

**SQL QUERY**
```sql
-- Relation definition
CREATE TABLE `Comments` (
  item_id int(11) NOT NULL,
  comment varchar(140) NOT NULL,
  email varchar(20) NOT NULL,
  comment_time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, email, comment_time),
  FOREIGN KEY (item_id) REFERENCES ContentItem (item_id),
  FOREIGN KEY (email) REFERENCES Person (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Posting a comment
INSERT INTO Comments (item_id, comment, email) VALUES (?, ?, ?)

-- Fetch comnents associated with a post
-- visible posts is a view of the item_ids that the user can see
SELECT Comments.*, Person.fname, Person.lname, Person.avatar, Person.email
FROM Comments
NATURAL JOIN Person
NATURAL JOIN visible_posts
```

**SOURCE CODE:** Backend source code for user registration in file `routes/api/index.js` on lines 447 - 471 (posting new comments) and lines 246 - 296 (retrieving comments for comments).

**SCREENSHOTS**


