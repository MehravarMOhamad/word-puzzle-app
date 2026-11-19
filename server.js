const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Level configuration (Level 1: 10x10 grid, 10 words)
const LEVELS = {
  1: { gridSize: 10, wordCount: 10 }
};

// Word pools per category (4-8 letters each so 10 words fit cleanly in 10x10)
const CATEGORIES = {
  Animals: [
    { word: 'ELEPHANT', meaning: 'The largest land animal, known for its long trunk and big ears.', visual: { type: 'scene', icon: '🐘', bg: '#dcfce7' } },
    { word: 'GIRAFFE', meaning: 'The tallest land animal, with a very long neck for eating tree leaves.', visual: { type: 'scene', icon: '🦒', bg: '#fef3c7' } },
    { word: 'PENGUIN', meaning: 'A black-and-white flightless bird that swims skillfully in cold oceans.', visual: { type: 'scene', icon: '🐧', bg: '#e0f2fe' } },
    { word: 'DOLPHIN', meaning: 'An intelligent ocean mammal known for leaping out of the water.', visual: { type: 'scene', icon: '🐬', bg: '#cffafe' } },
    { word: 'OCTOPUS', meaning: 'A clever sea creature with a soft body and eight flexible arms.', visual: { type: 'scene', icon: '🐙', bg: '#fce7f3' } },
    { word: 'CHEETAH', meaning: 'The fastest land animal in the world, famous for its spotted coat.', visual: { type: 'scene', icon: '🐆', bg: '#fef9c3' } },
    { word: 'TURTLE', meaning: 'A slow-moving reptile protected by a hard, bony shell.', visual: { type: 'scene', icon: '🐢', bg: '#d1fae5' } },
    { word: 'MONKEY', meaning: 'An agile primate that loves climbing trees and often has a long tail.', visual: { type: 'scene', icon: '🐒', bg: '#ffedd5' } },
    { word: 'RABBIT', meaning: 'A small furry mammal with long ears and strong back legs for hopping.', visual: { type: 'scene', icon: '🐇', bg: '#f3e8ff' } },
    { word: 'PARROT', meaning: 'A brightly colored tropical bird that can mimic human speech.', visual: { type: 'scene', icon: '🦜', bg: '#dcfce7' } },
    { word: 'WHALE', meaning: 'A gigantic ocean mammal that breathes air through a blowhole.', visual: { type: 'scene', icon: '🐋', bg: '#dbeafe' } },
    { word: 'LION', meaning: 'A powerful big cat often called the king of the jungle.', visual: { type: 'scene', icon: '🦁', bg: '#fef3c7' } }
  ],
  Countries: [
    { word: 'JAPAN', meaning: 'An island nation in East Asia known as the Land of the Rising Sun.', visual: { type: 'flag', code: 'JP' } },
    { word: 'GERMANY', meaning: 'A Central European country famous for engineering, castles, and forests.', visual: { type: 'flag', code: 'DE' } },
    { word: 'FRANCE', meaning: 'A Western European nation celebrated for art, cuisine, and the Eiffel Tower.', visual: { type: 'flag', code: 'FR' } },
    { word: 'ITALY', meaning: 'A Mediterranean country shaped like a boot, famous for Rome and pasta.', visual: { type: 'flag', code: 'IT' } },
    { word: 'BRAZIL', meaning: 'The largest country in South America, home to the Amazon rainforest.', visual: { type: 'flag', code: 'BR' } },
    { word: 'CANADA', meaning: 'A vast North American country known for maple leaves and snowy mountains.', visual: { type: 'flag', code: 'CA' } },
    { word: 'NORWAY', meaning: 'A Nordic country famous for deep coastal fjords and the midnight sun.', visual: { type: 'flag', code: 'NO' } },
    { word: 'SWEDEN', meaning: 'A Scandinavian nation of thousands of islands, forests, and lakes.', visual: { type: 'flag', code: 'SE' } },
    { word: 'MEXICO', meaning: 'A vibrant North American country known for ancient ruins and rich cuisine.', visual: { type: 'flag', code: 'MX' } },
    { word: 'ICELAND', meaning: 'A Nordic island of glaciers, geysers, waterfalls, and volcanoes.', visual: { type: 'flag', code: 'IS' } },
    { word: 'BELGIUM', meaning: 'A European country famous for waffles, chocolate, and medieval towns.', visual: { type: 'flag', code: 'BE' } },
    { word: 'POLAND', meaning: 'A Central European country known for historic cities and Baltic beaches.', visual: { type: 'flag', code: 'PL' } }
  ],
  Technology: [
    { word: 'LAPTOP', meaning: 'A portable personal computer with a built-in screen and keyboard.', visual: { type: 'scene', icon: '💻', bg: '#e0e7ff' } },
    { word: 'SERVER', meaning: 'A powerful computer that stores data and delivers websites to users.', visual: { type: 'scene', icon: '🖥️', bg: '#dbeafe' } },
    { word: 'DATABASE', meaning: 'An organized digital system for storing and searching large amounts of data.', visual: { type: 'scene', icon: '🗄️', bg: '#e0f2fe' } },
    { word: 'KEYBOARD', meaning: 'An input device covered in letter and symbol keys for typing text.', visual: { type: 'scene', icon: '⌨️', bg: '#f1f5f9' } },
    { word: 'BROWSER', meaning: 'A software app used to open and view websites on the internet.', visual: { type: 'scene', icon: '🌐', bg: '#dcfce7' } },
    { word: 'NETWORK', meaning: 'A group of connected computers that share information with each other.', visual: { type: 'scene', icon: '📡', bg: '#ede9fe' } },
    { word: 'ROBOT', meaning: 'A programmable machine capable of performing physical tasks automatically.', visual: { type: 'scene', icon: '🤖', bg: '#fae8ff' } },
    { word: 'CAMERA', meaning: 'A device that captures photographs or records moving video.', visual: { type: 'scene', icon: '📷', bg: '#ffedd5' } },
    { word: 'BATTERY', meaning: 'A device that stores chemical energy and supplies electrical power.', visual: { type: 'scene', icon: '🔋', bg: '#dcfce7' } },
    { word: 'PRINTER', meaning: 'A machine that puts digital text and pictures onto sheets of paper.', visual: { type: 'scene', icon: '🖨️', bg: '#f1f5f9' } },
    { word: 'PHONE', meaning: 'A handheld device used to make calls, send messages, and run apps.', visual: { type: 'scene', icon: '📱', bg: '#dbeafe' } },
    { word: 'MOUSE', meaning: 'A hand-held device moved across a desk to control the screen cursor.', visual: { type: 'scene', icon: '🖱️', bg: '#fef3c7' } }
  ],
  Space: [
    { word: 'GALAXY', meaning: 'A massive system of billions of stars, gas, and dust held by gravity.', visual: { type: 'scene', icon: '🌌', bg: '#1e1b4b' } },
    { word: 'PLANET', meaning: 'A large round object in space that orbits around a star.', visual: { type: 'scene', icon: '🪐', bg: '#312e81' } },
    { word: 'COMET', meaning: 'An icy space object that grows a bright glowing tail near the Sun.', visual: { type: 'scene', icon: '☄️', bg: '#0f172a' } },
    { word: 'NEBULA', meaning: 'A giant glowing cloud of gas and dust in space where new stars form.', visual: { type: 'scene', icon: '✨', bg: '#3b0764' } },
    { word: 'ECLIPSE', meaning: 'An event where one space object casts its shadow over another.', visual: { type: 'scene', icon: '🌑', bg: '#1e293b' } },
    { word: 'GRAVITY', meaning: 'The invisible force that pulls objects with mass toward each other.', visual: { type: 'scene', icon: '🌍', bg: '#172554' } },
    { word: 'ROCKET', meaning: 'A powerful spacecraft engine-driven vehicle built to launch into space.', visual: { type: 'scene', icon: '🚀', bg: '#1e293b' } },
    { word: 'METEOR', meaning: 'A streak of light in the night sky made by space rock burning in air.', visual: { type: 'scene', icon: '🌠', bg: '#0f172a' } },
    { word: 'SATURN', meaning: 'The sixth planet from the Sun, famous for its wide icy rings.', visual: { type: 'scene', icon: '🪐', bg: '#451a03' } },
    { word: 'SUN', meaning: 'The bright hot star at the center of our solar system.', visual: { type: 'scene', icon: '☀️', bg: '#422006' } },
    { word: 'ORBIT', meaning: 'The curved path an object follows as it travels around a star or planet.', visual: { type: 'scene', icon: '🛰️', bg: '#0f172a' } },
    { word: 'MOON', meaning: 'Earth’s natural satellite that shines by reflecting sunlight.', visual: { type: 'scene', icon: '🌕', bg: '#1e293b' } }
  ],
  Food: [
    { word: 'AVOCADO', meaning: 'A creamy green fruit with a large round pit in the center.', visual: { type: 'scene', icon: '🥑', bg: '#dcfce7' } },
    { word: 'PANCAKE', meaning: 'A flat, round breakfast cake cooked on a pan and served with syrup.', visual: { type: 'scene', icon: '🥞', bg: '#fef3c7' } },
    { word: 'PRETZEL', meaning: 'A baked bread snack twisted into a knot and sprinkled with salt.', visual: { type: 'scene', icon: '🥨', bg: '#ffedd5' } },
    { word: 'PIZZA', meaning: 'A baked flatbread topped with tomato sauce, melted cheese, and toppings.', visual: { type: 'scene', icon: '🍕', bg: '#fee2e2' } },
    { word: 'BANANA', meaning: 'A sweet curved yellow fruit packed with energy and potassium.', visual: { type: 'scene', icon: '🍌', bg: '#fef9c3' } },
    { word: 'CHEESE', meaning: 'A flavorful dairy food made by pressing and aging milk curds.', visual: { type: 'scene', icon: '🧀', bg: '#fef3c7' } },
    { word: 'MUFFIN', meaning: 'A small cup-shaped baked cake, often filled with fruit or chocolate.', visual: { type: 'scene', icon: '🧁', bg: '#fce7f3' } },
    { word: 'NOODLES', meaning: 'Long thin strips of cooked dough served in soup or with sauce.', visual: { type: 'scene', icon: '🍜', bg: '#ffedd5' } },
    { word: 'CHERRY', meaning: 'A small round bright-red fruit with a hard pit inside.', visual: { type: 'scene', icon: '🍒', bg: '#ffe4e6' } },
    { word: 'COOKIE', meaning: 'A small flat sweet baked treat, often crisp on the edges and chewy inside.', visual: { type: 'scene', icon: '🍪', bg: '#fef3c7' } },
    { word: 'BURGER', meaning: 'A cooked patty served inside a sliced round bread bun with toppings.', visual: { type: 'scene', icon: '🍔', bg: '#ffedd5' } },
    { word: 'DONUT', meaning: 'A sweet ring-shaped fried dough pastry covered in glaze or sprinkles.', visual: { type: 'scene', icon: '🍩', bg: '#fce7f3' } }
  ]
};

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: 1 }
];

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

