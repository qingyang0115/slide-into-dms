// Boot, scaling, input, and scene/state switching.

const CONFIG = {
  width: 450,  // logical resolution (phone portrait)
  height: 800,
  // Placeholder level count until levels.json loading lands (build step 4).
  placeholderLevelCount: 2,
  placeholderLevelTime: 5, // seconds before the stub level auto-"sends"
};

// Every image the game may use. Missing ones become labeled placeholders.
const PRELOAD = [
  'bg_phone.png',
  'player_heart.png',
  'chip_bad.png',
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

  // Stub level: real bullet phase arrives in build steps 2–4.
  level: {
    enter() {
      this.timeLeft = CONFIG.placeholderLevelTime;
      Game.start();
    },
    update(dt) {
      Game.update(dt);
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.send(false);
    },
    send(success) {
      progress.lastResult = {
        success,
        message: success ? 'yeah i\'ll be there' : 'yeah lol u up? sorry',
      };
      setState('result');
    },
    draw() {
      drawFullscreen('bg_phone.png');
      drawCenteredText(`LEVEL ${progress.levelIndex + 1}`, 60, 28);
      drawCenteredText(`auto-send in ${Math.ceil(this.timeLeft)}`, 110, 18, '#ffd');
      drawCenteredText('debug: Enter = clean send, L = garbled send', 150, 12, '#ccc');
      drawCenteredText('move: WASD / arrows   slow: Shift', 180, 12, '#ccc');
      Game.draw();
    },
    // W is now "up", so the debug clean-send moved to Enter (not onConfirm: clicks/Space shouldn't end the level).
    onKey(code) {
      if (code === 'Enter') this.send(true);
      if (code === 'KeyL') this.send(false);
    },
  },

  result: {
    draw() {
      const r = progress.lastResult;
      drawFullscreen('bg_phone.png');
      drawCenteredText('you sent:', 220, 18, '#ddd');
      drawCenteredText(`"${r.message}"`, 260, 22);
      drawCenteredText(r.success ? 'crush: cool see u there' : 'seen 11:42pm', 360, 22, r.success ? '#9f9' : '#f99');
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
