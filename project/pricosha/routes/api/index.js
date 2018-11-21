var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

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
	query("SELECT email, password, fname, lname FROM Person WHERE email=? AND password=?", [email, password])
		.then((result) => {
			if (result.length == 0) res.send('fail');
			else {
				// Return a session token with user information
				res.send(jwt.sign({ fname: result[0].fname, lname: result[0].lname, email: result[0].email }, 
							jwtsecret, 
							{ expiresIn: '7d' }));

			}
		});
});

// See content items
router.get('/item', (req, res, next) => {
	var token;

	if (req.params.token == null) {
		token = null;
	}
	else token = req.params.token;

	// If not token, user is not authenticated, only so public posts
	if (token === null) {
		query("SELECT * FROM ContentItem WHERE is_pub=1 AND post_time > DATE_SUB(CURDATE(), INTERVAL 1 DAY)")
			.then((result) => {
				res.json(result);
			});
	}
	// Else ONLY show posts that the user is allowed to see
	else {
		// Implement this later
	}
});


// Create content items
router.post('/item', (req, res, next) => {
	// Implement this later
});

// Create a FriendGroup
router.post('/group', (req, res, next) => {
	// Implement this later
})

module.exports = router;