const socket = io();

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const roomCodeInput = document.getElementById('room-code');
const genRoomBtn = document.getElementById('gen-room-btn');
const playerNameInput = document.getElementById('player-name');
const categorySelect = document.getElementById('category-select');
const joinBtn = document.getElementById('join-btn');
const lobbyError = document.getElementById('lobby-error');

const displayRoom = document.getElementById('display-room');
const overlayRoomCode = document.getElementById('overlay-room-code');
const copyLinkBtn = document.getElementById('copy-link-btn');
const resetBtn = document.getElementById('reset-btn');
const connStatus = document.getElementById('conn-status');

const resetBanner = document.getElementById('reset-banner');
const resetBannerText = document.getElementById('reset-banner-text');
const confirmResetBtn = document.getElementById('confirm-reset-btn');
const declineResetBtn = document.getElementById('decline-reset-btn');
const hintToast = document.getElementById('hint-toast');

const gridEl = document.getElementById('grid');
const wordListEl = document.getElementById('word-list');
const displayCategory = document.getElementById('display-category');
const levelLabel = document.getElementById('level-label');
const waitingOverlay = document.getElementById('waiting-overlay');

const meaningPicture = document.getElementById('meaning-picture');
const meaningWord = document.getElementById('meaning-word');
const meaningFinder = document.getElementById('meaning-finder');
const meaningText = document.getElementById('meaning-text');

const resultModal = document.getElementById('result-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerSummary = document.getElementById('winner-summary');
const nextCategorySelect = document.getElementById('next-category');
const playAgainBtn = document.getElementById('play-again-btn');

// Client state & persistent session token for auto-reconnect
const playerToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
let selectedSlot = 1;
let selectedAvatar = '🦊';
let mySlot = null;
let sessionInfo = null;
let currentState = null;

// Drag state
let isDragging = false;
let dragStart = null;
let dragEnd = null;

// Pre-fill room code from URL query (?room=ABCD)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
  roomCodeInput.value = urlParams.get('room').toUpperCase();
}

genRoomBtn.addEventListener('click', () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  roomCodeInput.value = code;
});

document.querySelectorAll('.slot-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSlot = Number(btn.dataset.slot);
  });
});

document.querySelectorAll('.avatar-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.avatar-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAvatar = btn.dataset.avatar;
  });
});

joinBtn.addEventListener('click', () => {
  lobbyError.textContent = '';
  if (!roomCodeInput.value.trim()) {
    genRoomBtn.click();
  }
  sessionInfo = {
    roomCode: roomCodeInput.value.trim().toUpperCase(),
    slot: selectedSlot,
    name: playerNameInput.value,
    avatar: selectedAvatar,
    category: categorySelect.value,
    token: playerToken
  };
  socket.emit('joinRoom', sessionInfo);
});

copyLinkBtn.addEventListener('click', () => {
  const url = `${window.location.origin}?room=${currentState.roomCode}`;
  navigator.clipboard.writeText(url).then(() => {
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => (copyLinkBtn.textContent = 'Copy Invite Link'), 1500);
  });
});

// Mutual-confirmation Reset buttons
resetBtn.addEventListener('click', () => {
  if (!currentState || !mySlot) return;
  if (currentState.resetVotes?.[mySlot]) {
    socket.emit('cancelReset');
  } else {
    socket.emit('requestReset');
  }
});

confirmResetBtn.addEventListener('click', () => {
  socket.emit('requestReset');
});

declineResetBtn.addEventListener('click', () => {
  socket.emit('cancelReset');
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('restartGame', { category: nextCategorySelect.value });
});

// Socket lifecycle & auto-rejoin
socket.on('connect', () => {
  connStatus.classList.add('hidden');
  if (mySlot && sessionInfo) {
    socket.emit('rejoinRoom', {
      roomCode: sessionInfo.roomCode,
      slot: sessionInfo.slot,
      token: playerToken
    });
  }
});

socket.on('disconnect', () => {
  if (mySlot) {
    connStatus.classList.remove('hidden');
  }
});

socket.on('rejoinFailed', () => {
  mySlot = null;
  sessionInfo = null;
  gameScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  lobbyError.textContent = 'Session expired after disconnecting. Please rejoin the room.';
});

