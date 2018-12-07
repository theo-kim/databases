var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var request = require('request');
var validUrl = require('valid-url');
var moment = require('moment');

var salt = process.env.SALT;
var jwtsecret = process.env.SECRET;
var query = require('../../db.js');

// Function to handle SQL error
function sqlErrorHandler (error, res) {
	switch (error.code) {
		case "ER_DUP_ENTRY" :
			res.send("DUP: That entry already exists");
			break;
		case "ER_DATA_TOO_LONG" :
			res.send("LONG: Your Data was too long");
			break;
		default: 
			res.send("ERR: MySQL Error")
			break;
	}
}

// Log user in
router.post('/login', (req, res, next) => {
	var email = req.body.email;

	// Hash password
	var password = crypto.createHash('sha256')
						.update(req.body.password + salt)
						.digest('hex');

	// Perform query
	query("SELECT email, password, fname, lname, avatar FROM Person WHERE email=? AND password=?", [email, password])
		.then((result) => {
			if (result.length == 0) res.send('fail');
			else {
				// Return a session token with user information
				res.send(jwt.sign({ fname: result[0].fname, lname: result[0].lname, email: result[0].email, avatar: result[0].avatar }, 
							jwtsecret, 
							{ expiresIn: '7d' }));

			}
		}, error => sqlErrorHandler(error, res));
});

// Create a new user
router.post('/user', (req, res, next) => {
	// Declare variables
	var email, pass, avatar, fname, lname;

	email = req.body.email;
	// Hash Password to put into the database
	if (req.body.password != null) {
		pass = crypto.createHash('sha256')
						.update(req.body.password + salt)
						.digest('hex');
	}
	avatar = req.body.avatar;
	fname = req.body.fname;
	lname = req.body.lname;

	// Check for missing fields
	if (email != null && pass != null && fname != null && avatar != null && lname != null) {
		res.send("INC: Incomplete Request");
	}
	else {
		// Perform query to insert user
		query("INSERT INTO Person (email, password, avatar, fname, lname) VALUE (?, ?, ?, ?, ?)", 
			[email, pass, avatar, fname, lname])
			.then(response => {
				if (response.affectedRows > 0) res.send("success");
				else res.send("error");
			}, error => sqlErrorHandler(error, res))
	}
});

// Search for users by first name
router.get('/user', (req, res, next) => {
	var fname, lname;
	var name = req.query.name;

	if (name.includes(" ")) [fname, lname] = name.split(" ");
	else [fname, lname] = [name, name];

	if (fname != "") fname = "%" + fname + "%";
	if (lname != "") lname = "%" + lname + "%";

	query("SELECT fname, lname, email, avatar FROM Person WHERE fname LIKE ? OR lname LIKE ?", [fname, lname])
		.then((results) => {
			res.send(results);
		}, error => sqlErrorHandler(error, res))
})

// Tag users in posts
router.post('/tag', (req, res, next) => {
	var tagger, tagged, item, token;
	tagged = req.body.email;
	item = req.body.item;
	token = req.body.token;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) {
			res.send("Unauthenticated user");
		}
		else {
			tagger = user.email;
			query(`INSERT INTO Tag (email_tagged, email_tagger, item_id, status)
				   SELECT ?, ?, item_id, ?
				   FROM ContentItem
				   WHERE item_id = ? AND item_id IN 
				       (SELECT item_id
				       FROM ContentItem AS c 
				       NATURAL LEFT JOIN Share
				       NATURAL LEFT JOIN Friendgroup
				       NATURAL LEFT JOIN Belong AS b
				       WHERE b.email = ? OR c.is_pub = true OR c.email_post = ?)`, 
				       [tagged, tagger, tagged==tagger, parseInt(item), tagged, tagged])
				.then((result) => {
					if (result.affectedRows > 0) res.send("success");
					else res.send("Taggee cannot see this post");
				}, error => sqlErrorHandler(error, res));
		}
	});
})

