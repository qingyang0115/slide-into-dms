// Boot, scaling, input, and scene/state switching.

const CONFIG = {
  width: 450,  // logical resolution (phone portrait)
  height: 800,
  replyDelay: 1.0, // seconds before the crush's reply appears on the result screen
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
  'char_crush_amused.png',
  'char_crush_unimpressed.png',
  'char_player_idle.png',
  'char_player_sweat.png',
  'char_player_panic.png',
  'char_player_happy.png',
  'fx_sweat_vignette.png',
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
const levelData = { levels: [] }; // filled from data/levels.json at boot

const progress = {
  levelIndex: 0,
  lastResult: null, // { success, entries, reply, tone }
  tones: { chill: 0, flirty: 0, unhinged: 0 }, // counts of completed answers (drives the ending, step 7)
  reset() {
    this.levelIndex = 0;
    this.lastResult = null;
    this.tones = { chill: 0, flirty: 0, unhinged: 0 };
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

  level: {
    enter() {
      Game.start(levelData.levels[progress.levelIndex]);
    },
    update(dt) {
      Game.update(dt);
      if (Game.finished()) this.send();
    },
    // Locks in the bar as the sent message and picks the crush's reaction.
    send() {
      const success = Game.isClean();
      const answer = Game.lockedAnswer();
      const fails = Game.level.failReplies;
      if (success) progress.tones[answer.tone] = (progress.tones[answer.tone] || 0) + 1;
      progress.lastResult = {
        success,
        entries: Game.entries.slice(),
        reply: success ? answer.reply : fails[Math.floor(Math.random() * fails.length)],
        tone: success ? answer.tone : null,
      };
      setState('result');
    },
    draw() {
      drawFullscreen('bg_phone.png');
      // Anxiety shakes everything on the phone except the backdrop and the vignette.
      ctx.save();
      const [sx, sy] = Anxiety.shakeOffset();
      ctx.translate(sx, sy);
      Chat.draw(Game.level.crushMessage, Game.entries);
      Game.draw();
      ctx.restore();
      Anxiety.drawVignette();
      drawCenteredText(`level ${progress.levelIndex + 1}/${levelData.levels.length}   move: WASD/arrows, slow: Shift`, 772, 12, '#eee');
    },
  },

  // Chat view: your sent message, then (after a beat) the crush's reaction.
  result: {
    enter() {
      this.t = 0;
    },
    update(dt) {
      this.t += dt;
    },
    replyShown() {
      return this.t >= CONFIG.replyDelay;
    },
    draw() {
      const r = progress.lastResult;
      drawFullscreen('bg_phone.png');
      Chat.drawCrushMessage(Game.level.crushMessage);
      Chat.drawReplyBar(r.entries, '(you sent nothing...)');
      Chat.drawPlayerAvatar(r.success ? 'happy' : 'panic');
      if (!this.replyShown()) return;
      Chat.drawCrushMessage(r.reply, r.success ? 'amused' : 'unimpressed', 270);
      drawCenteredText('press Space / click', 600, 16, '#ffd');
    },
    onConfirm() {
      if (!this.replyShown()) {
        this.t = CONFIG.replyDelay; // first press just skips the wait
        return;
      }
      if (!progress.lastResult.success) return setState('gameover');
      progress.levelIndex++;
      if (progress.levelIndex >= levelData.levels.length) return setState('gameover');
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
function showBootError(msg) {
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  drawCenteredText('Could not start the game', 300, 22, '#f99');
  Chat.wrapLines(msg, 380, '15px system-ui, sans-serif').forEach((l, i) => drawCenteredText(l, 350 + i * 22, 15, '#ddd'));
}

Promise.all([
  Assets.loadAll(PRELOAD),
  fetch('data/levels.json').then((r) => {
    if (!r.ok) throw new Error(`levels.json: HTTP ${r.status}`);
    return r.json();
  }),
]).then(([, data]) => {
  levelData.levels = data.levels;
  setState('title');
  requestAnimationFrame(frame);
}).catch((err) => {
  console.error(err);
  // Opening index.html as a file:// URL blocks fetch(); a local server fixes it.
  showBootError(`${err.message}. Run a local server (python -m http.server) and open it from there.`);
});