socket.on('joinError', (msg) => {
  lobbyError.textContent = msg;
});

socket.on('joinedSuccess', ({ slot }) => {
  mySlot = slot;
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
});

socket.on('roomState', (state) => {
  currentState = state;
  renderGame(state);
});

socket.on('invalidSelection', () => {
  gridEl.classList.add('shake');
  setTimeout(() => gridEl.classList.remove('shake'), 250);
});

socket.on('selectionHint', (msg) => {
  hintToast.textContent = msg;
  hintToast.classList.remove('hidden');
  gridEl.classList.add('shake');
  setTimeout(() => gridEl.classList.remove('shake'), 250);
  setTimeout(() => hintToast.classList.add('hidden'), 2500);
});

function renderVisualSVG(visual) {
  if (!visual) {
    return `<span class="placeholder-icon">📖</span>`;
  }

  if (visual.type === 'flag') {
    const flags = {
      JP: `<svg viewBox="0 0 90 60"><rect width="90" height="60" fill="#ffffff"/><circle cx="45" cy="30" r="16" fill="#bc002d"/></svg>`,
      DE: `<svg viewBox="0 0 90 60"><rect width="90" height="20" y="0" fill="#000000"/><rect width="90" height="20" y="20" fill="#dd0000"/><rect width="90" height="20" y="40" fill="#ffce00"/></svg>`,
      FR: `<svg viewBox="0 0 90 60"><rect width="30" height="60" x="0" fill="#0055a4"/><rect width="30" height="60" x="30" fill="#ffffff"/><rect width="30" height="60" x="60" fill="#ef4135"/></svg>`,
      IT: `<svg viewBox="0 0 90 60"><rect width="30" height="60" x="0" fill="#009246"/><rect width="30" height="60" x="30" fill="#ffffff"/><rect width="30" height="60" x="60" fill="#ce2b37"/></svg>`,
      BE: `<svg viewBox="0 0 90 60"><rect width="30" height="60" x="0" fill="#000000"/><rect width="30" height="60" x="30" fill="#fdda24"/><rect width="30" height="60" x="60" fill="#ef3340"/></svg>`,
      PL: `<svg viewBox="0 0 90 60"><rect width="90" height="30" y="0" fill="#ffffff"/><rect width="90" height="30" y="30" fill="#dc143c"/></svg>`,
      SE: `<svg viewBox="0 0 90 60"><rect width="90" height="60" fill="#006aa7"/><rect width="12" height="60" x="25" fill="#fecc00"/><rect width="90" height="12" y="24" fill="#fecc00"/></svg>`,
      NO: `<svg viewBox="0 0 90 60"><rect width="90" height="60" fill="#ba0c2f"/><rect width="14" height="60" x="24" fill="#ffffff"/><rect width="90" height="14" y="23" fill="#ffffff"/><rect width="8" height="60" x="27" fill="#00205b"/><rect width="90" height="8" y="26" fill="#00205b"/></svg>`,
      IS: `<svg viewBox="0 0 90 60"><rect width="90" height="60" fill="#02529c"/><rect width="14" height="60" x="24" fill="#ffffff"/><rect width="90" height="14" y="23" fill="#ffffff"/><rect width="8" height="60" x="27" fill="#dc1e35"/><rect width="90" height="8" y="26" fill="#dc1e35"/></svg>`,
      BR: `<svg viewBox="0 0 90 60"><rect width="90" height="60" fill="#009c3b"/><polygon points="45,8 80,30 45,52 10,30" fill="#ffdf00"/><circle cx="45" cy="30" r="12" fill="#002776"/></svg>`,
      CA: `<svg viewBox="0 0 90 60"><rect width="22" height="60" x="0" fill="#d80621"/><rect width="46" height="60" x="22" fill="#ffffff"/><rect width="22" height="60" x="68" fill="#d80621"/><polygon points="45,14 49,25 58,23 52,32 58,37 47,37 46,46 44,46 43,37 32,37 38,32 32,23 41,25" fill="#d80621"/></svg>`,
      MX: `<svg viewBox="0 0 90 60"><rect width="30" height="60" x="0" fill="#006847"/><rect width="30" height="60" x="30" fill="#ffffff"/><rect width="30" height="60" x="60" fill="#ce1126"/><circle cx="45" cy="30" r="7" fill="#8b5a2b"/></svg>`
    };
    return flags[visual.code] || `<span class="placeholder-icon">🏳️</span>`;
  }

  return `
    <svg viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${visual.bg || '#f1f5f9'}"/>
      <circle cx="50" cy="50" r="36" fill="rgba(255,255,255,0.25)"/>
      <text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-size="52">${visual.icon}</text>
    </svg>
  `;
}

