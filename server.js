import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { MonopolyEngine } from "./gameEngine.js";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map(); // roomCode -> { players: [], engine: MonopolyEngine | null }

// Global 1-second interval for driving timers (e.g., Auction countdown)
setInterval(() => {
  rooms.forEach((room, roomCode) => {
    if (room.engine) {
      const active = room.engine.tickAuctionTimer();
      if (active) {
        io.to(roomCode).emit("GAME_STATE_UPDATE", room.engine.getState());
      }
    }
  });
}, 1000);

io.on("connection", (socket) => {
  socket.on("JOIN_GAME", ({ roomCode, playerName }) => {
    socket.join(roomCode);
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, { players: [], engine: null });
    }

    const room = rooms.get(roomCode);
    const existing = room.players.find((p) => p.id === socket.id);
    if (!existing) {
      room.players.push({ id: socket.id, name: playerName });
    }

    io.to(roomCode).emit("ROOM_UPDATE", { players: room.players });

    if (room.engine) {
      socket.emit("GAME_STATE_UPDATE", room.engine.getState());
    }
  });

  socket.on("START_GAME", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.engine = new MonopolyEngine(roomCode, room.players);
    io.to(roomCode).emit("GAME_STATE_UPDATE", room.engine.getState());
  });

  const handleAction = (socket, roomCode, actionFn) => {
    const room = rooms.get(roomCode);
    if (!room || !room.engine) return;
    try {
      actionFn(room.engine);
      io.to(roomCode).emit("GAME_STATE_UPDATE", room.engine.getState());
    } catch (err) {
      socket.emit("ERROR", err.message);
    }
  };

  socket.on("ACTION_ROLL", ({ roomCode }) => {
    handleAction(socket, roomCode, (engine) => engine.rollDice(socket.id));
  });

  socket.on("ACTION_BUY", ({ roomCode }) => {
    handleAction(socket, roomCode, (engine) => engine.buyProperty(socket.id));
  });

  socket.on("ACTION_DECLINE", ({ roomCode }) => {
    handleAction(socket, roomCode, (engine) => engine.declineProperty(socket.id));
  });

  socket.on("ACTION_BID", ({ roomCode, amount }) => {
    handleAction(socket, roomCode, (engine) => engine.placeBid(socket.id, amount));
  });

  socket.on("ACTION_PASS_BID", ({ roomCode }) => {
    handleAction(socket, roomCode, (engine) => engine.passBid(socket.id));
  });

  socket.on("ACTION_END_TURN", ({ roomCode }) => {
    handleAction(socket, roomCode, (engine) => engine.endTurn(socket.id));
  });

  socket.on("ACTION_PAY_BAIL", ({ roomCode }) => {
    handleAction(socket, roomCode, (engine) => engine.payBail(socket.id));
  });

  socket.on("ACTION_BUILD_HOUSE", ({ roomCode, tileId }) => {
    handleAction(socket, roomCode, (engine) => engine.buildHouse(socket.id, tileId));
  });

  socket.on("ACTION_MORTGAGE", ({ roomCode, tileId }) => {
    handleAction(socket, roomCode, (engine) => engine.mortgageProperty(socket.id, tileId));
  });

  socket.on("ACTION_UNMORTGAGE", ({ roomCode, tileId }) => {
    handleAction(socket, roomCode, (engine) => engine.unmortgageProperty(socket.id, tileId));
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomCode) => {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        io.to(roomCode).emit("ROOM_UPDATE", { players: room.players });
      }
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
