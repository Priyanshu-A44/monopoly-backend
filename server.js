// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { MonopolyEngine } from "./gameEngine.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const games = new Map(); // roomCode -> { players: [], engine: MonopolyEngine }

io.on("connection", (socket) => {
  console.log(`[Connected]: Socket ID ${socket.id}`);

  // Join Room / Lobby
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
        room.players.push({ id: socket.id, name: playerName });
      }
    }

    const room = games.get(roomCode);
    console.log(`[Lobby Join]: ${playerName} joined room ${roomCode}`);
    io.to(roomCode).emit("ROOM_UPDATE", { players: room.players, started: !!room.engine });
  });

  // Start Game Engine
  socket.on("START_GAME", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.players.length >= 2) {
      room.engine = new MonopolyEngine(roomCode, room.players);
      console.log(`[Game Started]: Room ${roomCode}`);
      io.to(roomCode).emit("GAME_STATE_UPDATE", room.engine.getState());
    }
  });

  // Roll Dice Action
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

  // Buy Property Action
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

  // Decline Property & Start Auction
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

  // Place Auction Bid
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

  // Pass Auction Bid
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

  // Build House/Hotel Action
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

  // End Turn Action
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

  // Handle Disconnection
  socket.on("disconnect", () => {
    console.log(`[Disconnected]: Socket ID ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Monopoly Backend running on port ${PORT}`);
});