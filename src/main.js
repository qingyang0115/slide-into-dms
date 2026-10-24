// Boot, scaling, input, and scene/state switching.

const CONFIG = {
  width: 450,  // logical resolution (phone portrait)
  height: 800,
  replyDelay: 1.0, // seconds before the crush's reply appears on the result screen
  send: { time: 0.55 },        // the send whoosh over the reply bar before the result screen
  transition: { time: 0.35 },  // screens slide in from the right (it's a game about slides)
  // Death phrase fail screen timeline (seconds since the result screen opened).
  death: {
    readsAsAt: 1.2,  // "which reads as..." fades in (after showing the sent message)
    phraseAt: 2.0,   // the highlighted phrase slams in
    zoomTime: 3.5,   // how long the slow zoom on the phrase lasts
    zoomMax: 1.35,   // final zoom factor
    replyAt: 4.5,    // the crush's special reply appears
  },};

// Every image the game may use. Missing ones become labeled placeholders.
const PRELOAD = [
  'bg_phone.png',
  'bubble_speech.png',
  'player_heart.png',
  'chip_bad.png',
  'chip_good.png',
  'bubble_crush.png',
  'bubble_player.png',
  'char_crush_neutral.png',
  'char_crush_amused.png',
  'char_crush_unimpressed.png',
  'char_crush_suspicious.png',
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
  Sfx.unlock(); // browsers only start audio from a key press / click
  if (e.code === 'KeyM') Sfx.toggleMute();
  input.keys.add(e.code);
  const state = current; // onKey may switch state; don't let the same keypress hit the new one
  if (state && state.onKey) state.onKey(e.code);
  if (state === current && (e.code === 'Space' || e.code === 'Enter') && state.onConfirm) state.onConfirm();
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
window.addEventListener('blur', () => input.keys.clear());
// Mouse position in logical (450x800) coordinates, however the page is scaled.
function logicalPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * CONFIG.width / r.width, (e.clientY - r.top) * CONFIG.height / r.height];
}
window.addEventListener('mousemove', (e) => {
  if (current && current.onPointerMove) current.onPointerMove(...logicalPoint(e));
});
window.addEventListener('mouseup', (e) => {
  if (current && current.onPointerUp) current.onPointerUp(...logicalPoint(e));
});
canvas.addEventListener('mousedown', (e) => {
  Sfx.unlock();
  if (!current) return;
  if (current.onPointerDown) {
    current.onPointerDown(...logicalPoint(e)); // screens that need drag/click control (the level)
  } else if (current.onClick) {
    // Logical (450x800) coordinates, regardless of how the page is scaled.
    const r = canvas.getBoundingClientRect();
    current.onClick((e.clientX - r.left) * CONFIG.width / r.width, (e.clientY - r.top) * CONFIG.height / r.height);
  } else if (current.onConfirm) {
    current.onConfirm();
  }
});

// ---------- Shared game progress ----------
const levelData = { levels: [] }; // filled from data/levels.json at boot

