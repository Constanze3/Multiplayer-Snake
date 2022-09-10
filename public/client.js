/// <reference path="../TSDef/p5.global-mode.d.ts" />

let socket;
let id;

let roomManager;

let mainMenu;
let ui;
let lobbyMenu;
let gameOverMenu;

let ready = false;

let game;

function setup() {

    roomManager = new RoomManager();

    mainMenu = new MainMenu();
    lobbyMenu = new LobbyMenu();
    ui = new UI();
    gameOverMenu = new GameOverMenu();

    setupSocket("http://multiplayer-snake-production.up.railway.app");

    createCanvas(800, 700);
    frameRate(60);

    mainMenu.draw();

    let settings = document.getElementById("settings");
    if (settings != null) settings.onclick = () => { customizationMenu.setActive(true) };
}

function setupSocket(address) {

    socket = io.connect(address, { withCredentials: true });

    socket.on('connect', () => id = socket.id);

    socket.on("join_room_callback", roomManager.joinRoomCallback);

    socket.on("leave_room_callback", roomManager.leaveRoomCallback);

    socket.on("start_button_click_callback", readyUpCallback);

    socket.on("list_of_ready_players_changed", lobbyMenu.listOfReadyPlayersChanged);

    socket.on("start_game", startGame);

    socket.on("game_data", data => { if (game != null) game.onData(data) });

    socket.on("game_over", gameOver);

    socket.on("test", test);
}

function test(text) {
    alert(text);
}

function startGame() {
    lobbyMenu.clear();
    gameOverMenu.clear();
    game = new Game();
    game.start();
}

function gameOver(data) {
    game.isRunning = false;

    if (data.ownersOfSnakesToBump.length == 0) {
        displayGameOver(data.cause);
    }
    else
        doBump(data.ownersOfSnakesToBump, () => {
            new Promise(resolve => setTimeout(resolve, game.snakeRate + 50)).then(() => {
                game.isBumping = false;
                displayGameOver(data.cause);
            });
        });
}

function displayGameOver(cause) {
    if (cause != "") {
        gameOverMenu.draw(cause == "draw" ? "DRAW" : (cause != id ? "VICTORY" : "DEFEAT"));
        lobbyMenu.draw();
    }
}

function doBump(ownersOfSnakesToBump, callback) {
    game.ownersOfSnakesToBump = ownersOfSnakesToBump;
    game.bumpCallback = callback;
    game.isBumping = true;
}

function draw() {
    if (game == null) return;

    if (game.isBumping) {
        game.drawBump();
        ui.draw();
    }

    if (game.isRunning) {
        game.draw();
        ui.draw();
    }
}

function readyUpCallback(isReady) {
    ready = isReady;
}

class Game {
    constructor() {
        this.mapSize = 35;
        this.squareSize = 700 / this.mapSize;

        this.snakes = [];
        this.apples = [];

        this.points = 0;
        this.enemyPoints = 0;

        this.timer = 0;
        this.snakeRate = 110;

        this.isRunning = false;

        this.ownersOfSnakesToBump = [];
        this.isBumping = false;
        this.bumpCallback;

        this.snakeColor = "#82ff30";
        this.enemySnakeColor = "#304cff";

        this.appleColor = "#ff2424";
    }

    toCanvasSpace = part => ({ x: part.x * this.squareSize, y: part.y * this.squareSize });

    start = () => {
        this.isRunning = true;
    }

    onData = (data) => {
        this.snakes = data.snakes;
        this.apples = data.apples;
        this.timer = 0;
    }

    draw = () => {
        background(0);

        this.timer += deltaTime;

        let lerpAmount = this.timer <= this.snakeRate ? this.timer / this.snakeRate : 1;

        for (let i = 0; i < this.snakes.length; i++) {
            this.drawSnake(this.snakes[i], lerpAmount);
        }

        this.drawApples();
    }

    drawSnake = (snake, lerpAmount) => {
        let body = snake.body.map(this.toCanvasSpace);
        let pastBody = snake.pastBody.map(this.toCanvasSpace);
        let cornersForCorrection = snake.cornersForCorrection.map(this.toCanvasSpace);
        let owner = snake.owner;
        let color;

        if (id == owner) {
            color = this.snakeColor;
            this.points = snake.points;
        }
        else {
            this.enemyPoints = snake.points;
            color = this.enemySnakeColor;
        }

        fill(color); stroke(color); strokeWeight(1);

        for (let j = 0; j < body.length; j++) {
            square(lerp(pastBody[j].x, body[j].x, lerpAmount), lerp(pastBody[j].y, body[j].y, lerpAmount), this.squareSize);
        }

        cornersForCorrection.forEach(corner => square(corner.x, corner.y, this.squareSize));
    }

    drawApples = () => {
        fill(this.appleColor); noStroke();
        this.apples.map(this.toCanvasSpace).forEach(apple => square(apple.x + 1, apple.y * + 1, this.squareSize - 1));
    }

    drawBump = () => {
        background(0);

        this.timer += deltaTime;

        if (this.snakeRate <= this.timer) {
            this.bumpCallback();
        }

        let lerpAmount = this.timer <= this.snakeRate / 2 ? this.timer / this.snakeRate :
            this.timer <= this.snakeRate ? 1 - this.timer / this.snakeRate : 0;

        this.snakes.forEach(snake => {
            if (this.ownersOfSnakesToBump.includes(snake.owner)) {
                this.drawSnake(snake, lerpAmount);
            }
        });

        this.drawApples();
    }
}