// Get outstanding tags for a user
router.get('/tag', (req, res, next) => {
	var token, tagged;
	token = req.query.token;
	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) {
			res.send("Unauthenticated user");
		}
		else {
			// Select all posts that the user was tagged in with a status of false
			tagged = user.email;
			query(`SELECT * FROM ContentItem 
				   NATURAL JOIN Tag
				   JOIN Person ON Person.email = Tag.email_tagger
				   WHERE email_tagged = ? AND status = 0`, [tagged])
				.then((result) => {
					res.send({success: result});
				}, error => sqlErrorHandler(error, res));
		}
	})
})

// Update status of the tag
router.put('/tag', (req, res, next) => {
	var tagger, tagged, item, token;
	tagger = req.body.email;
	item = req.body.item;
	token = req.body.token;
	status = req.body.status;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) {
			res.send("Unauthenticated user");
		}
		else {
			tagged = user.email;
			query(`UPDATE Tag
				   SET status = ?
				   WHERE item_id = ? AND email_tagged = ? AND email_tagger = ?`, 
				       [(status=='true' ? true : false), parseInt(item), tagged, tagger])
				.then((result) => {
					if (result.affectedRows > 0) res.send("success");
					else res.send("error");
				}, error => sqlErrorHandler(error, res));
		}
	});
})

// Delete tags
router.delete('/tag', (req, res, next) => {
	var tagger, tagged, item, token;
	tagger = req.body.email;
	item = req.body.item;
	token = req.body.token;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) res.send("Unauthenticated user");
		else {
			tagged = user.email;
			query(`DELETE FROM Tag
				   WHERE item_id = ? AND email_tagged = ? AND email_tagger = ?`, 
				       [parseInt(item), tagged, tagger])
				.then((result) => {
					if (result.affectedRows > 0) res.send("success");
					else res.send("error");
				}, error => sqlErrorHandler(error, res));
		}
	});
})

