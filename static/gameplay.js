// high level constants
const canvas = document.getElementById("gameCanvas");
const DRAW = canvas.getContext("2d");

// initial data framework. later loaded in from server
let JSONData = {};
let dataHasLoaded = false;
JSONData["me"] = {};
JSONData["shots"] = {};
JSONData["rooms"] = {};
JSONData["players"] = {};

// some variables for later use
let shielded = false;
let playing = false;
let scores = {};
let have_collided = [];
let name_input_text = "";

// set canvas dimentions
canvas.width = window.innerHeight + 290;
canvas.height = window.innerHeight - 20;

// load sprites
let red = new Image(); red.src = 'red_circle.png'; red.anchor = "center";
let blue = new Image(); blue.src = 'blue_circle.png'; blue.anchor = "center";
let green = new Image(); green.src = 'green_circle.png'; green.anchor = "center";
let white = new Image(); white.src = 'white_circle.png'; green.anchor = "center";
const circlesDict = {"red": red, "blue": blue, "green": green, "white": white};
let wasd = new Image(); wasd.src = 'wasd.png';
let plus = new Image(); plus.src = 'plus.png'; plus.anchor = "center";
let shield = new Image(); shield.src = 'shield.png'; shield.anchor = "center";
let click = new Image(); click.src = 'mouse_click.png'; click.anchor = "center";
let space = new Image(); space.src = 'spacebar.png'; space.anchor = "center";
let shift = new Image(); shift.src = 'shift.png'; shift.anchor = "center";

// control listeners setup
document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);
document.addEventListener("click", clickHandler, false);

// bools for keys that are pressed down
let wPressed = false;
let aPressed = false;
let sPressed = false;
let dPressed = false;
let shiftPressed = false;

// distance between two points for future use
function distance(x1, y1, x2, y2) {
    let xs = x2 - x1;
    let ys = y2 - y1;

	xs *= xs;
	ys *= ys;

	return Math.sqrt( xs + ys );
}

// get hex color from rgb given by getImageData
function rgbToHex(r, g, b) {
    if (r > 255 || g > 255 || b > 255)
        throw "Invalid color component";
    return ((r << 16) | (g << 8) | b).toString(16);
}

// get rgb color from hex
function hexToRGB(hex) {
    return {
        r: parseInt(hex.substring(1,3),16),
        g: parseInt(hex.substring(3,5),16),
        b: parseInt(hex.substring(5,7),16)
    }
}

// when user presses play
function startGame() {
    let gen_id = "";
    for (let i = 0; i < 4; i++) {
        gen_id = gen_id.concat(Math.floor(Math.random()*10));
    }
    if(JSONData.players.hasOwnProperty(gen_id)) {
        gen_id = "";
        for (let i = 0; i < 4; i++) {
            gen_id = gen_id.concat(Math.floor(Math.random()*10));
        }
    }
    let randomColor = Math.floor(Math.random()*16777215).toString(16);
    const rgb = hexToRGB("#".concat(randomColor))
    if(rgb.r < 20 && rgb.g < 20 && rgb.b < 20) {
        randomColor = "#ffffff";
    }
    JSONData["me"] = {
        "name": name_input_text, // get from text input
        "room_x": Math.floor(Math.random()*26)+2,
        "room_y": Math.floor(Math.random()*26)+2,
        "pos_x": Math.floor(Math.random()*50)+25,
        "pos_y": Math.floor(Math.random()*50)+25,
        "shield_on": false,
        "id": gen_id, // generated id
        "skin": "#".concat(randomColor), // random hex color
        "new": {},
        "is_dead": false
    };
    if(JSONData.me.name === "") {
        JSONData.me["name"] = "unnamed";
    }
    max_score = 0;
    shots_fired = 0;
    playing = true;
}

