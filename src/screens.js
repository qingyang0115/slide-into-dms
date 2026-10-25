// Title screen and end screens (win / game over), plus the little UI pieces they share:
// a button, an animated logo, and the ending icons. Which endings the player has cleared is
// remembered between visits (localStorage), so the title screen's icons stay lit.
// Art: title_logo.png, ending_title.png and icon_ending_<id>.png are optional; missing ones draw
// animated, labeled placeholders. See CLAUDE.md "Title & end screens".

const SCREEN_CONFIG = {
  title: {
    logo: { image: 'title_logo.png', cx: 225, cy: 205, w: 380, h: 190, slideTime: 0.9, slipEvery: 4.5 },
    button: { cx: 225, cy: 425, w: 240, h: 64 },
    icons: { y: 595, size: 64, gap: 100 },
    reset: { cx: 225, cy: 762, w: 170, h: 22, armTime: 3 }, // two-click "reset progress" link
  },
  end: {
    logo: { image: 'ending_title.png', cx: 225, cy: 160, w: 380, h: 150 },
    icons: { y: 445, size: 72, gap: 100 },
    button: { cx: 225, cy: 640, w: 290, h: 64 },
    unlockAt: 1.4,       // seconds before the new ending's icon lights up
  },
  gameOver: {
    retry: { cx: 225, cy: 470, w: 260, h: 64 },
    title: { cx: 225, cy: 555, w: 260, h: 56 },
  },
  iconColors: { good: '#ff7eb6', neutral: '#6ec6ff', bad: '#ffb347' }, // placeholder icon colours
};

// ---------- Which endings have been cleared ----------

const Endings = {
  KEY: 'sdm_endings_v1',
  cleared: {}, // ending id -> true

  load() {
    try { this.cleared = JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { this.cleared = {}; }
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.cleared)); } catch (e) { /* storage blocked: stays for this session */ }
  },

  // The endings from story.json, in display order. Each: { id, name, scene, slot }.
  list() {
    const rules = (Story.data.endings || []).map((r, i) => ({
      id: r.id || r.scene,
      name: r.name || r.scene,
      scene: r.scene,
      slot: r.slot === undefined ? i : r.slot,
    }));
    return rules.sort((a, b) => a.slot - b.slot);
  },

  iconFile(e) {
    return `icon_ending_${e.id}.png`;
  },

  assetNames() {
    return this.list().map((e) => this.iconFile(e));
  },

  has(id) { return !!this.cleared[id]; },

  count() { return this.list().filter((e) => this.has(e.id)).length; },

  // Returns true the first time an ending is cleared.
  unlock(id) {
    const isNew = !this.cleared[id];
    this.cleared[id] = true;
    this.save();
    return isNew;
  },

  reset() {
    this.cleared = {};
    this.save();
  },
};

// ---------- Shared drawing helpers ----------

