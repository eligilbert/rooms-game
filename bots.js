// this is a big project that needs to be done but will take a while
// make sure that it doesn't lag the server too much also!
// all bots will be controlled from here

let methods = {};

function getScore(id, rooms) {
    let s = 0;
    for(let r in rooms) {
        if(rooms[r]["owner_id"] === id) {
            s++;
        }
    }
    return s;
}

function distance(x1, y1, x2, y2) {
    let xs = x2 - x1;
    let ys = y2 - y1;

	xs *= xs;
	ys *= ys;

	return Math.sqrt( xs + ys );
}

function move(id, players, rooms, strategy, pool, score) {
    if(strategy === "room") {
        // move towards the nearest room
    } else if(strategy === "person") {
        // move towards the nearest person
    } else if(strategy === "camp") {
        // don't move
    }
    // push data to DB
}

function shoot(id, players, strategy, pool, score) {
    // shoot at the nearest player if there is one in range
    // use rng to make this only happen occasionally (not a constant stream)
}

function check_collisions(id, players, shots, pool) {
    // check collisions of my shots with other players
    // claim rooms
    // check collisions of other shots with me (make sure not to include shots that have already hit things)
    // die
}

methods.updateBots = function(players, rooms, shots, pool) {
    for(let p in players) {
        if(players[p]["is_bot"]) {
            let player = players[p];
            let myScore = getScore(player["id"], rooms);
            let strategy;
            if(myScore < 20) {
                strategy = "room";
            } else if(myScore > 250) {
                strategy = "camp";
            } else {
                strategy = "person";
            }
            move(player["id"], players, rooms, strategy, pool, myScore);
            shoot(player["id"], players, strategy, pool, myScore);
            check_collisions(player["id"], shots, pool);
        }
    }
};

methods.newBots = function(players, pool) {
    // make new bots when necessary
};

exports.data = methods;