// when a key is pressed
function keyDownHandler(event) {
    if(event.key === "Shift") {
        shiftPressed = true;
    }
    if(event.keyCode === 87) {
        wPressed = true;
    }
    if(event.keyCode === 65) {
        aPressed = true;
    }
    if(event.keyCode === 83) {
        sPressed = true;
    }
    if(event.keyCode === 68) {
        dPressed = true;
    }
    if(event.keyCode === 32) {
        shielded = true;
        JSONData.me.shield_on = true;
    }

    if(!playing) {
        if(event.key.length === 1 && name_input_text.length < 24 && event.key !== "\'" && event.key !== "\"") {
            name_input_text = name_input_text.concat(event.key);
        } else if(event.key === "Backspace") {
            name_input_text = name_input_text.slice(0,-1);
        } else if(event.key === "Enter") {
            startGame();
        }
    }

    // dev teleportation cheats - delete later - takes you instantly to corners or middle
    if(event.keyCode === 39) {
        JSONData.me.room_x = 29;
    }
    if(event.keyCode === 40) {
        JSONData.me.room_y = 29;
    }
    if(event.keyCode === 38) {
        JSONData.me.room_y = 0;
    }
    if(event.keyCode === 37) {
        JSONData.me.room_x = 0;
    }
    if(event.keyCode === 18) {
        JSONData.me.room_x = 14;
        JSONData.me.room_y = 14;
    }
}

// when a key is unpressed
function keyUpHandler(event) {
    if(event.key === "Shift") {
        shiftPressed = false;
    }
    if(event.keyCode === 87) {
        wPressed = false;
    }
    if(event.keyCode === 65) {
        aPressed = false;
    }
    if(event.keyCode === 83) {
        sPressed = false;
    }
    if(event.keyCode === 68) {
        dPressed = false;
    }
    if(event.keyCode === 32) {
        shielded = false;
        JSONData.me.shield_on = false;
    }
}

// check point inside rectangle
function isInside(pos, rect){
    return pos.x > rect.x && pos.x < rect.x+rect.width && pos.y < rect.y+rect.height && pos.y > rect.y
}

// play button rectangle
const playBtnRect = {
    x: canvas.width / 2 - 70,
    y: canvas.height / 2 + 30,
    width: 140,
    height: 60
};

// name input rectangle
const inputRect = {
    x: canvas.width / 2 - 150,
    y: canvas.height / 2 - 10,
    width: 300,
    height: 30
};

// on click
function clickHandler(event) {
    if(!shielded && playing) { // can't shoot while you have the shield on
        const x = event.clientX;
        const y = event.clientY;
        const dx = x - (canvas.width-310)/2;
        const dy = y - canvas.height/2;
        let theta = Math.atan(dx/dy);
        if(dy < 0) {
            theta = theta + Math.PI;
        }
        JSONData.me["new"]["shot"] = {"rx": JSONData.me.room_x,
                                      "ry": JSONData.me.room_y,
                                      "px": JSONData.me.pos_x,
                                      "py": JSONData.me.pos_y,
                                      "th": theta,
                                      "time": (new Date().getTime() + 300)};
        shots_fired++;
    } else if(!playing && isInside({x: event.clientX, y: event.clientY}, playBtnRect)) {
        startGame();
    }
}

// check if touching walls to stop movement
// referenced in compileUserActions()
// return false allows movement (default), return true when restricted by a wall in that direction
function touchingWallLeft() {
    if(JSONData.me.pos_x<9) {
        if(JSONData.me.pos_y<30 || JSONData.me.pos_y>70 || JSONData.me.room_x === 0) {
            return true;
        }
        isDoorClosed(JSONData.me.room_x, JSONData.me.room_y, "left");
    }
}
function touchingWallRight() {
    if(JSONData.me.pos_x>91) {
        if (JSONData.me.pos_y < 30 || JSONData.me.pos_y > 70 || JSONData.me.room_x === 29) {
            return true;
        }
        isDoorClosed(JSONData.me.room_x, JSONData.me.room_y, "right");
    }
}
function touchingWallUp() {
    if(JSONData.me.pos_y<9) {
        if(JSONData.me.pos_x<30 || JSONData.me.pos_x>70 || JSONData.me.room_y === 0) {
            return true;
        }
        isDoorClosed(JSONData.me.room_x, JSONData.me.room_y, "up");
    }
}
function touchingWallDown() {
    if(JSONData.me.pos_y>91) {
        if (JSONData.me.pos_x < 30 || JSONData.me.pos_x > 70 || JSONData.me.room_y === 29) {
            return true;
        }
        return isDoorClosed(JSONData.me.room_x, JSONData.me.room_y, "down");
    }
}

// check if a given door is closed
function isDoorClosed(room_x, room_y, direction) {
    // TODO check list of closed doors
    // check if at border - kind of works but buggy
    if(room_x < 0 && direction === "left") {return true;}
    else if(room_x > 29 && direction === "right") {return true;}
    else if(room_y < 0 && direction === "up") {return true;}
    else if(room_y > 29 && direction === "down") {return true;}

    return false;
}

