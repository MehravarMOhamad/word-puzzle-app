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
const langEnBtn = document.getElementById('lang-en-btn');
const langFaBtn = document.getElementById('lang-fa-btn');
const soundBtn = document.getElementById('sound-btn');
const connStatus = document.getElementById('conn-status');

const resetBanner = document.getElementById('reset-banner');
const resetBannerText = document.getElementById('reset-banner-text');
const confirmResetBtn = document.getElementById('confirm-reset-btn');
const declineResetBtn = document.getElementById('decline-reset-btn');

const langBanner = document.getElementById('lang-banner');
const langBannerText = document.getElementById('lang-banner-text');
const confirmLangBtn = document.getElementById('confirm-lang-btn');
const declineLangBtn = document.getElementById('decline-lang-btn');

const hintToast = document.getElementById('hint-toast');

const gridEl = document.getElementById('grid');
const wordListEl = document.getElementById('word-list');
const displayCategory = document.getElementById('display-category');
const levelLabel = document.getElementById('level-label');
const waitingOverlay = document.getElementById('waiting-overlay');

const meaningWord = document.getElementById('meaning-word');
const speakAgainBtn = document.getElementById('speak-again-btn');
const meaningFinder = document.getElementById('meaning-finder');
const meaningCounterpart = document.getElementById('meaning-counterpart');
const meaningText = document.getElementById('meaning-text');

