// Boot, scaling, input, and scene/state switching.

const CONFIG = {
  width: 450,  // logical resolution (phone portrait)
  height: 800,
  // Placeholder level count until levels.json loading lands (build step 4).
  placeholderLevelCount: 2,
};

// Every image the game may use. Missing ones become labeled placeholders.
const PRELOAD = [
  'bg_phone.png',
  'player_heart.png',
  'chip_bad.png',
  'chip_good.png',
  'bubble_crush.png',
  'bubble_player.png',
  'char_crush_neutral.png',
  'screen_title.png',
  'screen_gameover.png',
  'screen_ending.png',
];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gameEl = document.getElementById('game');

// ---------- Scaling ----------
// Keep the 450x800 logical screen, scale the whole #game box to fit the window.
function fitToWindow() {
  const scale = Math.min(window.innerWidth / CONFIG.width, window.innerHeight / CONFIG.height);
  gameEl.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitToWindow);
fitToWindow();

// ---------- Input ----------
// `keys` holds currently-held keys (for movement later); `confirm` fires on Space/Enter/click.
const input = {
  keys: new Set(),
  isDown(...codes) { return codes.some((c) => this.keys.has(c)); },
};

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  input.keys.add(e.code);
  const state = current; // onKey may switch state; don't let the same keypress hit the new one
  if (state && state.onKey) state.onKey(e.code);
  if (state === current && (e.code === 'Space' || e.code === 'Enter') && state.onConfirm) state.onConfirm();
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
window.addEventListener('blur', () => input.keys.clear());
canvas.addEventListener('mousedown', () => {
  if (current && current.onConfirm) current.onConfirm();
});

// ---------- Shared game progress ----------
const progress = {
  levelIndex: 0,
  lastResult: null, // { success: bool, message: string }
  reset() {
    this.levelIndex = 0;
    this.lastResult = null;
  },
};

// ---------- Drawing helpers ----------
function drawCenteredText(text, y, size = 24, color = '#fff') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CONFIG.width / 2, y);
  ctx.restore();
}

function drawFullscreen(name) {
  Assets.draw(ctx, name, 0, 0, CONFIG.width, CONFIG.height);
}

// ---------- States ----------
const states = {
  title: {
    enter() {
      progress.reset();
    },
    draw() {
      drawFullscreen('screen_title.png');
      drawCenteredText('SLIDE INTO DMs', 300, 40);
      drawCenteredText('press Space / click to start', 520, 18, '#ffd');
    },
    onConfirm() {
      setState('level');
    },
  },

  // Level data still comes from Game's fallbackLevel; levels.json loading is step 4.
  level: {
    enter() {
      Game.start();
      this.timeLeft = Game.level.timeLimit;
    },
    update(dt) {
      Game.update(dt);
      if (Game.done) return this.send();
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.send(); // out of time: sends whatever is in the bar
    },
    // Turns the bar into the sent message. Crush reply is a stub until step 4.
    send() {
      const success = Game.isClean();
      const answer = Game.lockedAnswer();
      const fails = Game.level.failReplies;
      progress.lastResult = {
        success,
        message: Game.message(),
        reply: success ? answer.reply : fails[Math.floor(Math.random() * fails.length)],
      };
      setState('result');
    },
    draw() {
      drawFullscreen('bg_phone.png');
      Chat.draw(Game.level.crushMessage, Game.entries);
      Game.draw();
      drawCenteredText(`level ${progress.levelIndex + 1}   time ${Math.max(0, Math.ceil(this.timeLeft))}   move: WASD/arrows, slow: Shift`, 772, 12, '#eee');
    },
  },

  result: {
    draw() {
      const r = progress.lastResult;
      drawFullscreen('bg_phone.png');
      drawCenteredText('you sent:', 200, 18, '#ddd');
      const lines = Chat.wrapLines(r.message || '(nothing...)', 380, 'bold 22px system-ui, sans-serif');
      lines.forEach((l, i) => drawCenteredText(l, 240 + i * 30, 22));
      drawCenteredText(r.reply, 240 + lines.length * 30 + 60, 22, r.success ? '#9f9' : '#f99');
      drawCenteredText('press Space / click', 600, 16, '#ffd');
    },
    onConfirm() {
      const r = progress.lastResult;
      if (!r.success) return setState('gameover');
      progress.levelIndex++;
      if (progress.levelIndex >= CONFIG.placeholderLevelCount) return setState('gameover');
      setState('level');
    },
  },

  // Doubles as the win screen until the ending scene exists (build steps 7/9).
  gameover: {
    enter() {
      this.won = progress.lastResult && progress.lastResult.success;
    },
    draw() {
      drawFullscreen(this.won ? 'screen_ending.png' : 'screen_gameover.png');
      drawCenteredText(this.won ? 'THE END' : 'GAME OVER', 300, 40);
      drawCenteredText(this.won ? 'Space / click: back to title' : 'Space / click: retry level', 520, 18, '#ffd');
      if (!this.won) drawCenteredText('Esc: back to title', 560, 14, '#ccc');
    },
    onConfirm() {
      if (this.won) setState('title');
      else setState('level'); // retry the level that was failed
    },
    onKey(code) {
      if (code === 'Escape') setState('title');
    },
  },
};

let current = null;
let currentName = '';

function setState(name) {
  if (current && current.exit) current.exit();
  currentName = name;
  current = states[name];
  if (current.enter) current.enter();
}

// ---------- Main loop ----------
let lastTime = 0;
function frame(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0); // clamp big gaps (tab switch)
  lastTime = time;

  if (current.update) current.update(dt);
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
  current.draw();

  requestAnimationFrame(frame);
}

// ---------- Boot ----------
Assets.loadAll(PRELOAD).then(() => {
  setState('title');
  requestAnimationFrame(frame);
});
