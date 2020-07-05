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

// get rgb color from hex
function hexToRGB(hex) {
    return {
        r: parseInt(hex.substring(1,3),16),
        g: parseInt(hex.substring(3,5),16),
        b: parseInt(hex.substring(5,7),16)
    }
}

function move(me, players, rooms, strategy, pool, score) {
    // FIXME can go through walls
    let new_px, new_py, new_rx, new_ry;
    let closest = {x: 15, y: 15};
    if(strategy === "room") {
        // find a room to move towards that i don't own
        // first check the room i'm in
        let owner_in_room = false;
        for(let p in players) {
            if(players[p]["owner_id"] === rooms["(".concat(me.room_x, ",", me.room_y, ")")]) {
                owner_in_room = true;
                break;
            }
        }
        if(rooms["(".concat(me.room_x, ",", me.room_y, ")")] !== me["player_id"] && !owner_in_room) {
            closest = {x: me.room_x, y: me.room_y};
        } else { // now check other rooms
            let i = -1;
            while(i <= 1) {
                let j = -1;
                while(j <= 1) {
                    let owner = rooms["(".concat(me.room_x+i, ",", me.room_y+j, ")")];
                    if(owner !== me["player_id"] && Math.abs(i + j) === 1 && me.room_x + i <= 29 && me.room_y + j <= 29) {
                        closest = {x: me.room_x + i, y: me.room_y + j};
                    }
                    j++;
                }
                i++;
            }
        }

        // move towards the nearest room center
        let delta = (4.5 - score / 20) / 2;
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

        let delta = (4.5 - score / 20) / 2;
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
            if(Math.random() < 0.08) {
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
                if(getScore(shot["owner"], rooms) > 10*score) {
                    // kill me
                    let d = "DELETE FROM rooms_players WHERE player_id = \'".concat(me.player_id, "\';");
                    pool.query(d);
                    let r = "UPDATE rooms_rooms SET owner_id = \'".concat(shot["owner"], "\' WHERE owner_id = \'", me.player_id, "\';");
                    pool.query(r);
                    console.log("<< Bot ".concat(me.name, "#", me.player_id, " was killed by #", shot["owner"]))
                }
            }
        }
    }
    // TODO keep list of used shots or something right now we consider them to have infinite range
}

methods.updateBots = function(players, rooms, shots, pool) {
    // console.log(new Date().getTime());
    let rooms_clean = {};
    for(let room in rooms) {
        let rd = rooms[room];
        let room_coord = "(".concat(rd.room_x, ",", rd.room_y, ")");
        rooms_clean[room_coord] = rd["owner_id"];
    }

    for(let p in players) {
        if(players[p]["is_bot"]) {
            let player = players[p];
            let myScore = getScore(player["player_id"], rooms_clean);
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
    // make new bots when necessary, called when a player joins
    const names = ["Alice", "Bob", "Cindy", "Dan", "Ellie", "Fred", "Greg", "Hildy", "Ian", "Janet", "Kringle", "Larry", "Mia"];
    if(Object.keys(players).length < 10) {
        let ids = [];
        let i = 0;
        while(i < 10-Object.keys(players).length) {
            let gen_id = "b";
            for (let i = 0; i < 3; i++) {
                gen_id = gen_id.concat(Math.floor(Math.random()*10));
            }
            if(ids.includes(gen_id)) {
                let gen_id = "b";
                for (let i = 0; i < 3; i++) {
                    gen_id = gen_id.concat(Math.floor(Math.random() * 10));
                }
            }
            ids.push(gen_id);
            let randomColor = Math.floor(Math.random()*16777215).toString(16);
            const rgb = hexToRGB("#".concat(randomColor));
            if(rgb.r < 20 && rgb.g < 20 && rgb.b < 20) {
                randomColor = "#ffffff";
            }
            let data = {
                "name": names[Math.floor(Math.random()*names.length)], // get from text input
                "room_x": Math.floor(Math.random()*26)+2,
                "room_y": Math.floor(Math.random()*26)+2,
                "pos_x": Math.floor(Math.random()*50)+25,
                "pos_y": Math.floor(Math.random()*50)+25,
                "id": gen_id, // generated id
                "skin": "#".concat(randomColor), // random hex color
            };
            let c = "INSERT INTO rooms_players (player_id, name, channel, skin, shield_on, pos_x, pos_y, room_x, room_y, is_bot) VALUES (\'";
            c = c.concat(data.id, "\', \'", data.name, "\', 1, \'", data.skin, "\', false, ", data.pos_x, ", ", data.pos_y, ", ", data.room_x, ", ", data.room_y, ", 1);");
            pool.query(c, function(err, results, fields) {
                if(err) {
                    console.log("!! Failed to create a bot");
                }
            });
            console.log(">> Created Bot ".concat(data.name, "#", data.id));
            i++;
        }
    }
};

exports.data = methods;