// take the user actions and update my data
function compileUserActions() {
    // change position in room
    let delta = 4.5 - scores[JSONData.me.id] / 20;
    if(shiftPressed && delta > 1.5) {
        delta = 1.5;
    } else if(delta < 1) {
        delta = 1;
    }
    if(wPressed && !touchingWallUp() && !shielded) {
        JSONData.me.pos_y -= delta;
    }
    if(aPressed && !touchingWallLeft() && !shielded) {
        JSONData.me.pos_x -= delta;
    }
    if(sPressed && !touchingWallDown() && !shielded) {
        JSONData.me.pos_y += delta;
    }
    if(dPressed && !touchingWallRight() && !shielded) {
        JSONData.me.pos_x += delta;
    }

    // switching between rooms
    if(JSONData.me.pos_y > 100) {
        JSONData.me.room_y++;
        JSONData.me.pos_y -= 100;
    }
    if(JSONData.me.pos_y < 0) {
        JSONData.me.room_y--;
        JSONData.me.pos_y += 100;
    }
    if(JSONData.me.pos_x > 100) {
        JSONData.me.room_x++;
        JSONData.me.pos_x -= 100;
    }
    if(JSONData.me.pos_x < 0) {
        JSONData.me.room_x--;
        JSONData.me.pos_x += 100;
    }

    // if hits middle of one of the rooms, claim in rooms list
    if(distance(JSONData.me.pos_x*4.5, JSONData.me.pos_y*4.5, 225, 225) < 25) {
        JSONData.me.new["room"] = [{x: JSONData.me.room_x, y: JSONData.me.room_y}];
    }
}

// draw the background elements, runs every frame
function drawBackground() {
    // begin path
    DRAW.beginPath();

    // background color
    DRAW.fillStyle = "black";
    DRAW.fillRect(0, 0, canvas.width, canvas.height);
}

function drawAdArea() {
    // black background
    DRAW.fillStyle = "black";
    DRAW.fillRect(canvas.width-310, 311, 310, canvas.height-318);

    // ad area
    DRAW.fillStyle = "#c3c3c3";
    DRAW.fillRect(canvas.width-311, 320, 302, canvas.height-330);

    // title text
    DRAW.fillStyle = "black";
    DRAW.textAlign = "left";
    DRAW.font = "45px Arial";
    DRAW.fillText("Rooms.io", canvas.width-305, 360);
    DRAW.lineWidth = 10;

    // controls tutorial
    DRAW.drawImage(wasd, canvas.width-110, 380, 90, 60);
    DRAW.font = "16px Arial";
    DRAW.fillText("to move", canvas.width-95, 455);
    DRAW.drawImage(click, canvas.width-110, 470, 40, 60);
    DRAW.fillText("to shoot", canvas.width-70, 510);
    DRAW.drawImage(space, canvas.width-115, 535, 100, 30);
    DRAW.fillText("activate shield", canvas.width-115, 580);
    DRAW.drawImage(shift, canvas.width-100, 595, 70, 30);
    DRAW.fillText("slow down", canvas.width-102, 640);

    // leaderboard
    // FIXME leaderboard goes away and exhibits strange behavior sometimes when another player quits
    for(let player in JSONData.players) {
        scores[player] = 0;
        for(let room in JSONData.rooms) {
            if(JSONData.rooms[room] === player) {
                scores[player]++;
            }
        }
    }
    if(scores.hasOwnProperty(JSONData.me.id)) {
        let i = 1;
        let leaderboard = {};
        let leaders = [];
        while(i <= 10) {
            let highest = 0;
            let highest_player = null;
            for(let player in scores) {
                if(scores[player] >= highest && !leaders.includes(player)) {
                    highest_player = player;
                    highest = scores[player];
                }
            }
            if(highest_player !== null && JSONData.players.hasOwnProperty(highest_player)) {
                leaderboard[i] = highest_player;
                leaders.push(highest_player);
            }
            i++;
        }
        for(let i in leaderboard) {
            let player = leaderboard[i];
            DRAW.font = "18px Arial";
            if(player === JSONData.me.id) {
                DRAW.font = "bold 18px Arial";
            }
            DRAW.fillStyle = JSONData.players[player].skin;
            DRAW.fillText("".concat(i, ". ", JSONData.players[player].name, ": ", Math.round(scores[player] / 0.9) / 10, "%"), canvas.width-305, 380+i*20);
            i++;
            if(i > 10) {
                break;
            }
        }
        if(scores[JSONData.me.id] > max_score) {
            max_score = scores[JSONData.me.id];
        }
    }

    // score
    DRAW.fillStyle = "black";
    DRAW.font = "18px Arial";
    DRAW.fillText("Shots Fired: ".concat(shots_fired), canvas.width-305, canvas.height-35);
    DRAW.fillText("Rooms Owned: ".concat(scores[JSONData.me.id]), canvas.width-305, canvas.height-15);
}