function showMeaningCard(item, players) {
  if (!item) {
    meaningPicture.innerHTML = `<span class="placeholder-icon">📖</span>`;
    meaningWord.textContent = 'Find a word to learn its meaning!';
    meaningFinder.classList.add('hidden');
    meaningText.textContent = 'When any player finds a word on the 10×10 board, its picture and definition will appear here.';
    return;
  }

  meaningPicture.innerHTML = renderVisualSVG(item.visual);
  meaningWord.textContent = item.word;
  meaningText.textContent = item.meaning;

  const finder = players[item.foundBy];
  if (finder) {
    meaningFinder.textContent = `${finder.avatar} Found by ${finder.name}`;
    meaningFinder.className = `finder-pill p${item.foundBy}`;
  } else {
    meaningFinder.classList.add('hidden');
  }
}

function renderResetUI(state) {
  const votes = state.resetVotes || { 1: false, 2: false };
  const otherSlot = mySlot === 1 ? 2 : 1;
  const iVoted = Boolean(votes[mySlot]);
  const otherVoted = Boolean(votes[otherSlot]);

  if (iVoted) {
    resetBtn.textContent = 'Cancel Reset (1/2)';
    resetBtn.classList.add('pending');
  } else {
    resetBtn.textContent = 'Reset Game';
    resetBtn.classList.remove('pending');
  }

  if (otherVoted && !iVoted) {
    const requester = state.players[otherSlot];
    resetBannerText.textContent = `${requester?.avatar || ''} ${requester?.name || 'Opponent'} wants to reset the game.`;
    resetBanner.classList.remove('hidden');
  } else {
    resetBanner.classList.add('hidden');
  }
}

function renderGame(state) {
  displayRoom.textContent = state.roomCode;
  overlayRoomCode.textContent = state.roomCode;
  displayCategory.textContent = state.category;
  levelLabel.textContent = `Level ${state.level} (${state.gridSize}×${state.gridSize})`;
  nextCategorySelect.value = state.category;

  updatePlayerCard(1, state.players[1]);
  updatePlayerCard(2, state.players[2]);
  renderResetUI(state);

  waitingOverlay.classList.toggle('hidden', state.status !== 'waiting');

  showMeaningCard(state.lastFound, state.players);

  const cellOwnership = new Map();
  state.words.forEach((w) => {
    if (w.foundBy) {
      w.cells.forEach(({ r, c }) => {
        const key = `${r},${c}`;
        const prev = cellOwnership.get(key);
        if (prev && prev !== w.foundBy) cellOwnership.set(key, 'both');
        else cellOwnership.set(key, w.foundBy);
      });
    }
  });

  gridEl.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
  gridEl.innerHTML = '';
  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = state.grid[r][c];
      cell.dataset.r = r;
      cell.dataset.c = c;

      const owner = cellOwnership.get(`${r},${c}`);
      if (owner === 1) cell.classList.add('found-p1');
      else if (owner === 2) cell.classList.add('found-p2');
      else if (owner === 'both') cell.classList.add('found-both');

      gridEl.appendChild(cell);
    }
  }

  wordListEl.innerHTML = '';
  state.words.forEach((w) => {
    const li = document.createElement('li');
    li.className = 'word-item';
    if (w.foundBy) {
      li.classList.add(`found-${w.foundBy}`);
      li.title = 'Click to view picture and meaning';
      li.addEventListener('click', () => showMeaningCard(w, state.players));
    }

    const wordSpan = document.createElement('span');
    wordSpan.textContent = w.word;
    li.appendChild(wordSpan);

    if (w.foundBy && state.players[w.foundBy]) {
      const finderSpan = document.createElement('span');
      finderSpan.textContent = state.players[w.foundBy].avatar;
      li.appendChild(finderSpan);
    }

    wordListEl.appendChild(li);
  });

  if (state.status === 'finished') {
    resultModal.classList.remove('hidden');
    const p1 = state.players[1];
    const p2 = state.players[2];

    if (state.winner === 'draw') {
      winnerTitle.textContent = "It's a Tie!";
    } else {
      const champ = state.players[state.winner];
      winnerTitle.textContent = `${champ.avatar} ${champ.name} Wins!`;
    }
    winnerSummary.textContent = `${p1?.name || 'Player 1'}: ${p1?.score || 0}  —  ${p2?.name || 'Player 2'}: ${p2?.score || 0}`;
  } else {
    resultModal.classList.add('hidden');
  }
}

