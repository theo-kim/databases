var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var request = require('request');
var validUrl = require('valid-url');
var moment = require('moment');

var salt = require('../../server_config.json').passhashsalt;
var jwtsecret = require('../../server_config.json').serversecret;
var query = require('../../db.js');

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
		});
});


// Search for users by first name
router.get('/user', (req, res, next) => {
	var fname, lname;
	var name = req.query.name;

	if (name.includes(" ")) [fname, lname] = name.split(" ");
	else [fname, lname] = [name, name];

	if (fname != "") fname = "%" + fname + "%";
	if (lname != "") lname = "%" + lname + "%";

	query("SELECT fname, lname, email FROM Person WHERE fname LIKE ? OR lname LIKE ?", [fname, lname])
		.then((results) => {
			res.send(results);
		})
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
				}, 
				(error) => {
					if (error.code == "ER_DUP_ENTRY") {
						res.send("This user has already been tagged.");
					}
					else {
						console.log(error)
						res.send("Bad Query");
					}
				});
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
				}, next);
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
				}, 
				(error) => {
					if (error.code == "ER_DUP_ENTRY") res.send("Already Exists");
					else res.send("Bad Query");
				});
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
				}, 
				(error) => {
					console.log(error)
					res.send("error");
				});
		}
	});
})

// See content items
router.get('/item', (req, res, next) => {
	var token = req.query.token;
	jwt.verify(token, jwtsecret, function(error, user) {
		// If not token, user is not authenticated, only so public posts
		if (error) {
			query("SELECT * FROM ContentItem WHERE is_pub=1 AND post_time > DATE_SUB(CURDATE(), INTERVAL 1 DAY)")
				.then((result) => {
					for (var i = 0; i < result.length; ++i) {
						result[i].post_time = moment(result[i].post_time).format("MMMM d [at] h:mm A");
					}
					res.json(result);
				});
		}
		// Else ONLY show posts that the user is allowed to see
		else {
			// Get the posts
			query(`SELECT *
				   FROM ContentItem AS c 
				   JOIN Person ON Person.email = c.email_post
				   NATURAL LEFT JOIN Share
				   NATURAL LEFT JOIN Friendgroup
				   NATURAL LEFT JOIN Belong AS b
				   WHERE (b.email = ? OR c.is_pub = true OR c.email_post = ?)
				   ORDER BY post_time DESC`, [ user.email, user.email ])
				.then((items) => {
					for (var i = 0; i < items.length; ++i)
						items[i].post_time = moment(items[i].post_time).format("MMMM d [at] h:mm A");
					// Get the tagged users
					query(`SELECT * FROM Tag JOIN Person ON Person.email = Tag.email_tagged WHERE status = 1`)
						.then((tagged) => {
							tags = {}
							for (var i = 0; i < tagged.length; ++i) {
								if (tags[tagged[i]["item_id"]])
									tags[tagged[i]["item_id"]].push(tagged[i])
								else { 
									tags[tagged[i]["item_id"]] = []
									tags[tagged[i]["item_id"]].push(tagged[i])
								}
							}
							query(`SELECT * FROM Rate NATURAL JOIN Person`)
								.then((ratings) => {
									rates = {}
									for (var i = 0; i < ratings.length; ++i) {
										ratings[i].rate_time = moment(ratings[i].rate_time).format("MMMM d [at] h:mm A");
										if (rates[ratings[i]["item_id"]])
											rates[ratings[i]["item_id"]].push(ratings[i])
										else { 
											rates[ratings[i]["item_id"]] = []
											rates[ratings[i]["item_id"]].push(ratings[i])
										}
									}
									var response = { tags, items, rates }
									res.send(response)
								});
						});
				})
		}
	});
});


// Create content items
router.post('/item', (req, res, next) => {
	// Default values
	var token = null, name = "", ispub = false, url = "";

	// Decode request
	token = (req.body.token !== undefined) ? req.body.token : null;
	name = req.body.name;
	url = req.body.url;
	ispub = (req.body.ispub === "true") ? 1 : 0;

	// Verify that all required fields were posted
	if (token == null || name == null || url == null || ispub == null) {
		res.send("Incomplete Request");
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
									if (response.affectedRows > 0) res.send("success");
									else res.send("Bad Query");
								});
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
				});
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
				}, (error) => {
					if (error.code == "ER_DUP_ENTRY") res.send("User is already a member of your group")
					else res.send("Bad Query")
				});
		}
	});
})

module.exports = router;