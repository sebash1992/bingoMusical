const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

// Generate a random bingo card for a player from the song pool
// Generate unique bingo cards ensuring no two players get the same cell
// playerIndex is used to rotate the starting position for small pools
function generateCard(songs, size, playerIndex = 0) {
  const needed = size * size;
  const pool = [...songs];

  // Shuffle with a different offset per player to increase uniqueness
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // For pools smaller than or equal to the number of cells needed,
  // rotate the pool by playerIndex so each player gets different songs
  if (pool.length <= needed) {
    const offset = (playerIndex * needed) % pool.length;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    return rotated.slice(0, needed).map((s) => ({
      songId: s.id,
      label: s.label || s.youtubeUrl,
      marked: false,
    }));
  }

  return pool.slice(0, needed).map((s) => ({
    songId: s.id,
    label: s.label || s.youtubeUrl,
    marked: false,
  }));
}

function createRoom(adminSocketId, adminName) {
  const roomCode = nanoid(6).toUpperCase();
  const adminToken = nanoid(20);
  rooms[roomCode] = {
    roomCode,
    adminSocketId,
    adminToken,
    adminName: adminName || "Admin",
    songs: [],
    cardSize: 4, // default 4x4 (1,2,3,4,5 supported)
    players: {}, // socketId -> { name, card: [], bingoCallers: false }
    gameState: {
      status: "waiting", // waiting | playing | bingo-claimed
      currentSongIndex: -1,
      playedSongIds: [], // songs revealed so far
      clipDuration: 5,
      shuffledOrder: [], // randomized song indices for the game
      winners: [], // confirmed winners
      bingoClaimant: null, // { socketId, name } who claimed bingo
    },
  };
  return { roomCode, adminToken };
}

function getRoomByAdminToken(token) {
  return Object.values(rooms).find((r) => r.adminToken === token);
}

function getPublicState(room) {
  return {
    roomCode: room.roomCode,
    adminName: room.adminName,
    cardSize: room.cardSize,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      card: p.card, // full card so admin can view it
      markedCount: p.card.filter((c) => c.marked).length,
      totalCells: p.card.length,
      hasBingo: p.hasBingo,
    })),
    gameState: {
      status: room.gameState.status,
      currentSongIndex: room.gameState.currentSongIndex,
      playedSongIds: room.gameState.playedSongIds,
      clipDuration: room.gameState.clipDuration,
      totalSongs: room.songs.length,
      shuffledTotal: room.gameState.shuffledOrder.length,
      winners: room.gameState.winners,
      bingoClaimant: room.gameState.bingoClaimant,
      // Ordered song list for admin (shuffled order resolved to song labels)
      orderedSongs: room.gameState.shuffledOrder.map((realIdx) => {
        const s = room.songs[realIdx];
        return s ? { id: s.id, label: s.label } : null;
      }).filter(Boolean),
    },
    currentSong:
      room.gameState.currentSongIndex >= 0 &&
      room.gameState.shuffledOrder.length > 0
        ? (() => {
            const idx =
              room.gameState.shuffledOrder[room.gameState.currentSongIndex];
            const s = room.songs[idx];
            return s
              ? { youtubeId: s.youtubeId, startSeconds: s.startSeconds, label: s.label, id: s.id }
              : null;
          })()
        : null,
  };
}

