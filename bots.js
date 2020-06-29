// this is a big project that needs to be done but will take a while
// make sure that it doesn't lag the server too much also!
// all bots will be controlled from here

let methods = {};

function getScore(id, rooms) {
    let s = 0;
    for(let r in rooms) {
        if(rooms[r] === id) {
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

function move(me, players, rooms, strategy, pool, score) {
    // FIXME can go through walls
    let new_px, new_py, new_rx, new_ry;
    let closest = {x: 15, y: 15};
    if(strategy === "room") {
        // find a room to move towards that i don't own
        // first check the room i'm in
        if(rooms["(".concat(me.room_x, ",", me.room_y, ")")] !== me["player_id"]) {
            closest = {x: me.room_x, y: me.room_y};
        } else { // now check other rooms
            let i = -1;
            while(i <= 1) {
                let j = -1;
                while(j <= 1) {
                    if(rooms["(".concat(me.room_x+i, ",", me.room_y+j, ")")] !== me["player_id"] && Math.abs(i + j) === 1) {
                        closest = {x: me.room_x + i, y: me.room_y + j};
                    }
                    j++;
                }
                i++;
            }
        }
        if(closest.x < 0 || closest.x > 29 || closest.y < 0 || closest.y > 29) {
            closest = {x: 15, y: 15};
        }

        // move towards the nearest room center
        let delta = (4.5 - score / 20);
        let dx = me.room_x*100+me.pos_x-closest.x*100-50;
        let dy = me.room_y*100+me.pos_y-closest.y*100-50;
        new_px = me.pos_x;
        new_py = me.pos_y;
        if(Math.abs(dx) > delta / 2) {
            new_px -= delta * Math.sign(dx);
        }
        if(Math.abs(dy) > delta / 2) {
            new_py -= delta * Math.sign(dy);
        }
        new_rx = me.room_x;
        new_ry = me.room_y;

    } else if(strategy === "person") {
        // move towards the nearest person
        let closest = me;
        let closest_distance = -1;
        for(let p in players) {
            let player = players[p];
            if(me.player_id !== player.player_id) {
                let d = distance(player.room_x*100+player.pos_x, player.room_y*100+player.pos_y, me.room_x*100+me.pos_x, me.room_y*100+me.pos_y);
                if(d < closest_distance || closest_distance < 0) {
                    closest_distance = d;
                    closest = player;
                }
            }
        }

        let delta = (4.5 - score / 20);
        let dx = me.room_x*100+me.pos_x-closest.room_x*100-closest.pos_x;
        let dy = me.room_y*100+me.pos_y-closest.room_y*100-closest.pos_y;
        new_px = me.pos_x;
        new_py = me.pos_y;
        if(Math.abs(dx) > 25) {
            new_px -= delta * Math.sign(dx);
        }
        if(Math.abs(dy) > 25) {
            new_py -= delta * Math.sign(dy);
        }
        new_rx = me.room_x;
        new_ry = me.room_y;
    }

    // if passes room boundary
    if(new_px > 100) {
        new_rx++;
        new_px-=100;
    } else if(new_px < 0) {
        new_rx--;
        new_px+=100;
    }
    if(new_py > 100) {
        new_ry++;
        new_py-=100;
    } else if(new_py < 0) {
        new_ry--;
        new_py+=100;
    }

    // push new position to DB
    if(strategy !== "camp") {
        let q = "UPDATE rooms_players SET room_x = ".concat(new_rx,", room_y = ", new_ry, ", pos_x = ", new_px, ", pos_y = ", new_py, " WHERE player_id = \'", me.player_id, "\';");
        pool.query(q);
    }
    // claim room if near center
    if(distance(50, 50, new_px, new_py) < 16 && rooms["(".concat(me.room_x, ",", me.room_y, ")")] !== me.player_id) {
        let q = "UPDATE rooms_rooms SET owner_id = \'".concat(me.player_id,"\' WHERE room_x = ", new_rx, " AND room_y = ", new_ry, " AND channel = 1;")
        pool.query(q);
    }
}

function shoot(me, players, strategy, pool) {
    // shoot a player who is in the same room
    for(let p in players) {
        let player = players[p];
        if(player.player_id !== me.player_id && player.room_x === me.room_x && player.room_y === me.room_y) {
            // restrict to ~1/sec
            if(new Date().getTime() % 1000 < 100) {
                let dx = me.pos_x - player.pos_x;
                let dy = me.pos_y - player.pos_y;
                let theta = Math.atan(dx/(dy+0.001));
                let shot = {
                    "rx": me.room_x,
                    "ry": me.room_y,
                    "px": me.pos_x,
                    "py": me.pos_y,
                    "th": theta,
                    // shot delay for players is 300ms but 370ms for bots to account for ~50ms client-server latency that is not present in the bot script
                    "time": (new Date().getTime() + 370)};
                // log shot to DB
                let s = "INSERT INTO rooms_shots (owner, origin_room_x, origin_room_y, origin_pos_x, origin_pos_y, theta, shot_time, channel) VALUES (\'";
                s = s.concat(me.player_id, "\', ", shot.rx, ", ", shot.ry, ", ");
                s = s.concat(shot.px, ", ", shot.py, ", ", shot.th, ", ");
                s = s.concat(shot.time, ", 1);");
                pool.query(s);
                // only one player can be shot per iter
                break;
            }
        }
    }
}

function check_collisions(me, players, shots, pool, rooms, score) {
    for(let s in shots) {
        let shot = shots[s];
        let age = new Date().getTime() - shot["shot_time"];
        let shot_x = shot["origin_pos_x"] + Math.sin(shot["theta"]) * age / 4.5 + shot["origin_room_x"] * 100;
        let shot_y = shot["origin_pos_y"] + Math.cos(shot["theta"]) * age / 4.5 + shot["origin_room_y"] * 100;
        if(shot["owner"] === me.player_id) {
            // take rooms
            for(let p in players) {
                let player = players[p];
                if(distance(player.room_x*100+player.pos_x, player.room_y*100+player.pos_y, shot_x, shot_y) < 10 && !player.shield_on && player.player_id !== me.player_id) {
                    let xr = 0;
                    let yr = 0;
                    let n = 0;
                    while (xr < 30) {
                        while (yr < 30) {
                            if (rooms["(".concat(xr, ",", yr, ")")] === player.player_id) {
                                let r = "UPDATE rooms_rooms SET owner_id = \'";
                                r = r.concat(me.player_id);
                                r = r.concat("\' WHERE room_x = ", xr, " AND room_y = ", yr);
                                r = r.concat(" AND channel = 1;");
                                pool.query(r);
                                n++;
                                if(n > score/6){
                                    break;
                                }
                            }
                            yr++;
                        }
                        yr = 0;
                        xr++;
                        if(n > score/6) {
                            break;
                        }
                    }
                }
            }
        } else {
            // kill me if I get shot by someone else 10x bigger
            if(distance(me.room_x*100+me.pos_x, me.room_y*100+me.pos_y, shot_x, shot_y) < 10) {
                console.log(getScore(shot["owner"], rooms));
                if(getScore(shot["owner"], rooms) > 10*score) {
                    // kill me
                    let d = "DELETE FROM rooms_players WHERE player_id = ".concat(me.player_id, ";");
                    pool.query(d);
                    let r = "UPDATE rooms_rooms SET owner_id = ".concat(shot["owner"], " WHERE owner_id = ", me.player_id, ";");
                    pool.query(r);
                    console.log("<< Bot ".concat(me.name, "#", me.player_id, " was killed by #", shot["owner"]))
                }
            }
        }
    }
    // TODO keep list of used shots or something
}

methods.updateBots = function(players, rooms, shots, pool) {
    let rooms_clean = {};
    for(let room in rooms) {
        let rd = rooms[room];
        let room_coord = "(".concat(rd.room_x, ",", rd.room_y, ")");
        rooms_clean[room_coord] = rd["owner_id"];
    }

    for(let p in players) {
        if(players[p]["is_bot"]) {
            let player = players[p];
            let myScore = getScore(player["player_id"], rooms);
            let strategy;
            if(myScore < 20) {
                strategy = "room";
            } else if(myScore > 250) {
                strategy = "camp";
            } else {
                strategy = "person";
            }
            move(player, players, rooms_clean, strategy, pool, myScore);
            shoot(player, players, strategy, pool);
            check_collisions(player, players, shots, pool, rooms_clean, myScore);
        }
    }
};

methods.newBots = function(players, pool) {
    // make new bots when necessary
};

exports.data = methods;