const UI = {
  outBack(k) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  outBounce(k) {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
  clamp01(v) { return Math.max(0, Math.min(1, v)); },

  // NEW: dark translucent rounded panel. Draw it BEFORE whatever sits on top of it.
  panel(x, y, w, h, alpha = 0.55, radius = 18) {
    ctx.save();
    ctx.fillStyle = `rgba(20, 16, 40, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
  },
  
  inside(r, x, y) {
    return x >= r.cx - r.w / 2 && x <= r.cx + r.w / 2 && y >= r.cy - r.h / 2 && y <= r.cy + r.h / 2;
  },

  // A rounded, pulsing button. style: 'primary' (pink) or 'secondary' (purple).
  button(r, label, hover, t, style = 'primary') {
    const pulse = style === 'primary' ? 1 + 0.025 * Math.sin(t * 4) : 1;
    const s = hover ? 1.07 : pulse;
    ctx.save();
    ctx.translate(r.cx, r.cy);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = hover ? 16 : 10;
    ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, -r.h / 2, 0, r.h / 2);
    if (style === 'primary') { g.addColorStop(0, '#ff9ccb'); g.addColorStop(1, '#ff4f93'); }
    else { g.addColorStop(0, '#9b8cff'); g.addColorStop(1, '#6a5acd'); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = hover ? '#fff' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(r.h * 0.4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(80,0,50,0.45)';
    ctx.strokeText(label, 0, 2);
    ctx.fillText(label, 0, 2);
    ctx.restore();
  },

  // An animated logo. With the real image it slides/drops in, bobs and "slips" now and then;
  // without it, an animated text placeholder (letters skid in one by one) with the filename shown.
  // mode: 'slide' (skids in from the left, the game is about slides) or 'drop' (falls in and bounces).
  logo(cfg, lines, t, mode = 'slide') {
    const entrance = this.clamp01(t / (cfg.slideTime || 0.9));
    let dx = 0, dy = Math.sin(t * 2) * 5, rot = 0;
    if (mode === 'slide') dx = -(1 - this.outBack(entrance)) * 420;
    else dy += -(1 - this.outBounce(entrance)) * 300;
    // Every few seconds the logo slips: skids sideways, tilts, and recovers.
    if (cfg.slipEvery && t > 2) {
      const phase = t % cfg.slipEvery;
      if (phase < 0.8) {
        const s = phase / 0.8;
        dx += 36 * Math.sin(s * Math.PI);
        rot = -0.12 * Math.sin(s * Math.PI);
      }
    }

    ctx.save();
    ctx.translate(cfg.cx + dx, cfg.cy + dy);
    ctx.rotate(rot);
    if (cfg.image && Assets.has(cfg.image)) {
      Sprites.draw(cfg.image, 0, cfg.h / 2, cfg.w, cfg.h, t); // frames animate if listed in sprites.json
    } else {
      this.placeholderLogo(cfg, lines, t, mode);
    }
    ctx.restore();
  },

  // Text stand-in for a missing logo image: letters skid/drop in one by one, then bounce.
  placeholderLogo(cfg, lines, t, mode) {
    const lineGap = 8;
    const total = lines.reduce((s, l) => s + l.size, 0) + lineGap * (lines.length - 1);
    let y = -total / 2;
    let i = 0;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    for (const line of lines) {
      ctx.font = `900 ${line.size}px system-ui, sans-serif`;
      const widths = [...line.text].map((ch) => ctx.measureText(ch).width);
      let x = -widths.reduce((a, b) => a + b, 0) / 2;
      const cy = y + line.size / 2;
      [...line.text].forEach((ch, k) => {
        const lt = this.clamp01((t - 0.15 - i * 0.06) / 0.5); // each letter starts a little later
        const e = mode === 'slide' ? this.outBack(lt) : this.outBounce(lt);
        const ox = mode === 'slide' ? -(1 - e) * 360 : 0;
        const oy = mode === 'slide' ? 0 : -(1 - e) * 260;
        const wob = lt >= 1 ? Math.sin(t * 3 + i * 0.6) * 3 : 0;
        if (lt > 0 && ch !== ' ') {
          ctx.save();
          ctx.globalAlpha = Math.min(1, lt * 4);
          ctx.translate(x + widths[k] / 2 + ox, cy + oy + wob);
          ctx.rotate(mode === 'slide' ? (1 - e) * -0.4 : 0);
          const g = ctx.createLinearGradient(0, -line.size / 2, 0, line.size / 2);
          g.addColorStop(0, line.top || '#fff6a8');
          g.addColorStop(1, line.bottom || '#ff6fae');
          ctx.lineWidth = Math.max(6, line.size * 0.12);
          ctx.strokeStyle = '#3a1a4a';
          ctx.strokeText(ch, -widths[k] / 2, 0);
          ctx.fillStyle = g;
          ctx.fillText(ch, -widths[k] / 2, 0);
          ctx.restore();
        }
        x += widths[k];
        i++;
      });
      y += line.size + lineGap;
    }
    if (cfg.image) { // labeled placeholder: say which file will replace this
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(`${cfg.image} (placeholder)`, 0, total / 2 + 16);
    }
  },

  // Real art, darkened into a silhouette (works in every browser, unlike ctx.filter). Cached.
  _silhouettes: {},
  silhouette(name) {
    if (this._silhouettes[name]) return this._silhouettes[name];
    const img = Assets.get(name).img;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(25,10,35,0.88)';
    g.fillRect(0, 0, c.width, c.height);
    return (this._silhouettes[name] = c);
  },

  // One ending icon. lit = cleared (glows and sparkles); otherwise a dark "?" silhouette.
  // burst (0..1) plays the "just lit up" pop and ring.
  endingIcon(e, cx, cy, size, lit, t, burst = 0) {
    const file = Endings.iconFile(e);
    const real = Assets.has(file);
    const pop = burst > 0 && burst < 1 ? 1 + 0.3 * Math.sin(burst * Math.PI) : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);

    if (lit) {
      const glow = 0.35 + 0.15 * Math.sin(t * 3 + cx);
      const g = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 0.95);
      g.addColorStop(0, `rgba(255,236,140,${glow + 0.25})`);
      g.addColorStop(1, 'rgba(255,236,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.95, 0, Math.PI * 2);
      ctx.fill();
    }

    if (real) {
      if (lit) ctx.drawImage(Assets.get(file).img, -size / 2, -size / 2, size, size);
      else ctx.drawImage(this.silhouette(file), -size / 2, -size / 2, size, size);
    } else if (lit) {
      ctx.save();
      ctx.translate(-size / 2, -size / 2);
      // Assets.drawPlaceholder colours by filename; use the ending's own colour instead, then label it.
      ctx.fillStyle = SCREEN_CONFIG.iconColors[e.id] || '#c79bff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(file, size / 2, size / 2);
      ctx.restore();
    } else { // locked placeholder
      ctx.fillStyle = 'rgba(30,15,45,0.85)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `bold ${Math.round(size * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 2);
    }

    if (lit) { // twinkling sparkles
      ctx.fillStyle = '#fffbd0';
      for (let k = 0; k < 3; k++) {
        const a = t * 1.5 + k * 2.1, r = size * 0.62;
        const tw = 0.5 + 0.5 * Math.sin(t * 5 + k * 1.7);
        ctx.globalAlpha = tw;
        ctx.font = `${Math.round(8 + 6 * tw)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (burst > 0 && burst < 1) { // expanding ring when it lights up
      ctx.save();
      ctx.strokeStyle = `rgba(255,248,170,${1 - burst})`;
      ctx.lineWidth = 5 * (1 - burst) + 1;
      ctx.beginPath();
      ctx.arc(cx, cy, size * (0.5 + 1.1 * burst), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Caption: the ending's name once cleared, "???" until then.
    ctx.save();
    ctx.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.font = `${lit ? 'bold ' : ''}11px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(lit ? e.name : '???', cx, cy + size / 2 + 8);
    ctx.restore();
  },

  // The row of ending icons, centered on x=225. `state(e, i)` says how to draw each one.
  iconRow(cfg, t, state) {
    const list = Endings.list();
    const startX = 225 - ((list.length - 1) * cfg.gap) / 2;
    list.forEach((e, i) => {
      const s = state(e, i);
      this.endingIcon(e, startX + i * cfg.gap, cfg.y, cfg.size, s.lit, t, s.burst || 0);
    });
  },

  setCursor(pointer) {
    canvas.style.cursor = pointer ? 'pointer' : 'default';
  },
};

// ---------- Title screen ----------

const TitleScreen = {
  t: 0,
  hover: null,   // 'start' | 'reset' | null
  resetArm: 0,   // seconds left in which a second click on "reset progress" confirms

  enter() {
    progress.reset();
    this.t = 0;
    this.hover = null;
    this.resetArm = 0;
  },

  exit() {
    UI.setCursor(false);
  },

  update(dt) {
    this.t += dt;
    if (this.resetArm > 0) this.resetArm -= dt;
  },

  draw() {
    const c = SCREEN_CONFIG.title;
    drawFullscreen('screen_title.png');
    UI.logo(c.logo, [{ text: 'SLIDE', size: 74 }, { text: 'INTO DMs', size: 46, top: '#d6f0ff', bottom: '#7ec8ff' }], this.t, 'slide');

    const slideIn = UI.outBack(UI.clamp01((this.t - 0.7) / 0.5)); // the button pops in after the logo lands
    ctx.save();
    ctx.globalAlpha = UI.clamp01((this.t - 0.7) / 0.3);
    ctx.translate(0, (1 - slideIn) * 60);
    UI.button(c.button, 'START', this.hover === 'start', this.t);
    ctx.restore();

    // Ending icons: lit once cleared.
    const list = Endings.list();
    if (list.length) {
      // NEW: panel behind the "ENDINGS n / 3" label, the icons and their names.
      // Derived from SCREEN_CONFIG so it follows the icons if anyone moves them.
      const top = c.icons.y - c.icons.size / 2 - 40;
      const bottom = c.icons.y + c.icons.size / 2 + 34;
      UI.panel(45, top, 360, bottom - top);

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(`ENDINGS  ${Endings.count()} / ${list.length}`, 225, c.icons.y - c.icons.size / 2 - 22);
      ctx.restore();
      UI.iconRow(c.icons, this.t, (e) => ({ lit: Endings.has(e.id) }));
    }

    UI.panel(95, 707, 260, 30, 0.5, 15);   // NEW: behind the Space / Enter hint
    UI.panel(c.reset.cx - 105, c.reset.cy - c.reset.h / 2 - 2, 210, c.reset.h + 4, 0.45, 11); // NEW: behind "reset progress"

    drawCenteredText(`Space / Enter: start     M: ${Sfx.muted ? 'unmute' : 'mute'}`, 722, 12, '#ddd');
    const armed = this.resetArm > 0;
    ctx.save();
    ctx.fillStyle = armed ? '#ffd0d0' : 'rgba(255,255,255,0.5)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(armed ? 'click again to erase cleared endings' : 'reset progress', c.reset.cx, c.reset.cy);
    ctx.restore();
  },

  start() {
    Sfx.play('click');
    goTo('scene:intro', `level:${levelData.levels[0].id}`);
  },

  onPointerMove(x, y) {
    const c = SCREEN_CONFIG.title;
    this.hover = UI.inside(c.button, x, y) ? 'start' : UI.inside(c.reset, x, y) ? 'reset' : null;
    UI.setCursor(this.hover !== null);
  },

  onClick(x, y) {
    const c = SCREEN_CONFIG.title;
    if (UI.inside(c.button, x, y)) return this.start();
    if (UI.inside(c.reset, x, y)) {
      Sfx.play('click');
      if (this.resetArm > 0) { Endings.reset(); this.resetArm = 0; Sfx.play('wrong'); }
      else this.resetArm = c.reset.armTime;
    }
  },

  onConfirm() {
    this.start();
  },
};

// ---------- End screen (win) and game over ----------

const EndScreen = {
  t: 0,
  won: false,
  hover: null,   // 'primary' | 'secondary' | null
  cues: {},
  isNew: false,  // this run cleared an ending for the first time

  enter() {
    this.t = 0;
    this.won = progress.won;
    this.hover = null;
    this.cues = {};
    this.isNew = this.won && !!progress.newEnding;
  },

  exit() {
    UI.setCursor(false);
  },

  update(dt) {
    this.t += dt;
    const once = (key, when, fn) => { if (!this.cues[key] && this.t >= when) { this.cues[key] = true; fn(); } };
    if (this.won) {
      once('jingle', 0.5, () => Sfx.play('win'));
      if (this.isNew) once('unlock', SCREEN_CONFIG.end.unlockAt, () => Sfx.play('collect', { rate: 1.5 }));
    } else {
      once('sad', 0.4, () => Sfx.play('fail'));
    }
  },

  buttons() {
    const c = SCREEN_CONFIG;
    return this.won
      ? [{ id: 'primary', rect: c.end.button, label: 'BACK TO START', style: 'primary' }]
      : [{ id: 'primary', rect: c.gameOver.retry, label: 'RETRY', style: 'primary' },
         { id: 'secondary', rect: c.gameOver.title, label: 'START SCREEN', style: 'secondary' }];
  },

  draw() {
    const c = SCREEN_CONFIG.end;
    drawFullscreen(this.won ? 'screen_ending.png' : 'screen_gameover.png');

    if (this.won) {
      UI.logo({ ...c.logo, slipEvery: 0 }, [{ text: 'THE END', size: 78 }], this.t, 'drop');

      const ending = progress.ending;
      if (this.t > 0.9) {
        ctx.save();
        ctx.globalAlpha = UI.clamp01((this.t - 0.9) / 0.5);
        drawCenteredText(ending ? `Ending: ${ending.name || ending.scene}` : 'Thanks for playing!', 262, 22, '#fff');
        const t = progress.tones;
        drawCenteredText(`chill ${t.chill}  ·  flirty ${t.flirty}  ·  unhinged ${t.unhinged}`, 292, 13, '#ffe9f3');
        ctx.restore();
      }
      if (this.isNew && this.t > c.unlockAt && Math.floor(this.t * 2.5) % 2 === 0) {
        drawCenteredText('NEW ENDING UNLOCKED!', 340, 20, '#ffe066');
      }

      if (Endings.list().length) {
        const unlockAt = c.unlockAt;
        UI.iconRow(c.icons, this.t, (e) => {
          const justNow = this.isNew && progress.ending && (progress.ending.id || progress.ending.scene) === e.id;
          if (justNow) return { lit: this.t >= unlockAt, burst: UI.clamp01((this.t - unlockAt) / 0.9) };
          return { lit: Endings.has(e.id) };
        });
      }
    } else {
      UI.logo({ cx: 225, cy: 250, w: 380, h: 120, slipEvery: 0 }, [{ text: 'GAME OVER', size: 62, top: '#ffd0d0', bottom: '#ff5c7c' }], this.t, 'drop');
    }

    const appear = UI.clamp01((this.t - 0.6) / 0.4);
    ctx.save();
    ctx.globalAlpha = appear;
    for (const b of this.buttons()) UI.button(b.rect, b.label, this.hover === b.id, this.t, b.style);
    ctx.restore();
    drawCenteredText(this.won ? 'Space / Enter: back to start screen' : 'Space / Enter: retry     Esc: start screen', 722, 12, '#ddd');
  },

  activate(id) {
    Sfx.play('click');
    if (this.won || id === 'secondary') setState('title');
    else setState('level'); // retry the level that was failed
  },

  onPointerMove(x, y) {
    const b = this.buttons().find((b) => UI.inside(b.rect, x, y));
    this.hover = b ? b.id : null;
    UI.setCursor(!!b);
  },

  onClick(x, y) {
    const b = this.buttons().find((b) => UI.inside(b.rect, x, y));
    if (b && this.t > 0.6) this.activate(b.id); // buttons fade in first
  },

  onConfirm() {
    this.activate('primary');
  },

  onKey(code) {
    if (code === 'Escape') this.activate('secondary');
  },
};
