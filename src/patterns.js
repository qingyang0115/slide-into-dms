// Bullet pattern definitions. Each pattern has update(game, dt, state) and
// spawns bad-word bullets with game.spawnBullet(). `state` is per-pattern scratch
// space, reset whenever the pattern starts. Names match levels.json "patterns".

const PATTERN_CONFIG = {
  rain: {
    interval: 0.45, // seconds between drops
    speed: 170,     // px/sec fall speed (before level / anxiety multipliers)
    speedJitter: 40,
  },
};

const Patterns = {
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
};
