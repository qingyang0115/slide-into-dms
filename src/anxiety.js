// Anxiety meter + its effects: faster bullets, screen shake, text wobble,
// sweat vignette, protagonist face. Game feeds it (time, hits); everything else reads it.

const ANXIETY_CONFIG = {
  max: 100,
  baseRate: 1.5,     // anxiety per second just from existing
  badHit: 12,        // touched a bad word
  misplacedHit: 8,   // touched a good word at the wrong time
  goodRelief: 4,     // collecting a correct word calms you down a little
  speedBoost: 0.6,   // bullets are up to +60% faster at max anxiety
  shake: { start: 0.5, maxPx: 5 },        // screen shake begins at 50% anxiety
  wobble: { start: 0.35, maxPx: 3 },      // text wobble begins at 35%
  vignette: { start: 0.3, maxAlpha: 0.85 },
  face: { sweat: 0.33, panic: 0.66 },     // thresholds for the protagonist's face
  meter: { x: 339, y: 228, w: 96, h: 10 },
};

const Anxiety = {
  value: 0,

  reset() {
    this.value = 0;
  },

  add(n) {
    this.value = Math.max(0, Math.min(ANXIETY_CONFIG.max, this.value + n));
  },

  update(dt) {
    this.add(ANXIETY_CONFIG.baseRate * dt);
  },

  ratio() {
    return this.value / ANXIETY_CONFIG.max;
  },

  maxed() {
    return this.value >= ANXIETY_CONFIG.max;
  },

  // 0 below `start`, ramping to 1 at max anxiety.
  ramp(start) {
    return Math.max(0, (this.ratio() - start) / (1 - start));
  },

  speedMultiplier() {
    return 1 + this.ratio() * ANXIETY_CONFIG.speedBoost;
  },

  shakeOffset() {
    const amp = this.ramp(ANXIETY_CONFIG.shake.start) * ANXIETY_CONFIG.shake.maxPx;
    return [(Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * 2 * amp];
  },

  wobbleAmp() {
    return this.ramp(ANXIETY_CONFIG.wobble.start) * ANXIETY_CONFIG.wobble.maxPx;
  },

  // Which protagonist avatar to show: 'idle' | 'sweat' | 'panic'.
  face() {
    const r = this.ratio();
    if (r >= ANXIETY_CONFIG.face.panic) return 'panic';
    if (r >= ANXIETY_CONFIG.face.sweat) return 'sweat';
    return 'idle';
  },

  drawMeter() {
    const m = ANXIETY_CONFIG.meter;
    const r = this.ratio();
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ANXIETY', m.x, m.y - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = `hsl(${120 * (1 - r)}, 80%, 50%)`; // green -> red
    ctx.fillRect(m.x, m.y, m.w * r, m.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(m.x, m.y, m.w, m.h);
    ctx.restore();
  },

  // Full-screen overlay; fades in as anxiety climbs.
  drawVignette() {
    const alpha = this.ramp(ANXIETY_CONFIG.vignette.start) * ANXIETY_CONFIG.vignette.maxAlpha;
    if (alpha <= 0) return;
    const w = CONFIG.width, h = CONFIG.height;
    ctx.save();
    if (Assets.has('fx_sweat_vignette.png')) {
      ctx.globalAlpha = alpha;
      Assets.draw(ctx, 'fx_sweat_vignette.png', 0, 0, w, h);
    } else {
      // Placeholder for the missing art: a plain pulsing dark-red edge gradient
      // (no filename label: an opaque label box would hide the game).
      const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 150);
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.65);
      g.addColorStop(0, 'rgba(140,0,40,0)');
      g.addColorStop(1, 'rgba(140,0,40,1)');
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  },
};
