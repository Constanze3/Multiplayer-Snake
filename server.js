const { dir } = require("console");
const express = require("express");
const { runInThisContext } = require("vm");
const app = express();
const httpServer = require("http").createServer(app);

const options = {};
const io = require("socket.io")(httpServer, options);

let rooms = [];

const mapSize = 35;
const snakeRate = 100;
const snakeStarts = [
    { position: { x: 3, y: 18 }, direction: { x: 1, y: 0 } },
    { position: { x: 31, y: 18 }, direction: { x: -1, y: 0 } }
];

app.use((req, res, next) => {
    res.set({
        "Access-Control-Allow-Origin": "*"
    });
    next();
});

app.use(express.static("public"));

io.on('connection', (socket) => {
    console.log(`${socket.id} connected`);

    let client = new Client(socket);

    socket.on("join_room", client.joinRoom);

    socket.on("leave_room", client.leaveRoom)

    socket.on("start_button_click", client.startButtonClick);

    socket.on('disconnect', client.disconnect);

    socket.on("directional_input", (input) => { if (client.snake != null) client.snake.setDirection(input) });
});

httpServer.listen(80, () => {
    console.log("server listening on port 3000");
});

class Game {
    constructor(room, players) {
        this.room = room;
        this.players = players;

        this.gameInterval = null;

        this.mapSize = 35;

        this.snakes = [];

        this.appleCount = 2;
        this.apples = [];

        this.goal = 30;
        this.isOver = false;

        this.start();
    }

    start = () => {
        io.in(this.room.name).emit("start_game");

        for (let i = 0; i < this.players.length; i++) {
            this.players[i].cancelReadyUp();

            let snakeStart = snakeStarts[i];
            this.snakes.push(new Snake(this.players[i], snakeStart.position, snakeStart.direction, this));
        }

        for (let i = 0; i < this.appleCount; i++) {
            this.apples.push(this.randomFreePosition());
        }

        this.sendData();

        this.gameInterval = setInterval(this.update, snakeRate);
    }

    update = () => {
        this.snakes.forEach(snake => snake.update());
        this.snakes.forEach(snake => snake.deathCheck());

        if (this.isOver) this.gameOver();

        this.sendData();
        for (let i = 0; i < this.appleCount - this.apples.length; i++) {
            this.apples.push(this.randomFreePosition());
        }
    }

    sendData = () => {
        let data = {};

        data.snakes = [];
        this.snakes.forEach(snake => data.snakes.push({
            owner: snake.owner.socket.id,
            body: snake.body,
            pastBody: snake.pastBody,
            cornersForCorrection: snake.cornersForCorrection,
            points: snake.points
        }));

        data.apples = [];
        this.apples.forEach(apple => data.apples.push(apple));

        io.in(this.room.name).emit("game_data", data);
    }

    randomFreePosition = () => {
        //array of numbered squares
        let squares = Array.from(Array(this.mapSize ** 2).keys());

        this.snakes.forEach(snake => {
            let snakeSquares = snake.body.map(part => { return part.x + part.y * this.mapSize });
            squares = squares.filter(square => { return snakeSquares.indexOf(square) < 0; });
        });

        let appleSquares = this.apples.map(apple => { return apple.x + apple.y * this.mapSize });
        squares = squares.filter(square => { return appleSquares.indexOf(square) < 0; });

        let freeSquare = squares[Math.floor(Math.random() * squares.length)];

        return { x: freeSquare % this.mapSize, y: Math.trunc(freeSquare / this.mapSize) }
    }

    gameOver = () => {
        clearInterval(this.gameInterval);

        let cause = "";

        let deadSnakes = [];
        let snakesToBump = [];

        this.snakes.forEach(snake => {
            if(snake.dead) deadSnakes.push(snake.owner.socket.id);
            if(snake.shouldBump) snakesToBump.push(snake.owner.socket.id);
        });

        if(deadSnakes.length == this.snakes.length) {
            cause = "draw"
        } else {
            cause = deadSnakes[0];
        }

        let data = {
            cause: cause,
            ownersOfSnakesToBump: snakesToBump
        }

        io.in(this.room.name).emit("game_over", data);
    }

    quit = () => {
        io.in(this.room.name).emit("game_over", "");
    }
}

class Snake {
    constructor(player, startPosition, startDirection, game) {
        player.snake = this;
        this.owner = player;

        this.points = 0;

        this.body = [];
        this.head = structuredClone(startPosition);
        this.body.push(structuredClone(this.head));
        this.pastBody = structuredClone(this.body);

        this.direction = structuredClone(startDirection);
        this.lastDirectionUsed = structuredClone(this.direction);

        this.game = game;

        this.cornersForCorrection = [];

        this.dead = false;
        this.shouldBump = false;
    }

    setDirection = (direction) => {
        if (this.body.length == 1 || !(direction.x == -this.lastDirectionUsed.x && direction.y == -this.lastDirectionUsed.y))
            this.direction = direction;
    }

    update = () => {
        let onApple = false;

        this.cornersForCorrection = this.cornersForCorrection.filter(corner =>
            !(corner.x == this.body[0].x && corner.y == this.body[0].y));

        this.pastBody = structuredClone(this.body);

        this.head.x += this.direction.x;
        this.head.y += this.direction.y;

        for (let i = this.game.apples.length - 1; 0 <= i; i--) {
            let apple = this.game.apples[i];
            if (apple.x == this.head.x && apple.y == this.head.y) {
                onApple = true;
                this.game.apples.splice(i, 1);
                this.points++;
            }
        }

        this.body.push(structuredClone(this.head));

        if (!onApple) this.body.shift();

        else this.pastBody.unshift(structuredClone(this.pastBody[0]));

        if (this.body.length > 1 && !(this.direction.x == this.lastDirectionUsed.x && this.direction.y == this.lastDirectionUsed.y))
            this.cornersForCorrection.unshift(structuredClone(this.body[this.body.length - 2]));

        this.lastDirectionUsed = structuredClone(this.direction);
    }