// draw the mini reference board on the top right
function drawFullGameBoard() {
    // black background
    DRAW.fillStyle = "black";
    DRAW.fillRect(canvas.width-310, 0, 310, 310);

    // draw tiny grid
    var x = 0;
    var y = 0;
    DRAW.strokeStyle="rgb(104,104,104)";
    DRAW.lineWidth = 2;
    while(x < 30) {
        while(y < 30) {
            DRAW.rect(canvas.width-10-(30-x)*10, 10+y*10, 10, 10); // outline
            y++;
        }
        x++;
        y = 0;
    }
    DRAW.stroke();

    // draw open doors (all doors are open for now)
    var i = 3.5;
    DRAW.fillStyle="black";
    while(i < 304) {
        DRAW.fillRect(canvas.width-305, i, 292, 3);
        DRAW.fillRect(canvas.width-310+i, 13, 3, 295);
        i += 10
    }

    // color in taken rooms (would do together in previous loop but must be after open doors. maybe fix this later?)
    var x = 0;
    var y = 0;
    while(x < 30) {
        while(y < 30) {
            let room_id = "(".concat(x, ",", y, ")");
            if(JSONData.rooms.hasOwnProperty(room_id)) {
                try {
                    DRAW.fillStyle = JSONData.players[JSONData.rooms[room_id]].skin;
                    DRAW.fillRect(canvas.width-10-(30-x)*10+1, 10+y*10-1, 8, 8)
                } catch (e) {
                    console.error(e);
                }

            }
            y++;
        }
        x++;
        y = 0;
    }

    // draw small players
    let players = JSONData["players"];
    for(let id in players) {
        if (players.hasOwnProperty(id)) {
            const player_data = players[id];
            const roomx = canvas.width - 10 - (30 - player_data.room_x) * 10;
            const roomy = 10 + player_data.room_y * 10;
            const internalx = player_data.pos_x;
            const internaly = player_data.pos_y;
            let rgb = hexToRGB(player_data.skin);
            let total = rgb.r + rgb.g + rgb.b;
            DRAW.drawImage(circlesDict["white"], roomx + internalx / 10 - 4, roomy + internaly / 10 - 4, 8, 8);
            DRAW.globalAlpha = rgb.r/total;
            DRAW.drawImage(circlesDict["red"], roomx + internalx / 10 - 4, roomy + internaly / 10 - 4, 8, 8);
            DRAW.globalAlpha = rgb.g/total;
            DRAW.drawImage(circlesDict["green"], roomx + internalx / 10 - 4, roomy + internaly / 10 - 4, 8, 8);
            DRAW.globalAlpha = rgb.b/total;
            DRAW.drawImage(circlesDict["blue"], roomx + internalx / 10 - 4, roomy + internaly / 10 - 4, 8, 8);
            DRAW.globalAlpha = 1;
        }
    }
}