const progress = {
  levelIndex: 0,
  lastResult: null, // { success, outcome, entries, reply, tone }
  won: false,       // true when the run ends on the win screen
  tones: { chill: 0, flirty: 0, unhinged: 0 }, // counts of completed answers (drives the ending, step 7)
  reset() {
    this.levelIndex = 0;
    this.lastResult = null;
    this.won = false;
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

// ---------- Flow ----------
// Where to go next. Targets (same format as story.json "next" and levels.json afterWin/afterFail):
//   level:<id>   scene:<id>   retry (replay the level just played)   ending (tone-based ending scene)   end (win screen)   title
// If a scene doesn't exist (story.json missing or typo) we go to `fallback` so the game never dead-ends.
function goTo(target, fallback) {
  const [kind, id] = target.split(':');
  if (kind === 'level') {
    const i = levelData.levels.findIndex((l) => l.id === id);
    if (i < 0) { console.warn(`goTo: unknown level "${id}"`); return goTo(fallback || 'end'); }
    progress.levelIndex = i;
    return setState('level');
  }
  if (kind === 'scene') {
    if (!Story.has(id)) {
      if (!fallback) console.warn(`goTo: unknown scene "${id}"`);
      return goTo(fallback || 'end');
    }
    return Story.start(id);
  }
  if (target === 'ending') { // pick the ending scene from the tone counts (story.json "endings")
    const sceneId = Story.pickEnding(progress.tones);
    return sceneId ? goTo(`scene:${sceneId}`, 'end') : goTo('end');
  }
  if (target === 'retry') return setState('level');
  if (target === 'title') return setState('title');
  if (target === 'gameover') { progress.won = false; return setState('gameover'); }
  progress.won = true; // 'end'
  setState('gameover');
}

// After a level: its afterWin / afterFail scene, else the next level (win) or the game over screen (fail).
function afterLevel(success) {
  const levels = levelData.levels;
  const level = levels[progress.levelIndex];
  if (success) {
    const next = levels[progress.levelIndex + 1];
    const fallback = next ? `level:${next.id}` : 'end';
    goTo(level.afterWin || fallback, fallback);
  } else {
    goTo(level.afterFail || 'gameover', 'gameover');
  }
}

// Small caption under the crush's reply explaining how the level ended.
const OUTCOME_NOTES = {
  complete: (r) => (r.clean ? '' : '(sent, with a few extras...)'),
  timeout: () => '(time ran out)',
  satisfaction: () => '(she lost interest)',
};

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
      drawCenteredText(Sfx.muted ? 'M: unmute sound' : 'M: mute sound', 720, 12, '#ccc');
    },
    onConfirm() {
      Sfx.play('click');
      goTo('scene:intro', `level:${levelData.levels[0].id}`);
    },
  },

  level: {
    enter() {
      Game.start(levelData.levels[progress.levelIndex]);
      this.sendT = null; // set while the send whoosh plays
    },
    update(dt) {
      if (this.sendT !== null) { // message is on its way: whoosh, then the result screen
        this.sendT += dt;
        Game.updateFx(dt);
        if (this.sendT >= CONFIG.send.time) setState('result');
        return;
      }
      Game.update(dt);
      Game.updateFx(dt);
      if (Game.finished()) this.send();
    },
    // Space while she is "typing" skips straight to the bullets.
    onConfirm() {
      Game.skipIntro();
    },
    // Mouse: grab/click a notification banner, otherwise a click skips the typing wait.
    onPointerDown(x, y) {
      if (Game.introDone() && !Game.finished() && Notifs.pointerDown(x, y)) return;
      Game.skipIntro();
    },
    onPointerMove(x, y) { Notifs.pointerMove(x, y); },
    onPointerUp(x, y) { Notifs.pointerUp(x, y); },
    // Q dismisses the newest notification banner (so keyboard players can keep moving).
    onKey(code) {
      if (code === 'KeyQ' && !Game.finished()) Notifs.dismissNewest();
    },
    // Locks in the bar as the sent message and picks the crush's reaction from Game.endReason.
    // Passing = sentence completed with satisfaction left (even with mistakes in the message).
    send() {
      const outcome = Game.endReason;
      const success = outcome === 'complete';
      const answer = Game.lockedAnswer();
      const fails = Game.level.failReplies;
      if (success) progress.tones[answer.tone] = (progress.tones[answer.tone] || 0) + 1;
      let reply;
      if (success) reply = answer.reply;
      else if (outcome === 'death') reply = Game.death.reply;
      else reply = fails[Math.floor(Math.random() * fails.length)];
      progress.lastResult = {
        success,
        outcome,
        clean: Game.isClean(),
        entries: Game.entries.slice(),
        reply,
        tone: success ? answer.tone : null,
        death: outcome === 'death' ? { phrase: Game.death.phrase } : null,
      };
      Sfx.play('whoosh');
      this.sendT = 0;
    },
    draw() {
      drawFullscreen('bg_phone.png');
      // Anxiety shakes everything on the phone except the backdrop and the vignette.
      ctx.save();
      const [sx, sy] = Anxiety.shakeOffset();
      const [kx, ky] = Game.kickOffset(); // extra jolt right after a hit
      ctx.translate(sx + kx, sy + ky);
      const sendP = this.sendT === null ? undefined : Math.min(1, this.sendT / CONFIG.send.time);
      Chat.draw(Game.level.crushMessage, Game.entries, sendP);
      Game.draw();
      ctx.restore();
      Anxiety.drawVignette();
      Game.drawFlash();
      drawCenteredText(`level ${progress.levelIndex + 1}/${levelData.levels.length}   move: WASD/arrows, slow: Shift   M: ${Sfx.muted ? 'unmute' : 'mute'}`, 772, 12, '#eee');
    },
  },

  // Chat view: your sent message, then (after a beat) the crush's reaction.
  // A death phrase gets a longer fail screen: reveal what the message reads as, then her reply.
  result: {
    enter() {
      this.t = 0;
      this.cues = {}; // which sounds have played (flags, so skipping ahead still plays the important ones)
    },
    update(dt) {
      this.t += dt;
      this.playCues();
    },
    // Typing blips while she types, then her reply pops in with a win/fail sting. Death phrase: boom on the slam.
    playCues() {
      const r = progress.lastResult, c = this.cues, t = this.t;
      const once = (key, when, fn) => { if (!c[key] && t >= when) { c[key] = true; fn(); } };
      const typeFrom = this.typingFrom();
      once('t1', typeFrom + 0.1, () => Sfx.play('type'));
      once('t2', typeFrom + 0.4, () => Sfx.play('type', { rate: 1.12 }));
      once('t3', typeFrom + 0.7, () => Sfx.play('type', { rate: 1.24 }));
      if (r.death) once('boom', CONFIG.death.phraseAt, () => Sfx.play('boom'));
      once('reply', this.replyAt(), () => { Sfx.play('pop'); Sfx.play(r.success ? 'win' : 'fail'); });
    },
    // She starts "typing" right away, or for the last second before a death-phrase reply.
    typingFrom() {
      return progress.lastResult.death ? CONFIG.death.replyAt - 1.0 : 0;
    },
    replyAt() {
      return progress.lastResult.death ? CONFIG.death.replyAt : CONFIG.replyDelay;
    },
    replyShown() {
      return this.t >= this.replyAt();
    },
    drawReveal(r) {
      const c = CONFIG.death, t = this.t;
      if (t >= c.readsAsAt) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (t - c.readsAsAt) / 0.4);
        drawCenteredText('which reads as...', 322, 18, '#ddd');
        ctx.restore();
      }
      if (t < c.phraseAt) return;

      const dt = t - c.phraseAt;
      const pop = Math.min(1, dt / 0.25);
      const zoom = 1 + (c.zoomMax - 1) * Math.min(1, dt / c.zoomTime); // slow zoom
      const scale = (0.3 + 0.7 * (1 - Math.pow(1 - pop, 3))) * zoom;   // slam-in, then zoom
      const shake = dt < 0.4 ? (1 - dt / 0.4) * 6 : 0;
      const text = r.death.phrase.toUpperCase();

      ctx.save();
      let size = 40;
      ctx.font = `bold ${size}px system-ui, sans-serif`;
      while (size > 16 && ctx.measureText(text).width > 280) {
        size -= 2;
        ctx.font = `bold ${size}px system-ui, sans-serif`;
      }
      const w = ctx.measureText(text).width + 28, h = size + 18;
      ctx.translate(CONFIG.width / 2 + (Math.random() - 0.5) * 2 * shake, 375 + (Math.random() - 0.5) * 2 * shake);
      ctx.rotate(-0.03);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffe066'; // highlighter
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#b00020';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 2);
      ctx.restore();
    },
    draw() {
      const r = progress.lastResult;
      drawFullscreen('bg_phone.png');
      Chat.drawCrushMessage(Game.level.crushMessage, r.death ? 'suspicious' : 'neutral');
      Chat.drawReplyBar(r.entries, '(you sent nothing...)', 0, r.death ? 0.35 : 0);
      Chat.drawPlayerAvatar(r.success ? 'happy' : 'panic');
      if (r.death) this.drawReveal(r);
      const replyDy = r.death ? 425 : 270;
      if (!this.replyShown()) {
        if (this.t >= this.typingFrom()) Chat.drawCrushMessage('', 'neutral', replyDy, 0, { typing: true });
        return;
      }

      // Pass with a clean message: amused. Pass with mistakes: neutral. Fail: unimpressed.
      const face = r.success ? (r.clean ? 'amused' : 'neutral') : 'unimpressed';
      Chat.drawCrushMessage(r.reply, face, replyDy, 0, { pop: Math.min(1, (this.t - this.replyAt()) / 0.25) });
      const note = OUTCOME_NOTES[r.outcome] && OUTCOME_NOTES[r.outcome](r);
      if (note) drawCenteredText(note, 570, 14, '#ddd');
      drawCenteredText('press Space / click', 600, 16, '#ffd');
    },
    onConfirm() {
      Sfx.play('click');
      if (!this.replyShown()) {
        this.t = this.replyAt(); // first press just skips the wait
        this.playCues();
        return;
      }
      afterLevel(progress.lastResult.success);
    },
  },

  // Doubles as the win screen ("end" target) until the real ending screen exists (build steps 7/9).
  gameover: {
    enter() {
      this.won = progress.won;
    },
    draw() {
      drawFullscreen(this.won ? 'screen_ending.png' : 'screen_gameover.png');
      drawCenteredText(this.won ? 'THE END' : 'GAME OVER', 300, 40);
      drawCenteredText(this.won ? 'Space / click: back to title' : 'Space / click: retry level', 520, 18, '#ffd');
      if (!this.won) drawCenteredText('Esc: back to title', 560, 14, '#ccc');
    },
    onConfirm() {
      Sfx.play('click');
      if (this.won) setState('title');
      else setState('level'); // retry the level that was failed
    },
    onKey(code) {
      if (code === 'Escape') setState('title');
    },
  },
};