app.get("/room/:code", (req, res) => {
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ roomCode: room.roomCode, adminName: room.adminName, playerCount: Object.keys(room.players).length });
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ── ADMIN: Create room ──────────────────────────────────────────
  socket.on("create-room", ({ adminName }, callback) => {
    const { roomCode, adminToken } = createRoom(socket.id, adminName);
    socket.join(roomCode);
    callback({ roomCode, adminToken });
  });

  // ── ADMIN: Rejoin ───────────────────────────────────────────────
  socket.on("admin-rejoin", ({ adminToken }, callback) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room) return callback({ error: "Room not found" });
    room.adminSocketId = socket.id;
    socket.join(room.roomCode);
    callback({ room: getPublicState(room), songs: room.songs, cardSize: room.cardSize });
  });

  // ── ADMIN: Update songs ─────────────────────────────────────────
  socket.on("update-songs", ({ adminToken, songs, cardSize }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;
    // Keep player-submitted songs, replace admin songs
    const playerSongs = room.songs.filter(s => s.id && s.id.startsWith('player-'));
    const adminSongs = songs.map((s, i) => ({ ...s, id: `song-${i}` }));
    room.songs = [...adminSongs, ...playerSongs];
    if (cardSize) room.cardSize = cardSize;
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── ADMIN: Start game (shuffle songs, assign cards) ─────────────
  socket.on("start-game", ({ adminToken }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;

    // Shuffle song order for the game
    const indices = room.songs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    room.gameState.shuffledOrder = indices;
    room.gameState.currentSongIndex = -1;
    room.gameState.playedSongIds = [];
    room.gameState.winners = [];
    room.gameState.bingoClaimant = null;
    room.gameState.status = "playing";

    // Generate cards for all current players
    Object.values(room.players).forEach((p, idx) => {
      p.card = generateCard(room.songs, room.cardSize, idx);
      p.hasBingo = false;
      io.to(p.socketId).emit("your-card", { card: p.card, cardSize: room.cardSize });
    });

    io.to(room.roomCode).emit("game-started", { cardSize: room.cardSize });
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── ADMIN: Play song (with countdown) ──────────────────────────
  socket.on("play-song", ({ adminToken, songIndex, clipDuration, countdown }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;

    const realIdx = room.gameState.shuffledOrder[songIndex];
    if (room.songs[realIdx] === undefined) return;

    room.gameState.currentSongIndex = songIndex;
    if (clipDuration) room.gameState.clipDuration = clipDuration;

    const cd = countdown || 3;
    const song = room.songs[realIdx];

    io.to(room.roomCode).emit("prepare-song", {
      song: { youtubeId: song.youtubeId, startSeconds: song.startSeconds, label: song.label, id: song.id },
      clipDuration: room.gameState.clipDuration,
      songIndex,
      countdown: cd,
    });

    setTimeout(() => {
      if (!rooms[room.roomCode]) return;
      if (rooms[room.roomCode].gameState.status === "waiting") return;

      // Auto-reveal: add song to playedSongIds when it starts playing
      if (!rooms[room.roomCode].gameState.playedSongIds.includes(song.id)) {
        rooms[room.roomCode].gameState.playedSongIds.push(song.id);
      }

      io.to(room.roomCode).emit("start-song", {
        song: { youtubeId: song.youtubeId, startSeconds: song.startSeconds, label: song.label, id: song.id },
        clipDuration: room.gameState.clipDuration,
      });
      io.to(room.roomCode).emit("song-revealed", { songId: song.id, label: song.label });
      io.to(room.roomCode).emit("state-update", getPublicState(rooms[room.roomCode]));
    }, cd * 1000);
  });

  // ── ADMIN: Reveal song (mark as played, players can now mark it) ─
  socket.on("reveal-song", ({ adminToken }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;

    const idx = room.gameState.currentSongIndex;
    if (idx < 0) return;
    const realIdx = room.gameState.shuffledOrder[idx];
    const song = room.songs[realIdx];
    if (!song) return;

    if (!room.gameState.playedSongIds.includes(song.id)) {
      room.gameState.playedSongIds.push(song.id);
    }

    io.to(room.roomCode).emit("song-revealed", { songId: song.id, label: song.label });
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── ADMIN: Stop song ────────────────────────────────────────────
  socket.on("stop-song", ({ adminToken }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;
    io.to(room.roomCode).emit("stop-song");
  });

  // ── ADMIN: Confirm bingo (and finish) ──────────────────────────
  socket.on("confirm-bingo-finish", ({ adminToken }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;
    const claimant = room.gameState.bingoClaimant;
    if (!claimant) return;

    if (!room.gameState.winners.find((w) => w.socketId === claimant.socketId)) {
      room.gameState.winners.push(claimant);
    }
    room.gameState.status = "finished";
    room.gameState.bingoClaimant = null;

    io.to(room.roomCode).emit("bingo-confirmed", { player: claimant, finished: true, winners: room.gameState.winners });
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── ADMIN: Confirm bingo (and continue) ────────────────────────
  socket.on("confirm-bingo-continue", ({ adminToken }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;
    const claimant = room.gameState.bingoClaimant;
    if (!claimant) return;

    if (!room.gameState.winners.find((w) => w.socketId === claimant.socketId)) {
      room.gameState.winners.push(claimant);
    }
    room.gameState.status = "playing";
    room.gameState.bingoClaimant = null;

    io.to(room.roomCode).emit("bingo-confirmed", { player: claimant, finished: false, winners: room.gameState.winners });
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── ADMIN: Reject bingo ─────────────────────────────────────────
  socket.on("reject-bingo", ({ adminToken }) => {
    const room = getRoomByAdminToken(adminToken);
    if (!room || room.adminSocketId !== socket.id) return;
    const claimant = room.gameState.bingoClaimant;
    room.gameState.status = "playing";
    room.gameState.bingoClaimant = null;

    io.to(room.roomCode).emit("bingo-rejected", { player: claimant });
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── PLAYER: Submit songs to pool ───────────────────────────────
  socket.on("submit-songs", ({ roomCode, songs: newSongs }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    if (room.gameState.status !== "waiting") return;
    const player = room.players[socket.id];
    if (!player) return;

    newSongs.forEach((s, i) => {
      room.songs.push({
        ...s,
        id: `player-${socket.id}-${i}`,
        submittedBy: player.name,
      });
    });

    io.to(code).emit("songs-updated", { totalSongs: room.songs.length });
    io.to(room.adminSocketId).emit("player-songs-added", {
      playerName: player.name,
      count: newSongs.length,
      totalSongs: room.songs.length,
    });
  });

  // ── PLAYER: Join room ───────────────────────────────────────────
  socket.on("join-room", ({ roomCode, playerName }, callback) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return callback({ error: "Sala no encontrada" });

    room.players[socket.id] = {
      id: socket.id,
      socketId: socket.id,
      name: playerName,
      card: [],
      hasBingo: false,
    };

    // If game already started, generate card immediately
    if (room.gameState.status !== "waiting" && room.songs.length >= room.cardSize * room.cardSize) {
      const existingCount = Object.keys(room.players).length;
      room.players[socket.id].card = generateCard(room.songs, room.cardSize, existingCount);
    }

    socket.join(code);
    callback({ success: true, state: getPublicState(room), card: room.players[socket.id].card, cardSize: room.cardSize });

    io.to(code).emit("player-joined", { name: playerName });
    io.to(code).emit("state-update", getPublicState(room));
  });

  // ── PLAYER: Mark cell ───────────────────────────────────────────
  socket.on("mark-cell", ({ roomCode, songId }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;

    // Only allow marking songs that have been revealed
    if (!room.gameState.playedSongIds.includes(songId)) return;

    const cell = player.card.find((c) => c.songId === songId);
    if (cell) {
      cell.marked = !cell.marked; // toggle
      socket.emit("card-update", { card: player.card });
      io.to(room.roomCode).emit("state-update", getPublicState(room));
    }
  });

  // ── PLAYER: Claim bingo ─────────────────────────────────────────
  socket.on("claim-bingo", ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    if (room.gameState.status !== "playing") return;

    // Check if all cells are marked
    const allMarked = player.card.every((c) => c.marked);

    room.gameState.status = "bingo-claimed";
    room.gameState.bingoClaimant = { socketId: socket.id, name: player.name, allMarked };

    io.to(room.roomCode).emit("bingo-claimed", {
      player: { socketId: socket.id, name: player.name },
      allMarked,
      card: player.card,
    });
    io.to(room.roomCode).emit("state-update", getPublicState(room));
  });

  // ── DISCONNECT ──────────────────────────────────────────────────
  socket.on("disconnect", () => {
    Object.values(rooms).forEach((room) => {
      if (room.players[socket.id]) {
        const name = room.players[socket.id].name;
        delete room.players[socket.id];
        io.to(room.roomCode).emit("player-left", { name });
        io.to(room.roomCode).emit("state-update", getPublicState(room));
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Bingo Musical server on port ${PORT}`));