// draw the zoomed in main game screen
function drawLocal() {
    // clear background of local area
    DRAW.beginPath();
    DRAW.fillStyle = "black";
    DRAW.fillRect(0, 0, canvas.width-310, canvas.height);

    // info from me
    const myData = JSONData.me;
    const mySkin = JSONData.me.skin;
    const room_x = JSONData.me.room_x;
    const room_y = JSONData.me.room_y;
    const pos_x = JSONData.me.pos_x;
    const pos_y = JSONData.me.pos_y;
    const midpoint = [(canvas.width-310)/2, canvas.height/2];

    // draw the walls
    // TODO draw closed walls
    let x = -1, y = -1;
    DRAW.font = "Arial 12px";
    while(x < 2){
        while(y < 2) {
            if(0 <= room_x + x && room_x + x <= 29 && 0 <= room_y + y && room_y + y <= 29) {
                let room_id = "(".concat(room_x + x, ",", room_y + y, ")");
                if(JSONData.rooms.hasOwnProperty(room_id)) {
                    DRAW.fillStyle = JSONData.players[JSONData.rooms[room_id]].skin;
                    DRAW.fillRect(midpoint[0]-pos_x*4.5 + 450 * x, midpoint[1]-pos_y*4.5 + 450 * y, 450, 450);
                }
                DRAW.lineWidth = 30;
                DRAW.strokeStyle = "#c3c3c3";
                DRAW.strokeRect(midpoint[0]-pos_x*4.5 + 450 * x, midpoint[1]-pos_y*4.5 + 450 * y, 450, 450);
                DRAW.strokeStyle = "black";
                DRAW.lineWidth = 32;
                // not currently used but this snipped alternates the vertical and horizontal walls like a cat and mouse game
                // if(new Date().getTime() % 2000 < 1000) {
                //     DRAW.strokeRect(midpoint[0]-(pos_x-25)*4.5 + 450 * x, midpoint[1]-pos_y*4.5 + 450 * y, 50*4.5, 0);
                // } else {
                //     DRAW.strokeRect(midpoint[0]-pos_x*4.5 + 450 * x, midpoint[1]-(pos_y-25)*4.5 + 450 * y, 0, 50*4.5);
                // }
                DRAW.strokeRect(midpoint[0]-pos_x*4.5 + 450 * x, midpoint[1]-(pos_y-25)*4.5 + 450 * y, 0, 50*4.5);
                DRAW.strokeRect(midpoint[0]-(pos_x-25)*4.5 + 450 * x, midpoint[1]-pos_y*4.5 + 450 * y, 50*4.5, 0);
                if(JSONData.rooms.hasOwnProperty(room_id)) {
                    DRAW.fillStyle = "black";
                    DRAW.fillText(JSONData.players[JSONData.rooms[room_id]].name, midpoint[0]-pos_x*4.5 + 450 * x + 15, midpoint[1]-pos_y*4.5 + 450 * y + 12);
                }
            }
            y++;
        }
        x++;
        y = -1;
    }

    // draw edge
    DRAW.strokeStyle = "#c32207";
    DRAW.strokeRect(midpoint[0]-room_x*450-pos_x*4.5, midpoint[1]-room_y*450-pos_y*4.5,30*450,30*450);

    // plus for my room
    if(JSONData.rooms["(".concat(room_x, ",", room_y, ")")] !== JSONData.me.id) {
        DRAW.fillStyle = "white";
        DRAW.arc(midpoint[0]-pos_x*4.5+225, midpoint[1]-pos_y*4.5+225, 25, 0, 2*Math.PI);
        DRAW.fill();
        DRAW.drawImage(plus, midpoint[0]-pos_x*4.5+200, midpoint[1]-pos_y*4.5+200, 50, 50);
    }

    // draw the other players
    for(let id in JSONData.players) {
        if (JSONData.players.hasOwnProperty(id)) {
            let player = JSONData.players[id];
            if(-3 < player.room_x-room_x < 3 && -3 < player.room_y-room_y < 3 && id !== myData.id) {
                let dx = midpoint[0] - (room_x - player.room_x) * 450 - (pos_x - player.pos_x) * 4.5 - 22.5;
                let dy = midpoint[1] - (room_y - player.room_y) * 450 - (pos_y - player.pos_y) * 4.5 - 22.5;
                let rgb = hexToRGB(player.skin);
                let total = rgb.r + rgb.g + rgb.b;
                DRAW.drawImage(circlesDict["white"], dx, dy, 45, 45);
                DRAW.globalAlpha = rgb.r/total;
                DRAW.drawImage(circlesDict["red"], dx, dy, 45, 45);
                DRAW.globalAlpha = rgb.g/total;
                DRAW.drawImage(circlesDict["green"], dx, dy, 45, 45);
                DRAW.globalAlpha = rgb.b/total;
                DRAW.drawImage(circlesDict["blue"], dx, dy, 45, 45);
                DRAW.globalAlpha = 1;
                // draw minions
                let th = 0;
                let ring = 1;
                let i = 0;
                for(let room in JSONData.rooms) {
                    if(JSONData.rooms.hasOwnProperty(room)) {
                        if(JSONData.rooms[room] === id) {
                            let d = 27.5 + (ring - 1) * 10;
                            DRAW.drawImage(circlesDict["white"], dx+d*Math.cos(th)-5+22.5, dy+d*Math.sin(th)-5+22.5, 10, 10);
                            DRAW.globalAlpha = rgb.r/total;
                            DRAW.drawImage(circlesDict["red"], dx+d*Math.cos(th)-5+22.5, dy+d*Math.sin(th)-5+22.5, 10, 10);
                            DRAW.globalAlpha = rgb.g/total;
                            DRAW.drawImage(circlesDict["green"], dx+d*Math.cos(th)-5+22.5, dy+d*Math.sin(th)-5+22.5, 10, 10);
                            DRAW.globalAlpha = rgb.b/total;
                            DRAW.drawImage(circlesDict["blue"], dx+d*Math.cos(th)-5+22.5, dy+d*Math.sin(th)-5+22.5, 10, 10);

                            th += Math.PI/8/ring;
                            i++;
                            if(i === 8*ring*2) {
                                ring ++;
                                i = 0;
                            }
                        }
                    }
                }
                // draw shield
                if(player.shield_on) {
                    let t = new Date().getTime();
                    DRAW.globalAlpha = Math.abs(Math.sin(t/800))*0.65+0.15;
                    DRAW.drawImage(shield, dx-18.5, dy-18.5, 80, 80);
                    DRAW.globalAlpha = 1;
                }
                // draw player names
                if(player.name !== "unnamed") {
                    DRAW.fillStyle = "white";
                    // TODO scale text size with name length
                    DRAW.font = "Arial 14px";
                    DRAW.textAlign = "center";
                    DRAW.fillText(player.name, dx + 22.5, dy + 25);
                    DRAW.textAlign = "left";
                }
            }
        }
    }

    // draw minions for me
    let th = 0;
    let ring = 1;
    let i = 0;
    for(let room in JSONData.rooms) {
        if(JSONData.rooms.hasOwnProperty(room)) {
            if(JSONData.rooms[room] === JSONData.me.id) {
                let d = 27.5 + (ring - 1) * 10;
                let rgb = hexToRGB(mySkin);
                let total = rgb.r + rgb.g + rgb.b;
                DRAW.drawImage(circlesDict["white"], midpoint[0]+d*Math.cos(th)-5, midpoint[1]+d*Math.sin(th)-5, 10, 10);
                DRAW.globalAlpha = rgb.r/total;
                DRAW.drawImage(circlesDict["red"], midpoint[0]+d*Math.cos(th)-5, midpoint[1]+d*Math.sin(th)-5, 10, 10);
                DRAW.globalAlpha = rgb.g/total;
                DRAW.drawImage(circlesDict["green"], midpoint[0]+d*Math.cos(th)-5, midpoint[1]+d*Math.sin(th)-5, 10, 10);
                DRAW.globalAlpha = rgb.b/total;
                DRAW.drawImage(circlesDict["blue"], midpoint[0]+d*Math.cos(th)-5, midpoint[1]+d*Math.sin(th)-5, 10, 10);
                DRAW.globalAlpha = 1;
                th += Math.PI/8/ring;
                i++;
                if(i === 8*ring*2) {
                    ring ++;
                    i = 0;
                }
            }
        }
    }

    // draw me
    let rgb = hexToRGB(mySkin);
    let total = rgb.r + rgb.g + rgb.b;
    DRAW.drawImage(circlesDict["white"], midpoint[0]-22.5, midpoint[1]-22.5, 45, 45);
    DRAW.globalAlpha = rgb.r/total;
    DRAW.drawImage(circlesDict["red"], midpoint[0]-22.5, midpoint[1]-22.5, 45, 45);
    DRAW.globalAlpha = rgb.g/total;
    DRAW.drawImage(circlesDict["green"], midpoint[0]-22.5, midpoint[1]-22.5, 45, 45);
    DRAW.globalAlpha = rgb.b/total;
    DRAW.drawImage(circlesDict["blue"], midpoint[0]-22.5, midpoint[1]-22.5, 45, 45);
    DRAW.globalAlpha = 1;

    // draw shield
    if(shielded) {
        let t = new Date().getTime();
        DRAW.globalAlpha = Math.abs(Math.sin(t/800))*0.65+0.15;
        DRAW.drawImage(shield, midpoint[0]-40, midpoint[1]-40, 80, 80);
        DRAW.globalAlpha = 1;
    }

    // draw shots
    DRAW.beginPath();
    for(let shotid in JSONData.shots) {
        let shot = JSONData.shots[shotid];
        if(!have_collided.includes(shot["shot_id"])) {
            const age = new Date().getTime() - shot["shot_time"];
            // x and y of shot from direction and age
            let x = midpoint[0] + shot["origin_pos_x"] * 4.5 + Math.sin(shot["theta"]) * age - JSONData.me.pos_x * 4.5 + (shot["origin_room_x"] - JSONData.me.room_x) * 450;
            let y = midpoint[1] + shot["origin_pos_y"] * 4.5 + Math.cos(shot["theta"]) * age - JSONData.me.pos_y * 4.5 + (shot["origin_room_y"] - JSONData.me.room_y) * 450;
            // check if touching wall
            let d = DRAW.getImageData(x, y, 1, 1).data;
            var hex = rgbToHex(d[0], d[1], d[2]);
            if(hex === "c3c3c3" || hex === "c32207") {
                have_collided.push(shot["shot_id"]);
            }

            // if in screen and older than 0
            if(0 < x < canvas.width && 0 < y < canvas.height && age > 0) {
                // draw shot
                DRAW.lineWidth = 4 + scores[shot["owner"]] / 5;
                DRAW.strokeStyle = JSONData.players[shot["owner"]].skin;
                // FIXME shot from other person renders from reference point of player, as if it is shot by the player, creating a strange movement effect
                let start_x, start_y;
                if(shot["owner"] === JSONData.me.id) {
                    start_x = midpoint[0];
                    start_y = midpoint[1];
                } else {
                    let player = JSONData.players[shot["owner"]];
                    start_x = midpoint[0] - (room_x - player.room_x) * 450 - (pos_x - player.pos_x) * 4.5;
                    start_y = midpoint[1] - (room_y - player.room_y) * 450 - (pos_y - player.pos_y) * 4.5;
                }
                DRAW.moveTo((start_x+x)/2, (start_y+y)/2);
                DRAW.lineTo(x,  y);

                DRAW.stroke();
            }

            if(shot["owner"] !== JSONData.me.id && distance(x, y, midpoint[0], midpoint[1]) < 30 && scores[JSONData.me.id] < scores[shot["owner"]]/10) {
                JSONData.me["is_dead"] = true;
                JSONData.me.killed_me = shot["owner"];
                playing = false;
            }

            // check my bullets collisions
            JSONData.me.new["room"] = [];
            for(let player in JSONData.players) {
                if(player === shot["owner"]) {continue;}
                let p = JSONData.players[player];
                if(distance(x, y, midpoint[0] - (room_x - p.room_x) * 450 - (pos_x - p.pos_x) * 4.5, midpoint[1] - (room_y - p.room_y) * 450 - (pos_y - p.pos_y) * 4.5) < 30) {
                    if(!p["shield_on"]) {
                        let xr = 0;
                        let yr = 0;
                        let n = 0;
                        while (xr < 30) {
                            while (yr < 30) {
                                if (JSONData.rooms["(".concat(xr, ",", yr, ")")] === player) {
                                    if(shot["owner"] === JSONData.me.id) {
                                        JSONData.me.new["room"].push({x: xr, y: yr});
                                    }

                                    n++;
                                    scores[player]--;
                                    if(n > scores[JSONData.me.id]/6){
                                        break;
                                    }
                                }
                                yr++;
                            }
                            yr = 0;
                            xr++;
                            if(n > scores[JSONData.me.id]/6) {
                                break;
                            }
                        }
                    }
                    have_collided.push(shot["shot_id"]);
                }
            }

        }
    }
    DRAW.beginPath();
}

