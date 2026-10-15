import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { MonopolyEngine } from "./gameEngine.js";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Monopoly Engine Server is Live");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const games = new Map();

io.on("connection", (socket) => {
  console.log(`[Connected]: Socket ID ${socket.id}`);

  socket.on("JOIN_GAME", ({ roomCode, playerName }) => {
    socket.join(roomCode);

    if (!games.has(roomCode)) {
      games.set(roomCode, {
        players: [{ id: socket.id, name: playerName }],
        engine: null
      });
    } else {
      const room = games.get(roomCode);
      if (!room.engine) {
        if (!room.players.some((p) => p.id === socket.id)) {
          room.players.push({ id: socket.id, name: playerName });
        }
      }
    }

    const room = games.get(roomCode);
    console.log(`[Lobby Join]: ${playerName} joined room ${roomCode}`);

    io.to(roomCode).emit("ROOM_UPDATE", {
      players: room.players,
      started: !!room.engine
    });

    if (room.engine) {
      socket.emit("GAME_STATE_UPDATE", room.engine.getState());
    }
  });

  socket.on("START_GAME", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.players.length >= 1) {
      room.engine = new MonopolyEngine(roomCode, room.players);
      console.log(`[Game Started]: Room ${roomCode}`);
      io.to(roomCode).emit("GAME_STATE_UPDATE", room.engine.getState());
    }
  });

  socket.on("ACTION_ROLL", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.rollDice(socket.id);
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_PAY_BAIL", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.payBail(socket.id);
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_BUY", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.buyProperty(socket.id);
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_DECLINE", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.declineProperty(socket.id);
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_BID", ({ roomCode, amount }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.placeBid(socket.id, Number(amount));
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_PASS_BID", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.passBid(socket.id);
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_BUILD_HOUSE", ({ roomCode, tileId }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.buildHouse(socket.id, Number(tileId));
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_MORTGAGE", ({ roomCode, tileId }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.mortgageProperty(socket.id, Number(tileId));
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_UNMORTGAGE", ({ roomCode, tileId }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.unmortgageProperty(socket.id, Number(tileId));
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("ACTION_END_TURN", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.engine) {
      try {
        const newState = room.engine.endTurn(socket.id);
        io.to(roomCode).emit("GAME_STATE_UPDATE", newState);
      } catch (err) {
        socket.emit("ERROR", err.message);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Disconnected]: Socket ID ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Monopoly Backend running on port ${PORT}`);
});
