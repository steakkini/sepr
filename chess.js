var mongo = require('mongodb'),
	Server = mongo.Server,
	DB = mongo.Db,
	BSON = mongo.BSONPure,
	bcrypt = require('bcrypt'),
	nodemailer = require('nodemailer'),
	mailcreds = require('./../mailcreds'),
	crypto = require('crypto'),
 	server = new Server('localhost', 27017, {auto_reconnect: true}),
	db = new DB('sedb', server);


/*
 * establishes the db-connection
 */ 
db.open(function(err, db){
	if(!err){
		console.log("Connected to 'sedb' database.");
	}else{
		console.log("Problem connecting to 'sedb' database.");
	}
});


/*
 * transporter object for nodemailer
 */
var transporter = nodemailer.createTransport({
	service: 'Gmail',
	auth: {
		user: mailcreds.login,
		pass: mailcreds.pw	
	}
});


/*
 * signUp
 * inserts a new user document into the users collection
 * userId is ID
 * returns 201 if successful
 * returns 409 if a conflict occurs
 */
exports.signUp = function(req, res) {
    var user = req.body;
    bcrypt.genSalt(10, function(err, salt){
    	bcrypt.hash(user.pw, salt, function(err, hash){
    		user.pw = hash;
    		db.collection('users', function(err, collection) {
		    	collection.findOne({'userId': {$eq: user.userId}}, function(err, item){
		    		if(item == null){
				        collection.insert(user, {safe:true}, function(err, result) { //ev update mit $setoninsert und $upsert: true
				            if (!err) {
				                collection.update({'userId': {$eq: user.userId}}, {$set: {'status': 'offline'}}, function(err, result){
									res.sendStatus(201);
								});
				            }
				        });
					}else{
						res.sendStatus(409);
					}
	    		});
    		});
    	});
    });
}


/*
 * logIn
 * takes email and pw of a user as input
 * returns 200 if login successful
 * returns 404 if account not found (due to wrong email or wrong pw)
 */
exports.logIn = function(req, res){
	var userId = req.params.userId;
	var user = req.body;
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: userId}}, function(err, item){
			bcrypt.compare(user.pw, item.pw, function(error, isMatch){
				if(isMatch){
					collection.update({'userId': {$eq: userId}}, {$set: {'status': 'online'}}, function(err, result){
						res.sendStatus(204);
					});
				}else{
					res.sendStatus(404);
				}
			});
		});
	});
}


/*
 * logOut
 * takes email as input
 * returns 200 if logOut successful
 * returns 404 if account not found (due to wrong email)
 */
exports.logOut = function(req, res){
	var userId = req.params.userId;
	var user = req.body;
	db.collection('users', function(err, collection) {		
		collection.update({'userId': {$eq: userId}}, {$set: {'status': 'offline'}}, function(err, result){
			if(!err){
				res.sendStatus(204);
			}else{
				res.sendStatus(404);
			}
		});
	});
}


/*
 * allUsers
 * returns userId and status of all users
 * returns http status code 200
 */
exports.allUsers = function(req, res){
	db.collection('users', function(err, collection){
		collection.find({},{'_id': 0, 'userId': 1, 'status': 1}).toArray(function(err, items){
			if(!err){
				var itemsJson = JSON.stringify(items);
				itemsJson = '{"users" : ' + itemsJson + '}';
				res.status(200).send(itemsJson);
			}else{
				res.sendStatus(409);
			}
		});
	});
};


/*
 * allOnlineUsers
 * returns userId of all users online
 * returns http status code 200
 */
exports.allOnlineUsers = function(req, res){
	db.collection('users', function(err, collection){
		collection.find({'status': {$eq: 'online'}},{'_id': 0, 'userId': 1}).toArray(function(err, items){
			var itemsJson = JSON.stringify(items);
			itemsJson = '{"users" : ' + itemsJson + '}';
			res.status(200).send(itemsJson)
		});
	});
};


/*
 * newMatch
 * creates a new match
 * takes id's of user1 and user2 als input
 * returns matchId (user1.id+user2.id+date in milliseconds)
 */
exports.newMatch = function(req, res){
	var match = req.body;
	var matchId = match.user1 + '_' + match.user2 + '_' + crypto.randomBytes(8).toString('hex');
	db.collection('matches', function(err, collection) {
		collection.insert({'matchId': matchId, 'user1': match.user1, 'user2': match.user2}, function(err, item){
			if (!err) {							
				res.status(201).send(matchId);
		    }else{
		    	res.sendStatus(409);
		    }
		});
	});
};


