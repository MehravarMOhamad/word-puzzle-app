const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const CATEGORIES = require('./words');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Level configuration (Level 1: 10x10 grid, 10 words randomly chosen from 20)
const LEVELS = {
  1: { gridSize: 10, wordCount: 10 }
};

// English reads Left-to-Right; Farsi reads Right-to-Left
const DIRECTIONS_EN = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: 1 }
];

const DIRECTIONS_FA = [
  { dr: 0, dc: -1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: -1 },
  { dr: -1, dc: -1 }
];

const EN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FA_ALPHABET = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآ';

const rooms = new Map();
const disconnectTimers = new Map();

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generatePuzzle(category, levelNum = 1, tableLang = 'en') {
  const { gridSize, wordCount } = LEVELS[levelNum];
  const pool = CATEGORIES[category] || CATEGORIES.Animals;
  const directions = tableLang === 'fa' ? DIRECTIONS_FA : DIRECTIONS_EN;
  const alphabet = tableLang === 'fa' ? FA_ALPHABET : EN_ALPHABET;

  for (let boardTry = 0; boardTry < 120; boardTry++) {
    const chosenItems = shuffle(pool).slice(0, wordCount);
    chosenItems.sort((a, b) => {
      const lenA = tableLang === 'fa' ? a.fa.length : a.en.length;
      const lenB = tableLang === 'fa' ? b.fa.length : b.en.length;
      return lenB - lenA;
    });

    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));
    const placedWords = [];
    let allPlaced = true;

    for (let idx = 0; idx < chosenItems.length; idx++) {
      const item = chosenItems[idx];
      const targetWord = tableLang === 'fa' ? item.fa : item.en;
      let placed = false;

      for (let attempt = 0; attempt < 400; attempt++) {
        const dir = directions[(idx + attempt) % directions.length];
        const rStart = Math.floor(Math.random() * gridSize);
        const cStart = Math.floor(Math.random() * gridSize);

        const rEnd = rStart + dir.dr * (targetWord.length - 1);
        const cEnd = cStart + dir.dc * (targetWord.length - 1);

        if (rEnd < 0 || rEnd >= gridSize || cEnd < 0 || cEnd >= gridSize) {
          continue;
        }

        let fits = true;
        for (let i = 0; i < targetWord.length; i++) {
          const r = rStart + dir.dr * i;
          const c = cStart + dir.dc * i;
          if (grid[r][c] !== '' && grid[r][c] !== targetWord[i]) {
            fits = false;
            break;
          }
        }

        if (fits) {
          const cells = [];
          for (let i = 0; i < targetWord.length; i++) {
            const r = rStart + dir.dr * i;
            const c = cStart + dir.dc * i;
            grid[r][c] = targetWord[i];
            cells.push({ r, c });
          }

          // When table is English -> show Farsi word & meaning; when table is Farsi -> show English word & meaning
          placedWords.push({
            word: targetWord,
            counterpart: tableLang === 'fa' ? item.en : item.fa,
            meaning: tableLang === 'fa' ? item.meaningEn : item.meaningFa,
            cells,
            foundBy: null
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        allPlaced = false;
        break;
      }
    }

    if (allPlaced) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (grid[r][c] === '') {
            grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
          }
        }
      }

      placedWords.sort((a, b) => a.word.localeCompare(b.word, tableLang === 'fa' ? 'fa' : 'en'));
      return { gridSize, grid, words: placedWords };
    }
  }

  throw new Error('Could not generate puzzle grid');
}

function extractLine(grid, start, end) {
  const size = grid.length;
  if (
    !start || !end ||
    start.r < 0 || start.r >= size || start.c < 0 || start.c >= size ||
    end.r < 0 || end.r >= size || end.c < 0 || end.c >= size
  ) {
    return null;
  }

  const dr = end.r - start.r;
  const dc = end.c - start.c;

  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) {
    return null;
  }

  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return null;

  const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
  const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

  const cells = [];
  let text = '';
  for (let i = 0; i <= steps; i++) {
    const r = start.r + stepR * i;
    const c = start.c + stepC * i;
    cells.push({ r, c });
    text += grid[r][c];
  }

  return { text, cells };
}

function createRoom(roomCode, category, tableLang = 'en') {
  const lang = tableLang === 'fa' ? 'fa' : 'en';
  const cat = CATEGORIES[category] ? category : 'Animals';
  const puzzle = generatePuzzle(cat, 1, lang);

  return {
    roomCode,
    level: 1,
    category: cat,
    tableLang: lang,
    gridSize: puzzle.gridSize,
    grid: puzzle.grid,
    words: puzzle.words,
    players: { 1: null, 2: null },
    status: 'waiting',
    winner: null,
    lastFound: null,
    foundSeq: 0,
    resetVotes: { 1: false, 2: false },
    pendingLang: null,
    langVotes: { 1: false, 2: false }
  };
}

