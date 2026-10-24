// Spritesheet animation helper. Sheets are one horizontal row of equal-size frames, described in
// data/sprites.json: { "file.png": { frameWidth, frameHeight, frames, fps, loop } }.
// A PNG with no entry is a single static frame. A missing PNG draws a labeled placeholder
// that bobs, so animation timing can still be tested without the art.

const SPRITE_CONFIG = {
  placeholderFps: 6,  // bob rate for missing sheets that have no fps entry
  bobPx: 6,           // bob height for the placeholder
};

const Sprites = {
  defs: {}, // filename -> { frameWidth, frameHeight, frames, fps, loop }

  setDefs(defs) {
    this.defs = defs || {};
  },

  // Draws frame-at-time-`t` fitted inside (maxW x maxH), centered on cx, standing on `bottom`.
  // opts.alpha fades it; opts.dx / opts.dy nudge it (story effects).
  draw(name, cx, bottom, maxW, maxH, t, opts = {}) {
    const entry = Assets.get(name);
    const def = this.defs[name];
    const dx = opts.dx || 0, dy = opts.dy || 0;

    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

    if (entry && entry.ok) {
      const fw = def ? def.frameWidth : entry.width;
      const fh = def ? def.frameHeight : entry.height;
      // Never read past the image if sprites.json disagrees with the real file.
      const frames = def ? Math.max(1, Math.min(def.frames, Math.floor(entry.width / fw) || 1)) : 1;
      let frame = 0;
      if (frames > 1 && def.fps) {
        const n = Math.floor(t * def.fps);
        frame = def.loop === false ? Math.min(frames - 1, n) : n % frames;
      }
      const scale = Math.min(maxW / fw, maxH / fh);
      const w = fw * scale, h = fh * scale;
      ctx.drawImage(entry.img, frame * fw, 0, fw, fh, cx - w / 2 + dx, bottom - h + dy, w, h);
    } else {
      if (!entry) Assets.load(name);
      const fps = (def && def.fps) || SPRITE_CONFIG.placeholderFps;
      const bob = Math.abs(Math.sin(t * fps * 0.5)) * SPRITE_CONFIG.bobPx;
      Assets.drawPlaceholder(ctx, name, cx - maxW / 2 + dx, bottom - maxH + dy - bob, maxW, maxH);
    }
    ctx.restore();
  },
};