const resultModal = document.getElementById('result-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerSummary = document.getElementById('winner-summary');
const nextCategorySelect = document.getElementById('next-category');
const playAgainBtn = document.getElementById('play-again-btn');

// Client state & session token for auto-reconnect
const playerToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
let selectedSlot = 1;
let selectedAvatar = '🦊';
let mySlot = null;
let sessionInfo = null;
let currentState = null;

// Per-player pronunciation setting (stored locally per browser)
let soundEnabled = localStorage.getItem('wordPuzzleSound') !== 'off';
let lastSpokenSeq = 0;
let activeCardWord = null;

// Drag state
let isDragging = false;
let dragStart = null;
let dragEnd = null;

function updateSoundButton() {
  if (soundEnabled) {
    soundBtn.textContent = '🔊 Voice: ON';
    soundBtn.classList.remove('muted');
  } else {
    soundBtn.textContent = '🔇 Voice: OFF';
    soundBtn.classList.add('muted');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

updateSoundButton();

soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('wordPuzzleSound', soundEnabled ? 'on' : 'off');
  updateSoundButton();
});

function pronounceWord(word, lang) {
  if (!word || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  const targetLang = lang === 'fa' ? 'fa-IR' : 'en-US';
  utterance.lang = targetLang;
  utterance.rate = 0.88;

  const voices = window.speechSynthesis.getVoices();
  const matchingVoice = voices.find((v) =>
    v.lang.toLowerCase().startsWith(lang === 'fa' ? 'fa' : 'en')
  );
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.speak(utterance);
}

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

// Mutual Reset Buttons
resetBtn.addEventListener('click', () => {
  if (!currentState || !mySlot) return;
  if (currentState.resetVotes?.[mySlot]) {
    socket.emit('cancelReset');
  } else {
    socket.emit('requestReset');
  }
});

confirmResetBtn.addEventListener('click', () => socket.emit('requestReset'));
declineResetBtn.addEventListener('click', () => socket.emit('cancelReset'));

// Mutual Language Toggle Switch
function handleLangClick(targetLang) {
  if (!currentState || !mySlot) return;
  if (currentState.pendingLang === targetLang && currentState.langVotes?.[mySlot]) {
    socket.emit('cancelLangChange');
    return;
  }
  if (currentState.tableLang === targetLang && !currentState.pendingLang) return;
  socket.emit('requestLangChange', { targetLang });
}

langEnBtn.addEventListener('click', () => handleLangClick('en'));
langFaBtn.addEventListener('click', () => handleLangClick('fa'));
confirmLangBtn.addEventListener('click', () => {
  if (currentState?.pendingLang) {
    socket.emit('requestLangChange', { targetLang: currentState.pendingLang });
  }
});
declineLangBtn.addEventListener('click', () => socket.emit('cancelLangChange'));

speakAgainBtn.addEventListener('click', () => {
  if (activeCardWord && currentState) {
    pronounceWord(activeCardWord, currentState.tableLang);
  }
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

  // Pronounce newly found word once (if this player has voice ON)
  if (state.lastFound && state.lastFound.seq > lastSpokenSeq) {
    lastSpokenSeq = state.lastFound.seq;
    if (soundEnabled) {
      pronounceWord(state.lastFound.word, state.tableLang);
    }
  }
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

function showMeaningCard(item, players, tableLang) {
  if (!item) {
    activeCardWord = null;
    speakAgainBtn.classList.add('hidden');
    meaningWord.textContent = 'Find a word to learn its meaning!';
    meaningWord.className = '';
    meaningFinder.classList.add('hidden');
    meaningCounterpart.classList.add('hidden');
    meaningText.className = 'meaning-text ltr';
    meaningText.textContent = 'When any player finds a word on the 10×10 board, its meaning will appear here.';
    return;
  }

  activeCardWord = item.word;
  speakAgainBtn.classList.remove('hidden');

  meaningWord.textContent = item.word;
  meaningWord.className = tableLang === 'fa' ? 'rtl' : 'ltr';

  const descIsRtl = tableLang === 'en'; // English table -> Farsi counterpart & meaning
  meaningCounterpart.classList.remove('hidden');
  meaningCounterpart.textContent = item.counterpart;
  meaningCounterpart.className = `meaning-counterpart ${descIsRtl ? 'rtl' : 'ltr'}`;

  meaningText.textContent = item.meaning;
  meaningText.className = `meaning-text ${descIsRtl ? 'rtl' : 'ltr'}`;

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

function renderLangUI(state) {
  langEnBtn.classList.remove('active', 'pending');
  langFaBtn.classList.remove('active', 'pending');

  if (state.tableLang === 'en') langEnBtn.classList.add('active');
  else langFaBtn.classList.add('active');

  if (state.pendingLang === 'en') langEnBtn.classList.add('pending');
  if (state.pendingLang === 'fa') langFaBtn.classList.add('pending');

  const votes = state.langVotes || { 1: false, 2: false };
  const otherSlot = mySlot === 1 ? 2 : 1;
  const iVoted = Boolean(votes[mySlot]);
  const otherVoted = Boolean(votes[otherSlot]);

  if (state.pendingLang && otherVoted && !iVoted) {
    const requester = state.players[otherSlot];
    const targetLabel =
      state.pendingLang === 'fa'
        ? 'Farsi Table (معنی انگلیسی)'
        : 'English Table (معنی فارسی)';
    langBannerText.textContent = `${requester?.avatar || ''} ${requester?.name || 'Opponent'} wants to switch to: ${targetLabel}`;
    langBanner.classList.remove('hidden');
  } else {
    langBanner.classList.add('hidden');
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
  renderLangUI(state);

  waitingOverlay.classList.toggle('hidden', state.status !== 'waiting');

  showMeaningCard(state.lastFound, state.players, state.tableLang);

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

  wordListEl.className = `word-list ${state.tableLang === 'fa' ? 'rtl-list' : ''}`;
  wordListEl.innerHTML = '';
  state.words.forEach((w) => {
    const li = document.createElement('li');
    li.className = 'word-item';
    if (w.foundBy) {
      li.classList.add(`found-${w.foundBy}`);
      li.title = 'Click to view meaning & hear word';
      li.addEventListener('click', () => {
        showMeaningCard(w, state.players, state.tableLang);
        if (soundEnabled) pronounceWord(w.word, state.tableLang);
      });
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