function resetRoomPuzzle(room, newCategory, newLang) {
  const chosenCategory = CATEGORIES[newCategory] ? newCategory : room.category;
  const chosenLang = newLang === 'fa' || newLang === 'en' ? newLang : room.tableLang;
  const puzzle = generatePuzzle(chosenCategory, 1, chosenLang);

  room.category = chosenCategory;
  room.tableLang = chosenLang;
  room.gridSize = puzzle.gridSize;
  room.grid = puzzle.grid;
  room.words = puzzle.words;
  room.winner = null;
  room.lastFound = null;
  room.resetVotes = { 1: false, 2: false };
  room.pendingLang = null;
  room.langVotes = { 1: false, 2: false };

  if (room.players[1]) room.players[1].score = 0;
  if (room.players[2]) room.players[2].score = 0;

  room.status = room.players[1] && room.players[2] ? 'playing' : 'waiting';
}

function getPublicRoomState(room) {
  return {
    roomCode: room.roomCode,
    level: room.level,
    category: room.category,
    categories: Object.keys(CATEGORIES),
    tableLang: room.tableLang,
    descLang: room.tableLang === 'fa' ? 'en' : 'fa',
    gridSize: room.gridSize,
    grid: room.grid,
    words: room.words.map((w) => ({
      word: w.word,
      foundBy: w.foundBy,
      cells: w.foundBy ? w.cells : [],
      counterpart: w.foundBy ? w.counterpart : null,
      meaning: w.foundBy ? w.meaning : null
    })),
    players: {
      1: room.players[1]
        ? { slot: 1, name: room.players[1].name, avatar: room.players[1].avatar, score: room.players[1].score, connected: room.players[1].connected }
        : null,
      2: room.players[2]
        ? { slot: 2, name: room.players[2].name, avatar: room.players[2].avatar, score: room.players[2].score, connected: room.players[2].connected }
        : null
    },
    status: room.status,
    winner: room.winner,
    lastFound: room.lastFound,
    resetVotes: room.resetVotes,
    pendingLang: room.pendingLang,
    langVotes: room.langVotes
  };
}

