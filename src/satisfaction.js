// Crush satisfaction meter: the level's health bar. Bad words and out-of-order words drain it;
// at zero the message sends and the level is failed. Also picks the crush's avatar face.

const SATISFACTION_CONFIG = {
  max: 100,
  badHitLoss: 34,         // bad word touched: ~3 hits empties the meter
  misplacedLoss: 12,      // correct word touched out of order: a smaller mistake
  unimpressedBelow: 0.7,  // crush face turns unimpressed below this fraction
  meter: { x: 122, y: 108, w: 313, h: 7 },
};

const Satisfaction = {
  value: SATISFACTION_CONFIG.max,

  reset() {
    this.value = SATISFACTION_CONFIG.max;
  },

  lose(n) {
    this.value = Math.max(0, Math.min(SATISFACTION_CONFIG.max, this.value - n));
  },

  ratio() {
    return this.value / SATISFACTION_CONFIG.max;
  },

  empty() {
    return this.value <= 0;
  },

  // 'neutral' | 'unimpressed'
  face() {
    return this.ratio() < SATISFACTION_CONFIG.unimpressedBelow ? 'unimpressed' : 'neutral';
  },

  drawMeter() {
    const m = SATISFACTION_CONFIG.meter;
    const r = this.ratio();
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('♥ SATISFACTION', m.x, m.y - 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    // Pink; blinks when nearly empty.
    const low = r < 0.4 && Math.floor(performance.now() / 200) % 2 === 0;
    ctx.fillStyle = low ? '#ff3b6b' : '#ff8fb3';
    ctx.fillRect(m.x, m.y, m.w * r, m.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(m.x, m.y, m.w, m.h);
    ctx.restore();
  },
};
