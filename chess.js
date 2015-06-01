/*
 * DB stuff
 */
var mongo = require('mongodb'),
	BSON = mongo.BSONPure,
	Server = mongo.Server,
	server = new Server('localhost', 27017, {auto_reconnect: true}),
	DB = mongo.Db,
	db = new DB('sedb', server),

	/*
	 * requiring packet and credentials for mailing
	 */
	nodemailer = require('nodemailer'),
	mailcreds = require('./../mailcreds'),
	
	/*
	 * crypto stuff
	 */
	bcrypt = require('bcrypt'),
	crypto = require('crypto');
 	
	
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

    if(user.pw === user.pw2){
		db.collection('users', function(err, collection) {
	    	collection.findOne({'userId': {$eq: user.userId}}, function(err, item){		
	    		if(item == null){
			      	bcrypt.genSalt(10, function(err, salt){
	    				bcrypt.hash(user.pw, salt, function(err, hash){
	   	 					user.pw = hash; 
					        collection.insert({'userId': user.userId, 'pw': user.pw, 'email': user.email, 'status': 'online'}, {safe:true}, function(err, result) {
					        	if(err){
					        		res.sendStatus(409);
					        	}else{
					        		res.sendStatus(201);
					        	}
					        });
				  		});
	  				});
				}else{
					res.sendStatus(409);
				}

    		});
		});
	}else{
		res.sendStatus(409);
	}

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'signup', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});
}


/*
 * logIn
 * takes email and pw of a user as input
 * returns 204 if login successful
 * returns 404 if account not found (wrong email or wrong pw)
 */
exports.logIn = function(req, res){

	var userId = req.params.userId;
	var user = req.body;
	
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: userId}}, function(err, item){
			if(item != null){
				bcrypt.compare(user.pw, item.pw, function(error, isMatch){
					if(isMatch){
						collection.update({'userId': {$eq: userId}}, {$set: {'status': 'online'}}, function(err, result){
							res.sendStatus(204);
						});
					}else{
						res.sendStatus(404);
					}
				});
			}else{
				res.sendStatus(404);
			}
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'login', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
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
	db.collection('users', function(err, collection) {	
		collection.findOne({'userId': {$eq: userId}}, function(err, item){	
			if(item == null){
				res.sendStatus(404);
			}else{
				collection.update({'userId': {$eq: userId}}, {$set: {'status': 'offline'}}, function(err, result){
					if(!err){
						res.sendStatus(204);
					}else{
						res.sendStatus(404);
					}
				});
			}
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'logout', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
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

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'allUsers', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
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
		if(!err){
			collection.find({'status': {$eq: 'online'}},{'_id': 0, 'userId': 1}).toArray(function(err, items){
				if(!err){
					var itemsJson = JSON.stringify(items);
					itemsJson = '{"users" : ' + itemsJson + '}';
					res.status(200).send(itemsJson)
				}else{
					res.sendStatus(409);
				}
			});
		}else{
			res.sendStatus(409);
		}
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'allOnlineUsers', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
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
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: match.user1}}, function(err, item){ 
			if(item != null){
				collection.findOne({'userId': {$eq: match.user2}}, function(err, item){
					if(item != null){
						var matchId = match.user1 + '_' + match.user2 + '_' + crypto.randomBytes(8).toString('hex');
						db.collection('matches', function(err, collection) {
							collection.insert({'matchId': matchId, 'user1': match.user1, 'user2': match.user2, 'type': match.type, 'status': 0}, function(err, item){
								if (!err) {							
									res.status(201).send(matchId);
							    }else{
							    	res.sendStatus(409);
							    }
							});
						});
					}else{
						res.sendStatus(404);	
					}
				});
			}else{
				res.sendStatus(404);
			}
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'newMatch', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});
};


/*
 * change match status
 *
 */
exports.changeMatchStatus = function(req, res){
	var matchId = req.params.matchId;

	db.collection('matches', function(err, collection) {
		collection.findOne({'matchId': {$eq: matchId}}, function(err, item){ 								
			if(item != null){
				collection.update({'matchId': {$eq: matchId}}, {$set: {'status': req.body.status}}, function(err, result){
					res.sendStatus(200);
				});
			}else{
				res.sendStatus(404);
			}
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'changeMatchStatus', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
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
		collection.find({},{'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1, 'type': 1}).toArray(function(err, items){
			var itemsJson = JSON.stringify(items);
			itemsJson = '{"matches" : ' + itemsJson + '}';
			res.status(200).send(itemsJson)
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'getAllMatches', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
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
		collection.findOne({'matchId': {$eq: matchId}},{'_id': 0} ,function(err, item){
			if(item != null){
				var itemsJson = JSON.stringify(item);
				res.status(200).send(itemsJson)
			}else{
				res.sendStatus(404);
			}
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'getMatchById', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});
};


/*
 * get match by userId
 *
 */
exports.getMatchByUser = function(req, res){
	var userId = req.params.userId;
	var status = req.body.status;
	
	if(status == null){
		console.log('status is null');
		db.collection('matches', function(err, collection){
			collection.find({'user1': {$eq: userId}},{'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1}).toArray(function(err, items){
				if(!err){
					var itemsJson = JSON.stringify(items);
					itemsJson = '{"matches" : ' + itemsJson + '}';
					res.status(200).send(itemsJson);
				}else{
					res.sendStatus(409);
				}
			});
		});
	}else{
		db.collection('matches', function(err, collection){
			collection.find({'user1': {$eq: userId}, 'status': {$eq: status}},{'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1}).toArray(function(err, items){
				if(!err){
					var itemsJson = JSON.stringify(items);
					itemsJson = '{"matches" : ' + itemsJson + '}';
					res.status(200).send(itemsJson);
				}else{
					res.sendStatus(409);
				}
			});
		});
	}

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'getMatchByUser', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});
};


/*
 * delete user
 *
 */
exports.deleteUser = function(req, res) {
	var userId = req.params.userId;
	var user = req.body;

	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: userId}}, function(err, item){
			if(item == null){
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

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'deleteUser', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
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
		
			if(item != null){
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
			}else{
				res.sendStatus(404);
			}
		});
	});

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'forgotPassword', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
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

	if(user.newpw === user.newpw2){
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
	}else{
		res.sendStatus(409);
	}

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'changePassword', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});
};


