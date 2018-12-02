var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var jwtsecret = process.env.SECRET;

router.get('/', (req, res, next) => {
	var usertoken, user;
	if (req.cookies.usertoken != null) 
		usertoken = req.cookies.usertoken;
	else usertoken = null;

	if (usertoken !== null) {
		try {
			user = jwt.verify(usertoken, jwtsecret);
		}
		catch (e) {
			usertoken = null;
			user = null;
		}
	}

	var state = {
		loggedin: usertoken !== null,
		user: user
	};
	res.render('main', state);
});

module.exports = router;