// draw the start screen
function drawPlayButton() {
    // play button
    DRAW.fillStyle = '#c3c3c3';
    DRAW.fillRect(playBtnRect.x, playBtnRect.y, playBtnRect.width, playBtnRect.height);
    DRAW.fillStyle = 'black';
    DRAW.font = "40px Arial";
    DRAW.textAlign = "left";
    DRAW.fillText('Play!', canvas.width/2-43, canvas.height/2+72);

    // draw input for username and color etc.
    DRAW.strokeStyle = '#c3c3c3';
    DRAW.lineWidth = 3;
    DRAW.strokeRect(inputRect.x, inputRect.y, inputRect.width, inputRect.height);
    DRAW.font = "20px Monaco";
    if(name_input_text === '') {
        DRAW.fillStyle = 'rgba(195,195,195,0.42)';
        DRAW.fillText('Type to enter name', inputRect.x+5, inputRect.y+20);
    } else {
        DRAW.fillStyle = '#c3c3c3';
        DRAW.fillText(name_input_text, inputRect.x + 5, inputRect.y + 20);
    }

    // instructions
    DRAW.textAlign = "center";
    DRAW.font = "18px Arial";
    DRAW.fillStyle = "#c3c3c3";
    DRAW.fillText("Claim rooms by shooting other players or touching the center of the room", canvas.width/2, canvas.height/2 + 120);
    DRAW.fillText("Growing will make your shot more powerful and make you bigger but make you slower", canvas.width/2, canvas.height/2 + 140);
    DRAW.fillText("Move: W A S D   Shoot: Click   Shield: Space   Slow down: Shift", canvas.width/2, canvas.height/2 + 160);
}