/*
 * move
 *
 */
exports.move = function(req, res){
	var match = req.body;

	db.collection('matches', function(err, collection) {
		collection.findOne({'matchId': {$eq: match.matchId}},function(err, item){
			if(item != null){
				collection.update({'matchId': {$eq: match.matchId}},{'matchId': match.matchId, 'user1': match.user1,'user2': match.user2, 'moves': match.moves}, function(err, result){
					if(err){
						res.sendStatus(409);
					}else{
						collection.findOne({'matchId': {$eq: match.matchId}},{'_id': 0}, function(err, item){
							if(err){
								res.sendStatus(409);
							}else{
								var itemJson = JSON.stringify(item);
								res.status(200).send(item);
							}
						});
					}
				});
			}else{
				res.sendStatus(404);
			}
		});
	});	

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'move', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});
}

/*
exports.pgnToMoves = function(req, res){

	db.collection('logs', function(err, collection){
		collection.insert({'date': Date(), 'origin': req.connection.remoteAddress, 'destination': 'pgnToMoves', 'headers': req.headers, 'body': req.body}, function(err, result){
			if(err){
				console.log(err);
			}
		});
	});

}

exports.movesToPgn = function(req, res){
	var moves=req.body;
	var out="";
	// Annahme moves.length = 2 * N --> andernfalls NPE 
	for(var cnt=0; cnt < moves.length;cnt++){
		out += (cnt/2+1)+".";
		//1. spieler
		switch(moves[cnt].figure){
		case "pawn":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].startCol+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0";
			}
		break;
		case "king":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;
		case "queen":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}	
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;

		case "bishop":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;
			
		case "kight":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}	
		case "rook":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "castling"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R" moves[cnt].endCol+moves[cnt].endRow+"+ ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;					
		default:
			res.sendStatus(404);
		break;
		}	
		//2. spieler
		cnt++;
		switch(moves[cnt].figure){
		case "pawn":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].startCol+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0";
			}
		break;
		case "king":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-K" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;
		case "queen":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}	
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-Q" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;

		case "bishop":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-B" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;
			
		case "kight":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-N" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}	
		case "rook":
			if(moves[cnt].info == "normal"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "capture"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
			}
			if(moves[cnt].info == "check"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R" moves[cnt].endCol+moves[cnt].endRow+"! ";
			}
			if(moves[cnt].info == "castling"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R" moves[cnt].endCol+moves[cnt].endRow+"+ ";
			}
			if(moves[cnt].info == "check mate"){
				moves += moves[cnt].startCol+moves[cnt].startRow +"-R" moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
			}
		break;					
		default:
			res.sendStatus(404);
		break;
		}					
	}
	// wenn alle Züge durch iteriert worden sind, wird die konstruierte PGN abgesendet.
	res.status(200).send(out);
}