    deathCheck = () => {
        let collidesWithItself = false;
        let headCoordinateCountInBody = 0;
        this.body.forEach(part => { if (this.head.x == part.x && this.head.y == part.y) headCoordinateCountInBody++ });
        if (2 <= headCoordinateCountInBody) collidesWithItself = true;

        let collidesWithWall = false;
        if (this.head.x < 0 || this.head.x >= this.game.mapSize || this.head.y < 0 || this.head.y >= this.game.mapSize)
            collidesWithWall = true;

        let collidesWithOtherSnakeHead = false;
        let collidesWithOtherSnake = false;
        this.game.snakes.filter(snake => snake.owner !== this.owner).forEach(snake => {

            if (this.head.x == snake.head.x && this.head.y == snake.head.y) collidesWithOtherSnakeHead = true;

            snake.body.forEach(part => {
                if (this.head.x == part.x && this.head.y == part.y) {
                    collidesWithOtherSnake = true;
                }
            });
        });




        if (collidesWithItself || collidesWithOtherSnake || collidesWithWall || this.game.goal <= this.points) {
            if (collidesWithOtherSnakeHead) {
                this.shouldBump = true;
            }
            this.dead = true;
            this.game.isOver = true;
        }
    }
}

class Client {
    constructor(socket) {
        this.socket = socket;
        this.room = null;
        this.ready = false;
        this.snake = null;
    }

    joinRoom = (roomName) => {
        if (this.room != null) { this.leaveRoom(); }

        this.room = rooms.find(room => room.name == roomName);

        if (this.room == null) {
            this.room = new Room(rooms.length, roomName, this);
            rooms.push(this.room);
            this.socket.join(roomName);
            this.socket.emit("join_room_callback", true);
            this.startButtonClickCallback();
        }
        else if (this.room.tryJoin(this)) {
            this.socket.join(roomName);
            this.socket.emit("join_room_callback", true);
            this.startButtonClickCallback();
        }
        else {
            this.room = null;
            this.socket.emit("join_room_callback", false);
        }
    }

    leaveRoom = () => {
        if (this.room != null) {
            if (this.room.game != null) {
                this.room.delete(this);
                return;
            }

            this.cancelReadyUp();
            this.socket.leave(this.room.name);
            this.room.leave(this);
        }

        this.socket.emit("leave_room_callback");
    }

    startButtonClick = () => {
        if (!this.ready) this.readyUp();
        else this.cancelReadyUp();
    }

    readyUp = () => {
        if (this.room == null || this.ready) return;
        this.ready = true;
        this.room.readyClients.push(this.socket.id);
        this.startButtonClickCallback();

        console.log(`${this.socket.id} is ready`);

        if (this.room.readyClients.length == 2) {
            this.room.startGame();
        }
    }

    cancelReadyUp = () => {
        if (this.room == null || !this.ready) return;
        this.ready = false;
        this.room.readyClients.splice(this.room.readyClients.indexOf(this.id), 1)
        this.startButtonClickCallback();

        console.log(`${this.socket.id} is not ready anymore`);
    }

    startButtonClickCallback = () => {
        this.socket.emit("start_button_click_callback", this.ready);
        io.to(this.room.name).emit("list_of_ready_players_changed", this.room.readyClients);
    }

    onDirectionInputRecieved = (input) => {
        if (this.snake != null)
            this.snake.direction = input;
    }

    disconnect = () => {
        console.log(`${this.id} disconnected`);
        if (this.room != null) {
            if (this.room.game != null) this.room.delete(this);
            else this.leaveRoom();
        }
    }

}

class Room {
    constructor(id, name, client) {
        this.id = id;
        this.name = name;
        this.clients = [];
        this.maxClients = 2;
        this.readyClients = [];

        this.clients.push(client);

        this.game = null;

        this.snakes = [];
        this.apples = [];

        console.log(`${client.socket.id} has created the room "${this.name}"`);
    }

    tryJoin(client) {
        if (this.clients.length < this.maxClients) {
            this.clients.push(client);
            console.log(`${client.socket.id} has joined the room "${this.name}"`);
            return true;
        }
        else {
            console.log(`${client.socket.id} tried to join the room "${this.name}" but it's full`);
            return false;
        }
    }

    leave(client) {
        client.room = null;
        this.clients.splice(this.clients.findIndex(c => { return c.socket.id == client.socket.id }), 1)

        if (this.clients == 0) {
            rooms.splice(rooms.findIndex(r => { return r.id == this.id }), 1);
            console.log(`${client.socket.id} has deleted the room "${this.name}"`);
        }
        else {
            console.log(`${client.socket.id} has left the room "${this.name}"`);
        }
    }

    delete(client) {
        this.game.quit();
        this.game = null;

        for (let i = this.clients.length - 1; 0 <= i; i--)
            this.clients[i].leaveRoom();
        console.log(`${client.socket.id} has left the room "${this.name}" during game so it got deleted`);
    }

    startGame() {
        this.game = new Game(this, this.clients);
        console.log(`game started in room "${this.name}"`);
    }
}
