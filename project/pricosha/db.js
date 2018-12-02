// Import mysql interface
const mysql = require("mysql");

// Create connection to MySQL server
const connection = mysql.createConnection({
	host : process.env.DATABASEHOST,
	port : process.env.DATABASEPORT,
	user: process.env.DATABASEUSER,
	password : process.env.DATABASEPASS,
	database : process.env.DATABASE,
	charset : 'utf8mb4'
});

// Define easy abstraction for making sql queries
const query = function (query, values) {
	return new Promise((resolve, reject) => {
		if (!values && query.includes("?"))
			reject("Your query includes placeholders, but you don't provide binding values");
		connection.query({
			sql: query,
			values: values
		}, function (error, results, fields) {
			if (error) reject(error);
			else {
				resolve(results, fields);
			}
		})
	})
}

// export module
module.exports = query;