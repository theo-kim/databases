// Global variables
var mode = 0;
var activeModal = null;
var activeHeader = null;
var activePost = null;
var searchFunction = null;

var tagFunction = function() {
	// Make the request to the server
	var request = {
		token: token,
		item: activePost,
		email: $(this).data("email")
	}
	$.post("/api/tag", request, (response) => {
		if (response == "success") closeModal(() => location.reload())
		else alert(response)
	})
};
var inviteFunction = function() {
	// Make the request to the server
	var request = {
		token: token,
		group: activeGroup,
		email: $(this).data("email")
	}
	$.post("/api/group/user", request, (response) => {
		if (response == "success") closeModal(() => location.reload())
		else alert(response)
	})
};
var extensions = {
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
}

// Function definitions
// function to create a contentitem
function contentitem (info, tags, rates, container) {
	var type = info["file_path"].slice((info["file_path"].lastIndexOf(".") - 1 >>> 0) + 2);
	if (type !== "") type = extensions[type];
	var div = $(`<div class='contentitem'>
				<div class='${type}'></div>
				<div class='user-info'>
					<img class='profile-pic' src='/avatars/${info["avatar"]}.png'>
					<div>
						<span class='post-email person-badge'>
							${info["fname"]} ${info["lname"]}
							<div class='badge-popup'>
								${info["email_post"]}
							</div>
						</span><br>
						<span class='post-time'>Posted ${info["post_time"]}</span><br>
					</div>
				</div>
				<span class='title'>${info["item_name"]}</span><br>
				<span class='item-id'>Item ID: ${info["item_id"]}</span><br>
				<a href='${info["file_path"]}'>${info["file_path"]}</a><br>
				<div class='footer'>
					<div class='btn'><img class='comment-btn' src='/icon/compose.png'></div>
					<div class='btn tag-btn'><img src='/icon/pin.png'><span class='tagged'></span></div>
					<div class='btn emoji-btn'>
							<span class="rate-btn">
								<img src='/icon/like-1.png'>
								<span class='ratings'></span>
							</span>
							<div>
								<span>😁</span><span>😂</span><span>😅</span>
								<span>😍</span><span>😓</span><span>😜</span>
								<span>😡</span><span>😥</span><span>😱</span>
							</div>
					</div>
				</div>
			</div>`);

	var emoji = div.find(".emoji-btn div span");
	if (mode == 0) div.find(".footer").hide();
	emoji.each(function(index) {
		$(emoji[index]).data("item", info["item_id"]).click(() => {
			var request = { emoji: $(emoji[index]).html(), token: token, item: $(emoji[index]).data("item") }
			$.post("/api/rate", request, response => {
				location.reload()
			})
		})
	});

	div.data("id", info["item_id"]);
	if (tags) {
		div.find(".tagged").html(`${tags.length}`)
	}
	else div.find(".tagged").remove()
	if (rates) {
		div.find(".ratings").html(`${rates.length}`)
		// for (var i = 0; i < rates.length; ++i)
		// 	div.find(".ratings").append($(`<span>${rates[i].emoji}</span>`))
	}
	else div.find(".ratings").remove()

	container.append(div);

	// Individual contentitem actions

	// Show ratings
	div.find(".rate-btn").click({ rates: rates }, function(event) {
		var r = event.data.rates
		$("#rate-modal .modal-body #rate").empty()
		if (r) {
			for (var i = 0; i < r.length; ++i) {
				var d = $(`<div class='user-info' style='padding-top:20px; justify-content: space-between'>
								<div style='display:flex; flex-direction: row; align-items: center'>
								<img class='profile-pic' src='/avatars/${r[i].avatar}.png'>
								<div>
									<span class='post-email person-badge'>
										${r[i]["fname"]} ${r[i]["lname"]}
									</span><br>
									<span class='post-time'>Posted ${r[i]["rate_time"]}</span><br>
								</div>
								</div>
								<div style='font-size: 30px;'>${r[i]["emoji"]}</div>
							</div>`);
				$("#rate-modal .modal-body #rate").append(d)
			}
		}
		else {
			$("#rate-modal .modal-body #rate").html("<center>NO RATINGS</center>")
		}

		$("#rate-modal").addClass("open").removeClass("close");
		$("#default-header").hide();
		$("#rate-header").show();
		activeModal = $("#rate-modal");
		activeHeader = $("#rate-header");
	})

	// Allow for users to tag other users
	div.find(".tag-btn").click({ tags: tags, item: info["item_id"] }, function(event) {
		var t = event.data.tags
		if (t) {
			$("#tag-modal .modal-body #people").empty()
			$("#tag-modal .modal-body #people").html("Tagged Users: ")
			for (var i = 0; i < t.length; ++i)
				$("#tag-modal .modal-body #people").append($(`<span class='person-badge small with-icon'><img src='/avatars/${t[i].avatar}.png'>${t[i].fname} ${t[i].lname}</span>`))
		}

		searchFunction = tagFunction;

		$("#tag-modal").addClass("open").removeClass("close");
		$("#default-header").hide();
		$("#tag-header").show();
		activeModal = $("#tag-modal");
		activeHeader = $("#tag-header");
		activePost = $(this).parent().parent().data("id");
	});
}

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
	$.get("/api/item", {}, function(response) {
		var items = response.items
		var tags = response.tags
		var ratings = response.rates
		for (var i = 0; i < items.length; ++i) {
			contentitem(items[i], tags[items[i]["item_id"]], ratings[items[i]["item_id"]], $("#public-posts"));
		}
	});

	// Log user in using entered credentials
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
// If the user is authenticated
else {
	var token = $.cookie("usertoken");
	// Get all posts the user can see
	$.get("/api/item", { token: token }, function(response) {
		var items = response.items
		var tags = response.tags
		var ratings = response.rates
		for (var i = 0; i < items.length; ++i) {
			contentitem(items[i], tags[items[i]["item_id"]], ratings[items[i]["item_id"]], $("#posts"));
		}	
	});

	// Get all pending tags for the user
	$.get("/api/tag", { token: token }, function(response) {
		if (response.success) {
			if (response.success.length > 0) {
				$(".num-notif").each((i, e) => e.innerHTML = response.success.length);
				$("#notification-body").empty();
				for (var i = 0; i < response.success.length; ++i) {
					var notif = $(`<div class='notification'>
								       <div>
								       You were tagged by
								       <span class='person-badge'>
								           ${response.success[i].fname} ${response.success[i].lname}
								       	   <div class='badge-popup'>
								       	       ${response.success[i].email}
								       	   </div>
								       </span> 
								       in the content item, <span class='item-badge'>
								           ${response.success[i].item_name}
								           <div class='badge-popup'>
								       	       <a href='${response.success[i].file_path}'>File Link</a>
								       	   </div>
								       </span>.
								   	   </div>
								   	   <div style="align-self:flex-end; margin-top: 20px;">
								   	   <button id="reject">REJECT</button>
								   	   <button id="confirm">CONFIRM</button>
								   	   </div>
								   </div>`);
					$("#notification-body").css("justify-content", "flex-start")
						.append(notif);
					notif.find("#reject")
						.data("item", response.success[i]["item_id"])
						.data("tagger", response.success[i]["email_tagger"])
						.click(function() {
							var request = { 
								token: token,
								email: $(this).data("tagger"),
								item: $(this).data("item"), 
							}
							$.ajax({
								url: "/api/tag", 
								type: "DELETE", 
								data: request, 
								complete: function(response) {
									closeModal(() => location.reload())
								}
							});
						})

					notif.find("#confirm")
						.data("item", response.success[i]["item_id"])
						.data("tagger", response.success[i]["email_tagger"])
						.click(function() {
							var request = { 
								token: token,
								status: true,
								email: $(this).data("tagger"),
								item: $(this).data("item"), 
							}
							$.ajax({
								url: "/api/tag", 
								type: "PUT", 
								data: request, 
								complete: function(response) {
									closeModal(() => location.reload())
								}
							});
						})
				}
			}
			else 
				$(".num-notif").hide()
		}
	})

	// Get all groups that a person is a member of
	$.get("/api/groups", { token: token }, function(response) {
		var groups = response.groups;
		var members = response.member;
		console.log(groups)
		$("#group-modal .modal-body #groups").empty();
		for (var i = 0; i < groups.length; ++i) {
			var g = $(`<div class='user-info' style='padding-top:20px; align-items: stretch; flex-direction: column'>
							<div style="display:flex; flex-direction: row; justify-content: space-between; align-items: center">
								<div style='display:flex; flex-direction: row; align-items: center'>
								<img class='group-pic' src='/icon/users.png'>
								<div>
									<span class='post-email person-badge'>
										${groups[i].fname} ${groups[i].lname}'s ${groups[i].fg_name}
									</span><br>
									<span class='post-time'>${groups[i].description}</span><br>
								</div>
								</div>
								${(groups[i].owns) ? '<button>Invite Friend</button>' : ''}
							</div>
							<div class="members" style="margin-top: 10px;">Members: </div>
						</div>`);
			var key = groups[i]["fg_name"] + "," + groups[i]["owner_email"];
			if (members[key])
				for (var j = 0; j < members[key].length; ++j) 
					g.find(".members").append(`<span class='person-badge small with-icon'><img src='/avatars/${members[key][j]["avatar"]}.png'>${members[key][j]["fname"]} ${members[key][j]["lname"]}</span>`)
			$("#group-modal .modal-body #groups").append(g);
			$("#share-item").append($(`<div class='user-info' style='padding-top:20px; align-items: stretch; flex-direction: column'>
							<div style="display:flex; flex-direction: row; justify-content: space-between; align-items: center">
								<div style='display:flex; flex-direction: row; align-items: center'>
								<div>
									<span class='post-email person-badge'>
										${groups[i].fname} ${groups[i].lname}'s ${groups[i].fg_name}
									</span><br>
									<span class='post-time'>${groups[i].description}</span><br>
								</div>
								</div>
								<div class="md-checkbox"><input data-key="${key}" class="group-share" id="shared-group-${key}" type="checkbox" /><label for="shared-group-${key}"></label></div>
							</div>
						</div>`))
			g.find("button").click({ group: groups[i].fg_name }, function(event) {
				searchFunction = inviteFunction;
				activeGroup = event.data.group;

				closeModal(() => {
					$("#tag-modal").addClass("open").removeClass("close");
					$("#default-header").hide();
					$("#invite-header").show();
					activeModal = $("#tag-modal");
					activeHeader = $("#invite-header");
					activePost = $(this).parent().parent().data("id");
				});
			});
		}
	});

	// Open Friend Group window
	$("#group").click(function() {
		$("#group-modal").addClass("open").removeClass("close");
		$("#default-header").hide();
		$("#group-header").show();
		activeModal = $("#group-modal");
		activeHeader = $("#group-header");

		$("#tag-modal .modal-body #people").empty()
	});

	// Show menu to create a new post
	$("#new-post").click(function() {
		$("#post-modal").addClass("open").removeClass("close");
		$("#default-header").hide();
		$("#new-post-header").show();
		activeModal = $("#post-modal");
		activeHeader = $("#new-post-header");
	});

	// Actually post the new item
	$("#post-item").click(function() {
		var groups = [];
		$(".group-share").each(function(index, element) {
			if (element.checked)
				groups.push($(element).attr("data-key"));
		})
		var request = {
			token: token,
			name: $("#item-name").val(),
			url: $("#item-url").val(),
			ispub: $("#item-pub").is(':checked'),
			share: groups.join(";;")
		}
		console.log(request)
		$.post("/api/item", request, function(response) {
			// Successful, reload the page
			if (response == "success") closeModal(() => location.reload())
			else alert(response);
		});
	});

	// Show Notifications Window
	$("#notifications").click(function() {
		$("#notification-modal").addClass("open").removeClass("close");
		$("#default-header").hide();
		$("#notification-header").show();
		activeModal = $("#notification-modal");
		activeHeader = $("#notification-header");
	})

	// Show New Group Window
	$("#new-group-btn").click(function() {
		closeModal(() => {
			$("#new-group-modal").addClass("open").removeClass("close");
			$("#default-header").hide();
			$("#new-group-header").show();
			activeModal = $("#new-group-modal");
			activeHeader = $("#new-group-header");
		})
	});

	// Button to actually create the nw group
	$("#new-group").click(function() {
		$.post('/api/group', {token: token, name: $("#new-group-name").val(), description: $("#new-group-desc").val()}, function(response) { 
			if (response == "success") {
				closeModal(() => location.reload());
			}
			else alert(response)
		})
	})

	var timeout = null;
	// Search for people on the website when typed into the search bar
	$("#person-name").keyup(function() {
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			// Search for users on the API
			$.get("/api/user", { name: $("#person-name").val(), item: activePost }, function(response) {
				$("#people-result").empty()
				for (var i = 0; i < response.length; ++i) {
					var entry = $(`<div class='person-search'>
										<img src="/avatars/${response[i].avatar}.png">
										<div><b>${response[i].fname} ${response[i].lname}</b><small>${response[i].email}</small><div>
									</div>`);
					entry.data("email", response[i].email);
					$("#people-result").append(entry)
					// If a person is clicked
					entry.click(searchFunction)
				}
			});
		}, 500);
	})

	// Allow users to share contentitems with their groups if not public
	$("#item-pub").change(function() {
		if (!this.checked) {
			$("#share-item").show();
		}
		else {
			$("#share-item").hide();
		}
	});

	// Log user out of PriCoSha
	$("#logout").click(function() {
		$.cookie("usertoken", 0);
		location.reload();
	});
}

// General UI button assignments
function closeModal(callback) {
	if (callback == null || typeof callback != "function") callback = function() {}
	activeModal.addClass("close");
	setTimeout(() => {
		activeModal.removeClass("open");
		activeModal = null;
		callback();
	}, 300);
	activeHeader.hide();
	$("#default-header").show();

	activeHeader = null;
}

$(".close-modal").click(closeModal)