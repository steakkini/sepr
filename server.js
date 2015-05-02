/* -----------------------------------------
 * ---- SEPR Summer 2015 Nodejs Server -----
 * ----------------------------------------- */

var express = require('express');
var bodyParser = require('body-parser');
var chess = require('./routes/chess');
var node_server = express();

node_server.use(bodyParser.json());
node_server.use(bodyParser.urlencoded({
	extended: true
}));

//interfaces for the clients
node_server.post('/signUp', chess.signUp);
node_server.put('/logIn', chess.logIn);
node_server.put('/logOut', chess.logOut);
node_server.get('/allUsers', chess.allUsers);
node_server.get('/allOnlineUsers', chess.allOnlineUsers);
node_server.post('/newMatch', chess.newMatch);
/*node_server.post('/changeMatchStatus', chess.changeMatchStatus);
node_server.get('/getAllMatches', chess.getAllMatches);
node_server.get('/getMatch', chess.getMatch);
node_server.get('/getMatchByUser', chess.getMatchByUser);
node_server.post('/move', chess.move);
*/

/*
 * TODO
 * passwort vergessen
 * pgn to string
 * string to pgn
 */

//server accessible on specified port
node_server.listen(1337);
console.log('Server lauscht auf Port 1337');
