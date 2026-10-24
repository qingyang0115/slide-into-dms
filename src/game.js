// Bullet phase: player movement, bad-word bullets, good words, reply assembly, collisions.
// Ends with an endReason: 'complete' | 'timeout' | 'satisfaction' | 'death' (main.js turns it into the crush's reply).

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
  // Level intro: the crush's "typing..." bubble, then her message pops in, then the bullets start.
  intro: {
    typingTime: 1.1,  // seconds of typing dots
    popTime: 0.25,    // the message pops in over this long
    readTime: 0.45,   // pause after the message appears, before the bullet phase starts
  },
  // Juice when you make a mistake.
  fx: {
    flashTime: 0.35,  // red screen flash fade-out
    kick: 7,          // px of screen shake right after a hit (fades out over kickTime)
    kickTime: 0.3,
  },
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
  endReason: null,  // why the level ended (null while playing)
  death: null,      // the death phrase that fired, if any: { phrase, reply }
  deathWarning: false, // bar is one word from a death phrase (telegraph)
  timeLeft: 0,
  hits: 0,
  time: 0,
  badWords: [],
  patternNames: [],
  patternState: {},
  patternIndex: -1, // which of the level's patterns is active (they take turns)
  introT: 0,        // seconds since the level opened (typing dots, then message, then play)
  introCue: 0,      // how many intro sounds have played
  flash: 0,         // 0..1 screen flash after a mistake
  flashColor: '255,50,70',
  kick: 0,          // 0..1 screen-shake impulse after a mistake

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
    this.endReason = null;
    this.death = null;
    this.deathWarning = false;
    Anxiety.reset();
    Satisfaction.reset();
    this.timeLeft = this.level.timeLimit;
    this.hits = 0;
    this.time = 0;
    this.badWords = this.level.badWords;
    this.patternNames = this.level.patterns;
    this.patternState = {};
    this.patternIndex = -1;
    this.introT = 0;
    this.introCue = 0;
    this.flash = 0;
    this.kick = 0;
    Notifs.start(this.level); // group chat banners (if this level has them)
  },

  // ----- Level intro (typing indicator) -----

  introTotal() {
    return GAME_CONFIG.intro.typingTime + GAME_CONFIG.intro.readTime;
  },

  introDone() {
    return this.introT >= this.introTotal();
  },

  // What the crush's bubble shows: typing dots, then the message popping in (pop goes 0..1).
  introPhase() {
    const c = GAME_CONFIG.intro;
    if (this.introT < c.typingTime) return { typing: true, pop: 0 };
    return { typing: false, pop: Math.min(1, (this.introT - c.typingTime) / c.popTime) };
  },

  // Space/click while she is "typing" jumps straight to the bullet phase.
  skipIntro() {
    if (this.introDone()) return;
    if (this.introT < GAME_CONFIG.intro.typingTime) Sfx.play('pop');
    this.introT = this.introTotal();
    this.introCue = 99;
  },

  // The sounds that go with the intro: three typing blips, then a pop when the message lands.
  introUpdate(dt) {
    const c = GAME_CONFIG.intro;
    this.introT += dt;
    const cues = [c.typingTime * 0.15, c.typingTime * 0.45, c.typingTime * 0.75];
    while (this.introCue < cues.length && this.introT >= cues[this.introCue]) { Sfx.play('type', { rate: 1 + this.introCue * 0.12 }); this.introCue++; }
    if (this.introCue === cues.length && this.introT >= c.typingTime) { Sfx.play('pop'); this.introCue++; }
  },

  // Fades the hit flash and shake impulse. Runs even after the level ends (during the send whoosh).
  updateFx(dt) {
    this.flash = Math.max(0, this.flash - dt / GAME_CONFIG.fx.flashTime);
    this.kick = Math.max(0, this.kick - dt / GAME_CONFIG.fx.kickTime);
    Notifs.animate(dt);
  },

  kickOffset() {
    const a = this.kick * GAME_CONFIG.fx.kick;
    return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a];
  },

  drawFlash() {
    if (this.flash <= 0) return;
    ctx.fillStyle = `rgba(${this.flashColor},${0.35 * this.flash})`;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  },

  // ----- Result (read by main.js when the level ends) -----

  // Level is over: sentence complete, time ran out, satisfaction empty, or a death phrase formed.
  finished() {
    return this.endReason !== null;
  },

  // Crush avatar: suspicious while a death phrase is one word away, otherwise follows satisfaction.
  crushFace() {
    return this.deathWarning ? 'suspicious' : Satisfaction.face();
  },

  message() {
    return this.entries.map((e) => e.text).join(' ');
  },

  // Clean = the whole sentence was collected with no bad or misplaced words in it.
  isClean() {
    return this.endReason === 'complete' && this.entries.every((e) => e.kind === 'good');
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
    if (!this.introDone()) { this.introUpdate(dt); return; } // she's "typing": nothing moves yet
    this.time += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endReason = 'timeout';
      return;
    }
    this.updatePlayer(dt);

    this.updatePattern(dt);

    Anxiety.update(dt);
    Notifs.update(dt);
    this.updateBullets(dt);
    this.syncGoods(dt);
    this.updateGoods(dt);
  },

  // One pattern is active at a time; the level's list takes turns every PATTERN_CONFIG.cycleTime seconds.
  updatePattern(dt) {
    if (!this.patternNames.length) return;
    const index = Math.floor(this.time / PATTERN_CONFIG.cycleTime) % this.patternNames.length;
    if (index !== this.patternIndex) {
      this.patternIndex = index;
      this.patternState = {}; // fresh timers for the pattern that just took over
    }
    const p = Patterns[this.patternNames[index]];
    if (p) p.update(this, dt, this.patternState);
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
      const scale = b.hitScale || GAME_CONFIG.chip.hitShrink; // wall chips use full-size hitboxes
      b.x += b.vx * dt * speed;
      b.y += b.vy * dt * speed;

      // Despawn once fully outside the play area (with a margin).
      const m = 60;
      if (b.y - b.h / 2 > a.y + a.h + m || b.y + b.h / 2 < a.y - m - 40 ||
          b.x + b.w / 2 < a.x - m || b.x - b.w / 2 > a.x + a.w + m) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (p.invuln <= 0) {
        if (this.circleHitsRect(p.x, p.y, GAME_CONFIG.player.hitRadius, b, scale)) {
          this.onBadHit(b);
          this.bullets.splice(i, 1);
        } else if (!b.nearMissed &&
                   this.circleHitsRect(p.x, p.y, ANXIETY_CONFIG.nearMissRadius, b, scale)) {
          b.nearMissed = true; // each bad word counts once
          Anxiety.add(ANXIETY_CONFIG.nearMissRise);
        }
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

  // Every word that lands in the reply bar goes through here: checks for a death phrase
  // (instant fail) and updates the one-word-away telegraph.
  addEntry(text, kind) {
    this.entries.push({ text, kind, born: performance.now() });
    const death = DeathPhrase.match(this.level, this.entries);
    if (death) {
      this.death = death;
      this.endReason = 'death'; // beats anything else that ends the level on this same word
    } else {
      const warning = DeathPhrase.oneAway(this.level, this.entries);
      if (warning && !this.deathWarning) Sfx.play('warn'); // telegraph just started
      this.deathWarning = warning;
    }
  },

  // A mistake costs satisfaction; at zero the message sends and the level fails.
  checkSatisfaction() {
    if (this.endReason === null && Satisfaction.empty()) this.endReason = 'satisfaction';
  },

  // Bad word touched: it gets inserted into the message, drains satisfaction, spikes anxiety.
  onBadHit(b) {
    this.hits++;
    Anxiety.add(ANXIETY_CONFIG.hitRise);
    Satisfaction.lose(SATISFACTION_CONFIG.badHitLoss);
    this.player.invuln = GAME_CONFIG.hitInvulnTime;
    this.flash = 1; this.flashColor = '255,50,70'; this.kick = 1;
    Sfx.play('hit');
    this.addEntry(b.text, 'bad');
    this.checkSatisfaction();
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
        Anxiety.add(ANXIETY_CONFIG.misplacedRise);
        Satisfaction.lose(SATISFACTION_CONFIG.misplacedLoss);
        p.invuln = GAME_CONFIG.hitInvulnTime;
        this.goods.splice(i, 1);
        this.flash = 0.6; this.flashColor = '255,150,40'; this.kick = 0.5;
        Sfx.play('wrong');
        this.addEntry(g.text, 'misplaced');
        this.checkSatisfaction();
      }
    }
  },

  collectGood(g) {
    Anxiety.add(-ANXIETY_CONFIG.correctDrop);
    Sfx.play('collect', { rate: 1 + 0.07 * this.entries.length }); // climbs as the sentence builds
    this.addEntry(g.text, 'good');
    if (this.locked === null) {
      this.locked = g.answer; // first word picks which sentence we're building
      this.next = 1;
    } else {
      this.next++;
    }
    // A death phrase formed by this same word wins over completing the sentence.
    if (this.endReason === null && this.next >= this.level.answers[this.locked].words.length) this.endReason = 'complete';
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
    Notifs.draw(); // banners hide bullets and words, but never the player
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