function updatePlayerCard(slot, player) {
  const avatarEl = document.getElementById(`p${slot}-avatar`);
  const nameEl = document.getElementById(`p${slot}-name`);
  const scoreEl = document.getElementById(`p${slot}-score`);

  if (player) {
    avatarEl.textContent = player.avatar;
    const statusSuffix = player.connected === false ? ' (Reconnecting...)' : '';
    nameEl.textContent = player.name + (slot === mySlot ? ' (You)' : '') + statusSuffix;
    scoreEl.textContent = player.score;
  } else {
    avatarEl.textContent = '❓';
    nameEl.textContent = 'Waiting...';
    scoreEl.textContent = '0';
  }
}

function computeSnappedLine(start, target) {
  const dr = target.r - start.r;
  const dc = target.c - start.c;

  if (dr === 0 && dc === 0) {
    return { end: start, cells: [start] };
  }

  const angle = Math.atan2(dr, dc);
  const octant = Math.round(angle / (Math.PI / 4));
  const snappedAngle = octant * (Math.PI / 4);

  const stepR = Math.round(Math.sin(snappedAngle));
  const stepC = Math.round(Math.cos(snappedAngle));
  const steps = Math.max(Math.abs(dr), Math.abs(dc));

  const maxIdx = currentState.gridSize - 1;
  const cells = [];
  let lastCell = start;

  for (let i = 0; i <= steps; i++) {
    const r = start.r + stepR * i;
    const c = start.c + stepC * i;
    if (r < 0 || r > maxIdx || c < 0 || c > maxIdx) break;
    lastCell = { r, c };
    cells.push(lastCell);
  }

  return { end: lastCell, cells };
}

function clearPreview() {
  const cls = `selecting-p${mySlot}`;
  gridEl.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls));
}

function highlightPreview(cells) {
  clearPreview();
  const cls = `selecting-p${mySlot}`;
  cells.forEach(({ r, c }) => {
    const el = gridEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (el) el.classList.add(cls);
  });
}

function getCellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !el.classList.contains('cell')) return null;
  return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
}

function startDrag(cell) {
  if (!currentState || currentState.status !== 'playing' || !cell) return;
  isDragging = true;
  dragStart = cell;
  dragEnd = cell;
  highlightPreview([cell]);
}

function moveDrag(cell) {
  if (!isDragging || !cell) return;
  const { end, cells } = computeSnappedLine(dragStart, cell);
  dragEnd = end;
  highlightPreview(cells);
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  clearPreview();

  if (dragStart && dragEnd && (dragStart.r !== dragEnd.r || dragStart.c !== dragEnd.c)) {
    socket.emit('submitSelection', { start: dragStart, end: dragEnd });
  }
  dragStart = null;
  dragEnd = null;
}

gridEl.addEventListener('mousedown', (e) => {
  const cellEl = e.target.closest('.cell');
  if (cellEl) {
    startDrag({ r: Number(cellEl.dataset.r), c: Number(cellEl.dataset.c) });
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const cell = getCellFromPoint(e.clientX, e.clientY);
  if (cell) moveDrag(cell);
});

window.addEventListener('mouseup', endDrag);

gridEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const cell = getCellFromPoint(touch.clientX, touch.clientY);
  if (cell) startDrag(cell);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const touch = e.touches[0];
  const cell = getCellFromPoint(touch.clientX, touch.clientY);
  if (cell) moveDrag(cell);
}, { passive: false });

window.addEventListener('touchend', endDrag);
