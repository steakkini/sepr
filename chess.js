var mongo = require('mongodb');
var Server = mongo.Server;
var DB = mongo.Db;
var BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new DB('sedb', server);
 
db.open(function(err, db){
	if(!err){
		console.log("Connected to 'sedb' database.");
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
    db.collection('users', function(err, collection) {
    	collection.findOne({'userId': {$eq: user.userId}}, function(err, item){
    		if(item == null){
		        collection.insert(user, {safe:true}, function(err, result) {
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
}


/*
 * logIn
 * takes email and pw of a user as input
 * returns 200 if login successful
 * returns 404 if account not found (due to wrong email or wrong pw)
 */
exports.logIn = function(req, res){
	var user = req.body;
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: user.userId}, 'pw': {$eq: user.pw}}, function(err, item){
			if(item != null){
				collection.update({'userId': {$eq: user.userId}, 'pw': {$eq: user.pw}}, {$set: {'status': 'online'}}, function(err, result){
					res.sendStatus(200);
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
	var user = req.body;
	db.collection('users', function(err, collection) {
		collection.findOne({'userId': {$eq: user.userId}}, function(err, item){
			if(item != null){
				collection.update({'userId': {$eq: user.userId}}, {$set: {'status': 'offline'}}, function(err, result){
					res.sendStatus(200);
				});
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
			var itemsJson = JSON.stringify(items);
			itemsJson = '{"users" : ' + itemsJson + '}';
			res.status(200).send(itemsJson)
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
	var d = new Date();

	var matchId = match.user1 + match.user2 + d.getTime();
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
exports.changeMatchStatus = function(req, res){

};

exports.getAllMatches = function(req, res){

};
/*
exports.getMatch = function(req, res){

};

exports.getMatchByUser = function(req, res){

};

exports.move = function(req, res){

};
*/