function clearDisconnectTimer(code, slot) {
  const key = `${code}:${slot}`;
  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key));
    disconnectTimers.delete(key);
  }
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomCode, slot, name, avatar, category, token }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const playerSlot = Number(slot);
    const playerName = (name || '').trim().slice(0, 16);

    if (!code || (playerSlot !== 1 && playerSlot !== 2) || !playerName) {
      socket.emit('joinError', 'Please enter a valid room code, name, and player slot.');
      return;
    }

    let room = rooms.get(code);
    if (!room) {
      // Default table language is English ('en'), default description language is Farsi ('fa')
      room = createRoom(code, category, 'en');
      rooms.set(code, room);
    }

    const existing = room.players[playerSlot];
    if (existing && existing.token !== token) {
      socket.emit('joinError', `Player ${playerSlot} is already taken in room ${code}. Choose the other slot!`);
      return;
    }

    clearDisconnectTimer(code, playerSlot);

    room.players[playerSlot] = {
      id: socket.id,
      token: token || socket.id,
      slot: playerSlot,
      name: playerName,
      avatar: avatar || (playerSlot === 1 ? '🦊' : '🐼'),
      score: existing ? existing.score : 0,
      connected: true
    };

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.slot = playerSlot;

    if (room.players[1] && room.players[2] && room.status === 'waiting') {
      room.status = room.words.every((w) => w.foundBy !== null) ? 'finished' : 'playing';
    }

    socket.emit('joinedSuccess', { slot: playerSlot });
    io.to(code).emit('roomState', getPublicRoomState(room));
  });

  socket.on('rejoinRoom', ({ roomCode, slot, token }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const playerSlot = Number(slot);
    const room = rooms.get(code);

    if (!room || !room.players[playerSlot] || room.players[playerSlot].token !== token) {
      socket.emit('rejoinFailed');
      return;
    }

    clearDisconnectTimer(code, playerSlot);
    room.players[playerSlot].id = socket.id;
    room.players[playerSlot].connected = true;

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.slot = playerSlot;

    if (room.players[1] && room.players[2] && room.status === 'waiting') {
      room.status = room.words.every((w) => w.foundBy !== null) ? 'finished' : 'playing';
    }

    io.to(code).emit('roomState', getPublicRoomState(room));
  });

  socket.on('submitSelection', ({ start, end }) => {
    const { roomCode, slot } = socket.data;
    if (!roomCode || !slot) return;

    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    const line = extractLine(room.grid, start, end);
    if (!line) {
      socket.emit('invalidSelection');
      return;
    }

    const matched = room.words.find((w) => w.foundBy === null && w.word === line.text);

    if (!matched) {
      const reversed = line.text.split('').reverse().join('');
      const backwardsMatch = room.words.find((w) => w.foundBy === null && w.word === reversed);
      if (backwardsMatch) {
        socket.emit('selectionHint', 'Drag from the FIRST letter to the LAST letter!');
      } else {
        socket.emit('invalidSelection');
      }
      return;
    }

    matched.foundBy = slot;
    matched.cells = line.cells;
    room.players[slot].score += 1;
    room.foundSeq += 1;
    room.lastFound = {
      seq: room.foundSeq,
      word: matched.word,
      counterpart: matched.counterpart,
      meaning: matched.meaning,
      foundBy: slot
    };

    const allFound = room.words.every((w) => w.foundBy !== null);
    if (allFound) {
      room.status = 'finished';
      const s1 = room.players[1]?.score || 0;
      const s2 = room.players[2]?.score || 0;
      if (s1 > s2) room.winner = 1;
      else if (s2 > s1) room.winner = 2;
      else room.winner = 'draw';
    }

    io.to(roomCode).emit('roomState', getPublicRoomState(room));
  });

  // Mutual Reset Confirmation
  socket.on('requestReset', () => {
    const { roomCode, slot } = socket.data;
    if (!roomCode || !slot) return;

    const room = rooms.get(roomCode);
    if (!room || !room.players[1] || !room.players[2]) return;

    room.resetVotes[slot] = true;
    if (room.resetVotes[1] && room.resetVotes[2]) {
      resetRoomPuzzle(room, room.category, room.tableLang);
    }

    io.to(roomCode).emit('roomState', getPublicRoomState(room));
  });

  socket.on('cancelReset', () => {
    const { roomCode } = socket.data;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    room.resetVotes = { 1: false, 2: false };
    io.to(roomCode).emit('roomState', getPublicRoomState(room));
  });

  // Mutual Language Change Confirmation
  socket.on('requestLangChange', ({ targetLang }) => {
    const { roomCode, slot } = socket.data;
    if (!roomCode || !slot) return;

    const room = rooms.get(roomCode);
    if (!room || !room.players[1] || !room.players[2]) return;

    const lang = targetLang === 'fa' ? 'fa' : 'en';
    if (lang === room.tableLang && !room.pendingLang) return;

    if (room.pendingLang !== lang) {
      room.pendingLang = lang;
      room.langVotes = { 1: false, 2: false };
    }

    room.langVotes[slot] = true;

    if (room.langVotes[1] && room.langVotes[2]) {
      resetRoomPuzzle(room, room.category, room.pendingLang);
    }

    io.to(roomCode).emit('roomState', getPublicRoomState(room));
  });

  socket.on('cancelLangChange', () => {
    const { roomCode } = socket.data;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    room.pendingLang = null;
    room.langVotes = { 1: false, 2: false };
    io.to(roomCode).emit('roomState', getPublicRoomState(room));
  });

  socket.on('restartGame', ({ category }) => {
    const { roomCode } = socket.data;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    resetRoomPuzzle(room, category, room.tableLang);
    io.to(roomCode).emit('roomState', getPublicRoomState(room));
  });

  socket.on('disconnect', () => {
    const { roomCode, slot } = socket.data;
    if (!roomCode || !slot) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players[slot];
    if (!player || player.id !== socket.id) return;

    player.connected = false;
    io.to(roomCode).emit('roomState', getPublicRoomState(room));

    clearDisconnectTimer(roomCode, slot);
    const timer = setTimeout(() => {
      const currentRoom = rooms.get(roomCode);
      if (!currentRoom) return;

      const p = currentRoom.players[slot];
      if (p && !p.connected) {
        currentRoom.players[slot] = null;
        currentRoom.resetVotes = { 1: false, 2: false };
        currentRoom.pendingLang = null;
        currentRoom.langVotes = { 1: false, 2: false };

        if (currentRoom.status === 'playing') {
          currentRoom.status = 'waiting';
        }
        if (!currentRoom.players[1] && !currentRoom.players[2]) {
          rooms.delete(roomCode);
        } else {
          io.to(roomCode).emit('roomState', getPublicRoomState(currentRoom));
        }
      }
      disconnectTimers.delete(`${roomCode}:${slot}`);
    }, 60000);

    disconnectTimers.set(`${roomCode}:${slot}`, timer);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Word Puzzle server running at http://localhost:${PORT}`);
});
