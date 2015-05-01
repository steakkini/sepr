/* -----------------------------------------
 * ---- SEPR Summer 2015 Nodejs Server -----
 * ----------------------------------------- */

var express = require('express');
var chess = require('./routes/chess');
var node_server = express();

node_server.configure(function () {
    node_server.use(express.logger('dev')); //'default', 'short', 'tiny', 'dev'
    node_server.use(express.bodyParser());
});

//interface for the clients
node_server.put('/signUp', chess.signUp);
node_server.post('/logIn', chess.logIn);
node_server.post('/logOut', chess.logOut);
node_server.get('/getAllUsers', chess.getAllUsers);
node_server.get('/getAllOnlineUserrs', chess.getAllOnlineUserrs);
node_server.post('/newMatch', chess.newMatch);
node_server.post('/changeMatchStatus', chess.changeMatchStatus);
node_server.get('/getAllMatches', chess.getAllMatches);
node_server.get('/getMatch', chess.getMatch);
node_server.get('/getMatchByUser', chess.getMatchByUser);
node_server.post('/move', chess.move);


//server accessible on specified port
node_server.listen(80);
console.log('Server lauscht auf Port 80');