// See content items
router.get('/item', (req, res, next) => {
	var token = req.query.token;
	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) {
			query(`SELECT c.*, Person.fname, Person.lname, Person.avatar, Person.email FROM ContentItem AS c JOIN Person ON Person.email = c.email_post WHERE is_pub=1 AND post_time > DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
				.then((items) => {
					for (var i = 0; i < items.length; ++i) {
						items[i].post_time = moment(items[i].post_time).format("MMMM D [at] h:mm A");
					}
					var response = { items }
					res.send(response)
				}, error => sqlErrorHandler(error, res));
		}
		// Else ONLY show posts that the user is allowed to see
		else {
			// Queries to get all the information about posts
			var queries = [
				// Define View for all posts (by id) that a user is able to see
				query(`CREATE OR REPLACE VIEW visible_posts AS
					   SELECT c.item_id
					   FROM ContentItem AS c
					   NATURAL LEFT JOIN Share 
					   NATURAL LEFT JOIN Friendgroup 
					   LEFT JOIN Belong AS b ON Friendgroup.owner_email = b.owner_email AND Friendgroup.fg_name = b.fg_name 
					   WHERE (b.email = ? OR c.is_pub = true OR c.email_post = ?) 
					   ORDER BY post_time DESC`, [ user.email, user.email ]),
				// Get actual posts and their information
				query(`SELECT c.*, Person.fname, Person.lname, Person.avatar, Person.email
					   FROM ContentItem AS c
					   JOIN Person ON Person.email = c.email_post 
					   NATURAL JOIN visible_posts
					   ORDER BY post_time DESC`),
				// Get information about post tags
				query(`SELECT Tag.*, Person.fname, Person.lname, Person.email, Person.avatar
					   FROM Tag JOIN Person ON Person.email = Tag.email_tagged NATURAL JOIN visible_posts WHERE status = 1`),
				// Get information about post rates
				query(`SELECT Rate.*, Person.fname, Person.lname, Person.email, Person.avatar
					   FROM Rate NATURAL JOIN Person NATURAL JOIN visible_posts`),
				// Get information about comments
				query(`SELECT Comments.*, Person.fname, Person.lname, Person.avatar, Person.email
					   FROM Comments NATURAL JOIN Person NATURAL JOIN visible_posts`)
			]

			// Get the posts
			Promise.all(queries)
				.then(result => {
					// Deconstruct SQL results
					var view, items, tagged, ratings, comments;
					[view, items, tagged, ratings, comments] = result;
					
					for (var i = 0; i < items.length; ++i)
						items[i].post_time = moment(items[i].post_time).format("MMMM D [at] h:mm A");
					
					tags = {}
					for (var i = 0; i < tagged.length; ++i) {
						if (tags[tagged[i]["item_id"]])
							tags[tagged[i]["item_id"]].push(tagged[i])
						else { 
							tags[tagged[i]["item_id"]] = []
							tags[tagged[i]["item_id"]].push(tagged[i])
						}
					}
					rates = {}
					for (var i = 0; i < ratings.length; ++i) {
						ratings[i].rate_time = moment(ratings[i].rate_time).format("MMMM D [at] h:mm A");
						if (rates[ratings[i]["item_id"]])
							rates[ratings[i]["item_id"]].push(ratings[i])
						else { 
							rates[ratings[i]["item_id"]] = []
							rates[ratings[i]["item_id"]].push(ratings[i])
						}
					}			
					comment = {}
					for (var i = 0; i < comments.length; ++i) {
						comments[i].comment_time = moment(comments[i].comment_time).format("MMMM D [at] h:mm A");
						if (comment[comments[i]["item_id"]])
							comment[comments[i]["item_id"]].push(comments[i])
						else { 
							comment[comments[i]["item_id"]] = []
							comment[comments[i]["item_id"]].push(comments[i])
						}
					}
					var response = { tags, items, rates, comment }
					res.send(response);
				}, error => sqlErrorHandler(error, res));
		}
	});
});


// Create content items
router.post('/item', (req, res, next) => {
	// Default values
	var token = null, name = null, ispub = false, url = null, share = null;

	// Decode request
	token = (req.body.token !== undefined) ? req.body.token : null;
	name = req.body.name;
	url = req.body.url;
	ispub = (req.body.ispub === "true") ? 1 : 0;
	share = req.body.share.split(";;");

	// Verify that all required fields were posted
	if (token == null || name == "" || url == "" || ispub == null) {
		res.send("INC: Incomplete Request");
	}
	// Check if user is authenticated
	else if (token != null) {
		jwt.verify(token, jwtsecret, function(error, user) {
			if (error) res.send("Unauthorized Request");
			else {
				//Verify that the linked file exists
				if (!validUrl.isUri(url)) { res.send("Invalid URL"); }
				else {
					request(url, (err, resp) => {
						if (err || resp.statusCode !== 200) {
							res.send("Document does not Exist");
						}
						else {
							query("INSERT INTO ContentItem (email_post, file_path, item_name, is_pub) VALUES (?, ?, ?, ?)", 
							[user.email, url, name, ispub])
								.then(response => {
									var id = response.insertId;
									if (response.affectedRows > 0) {
										if (!ispub && share != null) {
											var queryText = "INSERT INTO Share (owner_email, fg_name, item_id) VALUES ";
											var input = [];
											for (var i = 0; i < share.length; ++i) {
												var entry = share[i].split(",");
												queryText += " (?, ?, ?),";
												input = input.concat([entry[1], entry[0], id])
											}
											queryText = queryText.substring(0, queryText.length - 1);
											return query(queryText, input);
										}
									}
									else res.send("Bad Query");
								}, error => sqlErrorHandler(error, res))
								.then((response) => {
									res.send("success");
								}, error => sqlErrorHandler(error, res));
						}
					})
				}
			}
		});
	}
	else res.send("Unauthenticated Request");
});

// Add rating
router.post('/rate', (req, res, next) => {
	// Default values
	var token = null, item = null, emoji = "";

	// Decode request
	token = req.body.token;
	item = parseInt(req.body.item);
	emoji = req.body.emoji;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) res.send("Unauthenticated user");
		else {
			tagged = user.email;
			query(`INSERT INTO Rate (email, item_id, emoji) VALUES (?, ?, ?)`, 
				       [user.email, item, emoji])
				.then((result) => {
					if (result.affectedRows > 0) res.send("success");
					else res.send("error");
				}, error => sqlErrorHandler(error, res));
		}
	});
})

// Get FriendGroups that a user belongs to
router.get('/groups', (req, res, next) => {
	// Default values
	var token = null, email = "", response = {};

	// Decode request
	token = req.query.token;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) res.send("Unauthenticated user");
		else {
			email = user.email;
			query(`SELECT Friendgroup.*, Belong.email, Person.fname, Person.lname FROM Friendgroup NATURAL LEFT JOIN Belong JOIN Person ON owner_email = Person.email WHERE owner_email = ? OR Belong.email = ?`, 
				       [email, email])
				.then((results) => {
					for (var i = 0; i < results.length; ++i) {
						if (results[i].owner_email == email) results[i].owns = true;
						else results[i].owns = false;
					}
					response.groups = results
					query(`SELECT Belong.*, Person.* FROM Belong NATURAL JOIN Friendgroup JOIN Person ON Belong.email = Person.email WHERE owner_email = ? OR Belong.email = ?`,
						[email, email])
						.then((members) => {
							var member = {}
							for (var i = 0; i < members.length; ++i) {
								var key = members[i]["fg_name"] + "," + members[i]["owner_email"];
								if (member[key])
									member[key].push(members[i])
								else { 
									member[key] = []
									member[key].push(members[i])
								}
							}
							response.member = member;
							res.send(response)
						})
				});
		}
	});
})

router.post('/group', (req, res, next) => {
	// Default values
	var token = null, name = null, description = null;

	// Decode request
	token = req.body.token;
	name = req.body.name;
	description = req.body.description;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) res.send("Unauthenticated user");
		else {
			email = user.email;
			query("INSERT INTO Friendgroup (owner_email, fg_name, description) VALUES (?, ?, ?)", [email, name, description])
				.then((response) => {
					if (response.affectedRows > 0) res.send("success");
					else res.send("failure")
				}, error => sqlErrorHandler(error, res))
		}
	});
})

// Add a comment to a ContentItem
router.post('/post/comment', (req, res, next) => {
	var token, comment, item, email;

	token = req.body.token;
	item = req.body.item;
	comment = req.body.comment;

	if (comment == "" || item == null) {
		res.send("INC: Incomplete Request");
	}
	else {
		jwt.verify(token, jwtsecret, function(error, user) {
			if (error) res.send("Unauthenticated user")
			else {
				email = user.email;
				query(`INSERT INTO Comments (item_id, comment, email) VALUES (?, ?, ?)`,
					[item, comment, email])
					.then((response) => {
						if (response.affectedRows > 0) res.send("success")
					}, error => sqlErrorHandler(error, res))
			}
		})
	}
});

// Add a Person to a FriendGroup
router.post('/group/user', (req, res, next) => {
	// Default values
	var token = null, email = "";

	// Decode request
	token = req.body.token;
	email = req.body.email;
	group = req.body.group;

	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) res.send("Unauthenticated user");
		else {
			owner = user.email;
			query(`INSERT INTO Belong (email, fg_name, owner_email) VALUES (?, ?, ?)`, 
				       [email, group, owner])
				.then((results) => {
					if (results.affectedRows > 0) res.send("success")
					else res.send("User is already a member of your group")
				}, error => sqlErrorHandler(error, res));
		}
	});
});

// Search for contentitem by Name that is visible to the user
router.get('/search', (req, res, user) => {
	// Default values
	var token = null, searchPhrase = null;

	// Decode request
	token = req.query.token;
	searchPhrase = req.query.searchPhrase;

	if (searchPhrase == "" || searchPhrase == null) {
		res.send("Incomplete Request")
	}
	else {
		searchPhrase = "%" + searchPhrase + "%";
		jwt.verify(token, jwtsecret, function(error, user) {
			// If not token, user is not authenticated, only so public posts
			if (error) res.send("Unauthenticated user");
			else {
				searcher = user.email;
				// Queries to get all the information about posts
				var queries = [
					// Define View for all posts (by id) that a user is able to see
					query(`CREATE OR REPLACE VIEW visible_posts AS
						   SELECT c.item_id
						   FROM ContentItem AS c
						   NATURAL LEFT JOIN Share 
						   NATURAL LEFT JOIN Friendgroup 
						   LEFT JOIN Belong AS b ON Friendgroup.owner_email = b.owner_email AND Friendgroup.fg_name = b.fg_name 
						   WHERE (b.email = ? OR c.is_pub = true OR c.email_post = ?) AND c.item_name LIKE ? 
						   ORDER BY post_time DESC`, [ searcher, searcher, searchPhrase ]),
					// Get actual posts and their information
					query(`SELECT c.*, Person.fname, Person.lname, Person.avatar, Person.email
						   FROM ContentItem AS c
						   JOIN Person ON Person.email = c.email_post 
						   NATURAL JOIN visible_posts
						   ORDER BY post_time DESC`),
					// Get information about post tags
					query(`SELECT Tag.*, Person.fname, Person.lname, Person.email, Person.avatar
						   FROM Tag JOIN Person ON Person.email = Tag.email_tagged NATURAL JOIN visible_posts WHERE status = 1`),
					// Get information about post rates
					query(`SELECT Rate.*, Person.fname, Person.lname, Person.email, Person.avatar
						   FROM Rate NATURAL JOIN Person NATURAL JOIN visible_posts`),
					// Get information about comments
					query(`SELECT Comments.*, Person.fname, Person.lname, Person.avatar, Person.email
						   FROM Comments NATURAL JOIN Person NATURAL JOIN visible_posts`)
				]

				// Get the posts
				Promise.all(queries)
					.then(result => {
						// Deconstruct SQL results
						var view, items, tagged, ratings, comments;
						[view, items, tagged, ratings, comments] = result;
						
						for (var i = 0; i < items.length; ++i)
							items[i].post_time = moment(items[i].post_time).format("MMMM D [at] h:mm A");
						
						tags = {}
						for (var i = 0; i < tagged.length; ++i) {
							if (tags[tagged[i]["item_id"]])
								tags[tagged[i]["item_id"]].push(tagged[i])
							else { 
								tags[tagged[i]["item_id"]] = []
								tags[tagged[i]["item_id"]].push(tagged[i])
							}
						}
						rates = {}
						for (var i = 0; i < ratings.length; ++i) {
							ratings[i].rate_time = moment(ratings[i].rate_time).format("MMMM D [at] h:mm A");
							if (rates[ratings[i]["item_id"]])
								rates[ratings[i]["item_id"]].push(ratings[i])
							else { 
								rates[ratings[i]["item_id"]] = []
								rates[ratings[i]["item_id"]].push(ratings[i])
							}
						}			
						comment = {}
						for (var i = 0; i < comments.length; ++i) {
							comments[i].comment_time = moment(comments[i].comment_time).format("MMMM D [at] h:mm A");
							if (comment[comments[i]["item_id"]])
								comment[comments[i]["item_id"]].push(comments[i])
							else { 
								comment[comments[i]["item_id"]] = []
								comment[comments[i]["item_id"]].push(comments[i])
							}
						}
						var response = { tags, items, rates, comment }
						res.send(response);
					}, error => sqlErrorHandler(error, res));
			}
		})
	}
})

module.exports = router;