/*
 * change match status
 *
 */
exports.changeMatchStatus = function(req, res){
	var match = req.body;
	db.collection('matches', function(err, collection) {
		collection.findOne({'matchId': {$eq: match.matchId}}, function(err, item){ 									//findOne redundant
			if(item != null){
				collection.update({'matchId': {$eq: match.matchId}}, {$set: {'status': match.status}}, function(err, result){
					res.sendStatus(200);
				});
			}else{
				res.sendStatus(404);
			}
		});
	});
};


/*
 * get all matches
 *
 */
exports.getAllMatches = function(req, res){
	db.collection('matches', function(err, collection){
		collection.find({},{'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1}).toArray(function(err, items){
			var itemsJson = JSON.stringify(items);
			itemsJson = '{"matches" : ' + itemsJson + '}';
			res.status(200).send(itemsJson)
		});
	});
};


/*
 * get match by matchId
 *
 */
exports.getMatch = function(req, res){
	var matchId = req.params.matchId;
	var match = req.body;
	db.collection('matches', function(err, collection){
		collection.find({'matchId': {$eq: matchId}},{'_id': 0}).toArray(function(err, items){
			var itemsJson = JSON.stringify(items);
			itemsJson = '{"matches" : ' + itemsJson + '}';
			res.status(200).send(itemsJson)
		});
	});
};


/*
 * get match by userId
 *
 */
exports.getMatchByUser = function(req, res){
	var userId = req.params.userId;
	var user = req.body;
	db.collection('matches', function(err, collection){
		collection.find({'user1': {$eq: userId}},{'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1}).toArray(function(err, items){
			var itemsJson = JSON.stringify(items);
			itemsJson = '{"matches" : ' + itemsJson + '}';
			res.status(200).send(itemsJson)
		});
	});
};


/*
 *
 *
 */
exports.deleteUser = function(req, res) {
	var userId = req.params.userId;
	var user = req.body;
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: userId}}, function(err, item){
			if(err){
				res.sendStatus(404);
			}else{
				bcrypt.compare(user.pw, item.pw, function(error, isMatch){
					if(isMatch){
						collection.remove({'userId': userId}, function(err, result){
							if(err){
								res.sendStatus(409);
							}else{
								res.sendStatus(204);
							}
						});
					}else{
						res.sendStatus(409);
					}
				});
			}
		});
	});
}


/*
 * forgot password
 *
 */
exports.forgotPassword = function(req, res){
	var userId = req.params.userId;
	var user = req.body;
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: userId}}, function(err, item){
		
		 	var newPw =  crypto.randomBytes(8).toString('hex');

			var mailOptions = {
				from: 'pdmchess-Support <pdmchess@gmail.com>',
				to: item.email,
				subject: 'Your password has been reset!',
				text: 'Hi ' + userId + ', this is your temporary password: ' + newPw
			};

			transporter.sendMail(mailOptions, function(error, info){
				bcrypt.genSalt(10, function(err, salt){
					bcrypt.hash(newPw, salt, function(err, hash){
						collection.update({'userId': userId}, {$set: {'pw': hash}}, function(err, result){
							if(err){
								res.sendStatus(409);
							}else{
								res.sendStatus(200);
							}
						});
					});
				});
			});
		});
	});
}


/*
 * change password
 * 
 */
exports.changePassword = function(req, res){
	var userId = req.params.userId;
	var user = req.body;
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: userId}}, function(err, item){
			if(item != null){
				bcrypt.compare(user.oldpw, item.pw, function(error, isMatch){
					if(isMatch){
						bcrypt.genSalt(10, function(err, salt){
							bcrypt.hash(user.newpw, salt, function(err, hash){
								collection.update({'userId': {$eq: userId}}, {$set: {'pw': hash}}, function(err, result){
									res.sendStatus(200);
								});
							});
						});
					}else{
						res.sendStatus(409);
					}	
				});
			}else{
				res.sendStatus(404);
			}
		});
	});
}


/*
 * move
 *
 */
exports.move = function(req, res){
	var match = req.body;
	db.collection('matches', function(err, collection) {
		collection.update({'matchId': {$eq: match.matchId}},{'matchId': match.matchId, 'user1': match.user1, 'user2': match.user2, 'moves': match.moves}, function(err, result){
			if(err){
				res.sendStatus(404);
			}else{
				res.sendStatus(200);
			}
		});
	});	
}

/*
exports.pgnToMoves = function(req, res){

}

exports.movesToPgn = function(req, res){

}
*/