function generatePuzzle(category, levelNum = 1) {
  const { gridSize, wordCount } = LEVELS[levelNum];
  const pool = CATEGORIES[category] || CATEGORIES.Animals;

  for (let boardTry = 0; boardTry < 100; boardTry++) {
    const chosenItems = shuffle(pool).slice(0, wordCount);
    chosenItems.sort((a, b) => b.word.length - a.word.length);

    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));
    const placedWords = [];
    let allPlaced = true;

    for (let idx = 0; idx < chosenItems.length; idx++) {
      const item = chosenItems[idx];
      const word = item.word;
      let placed = false;

      for (let attempt = 0; attempt < 400; attempt++) {
        const dir = DIRECTIONS[(idx + attempt) % DIRECTIONS.length];
        const rStart = Math.floor(Math.random() * gridSize);
        const cStart = Math.floor(Math.random() * gridSize);

        const rEnd = rStart + dir.dr * (word.length - 1);
        const cEnd = cStart + dir.dc * (word.length - 1);

        if (rEnd < 0 || rEnd >= gridSize || cEnd < 0 || cEnd >= gridSize) {
          continue;
        }

        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const r = rStart + dir.dr * i;
          const c = cStart + dir.dc * i;
          if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
            fits = false;
            break;
          }
        }

        if (fits) {
          const cells = [];
          for (let i = 0; i < word.length; i++) {
            const r = rStart + dir.dr * i;
            const c = cStart + dir.dc * i;
            grid[r][c] = word[i];
            cells.push({ r, c });
          }

          placedWords.push({
            word,
            meaning: item.meaning,
            visual: item.visual,
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
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (grid[r][c] === '') {
            grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
          }
        }
      }

      placedWords.sort((a, b) => a.word.localeCompare(b.word));
      return { gridSize, grid, words: placedWords };
    }
  }

  throw new Error('Could not generate puzzle grid');
}