states.story = Story; // story.js is the 'story' state

let current = null;
let currentName = '';

// Screen transition: the old screen is snapshotted and slides out to the left while the new one
// slides in from the right. `trans` is null when no transition is running.
const snap = document.createElement('canvas');
snap.width = CONFIG.width;
snap.height = CONFIG.height;
const snapCtx = snap.getContext('2d');
let trans = null;

function setState(name) {
  if (current) { // everything but the very first screen slides in
    snapCtx.clearRect(0, 0, CONFIG.width, CONFIG.height);
    snapCtx.drawImage(canvas, 0, 0);
    trans = { t: 0 };
  }
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
  if (trans) {
    trans.t += dt;
    const k = Math.min(1, trans.t / CONFIG.transition.time);
    const e = 1 - Math.pow(1 - k, 3); // ease out
    ctx.drawImage(snap, -e * CONFIG.width, 0);
    ctx.save();
    ctx.translate((1 - e) * CONFIG.width, 0);
    current.draw();
    ctx.restore();
    if (k >= 1) trans = null;
  } else {
    current.draw();
  }

  requestAnimationFrame(frame);
}

// ---------- Boot ----------
function showBootError(msg) {
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  drawCenteredText('Could not start the game', 300, 22, '#f99');
  Chat.wrapLines(msg, 380, '15px system-ui, sans-serif').forEach((l, i) => drawCenteredText(l, 350 + i * 22, 15, '#ddd'));
}

