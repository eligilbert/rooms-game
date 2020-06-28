// required modules
const mysql = require('mysql2');
var express = require('express');
var app = express();
var serv = require('http').Server(app);
var io = require('socket.io')(serv, {});
var bots = require('./bots.js');
// var sizeof = require('object-sizeof');

// connect to index.html
app.get('/',function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

// import gameplay.js, images, etc
app.use(express.static(__dirname + '/static'));
app.use(express.static(__dirname + '/images'));

// set up server (for Heroku)
if(process.env.PORT !== undefined) {
    serv.listen(process.env.PORT);
    console.log("Server started on port ".concat(process.env.PORT));
} else {
    // set up server (local)
    serv.listen(8080);
    console.log("Local server started on port 8080");
}

// create mysql2 connection pools
const receive = mysql.createPool({host:'classnote.cctd6tsztsfn.us-west-1.rds.amazonaws.com', user: 'classnote', password: 'macklineli', database: 'ClassNoteDB'});
const send = mysql.createPool({host:'classnote.cctd6tsztsfn.us-west-1.rds.amazonaws.com', user: 'classnote', password: 'macklineli', database: 'ClassNoteDB'});
const cleanup_pool = mysql.createPool({host:'classnote.cctd6tsztsfn.us-west-1.rds.amazonaws.com', user: 'classnote', password: 'macklineli', database: 'ClassNoteDB'});
const bots_pool = mysql.createPool({host:'classnote.cctd6tsztsfn.us-west-1.rds.amazonaws.com', user: 'classnote', password: 'macklineli', database: 'ClassNoteDB'});

// local variables to remember data
let players = [];
let player_data = [];
let rooms_data = [];
let shots_data = [];

// let data_sent_amount = 0;
// let start_time = new Date().getTime();

// when the player sends data
io.sockets.on('connection', function(socket){
    // normal data send
    socket.on('meData', function(data) {
        if(!players.includes(data.id)) { // first transmition from player?
            let i = "INSERT INTO rooms_players (player_id, name, channel, skin, shield_on, pos_x, pos_y, room_x, room_y) VALUES (\'";
            i = i.concat(data.id, "\', \'", data.name, "\', 1, \'", data.skin, "\', false, ", data.pos_x, ", ", data.pos_y, ", ", data.room_x, ", ", data.room_y, ");");
            receive.query(i);
            players.push(data.id);
            console.log(">> ".concat(data.name, "#", data.id, " joined"));
            bots.data.newBots(player_data, bots_pool); // create new bots if needed
        } else { // normal update
            let q = 'UPDATE rooms_players SET room_x = ';
            q = q.concat(data.room_x);
            q = q.concat(", room_y = ", data.room_y);
            q = q.concat(", pos_x = ", data.pos_x);
            q = q.concat(", pos_y = ", data.pos_y);
            q = q.concat(", shield_on = ", data.shield_on);
            q = q.concat(", skin = \'", data.skin, "\'");
            q = q.concat(" WHERE channel = 1 AND player_id = ", data.id, ";");
            receive.query(q);

            // if the player is taking a new room
            if (data.new.hasOwnProperty("room")) {
                for (let r_id in data.new["room"]) {
                    let room = data.new["room"][r_id];
                    let r = "UPDATE rooms_rooms SET owner_id = \'";
                    r = r.concat(data.id);
                    r = r.concat("\' WHERE room_x = ", room.x, " AND room_y = ", room.y);
                    r = r.concat(" AND channel = 1;");
                    receive.query(r);
                }
            }

            // if the player just shot
            if (data.new.hasOwnProperty("shot")) {
                let s = "INSERT INTO rooms_shots (owner, origin_room_x, origin_room_y, origin_pos_x, origin_pos_y, theta, shot_time, channel) VALUES (\'";
                s = s.concat(data.id, "\', ", data.new.shot.rx, ", ", data.new.shot.ry, ", ");
                s = s.concat(data.new.shot.px, ", ", data.new.shot.py, ", ", data.new.shot.th, ", ");
                s = s.concat(data.new.shot.time, ", 1);");
                receive.query(s);
            }
        }
    });
    // if the client has asked for termination
    socket.on('killMe', function(player_id) {
        let d = "DELETE FROM rooms_players WHERE player_id = ".concat(player_id[0], ";");
        receive.query(d);
        let r = "UPDATE rooms_rooms SET owner_id = ".concat(player_id[3], " WHERE owner_id = ", player_id[0], ";");
        receive.query(r);
        if(player_id[3] !== "NULL") {
            console.log("<< ".concat(player_id[1], "#", player_id[0], " was ", player_id[2], " by ", player_id[4]))
        } else {
            console.log("<< ".concat(player_id[1], "#", player_id[0], " was ", player_id[2]))
        }
    });
});

// get relevant data from mysql table and send in JSON
let duration = 100;
let prev_rooms_results = {};
function sendData() {
    // player data
    const pre_query = new Date().getTime();
    send.query('SELECT * FROM rooms_players WHERE channel = 1;', function (err, results, fields) {
        io.sockets.emit('sendingPlayerData', results);
        player_data = results;
    });
    // rooms data
    send.query('SELECT * FROM rooms_rooms WHERE channel = 1 AND owner_id IS NOT NULL;', function (err, results, fields) {
        let results_to_send = {};
        for(let result in results) {
            if(!prev_rooms_results.hasOwnProperty(result)) {
                results_to_send[result] = results[result];
            } else if(results[result] !== prev_rooms_results[result]) {
                results_to_send[result] = results[result];
            }
        }
        io.sockets.emit('sendingRoomData', results_to_send);
        prev_rooms_results = results;
        rooms_data = results;
    });
    // shots data
    let border_time = new Date().getTime() - 3000;
    send.query('SELECT * FROM rooms_shots WHERE channel = 1 AND shot_time > '.concat(border_time, ';'), function (err, results, fields) {
        io.sockets.emit('sendingShotsData', results);
        let post_query = new Date().getTime();
        duration = post_query - pre_query;
        shots_data = results;
    });

    // FIXME to save the server don't run this when no players are on... not sure how to do this yet
    bots.data.updateBots(player_data, rooms_data, shots_data, bots_pool);

    // uses dynamic timeout rather than interval to fix backlogging
    setTimeout(sendData, duration + 10);
}
sendData();

function cleanup() {
    // delete shots older than 3 seconds
    let border_time = new Date().getTime() - 3000;
    cleanup_pool.query('DELETE FROM rooms_shots WHERE shot_time < '.concat(border_time, ";"));
}

// clean up only executes once a second
setInterval(cleanup, 1000);