// Extract straight line of cells from start to end on the grid
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

  // Must be horizontal, vertical, or 45-degree diagonal
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

function createRoom(roomCode, category) {
  const puzzle = generatePuzzle(category, 1);
  return {
    roomCode,
    level: 1,
    category,
    gridSize: puzzle.gridSize,
    grid: puzzle.grid,
    words: puzzle.words,
    players: { 1: null, 2: null },
    status: 'waiting',
    winner: null,
    lastFound: null,
    resetVotes: { 1: false, 2: false }
  };
}

function resetRoomPuzzle(room, newCategory) {
  const chosenCategory = CATEGORIES[newCategory] ? newCategory : room.category;
  const puzzle = generatePuzzle(chosenCategory, 1);

  room.category = chosenCategory;
  room.gridSize = puzzle.gridSize;
  room.grid = puzzle.grid;
  room.words = puzzle.words;
  room.winner = null;
  room.lastFound = null;
  room.resetVotes = { 1: false, 2: false };

  if (room.players[1]) room.players[1].score = 0;
  if (room.players[2]) room.players[2].score = 0;

  room.status = room.players[1] && room.players[2] ? 'playing' : 'waiting';
}

function getPublicRoomState(room) {
  return {
    roomCode: room.roomCode,
    level: room.level,
    category: room.category,
    gridSize: room.gridSize,
    grid: room.grid,
    words: room.words.map((w) => ({
      word: w.word,
      foundBy: w.foundBy,
      cells: w.foundBy ? w.cells : [],
      meaning: w.foundBy ? w.meaning : null,
      visual: w.foundBy ? w.visual : null
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
    resetVotes: room.resetVotes
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
      const chosenCategory = CATEGORIES[category] ? category : 'Animals';
      room = createRoom(code, chosenCategory);
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

  // Auto-rejoin after brief connection drops without losing score or slot
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
      // Helpful hint if player dragged from last letter to first letter
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
    room.lastFound = {
      word: matched.word,
      meaning: matched.meaning,
      visual: matched.visual,
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

  // Mutual-confirmation Reset (requires BOTH players to confirm)
  socket.on('requestReset', () => {
    const { roomCode, slot } = socket.data;
    if (!roomCode || !slot) return;

    const room = rooms.get(roomCode);
    if (!room || !room.players[1] || !room.players[2]) return;

    room.resetVotes[slot] = true;

    if (room.resetVotes[1] && room.resetVotes[2]) {
      resetRoomPuzzle(room, room.category);
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

  socket.on('restartGame', ({ category }) => {
    const { roomCode } = socket.data;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    resetRoomPuzzle(room, category);
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

    // Wait 60 seconds before removing player so temporary network blips can auto-rejoin
    clearDisconnectTimer(roomCode, slot);
    const timer = setTimeout(() => {
      const currentRoom = rooms.get(roomCode);
      if (!currentRoom) return;

      const p = currentRoom.players[slot];
      if (p && !p.connected) {
        currentRoom.players[slot] = null;
        currentRoom.resetVotes = { 1: false, 2: false };
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
