var mode = 0;

// Check mode 
if($('#login-btn').length) {
	mode = 0;
}
else {
	mode = 1;
}


if (mode == 0) {
	// View all items the user can see, in this case, only public posts b/c
	// the user is not authenticated
	$.get("/api/item", {}, function(items) {
		for (var i = 0; i < items.length; ++i) {
			$("#public-posts").append($(`<div class='contentitem'>
					<span class='title'>${items[i]["item_name"]}</span><br>
					<span class='item-id'>Item ID: ${items[i]["item_id"]}</span><br>
					<span class='post-time'>Posted: ${items[i]["post_time"]}</span><br>
					<a href='${items[i]["file_path"]}'>${items[i]["file_path"]}</a><br>
					<span class='post-email'>Posted By: ${items[i]["email_post"]}</span><br>
				</div>`));
		}
	});

	// Log user in
	$("#login-btn").click(function() {
		$.post("/api/login", {email: $("#email").val(), password: $("#pass").val()}, 
			function(res) {
				if (res === "fail") alert("Incorrect User Email and/or Password");
				else {
					$.cookie("usertoken", res);
					location.reload();
				}
			})
	});
}

else {
	var token = $.cookie("usertoken");
	// View all posts the user can see
	$.get("/api/item", { token: token }, function(items) {
		// Implement this later
	});

	// Create a new FriendGroup
	$("#new-group").click(function() {
		// Implement this later
	});

	// Show menu to create a new post
	$("#show-post").click(function() {
		// Implement this later
	});

	// Log user out of PriCoSha
	$("#logout").click(function() {
		$.cookie("usertoken", 0);
		location.reload();
	});
}