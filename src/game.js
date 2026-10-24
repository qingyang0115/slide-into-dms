// Bullet phase: player movement, bad-word bullets, good words, reply assembly, collisions.
// Timer + crush reply (step 4) and anxiety (step 5) plug in here later.

const GAME_CONFIG = {
  // Play area inside the phone screen (logical px). Chat UI sits above it.
  area: { x: 15, y: 280, w: 420, h: 480 },
  player: {
    speed: 260,       // px/sec
    focusSpeed: 110,  // px/sec while holding Shift
    hitRadius: 4,     // small hitbox (bullet hell feel)
    drawSize: 24,
  },
  chip: {
    height: 28,
    padX: 10,
    font: 'bold 15px system-ui, sans-serif',
    hitShrink: 0.8, // bad-word hitbox is a bit smaller than its drawn chip
  },
  good: {
    speed: 55,          // px/sec drift speed of good words
    hitScale: 1.2,      // good-word hitbox is bigger than its drawn chip (generous)
    respawnDelay: 0.6,  // seconds before a missing good word comes back
  },
  hitInvulnTime: 1.0, // seconds of invulnerability (blinking) after a mistake
};

const Game = {
  area: GAME_CONFIG.area,
  level: null,
  player: null,
  bullets: [],      // bad words
  goods: [],        // good words: { text, answer, index, x, y, vx, vy, w, h }
  pending: {},      // good-word key -> seconds until it (re)spawns
  entries: [],      // the reply bar: { text, kind: 'good' | 'bad' | 'misplaced' }
  locked: null,     // index of the answer the player committed to (null until first good word)
  next: 0,          // index of the next word needed in the locked answer
  done: false,      // sentence completed
  timedOut: false,  // timer ran out
  panicked: false,  // anxiety maxed out
  timeLeft: 0,
  hits: 0,
  time: 0,
  badWords: [],
  patternNames: [],
  patternState: {},

  start(level) {
    this.level = level;
    const a = this.area;
    this.player = { x: a.x + a.w / 2, y: a.y + a.h - 60, invuln: 0, focus: false };
    this.bullets = [];
    this.goods = [];
    this.pending = {};
    this.entries = [];
    this.locked = null;
    this.next = 0;
    this.done = false;
    this.timedOut = false;
    this.panicked = false;
    Anxiety.reset();
    this.timeLeft = this.level.timeLimit;
    this.hits = 0;
    this.time = 0;
    this.badWords = this.level.badWords;
    this.patternNames = this.level.patterns;
    this.patternState = {};
  },

  // ----- Result (read by main.js when the level ends) -----

  // Level is over: sentence complete, time ran out, or anxiety maxed (sends whatever is in the bar).
  finished() {
    return this.done || this.timedOut || this.panicked;
  },

  message() {
    return this.entries.map((e) => e.text).join(' ');
  },

  // Clean = the whole sentence was collected with no bad or misplaced words in it.
  isClean() {
    return this.done && this.entries.every((e) => e.kind === 'good');
  },

  lockedAnswer() {
    return this.locked === null ? null : this.level.answers[this.locked];
  },

  // ----- Bad words -----

  randomBadWord() {
    return this.badWords[Math.floor(Math.random() * this.badWords.length)];
  },

  measureChip(text) {
    ctx.font = GAME_CONFIG.chip.font;
    return Math.ceil(ctx.measureText(text).width) + GAME_CONFIG.chip.padX * 2;
  },

  // x/y is the chip center. Velocity is scaled by the level's bulletSpeed.
  spawnBullet(b) {
    const s = this.level.bulletSpeed || 1;
    b.vx *= s;
    b.vy *= s;
    b.w = this.measureChip(b.text);
    b.h = GAME_CONFIG.chip.height;
    this.bullets.push(b);
  },

  update(dt) {
    if (this.finished()) return;
    this.time += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.timedOut = true;
      return;
    }
    this.updatePlayer(dt);

    for (const name of this.patternNames) {
      const p = Patterns[name];
      if (!p) continue;
      p.update(this, dt, (this.patternState[name] = this.patternState[name] || {}));
    }

    Anxiety.update(dt);
    this.updateBullets(dt);
    this.syncGoods(dt);
    this.updateGoods(dt);
    if (!this.done && Anxiety.maxed()) this.panicked = true;
  },

  updatePlayer(dt) {
    const p = this.player;
    const cfg = GAME_CONFIG.player;
    let dx = 0, dy = 0;
    if (input.isDown('ArrowLeft', 'KeyA')) dx -= 1;
    if (input.isDown('ArrowRight', 'KeyD')) dx += 1;
    if (input.isDown('ArrowUp', 'KeyW')) dy -= 1;
    if (input.isDown('ArrowDown', 'KeyS')) dy += 1;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; } // same speed diagonally

    p.focus = input.isDown('ShiftLeft', 'ShiftRight');
    const speed = p.focus ? cfg.focusSpeed : cfg.speed;
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;

    // Keep the player's drawn sprite inside the play area.
    const half = cfg.drawSize / 2;
    const a = this.area;
    p.x = Math.max(a.x + half, Math.min(a.x + a.w - half, p.x));
    p.y = Math.max(a.y + half, Math.min(a.y + a.h - half, p.y));

    if (p.invuln > 0) p.invuln -= dt;
  },

  updateBullets(dt) {
    const p = this.player;
    const a = this.area;
    const speed = Anxiety.speedMultiplier(); // higher anxiety = faster bullets

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt * speed;
      b.y += b.vy * dt * speed;

      // Despawn once fully outside the play area (with a margin).
      const m = 60;
      if (b.y - b.h / 2 > a.y + a.h + m || b.y + b.h / 2 < a.y - m - 40 ||
          b.x + b.w / 2 < a.x - m || b.x - b.w / 2 > a.x + a.w + m) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (p.invuln <= 0 && this.circleHitsRect(p.x, p.y, GAME_CONFIG.player.hitRadius, b, GAME_CONFIG.chip.hitShrink)) {
        this.onBadHit(b);
        this.bullets.splice(i, 1);
      }
    }
  },

  circleHitsRect(cx, cy, r, b, scale) {
    const hw = (b.w * scale) / 2;
    const hh = (b.h * scale) / 2;
    const nx = Math.max(b.x - hw, Math.min(cx, b.x + hw));
    const ny = Math.max(b.y - hh, Math.min(cy, b.y + hh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  },

  // Bad word touched: it gets inserted into the message and spikes anxiety.
  onBadHit(b) {
    this.hits++;
    Anxiety.add(ANXIETY_CONFIG.badHit);
    this.entries.push({ text: b.text, kind: 'bad' });
    this.player.invuln = GAME_CONFIG.hitInvulnTime;
  },

  // ----- Good words -----

  // Which good words should exist right now: before the player commits, the first word
  // of every answer; after, every word of the locked answer not yet collected.
  neededGoods() {
    const answers = this.level.answers;
    const out = [];
    if (this.locked === null) {
      answers.forEach((ans, ai) => out.push({ answer: ai, index: 0, text: ans.words[0] }));
    } else {
      const words = answers[this.locked].words;
      for (let i = this.next; i < words.length; i++) out.push({ answer: this.locked, index: i, text: words[i] });
    }
    return out;
  },

  // Spawns missing good words (after a short delay) and drops ones no longer needed.
  syncGoods(dt) {
    const needed = this.neededGoods();
    const keyOf = (n) => n.answer + ':' + n.index;
    const neededKeys = new Set(needed.map(keyOf));

    this.goods = this.goods.filter((g) => neededKeys.has(keyOf(g)));
    for (const key of Object.keys(this.pending)) {
      if (!neededKeys.has(key)) delete this.pending[key];
    }

    for (const n of needed) {
      const key = keyOf(n);
      if (this.goods.some((g) => keyOf(g) === key)) continue;
      if (this.pending[key] === undefined) this.pending[key] = GAME_CONFIG.good.respawnDelay;
      this.pending[key] -= dt;
      if (this.pending[key] <= 0) {
        delete this.pending[key];
        this.spawnGood(n);
      }
    }
  },

  spawnGood(n) {
    const a = this.area;
    const w = this.measureChip(n.text);
    const angle = Math.random() * Math.PI * 2;
    const speed = GAME_CONFIG.good.speed;
    this.goods.push({
      ...n,
      w,
      h: GAME_CONFIG.chip.height,
      x: a.x + w / 2 + Math.random() * (a.w - w),
      y: a.y + 30 + Math.random() * (a.h * 0.4), // upper part, away from the player's start
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  },

  // Is this good word the one the player needs right now?
  isNextWord(g) {
    if (this.locked === null) return g.index === 0;
    return g.answer === this.locked && g.index === this.next;
  },

  updateGoods(dt) {
    const p = this.player;
    const a = this.area;

    for (let i = this.goods.length - 1; i >= 0; i--) {
      const g = this.goods[i];
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Drift around inside the play area, bouncing off the walls.
      if (g.x - g.w / 2 < a.x) { g.x = a.x + g.w / 2; g.vx = Math.abs(g.vx); }
      if (g.x + g.w / 2 > a.x + a.w) { g.x = a.x + a.w - g.w / 2; g.vx = -Math.abs(g.vx); }
      if (g.y - g.h / 2 < a.y) { g.y = a.y + g.h / 2; g.vy = Math.abs(g.vy); }
      if (g.y + g.h / 2 > a.y + a.h) { g.y = a.y + a.h - g.h / 2; g.vy = -Math.abs(g.vy); }

      if (!this.circleHitsRect(p.x, p.y, GAME_CONFIG.player.hitRadius, g, GAME_CONFIG.good.hitScale)) continue;

      if (this.isNextWord(g)) {
        this.collectGood(g);
        this.goods.splice(i, 1);
      } else if (p.invuln <= 0) {
        // Right word, wrong time: it lands in the message anyway. It respawns so the
        // sentence can still be finished (but the message is now garbled).
        this.entries.push({ text: g.text, kind: 'misplaced' });
        Anxiety.add(ANXIETY_CONFIG.misplacedHit);
        p.invuln = GAME_CONFIG.hitInvulnTime;
        this.goods.splice(i, 1);
      }
    }
  },

  collectGood(g) {
    this.entries.push({ text: g.text, kind: 'good' });
    Anxiety.add(-ANXIETY_CONFIG.goodRelief);
    if (this.locked === null) {
      this.locked = g.answer; // first word picks which sentence we're building
      this.next = 1;
    } else {
      this.next++;
    }
    if (this.next >= this.level.answers[this.locked].words.length) this.done = true;
  },

  // ----- Drawing -----

  drawTimerBar() {
    const a = this.area;
    const frac = Math.max(0, this.timeLeft / this.level.timeLimit);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(a.x, a.y - 9, a.w, 6);
    ctx.fillStyle = this.timeLeft < 5 ? '#e74c3c' : '#f1c40f';
    ctx.fillRect(a.x, a.y - 9, a.w * frac, 6);
  },

  draw() {
    const a = this.area;
    this.drawTimerBar();

    // Play area backdrop; everything inside is clipped to it.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    for (const g of this.goods) {
      const glow = this.isNextWord(g) ? 0.6 + 0.4 * Math.sin(this.time * 6) : 0;
      Chat.chip('good', g.text, g.x, g.y, g.w, g.h, { glow });
    }
    for (const b of this.bullets) Chat.chip('bad', b.text, b.x, b.y, b.w, b.h);
    this.drawPlayer();
    ctx.restore();
  },

  drawPlayer() {
    const p = this.player;
    const size = GAME_CONFIG.player.drawSize;
    // Blink while invulnerable.
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    Assets.draw(ctx, 'player_heart.png', p.x - size / 2, p.y - size / 2, size, size, 'circle');
    // Show the real hitbox while focusing, like classic bullet hells.
    if (p.focus) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#f33';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, GAME_CONFIG.player.hitRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  },
};