function drawDeath() {
    DRAW.fillStyle = "white";
    DRAW.textAlign = "center";
    DRAW.font = "36px Arial";
    DRAW.fillText("You Died!", canvas.width/2, canvas.height/2 - 60);
    DRAW.font = "16px Arial";
    DRAW.fillText("".concat("You controlled: ", Math.round(max_score/0.09)/100, "% of the Rooms at your best"), canvas.width/2, canvas.height/2 - 40);
    DRAW.fillText("".concat("Your fired ", shots_fired, " shots"), canvas.width/2, canvas.height/2 - 20);
    DRAW.textAlign = "left";
}

// !!!!! MAIN GAME LOOP !!!!!

// variables used for fps calculation
let lastCalledTime;
let fps;
let delta;

// runs when the browser requests a new frame
window.requestAnimationFrame(mainLoop);
drawBackground();
function mainLoop() {
    drawBackground();
    if(dataHasLoaded && playing) {
        try {
            compileUserActions();
            drawLocal();
            drawFullGameBoard();
            drawAdArea();
        } catch (e) {
            console.error(e);
        }
    }
    if(!playing) {
        drawPlayButton();
    }
    if(JSONData.me.is_dead) {
        drawDeath();
    }

    // check fps, set to true to show fps in top left
    if(true) {
        if(!lastCalledTime) {
            lastCalledTime = performance.now();
            fps = 0;
        }
        delta = (performance.now() - lastCalledTime)/1000;
        lastCalledTime = performance.now();
        fps = 1 / delta;
        if(fps > 55) {
            DRAW.fillStyle = "white";
        } else {
            DRAW.fillStyle = "red";
        }
        DRAW.font = "11px Arial";
        DRAW.fillText(Math.round(fps), 2, 9);
    }

    window.requestAnimationFrame(mainLoop);
}

