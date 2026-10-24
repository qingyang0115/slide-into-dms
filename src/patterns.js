// Bullet pattern definitions. Each pattern has update(game, dt, state) and
// spawns bad-word bullets with game.spawnBullet(). `state` is per-pattern scratch
// space, reset whenever the pattern becomes the active one. Names match levels.json "patterns".
// A level's patterns are cycled: one is active at a time, switching every `cycleTime` seconds.
// Speeds here are base values; the level's bulletSpeed and the anxiety multiplier scale them.

const PATTERN_CONFIG = {
  cycleTime: 6,     // seconds each pattern stays active before the next one in the level's list
  rain: {
    interval: 0.45, // seconds between drops
    speed: 170,     // px/sec fall speed
    speedJitter: 40,
  },
  aimed: {
    interval: 0.8,  // seconds between shots
    speed: 200,     // px/sec; each shot flies straight at where the player was when it spawned
  },
  spiral: {
    interval: 0.28, // seconds between shots
    speed: 150,
    angleStep: 0.34, // radians the emitter turns between shots
    sweepMin: 0.12,  // emitter sweeps between these angles (0 = right, PI/2 = straight down),
    sweepMax: 1.45,  // then wraps around, so it looks like a spinning spray from the corner
    emitter: { dx: 24, dy: -12 }, // offset from the play area's top-left corner (under Clover's avatar)
  },
  wall: {
    interval: 3.0,  // seconds between walls
    speed: 95,      // px/sec; slow, because a wall is wide
    gap: 120,       // width of the opening (leftover space beside it can make it up to two small chips wider)
    gapMargin: 24,  // the opening never touches the play area's side walls
  },
};

const Patterns = {
  // Bad words fall from the top at random x.
  rain: {
    update(game, dt, state) {
      state.timer = (state.timer || 0) - dt;
      if (state.timer > 0) return;
      state.timer += PATTERN_CONFIG.rain.interval;
      const a = game.area;
      const text = game.randomBadWord();
      const w = game.measureChip(text);
      game.spawnBullet({
        text,
        x: a.x + w / 2 + Math.random() * (a.w - w),
        y: a.y - 20,
        vx: 0,
        vy: PATTERN_CONFIG.rain.speed + Math.random() * PATTERN_CONFIG.rain.speedJitter,
      });
    },
  },

  // Bad words shot from the left, right and top edges toward the player's position.
  aimed: {
    update(game, dt, state) {
      state.timer = (state.timer || 0) - dt;
      if (state.timer > 0) return;
      state.timer += PATTERN_CONFIG.aimed.interval;
      const a = game.area;
      const p = game.player;
      const text = game.randomBadWord();
      const w = game.measureChip(text);
      const h = GAME_CONFIG.chip.height;

      // Start just outside a random edge (never the bottom: shots from below feel unfair).
      let x, y;
      const edge = Math.floor(Math.random() * 3);
      if (edge === 0) { x = a.x - w / 2; y = a.y + Math.random() * a.h * 0.8; }          // left
      else if (edge === 1) { x = a.x + a.w + w / 2; y = a.y + Math.random() * a.h * 0.8; } // right
      else { x = a.x + w / 2 + Math.random() * (a.w - w); y = a.y - h / 2; }              // top

      const dx = p.x - x, dy = p.y - y;
      const len = Math.hypot(dx, dy) || 1;
      const s = PATTERN_CONFIG.aimed.speed;
      game.spawnBullet({ text, x, y, vx: (dx / len) * s, vy: (dy / len) * s });
    },
  },

  // Bad words spray out from the top-left corner in a spinning fan.
  spiral: {
    update(game, dt, state) {
      state.timer = (state.timer || 0) - dt;
      if (state.timer > 0) return;
      const c = PATTERN_CONFIG.spiral;
      state.timer += c.interval;
      state.k = (state.k || 0) + 1;
      const a = game.area;
      const range = c.sweepMax - c.sweepMin;
      const angle = c.sweepMin + ((state.k * c.angleStep) % range);
      game.spawnBullet({
        text: game.randomBadWord(),
        x: a.x + c.emitter.dx,
        y: a.y + c.emitter.dy,
        vx: Math.cos(angle) * c.speed,
        vy: Math.sin(angle) * c.speed,
      });
    },
  },

  // A horizontal line of bad words falls with exactly one gap to slip through.
  wall: {
    update(game, dt, state) {
      state.timer = (state.timer || 0) - dt;
      if (state.timer > 0) return;
      const c = PATTERN_CONFIG.wall;
      state.timer += c.interval;
      const a = game.area;
      const gapStart = a.x + c.gapMargin + Math.random() * (a.w - c.gap - c.gapMargin * 2);
      const gapEnd = gapStart + c.gap;
      const y = a.y - 20;

      // Chips sit side by side with a 2px visual gap and full-size hitboxes (hitScale 1), so the
      // wall is solid (a 2px crack is narrower than the player's hitbox) and no chip hides another's text.
      const fill = (from, to, dir) => {
        let cursor = from;
        for (;;) {
          const room = (to - cursor) * dir;
          const fits = game.badWords.filter((t) => game.measureChip(t) <= room);
          if (!fits.length) return;
          const text = fits[Math.floor(Math.random() * fits.length)];
          const w = game.measureChip(text);
          game.spawnBullet({ text, x: cursor + dir * w / 2, y, vx: 0, vy: c.speed, hitScale: 1 });
          cursor += dir * (w + 2);
        }
      };
      fill(a.x, gapStart, 1);            // left of the gap, packed against the left wall
      fill(a.x + a.w, gapEnd, -1);       // right of the gap, packed against the right wall
    },
  },
};
