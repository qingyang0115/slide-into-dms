// Story scenes (visual-novel style): background, character sprites, speech bubble with
// typewriter text, click/Space to advance, skip button, per-line effects.
// All content lives in data/story.json. This module is registered as the 'story' state in main.js.

const STORY_CONFIG = {
  typeSpeed: 45,     // characters per second
  effectTime: 0.5,   // seconds a line's effect (shake/bounce/slideIn/fadeIn) lasts
  slots: { left: 115, center: 225, right: 335 }, // sprite x centres
  sprite: { w: 200, h: 300, bottom: 565 },
  dimAlpha: 0.55,    // sprites of characters who are not speaking
  bubble: { x: 20, y: 580, w: 410, h: 170, pad: 18, font: '20px system-ui, sans-serif', lineHeight: 28 },
  nameTag: { h: 26, padX: 14, font: 'bold 15px system-ui, sans-serif' },
  skip: { x: 366, y: 12, w: 72, h: 28 },
};

const Story = {
  data: { speakers: {}, scenes: {} }, // data/story.json, filled at boot
  sceneId: null,
  scene: null,
  lineIdx: 0,
  line: null,
  slots: {},        // position -> { sprite }
  speakerSlot: null,
  time: 0,          // scene clock (drives spritesheet animation)
  typeT: 0,         // seconds since the current line started
  effectT: 0,

  setData(data) {
    this.data = { speakers: {}, scenes: {}, ...data };
  },

  has(id) {
    return !!this.data.scenes[id];
  },

  // Scene id for the ending the tone counts earn, or null if story.json has no `endings` rules.
  // Rules are checked in order; `when` maps tones to minimum counts, no `when` always matches.
  pickEnding(tones) {
    const rule = (this.data.endings || []).find((r) =>
      Object.entries(r.when || {}).every(([tone, min]) => (tones[tone] || 0) >= min));
    return rule ? rule.scene : null;
  },

  // Every image the scenes mention, so main.js can preload them.
  assetNames() {
    const names = new Set(['bubble_speech.png']);
    for (const s of Object.values(this.data.scenes)) {
      if (s.background) names.add(s.background);
      for (const l of s.lines) if (l.sprite) names.add(l.sprite);
    }
    return [...names];
  },

  // Warns about broken links between scenes and levels. Returns the warnings.
  validate(levels) {
    const out = [];
    const warn = (msg) => { out.push(`[story] ${msg}`); console.warn(`[story] ${msg}`); };
    const known = (t) => {
      if (['end', 'title', 'retry', 'ending'].includes(t)) return true;
      const [kind, id] = t.split(':');
      if (kind === 'level') return levels.some((l) => l.id === id);
      if (kind === 'scene') return this.has(id);
      return false;
    };
    for (const [id, s] of Object.entries(this.data.scenes)) {
      if (!s.lines || !s.lines.length) warn(`scene "${id}" has no lines`);
      if (!s.next) warn(`scene "${id}" has no "next"`);
      else if (!known(s.next)) warn(`scene "${id}": unknown next "${s.next}"`);
      for (const l of s.lines || []) {
        if (l.position && !(l.position in STORY_CONFIG.slots)) warn(`scene "${id}": bad position "${l.position}"`);
        if (l.effect && !['shake', 'bounce', 'slideIn', 'fadeIn'].includes(l.effect)) warn(`scene "${id}": bad effect "${l.effect}"`);
      }
    }
    for (const r of this.data.endings || []) {
      if (!this.has(r.scene)) warn(`endings: unknown scene "${r.scene}"`);
    }
    for (const lv of levels) {
      for (const key of ['afterWin', 'afterFail']) {
        if (lv[key] && !known(lv[key])) warn(`level "${lv.id}": unknown ${key} "${lv[key]}"`);
      }
    }
    return out;
  },

  // Switch to a scene. (main.js's goTo('scene:<id>') calls this.)
  start(id) {
    this.sceneId = id;
    setState('story');
  },

  // ----- state interface -----

  enter() {
    this.scene = this.data.scenes[this.sceneId];
    this.slots = {};
    this.speakerSlot = null;
    this.time = 0;
    this.lineIdx = -1;
    this.nextLine();
  },

  update(dt) {
    this.time += dt;
    this.typeT += dt;
    this.effectT += dt;
    this.typeTicks();
  },

  // A quiet typewriter tick for every other letter that appears (none for spaces or when skipping).
  typeTicks() {
    const text = this.line.text;
    if (!isFinite(this.typeT)) { this.ticked = text.length; return; }
    const upTo = Math.min(text.length, Math.floor(this.typeT * STORY_CONFIG.typeSpeed));
    let tick = false;
    for (let i = this.ticked; i < upTo; i++) if (text[i] !== ' ' && i % 2 === 0) tick = true;
    this.ticked = Math.max(this.ticked, upTo);
    if (tick) Sfx.play('tick');
  },

  nextLine() {
    this.lineIdx++;
    if (this.lineIdx >= this.scene.lines.length) return this.finish();
    const line = this.scene.lines[this.lineIdx];
    this.line = line;
    this.typeT = 0;
    this.ticked = 0;
    this.effectT = 0;
    this.effect = line.effect || null;
    const cue = { shake: 'thud', bounce: 'boing', slideIn: 'swish' }[this.effect];
    if (cue) Sfx.play(cue);

    if (line.sprite) {
      const pos = line.position || 'left';
      if (!this.slots[pos] || this.slots[pos].sprite !== line.sprite) {
        this.slots[pos] = { sprite: line.sprite };
        if (!this.effect) this.effect = 'fadeIn'; // new character: quick fade in unless the line says otherwise
      }
      this.speakerSlot = pos;
    } else {
      this.speakerSlot = null; // narration: nobody highlighted
    }
  },

  finish() {
    goTo(this.scene.next || 'end');
  },

  typingDone() {
    return this.typeT * STORY_CONFIG.typeSpeed >= this.line.text.length;
  },

  // First press finishes the line instantly; the next one advances.
  onConfirm() {
    Sfx.play('click');
    if (!this.typingDone()) this.typeT = Infinity;
    else this.nextLine();
  },

  onClick(x, y) {
    const s = STORY_CONFIG.skip;
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return this.finish();
    this.onConfirm();
  },

  // ----- drawing -----

  effectOffset(pos) {
    const d = STORY_CONFIG.effectTime;
    const k = Math.min(1, this.effectT / d);
    const out = { dx: 0, dy: 0, a: 1 };
    switch (this.effect) {
      case 'shake': out.dx = Math.sin(this.effectT * 55) * 9 * (1 - k); break;
      case 'bounce': out.dy = -Math.abs(Math.sin(k * Math.PI * 2)) * 30 * (1 - k); break;
      case 'fadeIn': out.a = k; break;
      case 'slideIn': {
        const ease = 1 - Math.pow(1 - k, 3);
        if (pos === 'center') out.dy = (1 - ease) * 200;
        else out.dx = (1 - ease) * (pos === 'right' ? 240 : -240);
        break;
      }
    }
    return out;
  },

  draw() {
    const sc = STORY_CONFIG;
    drawFullscreen(this.scene.background);

    for (const pos of ['left', 'center', 'right']) {
      const slot = this.slots[pos];
      if (!slot) continue;
      const speaking = pos === this.speakerSlot;
      const fx = speaking ? this.effectOffset(pos) : { dx: 0, dy: 0, a: 1 };
      const dim = this.speakerSlot === null || speaking ? 1 : sc.dimAlpha;
      Sprites.draw(slot.sprite, sc.slots[pos], sc.sprite.bottom, sc.sprite.w, sc.sprite.h, this.time,
        { dx: fx.dx, dy: fx.dy, alpha: fx.a * dim });
    }

    this.drawBubble();
    this.drawSkip();
  },

  drawBubble() {
    const b = STORY_CONFIG.bubble;
    const line = this.line;

    if (Assets.has('bubble_speech.png')) {
      Assets.draw(ctx, 'bubble_speech.png', b.x, b.y, b.w, b.h); // TODO 9-slice once the real art exists
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 18);
      ctx.fill();
      ctx.stroke();
    }

    // Name tag above the bubble, on the speaker's side.
    const name = line.speaker && (this.data.speakers[line.speaker] || line.speaker);
    if (name) {
      const nt = STORY_CONFIG.nameTag;
      ctx.font = nt.font;
      const w = ctx.measureText(name).width + nt.padX * 2;
      const pos = line.position || 'left';
      const x = pos === 'right' ? b.x + b.w - w - 12 : pos === 'center' ? b.x + (b.w - w) / 2 : b.x + 12;
      const y = b.y - nt.h + 6;
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.roundRect(x, y, w, nt.h, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x + nt.padX, y + nt.h / 2 + 1);
    }

    // Typewriter text: wrap the full line first so words don't jump as they appear.
    ctx.fillStyle = '#222';
    ctx.font = b.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let remaining = Math.floor(this.typeT * STORY_CONFIG.typeSpeed);
    Chat.wrapLines(line.text, b.w - b.pad * 2, b.font).forEach((l, i) => {
      const shown = Math.max(0, Math.min(l.length, remaining));
      ctx.fillText(l.slice(0, shown), b.x + b.pad, b.y + b.pad + i * b.lineHeight);
      remaining -= l.length + 1; // +1 for the space the wrap swallowed
    });

    // "Press to continue" arrow once the line is fully typed.
    if (this.typingDone() && Math.floor(this.time * 2) % 2 === 0) {
      ctx.fillStyle = '#222';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('▼', b.x + b.w - 16, b.y + b.h - 12);
    }
  },

  drawSkip() {
    const s = STORY_CONFIG.skip;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('skip ▸▸', s.x + s.w / 2, s.y + s.h / 2 + 1);
  },
};