// Optional data files: the game stays playable without them (no story / no sprite sheets).
const fetchOptionalJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

Promise.all([
  Assets.loadAll(PRELOAD),
  fetch('data/levels.json').then((r) => {
    if (!r.ok) throw new Error(`levels.json: HTTP ${r.status}`);
    return r.json();
  }),
  fetchOptionalJSON('data/story.json'),
  fetchOptionalJSON('data/sprites.json'),
  fetchOptionalJSON('data/sfx.json'),
]).then(([, data, story, sprites, sfx]) => {
  Sfx.setManifest(sfx);
  levelData.levels = data.levels;
  DeathPhrase.validate(levelData.levels); // console.warns any unfair or unreachable death phrase
  Notifs.validate(levelData.levels);      // console.warns notifications without messages or a rate
  for (const l of levelData.levels) {
    for (const name of l.patterns) if (!Patterns[name]) console.warn(`level "${l.id}": unknown pattern "${name}"`);
  }
  Sprites.setDefs(sprites);
  if (story) Story.setData(story);
  else console.warn('data/story.json missing or invalid: story scenes are skipped');
  Story.validate(levelData.levels); // console.warns broken scene links
  // backgrounds, story sprites, notification banner + avatars (missing ones become placeholders)
  return Assets.loadAll([...Story.assetNames(), ...Notifs.assetNames(levelData.levels)]);
}).then(() => {
  setState('title');
  requestAnimationFrame(frame);
}).catch((err) => {
  console.error(err);
  // Opening index.html as a file:// URL blocks fetch(); a local server fixes it.
  showBootError(`${err.message}. Run a local server (python -m http.server) and open it from there.`);
});
