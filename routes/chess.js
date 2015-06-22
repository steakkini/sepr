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
	mailcreds = require('./mailcreds'),
	
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
    
    if (user.userId	!= "" && 
    	user.pw 	!= "" &&
    	user.pw2 	!= "" &&
    	user.email 	!= "" &&
    	user.pw === user.pw2){
   
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
};


/*
 * newMatch
 * creates a new match
 * takes id's of user1 and user2 als input
 * returns matchId (user1.id+user2.id+date in milliseconds)
 */
exports.newMatch = function(req, res){

	var match = req.body;
	var moves = [];
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: match.user1}}, function(err, item){ 
			if(item != null){
				collection.findOne({'userId': {$eq: match.user2}}, function(err, item){
					if(item != null){
						var matchId = match.user1 + '_' + match.user2 + '_' + crypto.randomBytes(8).toString('hex');
						db.collection('matches', function(err, collection) {
							collection.insert({'matchId': matchId, 'user1': match.user1, 'user2': match.user2, 'type': match.type, 'status': 0, 'moves': moves}, function(err, item){
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
			collection.find({$or: [{'user1': {$eq: userId}}, {'user2': {$eq: userId}}]},{'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1, 'type': 1}).toArray(function(err, items){
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
			collection.find({$and: [{$or: [{'user1': {$eq: userId}}, {'user2': {$eq: userId}}]},{'status': {$eq: status}}]}, {'_id': 0, 'matchId': 1, 'user1': 1, 'user2': 1, 'status': 1, 'type': 1}).toArray(function(err, items){
				if(!err){
					var itemsJson = JSON.stringify(items);
					itemsJson = '{"matches" : ' + itemsJson + '}';
					res.status(200).send(itemsJson);
				}else{
					res.status(409).send("conflict");
				}
			});
		});
	}
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
};


/*
 * move
 *
 */
exports.move = function(req, res){
	var match = req.body;

	db.collection('matches', function(err, collection) {
		collection.findOne({'matchId': {$eq: match.matchId}},function(err, item){
			if(item != null){2 
				collection.update({'matchId': {$eq: match.matchId}},{$push:{'moves': match.moves}}, function(err, result){
					if(err){
						res.sendStatus(409);
					}else{
						collection.findOne({'matchId': {$eq: match.matchId}},{'_id': 0}, function(err, item){
							if(err){
								res.sendStatus(409);
							}else{
								var response = "{'matchId:'" + item.matchId +",'user1':"+ item.user1+ ",'user2':"+ item.user2+ ",'type':" +item.type +",'status':" +item.status+ ",'moves': ["+ JSON.stringify(match.moves)+ "]}'";
								res.status(200).send(response);
							}
						});
					}
				});
			}else{
				res.sendStatus(404);
			}
		});
	});	
}

exports.pgnToMoves = function(req, res){
	var pgn = req.body.pgn.split(".");
	//über alle Doppelzüge iterieren
	var Moves = {
		moves : []
	};
	for(var cnt=1; cnt< pgn.length;cnt++){
		//entfernen der aufzählung am ende des Substrings
		var tmp =pgn[cnt].substring(0, pgn[cnt].length-2);
		// trennen des Doppelzugs in zwei einzel Züge
		var zuge = tmp.split(" ");
		var zuga =zuge[0];
		var zugb;
		if(tmp.length>1){
		 zugb =zuge[1];	
		}
		Moves.moves.push(pgnzToMovesz((cnt*2)-2,zuga,"w"));
		if(tmp.length>1){
		 	Moves.moves.push(pgnzToMovesz(((cnt*2))-1,zugb));	
		}
	}
	res.status(200).send(Moves);
}

function  pgnzToMovesz(nr,pgn,wb){

var	userId="nope";
var	startCol;
var	startRow;
var	endCol;
var	endRow;
var	figure ="pawn";
var	info;		
var comment="nocomment";
var	time="notime";
	figure = "pawn";
	info = "normal";
	if(pgn.indexOf("x") != -1){
		info ="capture";
	}
	if(pgn.indexOf("N") != -1){
		figure = "knight";
	}
	if(pgn.indexOf("K") != -1){
		figure = "king";
	}
	if(pgn.indexOf("Q") != -1){
		figure = "queen";
	}
	if(pgn.indexOf("!") != -1){
		info = "check";
	}
	if(pgn.indexOf("B") != -1){
		figure = "bishop";
	}
	if(pgn.indexOf("R") != -1){
		figure = "rook";
	}
	if(pgn.indexOf("1-0") != -1 || pgn.indexOf("0-1") != -1) {
		info = "check mate"
	}
	if(pgn.indexOf("=Q") != -1){
		info = "transform";
	}
	
	if(figure.equals("pawn")){
		startCol = pgn.charAt(0);
		startRow = pgn.charAt(1);
		endCol = pgn.charAt(3);
		endRow = pgn.charAt(4);
	}else{
		startCol = pgn.charAt(1);
		startRow = pgn.charAt(2);		
		endCol = pgn.charAt(4);
		endRow = pgn.charAt(5);		
	}
	if(pgn.indexOf("o-o") != -1) {
		figure = "king";	
		info = "smallRochade";
		if(wb=="w")	{
			startCol = "d";
			startRow = "1";		
			endCol = "b";
			endRow = "1";				
		}
		else{
			startCol = "d";
			startRow = "8";		
			endCol = "b";
			endRow = "8";		
		}
	}
	if(pgn.indexOf("O-O") != -1) {
		figure = "king";
		info = "bigRochade";
		if(wb=="w")	{
			startCol = "d";
			startRow = "1";		
			endCol = "f";
			endRow = "1";		
		}
		else{
			startCol = "d";
			startRow = "8";		
			endCol = "f";
			endRow = "8";		
		}		
	}
	return  {moveNr:nr, userId:userId, startCol:startCol,startRow:startRow, endCol:endCol, endRow:endRow ,figure:figure,comment:comment,time:time };
}

exports.movesToPgn = function(req, res){
	var matchId = req.params.matchId;

	db.collection('matches', function(err, collection){
		collection.findOne({'matchId': {$eq: matchId}},{'_id': 0} ,function(err, item){
			if(item != null){

				var moves= item.moves;
				var out="";
				


				console.log(moves);
				// Annahme moves.length = 2 * N --> andernfalls NPE 
				
				for(var cnt=0; cnt < moves.length;cnt++){
					out += (cnt/2+1)+".";
					//1. spieler
					switch(moves[cnt].figure){
						case "pawn":
						console.log(moves[cnt].figure + " " + moves[cnt].info);
							if(moves[cnt].info == "normal"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" ";
							console.log(" if");
							}
							if(moves[cnt].info == "capture"){
								out += moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0";
							}
							if(moves[cnt].info == "transform"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"=Q";
							}
						break;
						case "king":
							if(moves[cnt].info == "normal"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-K"+moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
							}
							if(moves[cnt].info == "bigRochade"){
								out +="O-O ";
							}
							if(moves[cnt].info == "smallRochade"){
								out +="o-o ";
							}
						break;
						case "queen":
							if(moves[cnt].info == "normal"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
							}	
							if(moves[cnt].info == "check mate"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
							}
						break;

						case "bishop":
							if(moves[cnt].info == "normal"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
							}
						break;
							
						case "knight":
							if(moves[cnt].info == "normal"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
							}
						break;
								
						case "rook":
							if(moves[cnt].info == "normal"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 1-0 ";
							}
						break;					
						default:
							//res.sendStatus(404);
						break;
					}	
					//2. spieler
					cnt++;
					if(moves.length  > cnt){
					switch(moves[cnt].figure){
						case "pawn":
							if(moves[cnt].info == "normal"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+" 0-1";
							}
							if(moves[cnt].info == "transform"){
								out += moves[cnt].startCol+moves[cnt].startRow +"-"+moves[cnt].endCol+moves[cnt].endRow+"=Q";
							}
						break;
						case "king":
							if(moves[cnt].info == "normal"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-"+"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-" +moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "K"+moves[cnt].startCol+moves[cnt].startRow +"-K" +moves[cnt].endCol+moves[cnt].endRow+" 0-1 ";
							}
							if(moves[cnt].info == "bigRochade"){
								out +="O-O ";
							}
							if(moves[cnt].info == "smallRochade"){
								out +="o-o ";
							}
						break;
						case "queen":
							if(moves[cnt].info == "normal"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+"! ";
							}	
							if(moves[cnt].info == "check mate"){
								out += "Q"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" 0-1 ";
							}
						break;

						case "bishop":
							if(moves[cnt].info == "normal"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"-" +moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "B"+moves[cnt].startCol+moves[cnt].startRow +"-" +moves[cnt].endCol+moves[cnt].endRow+" 0-1 ";
							}
						break;
							
						case "knight":
							if(moves[cnt].info == "normal"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "N"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" 0-1 ";
							}
						break;
						case "rook":
							if(moves[cnt].info == "normal"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "capture"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"x"+ moves[cnt].endCol+moves[cnt].endRow+" ";
							}
							if(moves[cnt].info == "check"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"-"+ moves[cnt].endCol+moves[cnt].endRow+"! ";
							}
							if(moves[cnt].info == "check mate"){
								out += "R"+moves[cnt].startCol+moves[cnt].startRow +"-" +moves[cnt].endCol+moves[cnt].endRow+" 0-1 ";
							}
						break;					
						default:
							//res.sendStatus(404);
						break;
					}		
				}
			}
			// wenn alle Züge durch iteriert worden sind, wird die konstruierte PGN abgesendet.
			res.status(200).send(out);
			}else{
				res.sendStatus(404);
			}
			
		});
	});
}
