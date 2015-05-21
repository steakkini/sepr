/* -----------------------------------------
 * ---- SEPR Summer 2015 Nodejs Server -----
 * ----------------------------------------- */

var express = require('express');
var bodyParser = require('body-parser');
var chess = require('./routes/chess');
var node_server = express();
var cors = require('cors');

node_server.use(cors());
node_server.use(bodyParser.json());
node_server.use(bodyParser.urlencoded({
	extended: true
}));

//interfaces for the clients
node_server.post('/users', chess.signUp);
node_server.put('/users/logIn/:userId', chess.logIn);
node_server.put('/users/logOut/:userId', chess.logOut);
node_server.delete('/users/:userId', chess.deleteUser);
node_server.put('/users/forgot/:userId', chess.forgotPassword);
node_server.put('/users/change/:userId', chess.changePassword);
node_server.get('/users', chess.allUsers);
node_server.get('/users/online', chess.allOnlineUsers);
node_server.post('/matches', chess.newMatch);
node_server.put('/matches/:matchId', chess.changeMatchStatus);
node_server.get('/matches', chess.getAllMatches);
node_server.get('/matches/byId/:matchId', chess.getMatch);
node_server.get('/matches/byUser/:userId', chess.getMatchByUser);
node_server.post('/matches/moves', chess.move);
//node_server.post('/moves/pgnToMoves', chess.pgnToMoves);
//node_server.post('/moves/movesToPgn/:matchId', chess.MovesToPgn);

//server accessible on specified port
node_server.listen(1337);
console.log('Server lauscht auf Port 1337');