function keyPressed() {

    if (keyCode == ENTER) {
        if (mainMenu.active) roomManager.joinRoom();
        if (lobbyMenu.active) lobbyMenu.startButtonClick();
    }

    if (keyCode == BACKSPACE) {
        if (ui.active) roomManager.leaveRoom();
    }

    if (game == null || !game.isRunning) return;
    let input = { x: GetInputAxis("Horizontal"), y: GetInputAxis("Vertical") };
    if (!(input.x == 0 && input.y == 0)) {
        socket.emit("directional_input", input);
    }
}

function GetInputAxis(axis) {
    let KEY = key.toLowerCase();
    switch (axis) {
        case "Horizontal":
            switch (KEY) {
                case 'a':
                    return -1;
                    break;
                case 'd':
                    return 1;
                    break;
            }
            switch (keyCode) {
                case LEFT_ARROW:
                    return -1;
                    break;
                case RIGHT_ARROW:
                    return 1;
                    break;
            }
            return 0;
            break;
        case "Vertical":
            switch (KEY) {
                case 'w':
                    return -1;
                    break;
                case 's':
                    return 1;
                    break;
            }
            switch (keyCode) {
                case UP_ARROW:
                    return -1;
                    break;
                case DOWN_ARROW:
                    return 1;
                    break;
            }
            return 0;
            break;
    }
}

function lerp(x, y, a) {
    return x * (1 - a) + y * a;
}

class RoomManager {
    joinRoom = () => {
        socket.emit("join_room", mainMenu.container.inputField.value());
    }

    joinRoomCallback = success => {
        if (success) {
            mainMenu.clear(0);
            lobbyMenu.draw();
        }
        else {
            mainMenu.drawError("this room is sadly full");
        }
    }

    leaveRoom = () => {
        game = null;
        socket.emit("leave_room");
    }

    leaveRoomCallback = () => {
        lobbyMenu.clear();
        ui.clear();
        gameOverMenu.clear();

        ready = false;

        mainMenu.draw();
    }
}

class OldMenu {
    constructor() {
        this.container = {};
        this.active = false;
    }

    clear = (color) => {
        if (color != null) background(color);
        Object.values(this.container).forEach(element => {
            element.remove();
        });
        this.active = false;
    }
}

class MainMenu extends OldMenu {

    draw = () => {
        this.clear(0);

        

        //logo
        noStroke(); fill("#7bff00"); textSize(110); textStyle(BOLD); textFont("monospace");
        text("MP SNAKE", 113, 193);

        //side menu
        fill("#171717");
        rect(700, 0, 100, 700);

        let settingsButton = createButton("⚙");
        settingsButton.id("settings");
        this.container.settingsButton = settingsButton;

        //input field
        let inputField = createInput();
        inputField.attribute("maxlength", 21);
        inputField.attribute("placeholder", "room name...");
        this.container.inputField = inputField;

        //create/join room button
        let button = createButton("CREATE/JOIN");
        button.mousePressed(roomManager.joinRoom);
        button.attribute("class", "main_menu");
        this.container.button = button;

        this.active = true;
        
    }

    drawError = (error) => {
        noStroke(); fill("#913339"); textSize(25); textStyle(NORMAL); textFont("monospace");
        text(error, 90, 470);
        this.container.inputField.value("");
    }
}

class LobbyMenu extends OldMenu {

    constructor() {
        super();
        this.readyCount = 0;
    }

    draw = () => {
        this.clear();

        ui.draw();

        noStroke();

        //background
        fill("#1c1c1c");
        rect(200, 500, 300, 100);

        //count of ready players
        fill(255); textSize(30); textStyle(BOLD); textFont("monospace");
        text(this.readyCount + "/2", 400, 561);

        //play/cancel button
        let button = !ready ? createButton("PLAY!") : createButton("CANCEL");
        button.mousePressed(this.startButtonClick);
        button.attribute("class", "lobby_menu");
        this.container.button = button;

        this.active = true;
    }

    startButtonClick = () => {
        socket.emit("start_button_click");
    }

    listOfReadyPlayersChanged = (readyClients) => {
        this.readyCount = readyClients.length;
        if (this.active && this.readyCount != 2) this.draw();
    }
}

class UI extends OldMenu {
    draw = () => {
        this.clear()

        noStroke();

        //background
        fill("#171717");
        rect(700, 0, 100, 700);

        textSize(35); textStyle(BOLD);

        //your points
        fill("#82ff30");
        text(this.pointsDisplayText(game ? game.points : 0), 711, 60);

        //enemy points
        fill("#304cff");
        text(this.pointsDisplayText(game ? game.enemyPoints : 0), 711, 120);

        //exit button
        let button = createButton("X");
        button.mousePressed(roomManager.leaveRoom);
        button.attribute("class", "ui");
        this.container.button = button;

        this.active = true;
    }

    pointsDisplayText = points => {
        let p = points.toString();
        let digits = 4;
        return "0".repeat(digits - p.length) + p;
    }
}

class GameOverMenu extends OldMenu {
    draw = (t) => {
        this.clear();

        let text = createDiv(t);
        text.attribute("class", "game_over");
        this.container.text = text;

        this.active = true;
    }
}
