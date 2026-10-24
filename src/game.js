// Bullet phase: player movement, bullets, collisions.
// Reply bar / good words (step 3), timer + send (step 4) and anxiety (step 5) plug in here later.

const GAME_CONFIG = {
  // Play area inside the phone screen (logical px). Chat UI will sit above it.
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
    hitShrink: 0.8, // bullet hitbox is a bit smaller than its drawn chip
  },
  hitInvulnTime: 1.0, // seconds of invulnerability (blinking) after a hit
  badWords: ['u up?', 'lol', 'k', 'sorry', '😳'], // fallback until levels.json (step 4)
  patterns: ['rain'],                              // fallback until levels.json (step 4)
};

const Game = {
  area: GAME_CONFIG.area,
  player: null,
  bullets: [],
  hits: 0,
  time: 0,
  badWords: GAME_CONFIG.badWords,
  patternNames: GAME_CONFIG.patterns,
  patternState: {},

  start() {
    const a = this.area;
    this.player = { x: a.x + a.w / 2, y: a.y + a.h - 60, invuln: 0, focus: false };
    this.bullets = [];
    this.hits = 0;
    this.time = 0;
    this.patternState = {};
  },

  randomBadWord() {
    return this.badWords[Math.floor(Math.random() * this.badWords.length)];
  },

  measureChip(text) {
    ctx.font = GAME_CONFIG.chip.font;
    return Math.ceil(ctx.measureText(text).width) + GAME_CONFIG.chip.padX * 2;
  },

  // x/y is the chip center.
  spawnBullet(b) {
    b.w = this.measureChip(b.text);
    b.h = GAME_CONFIG.chip.height;
    this.bullets.push(b);
  },

  update(dt) {
    this.time += dt;
    this.updatePlayer(dt);

    for (const name of this.patternNames) {
      const p = Patterns[name];
      if (!p) continue;
      p.update(this, dt, (this.patternState[name] = this.patternState[name] || {}));
    }

    this.updateBullets(dt);
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
    const shrink = GAME_CONFIG.chip.hitShrink;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Despawn once fully outside the play area (with a margin).
      const m = 60;
      if (b.y - b.h / 2 > a.y + a.h + m || b.y + b.h / 2 < a.y - m - 40 ||
          b.x + b.w / 2 < a.x - m || b.x - b.w / 2 > a.x + a.w + m) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (p.invuln <= 0 && this.circleHitsRect(p.x, p.y, GAME_CONFIG.player.hitRadius, b, shrink)) {
        this.onBadHit(b);
        this.bullets.splice(i, 1);
      }
    }
  },

  circleHitsRect(cx, cy, r, b, shrink) {
    const hw = (b.w * shrink) / 2;
    const hh = (b.h * shrink) / 2;
    const nx = Math.max(b.x - hw, Math.min(cx, b.x + hw));
    const ny = Math.max(b.y - hh, Math.min(cy, b.y + hh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  },

  // Step 3 will insert the word into the message; step 5 will raise anxiety.
  onBadHit(b) {
    this.hits++;
    this.player.invuln = GAME_CONFIG.hitInvulnTime;
  },

  draw() {
    const a = this.area;

    // Play area backdrop + clipped bullets.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    for (const b of this.bullets) this.drawChip(b);
    this.drawPlayer();
    ctx.restore();

    // Debug HUD (replaced by real chat UI / anxiety bar in later steps).
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`hits: ${this.hits}`, a.x, a.y - 12);
    ctx.restore();
  },

  drawChip(b) {
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    if (Assets.has('chip_bad.png')) {
      Assets.draw(ctx, 'chip_bad.png', x, y, b.w, b.h);
    } else {
      // Placeholder chip: the word itself is the label.
      ctx.fillStyle = '#c0392b';
      ctx.strokeStyle = '#ffd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, b.w, b.h, b.h / 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = GAME_CONFIG.chip.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, b.x, b.y + 1);
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