// !!!!! SERVER STUFF !!!!!

// socket to send data about me to the server
var socket = io();
function meData() {
    if(dataHasLoaded && playing) {
        socket.emit('meData', JSONData.me);
        JSONData.me["new"] = {};
    } else if(!dataHasLoaded) {
        socket.emit('notYetLoaded');
    } else if(JSONData.me.is_dead === true) {
        socket.emit('killMe', [JSONData.me.id, JSONData.me.name, "killed", JSONData.me.killed_me, JSONData.players[JSONData.me.killed_me]["name"].concat("#",JSONData.me.killed_me)]);
        JSONData.me.is_dead = 1;
    }
}

setInterval(meData, 100);

// socket to recieve data from the server
socket.on('sendingPlayerData', function(newData) {
    JSONData["players"] = {};
    for(let player in newData) {
        JSONData["players"][newData[player]["player_id"]] = newData[player];
    }
    dataHasLoaded = true;
});

// socket to recieve room data from server
socket.on('sendingRoomData', function(newData) {
    for(let room in newData) {
        let rd = newData[room];
        let room_coord = "(".concat(rd.room_x, ",", rd.room_y, ")");
        JSONData["rooms"][room_coord] = rd["owner_id"];
    }
});

// socket to recieve shot data from server
socket.on('sendingShotsData', function(newData) {
    JSONData["shots"] = newData;
    // expandShots();
});

// if the user closes the window delete them from the game
window.onbeforeunload = function() {
    if(playing) {
        socket.emit('killMe', [JSONData.me.id, JSONData.me.name, "terminated", "NULL"]);
    }
};
