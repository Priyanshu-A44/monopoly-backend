import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { MonopolyEngine } from "./gameEngine.js";

const app = express();
app.use(cors());

// Health check endpoint for Render zero-downtime monitoring
app.get("/", (req, res) => {
  res.send("Monopoly Engine Server is Live");
});

const server = http.createServer(app);

// Socket.io CORS setup to allow Vercel frontend connections
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
        // Prevent duplicate socket IDs in the lobby
        if (!room.players.some((p) => p.id === socket.id)) {
          room.players.push({ id: socket.id, name: playerName });
        }
      }
    }

    const room = games.get(roomCode);
    console.log(`[Lobby Join]: ${playerName} joined room ${roomCode}`);
    
    // Notify room of updated lobby state
    io.to(roomCode).emit("ROOM_UPDATE", { 
      players: room.players, 
      started: !!room.engine 
    });

    // If game is already running, send full game state to reconnected socket
    if (room.engine) {
      socket.emit("GAME_STATE_UPDATE", room.engine.getState());
    }
  });

  // Start Game Engine
  socket.on("START_GAME", ({ roomCode }) => {
    const room = games.get(roomCode);
    if (room && room.players.length >= 1) { // Allows testing with 1+ players
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
