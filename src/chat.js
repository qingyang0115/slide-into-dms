// Chat UI: crush message bubble, reply bar, and shared word-chip drawing.
// Reads GAME_CONFIG.chip (game.js) for the chip font/size at draw time.

const CHAT_CONFIG = {
  crushAvatar: { x: 15, y: 12, size: 96 },
  crushBubble: { x: 122, y: 24, w: 313, h: 70, pad: 14, font: '16px system-ui, sans-serif', lineHeight: 22 },
  replyBubble: { x: 15, y: 118, w: 313, h: 150, pad: 14, chipGap: 6 },
  playerAvatar: { x: 339, y: 118, size: 96 },
  colors: {
    good: '#27ae60',
    bad: '#c0392b',
    misplaced: '#e67e22',
    bubbleCrush: '#ecf0f1',
    bubblePlayer: '#3498db',
  },
};

const Chat = {
  wrapLines(text, maxW, font) {
    ctx.font = font;
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxW) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  // A word chip centered on (cx, cy). `kind` picks art + placeholder color:
  // 'good' | 'bad' | 'misplaced'. opts.glow (0..1) draws a pulsing outline.
  chip(kind, text, cx, cy, w, h, opts = {}) {
    if (opts.scale && opts.scale !== 1) { // pop animation: redraw scaled around the chip's centre
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(opts.scale, opts.scale);
      ctx.translate(-cx, -cy);
      this.chip(kind, text, cx, cy, w, h, { ...opts, scale: 1 });
      ctx.restore();
      return;
    }
    const x = cx - w / 2, y = cy - h / 2;
    const art = kind === 'good' ? 'chip_good.png' : 'chip_bad.png';
    if (Assets.has(art)) {
      Assets.draw(ctx, art, x, y, w, h);
    } else {
      // Placeholder chip: the word itself is the label.
      ctx.fillStyle = CHAT_CONFIG.colors[kind];
      ctx.strokeStyle = '#ffd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
    }
    if (opts.glow) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${opts.glow})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - 3, y - 3, w + 6, h + 6, h / 2 + 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    ctx.font = GAME_CONFIG.chip.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [wx, wy] = this.wobbleOffset(opts.wobble, cx);
    ctx.fillText(text, cx + wx, cy + 1 + wy);
  },

  // Jitter for anxious text. `amp` in px; `seed` desyncs neighbouring chips/lines.
  wobbleOffset(amp, seed) {
    if (!amp) return [0, 0];
    const t = performance.now() / 1000;
    return [Math.sin(t * 14 + seed * 0.07) * amp, Math.cos(t * 17 + seed * 0.11) * amp];
  },

  bubble(art, fallbackColor, r) {
    if (Assets.has(art)) {
      Assets.draw(ctx, art, r.x, r.y, r.w, r.h); // TODO 9-slice once the real art exists
    } else {
      ctx.fillStyle = fallbackColor;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 18);
      ctx.fill();
    }
  },

  // face: 'neutral' | 'amused' | 'unimpressed' picks the avatar. dy shifts the whole row down.
  // opts.typing draws the "typing..." dots instead of the text; opts.pop (0..1) pops the bubble in.
  drawCrushMessage(text, face = 'neutral', dy = 0, wobble = 0, opts = {}) {
    const av = CHAT_CONFIG.crushAvatar;
    Assets.draw(ctx, `char_crush_${face}.png`, av.x, av.y + dy, av.size, av.size, 'circle');

    const b = { ...CHAT_CONFIG.crushBubble, y: CHAT_CONFIG.crushBubble.y + dy };
    if (opts.typing) return this.drawTyping(b);
    ctx.save();
    if (opts.pop !== undefined && opts.pop < 1) {
      const k = 1 - Math.pow(1 - opts.pop, 3);
      const s = 0.75 + 0.25 * k;
      ctx.globalAlpha = k;
      ctx.translate(b.x, b.y + b.h / 2);
      ctx.scale(s, s);
      ctx.translate(-b.x, -(b.y + b.h / 2));
    }
    this.bubble('bubble_crush.png', CHAT_CONFIG.colors.bubbleCrush, b);
    ctx.fillStyle = '#222';
    ctx.font = b.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lines = this.wrapLines(text, b.w - b.pad * 2, b.font);
    const top = b.y + b.h / 2 - ((lines.length - 1) * b.lineHeight) / 2;
    lines.forEach((l, i) => {
      const [wx, wy] = this.wobbleOffset(wobble, i * 40);
      ctx.fillText(l, b.x + b.pad + wx, top + i * b.lineHeight + wy);
    });
    ctx.restore();
  },

  // A small bubble with three bouncing dots, in the crush bubble's position.
  drawTyping(b) {
    const small = { x: b.x, y: b.y + (b.h - 44) / 2, w: 74, h: 44 };
    this.bubble('bubble_crush.png', CHAT_CONFIG.colors.bubbleCrush, small);
    const t = performance.now() / 1000;
    ctx.fillStyle = '#888';
    for (let i = 0; i < 3; i++) {
      const bounce = Math.max(0, Math.sin(t * 8 - i * 0.9)) * 5;
      ctx.beginPath();
      ctx.arc(small.x + 22 + i * 15, small.y + small.h / 2 - bounce, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // entries: [{ text, kind: 'good' | 'bad' | 'misplaced' }]
  drawPlayerAvatar(face) {
    const av = CHAT_CONFIG.playerAvatar;
    Assets.draw(ctx, `char_player_${face}.png`, av.x, av.y, av.size, av.size, 'circle');
  },

  // flash (0..1): red pulse over the bubble, used as the death phrase telegraph.
  drawReplyBar(entries, emptyText = 'your reply...', wobble = 0, flash = 0) {
    const r = CHAT_CONFIG.replyBubble;
    this.bubble('bubble_player.png', CHAT_CONFIG.colors.bubblePlayer, r);
    if (flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(231,76,60,${flash})`;
      ctx.strokeStyle = `rgba(255,60,60,${Math.min(1, flash * 2)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 18);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (!entries.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = 'italic 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(emptyText, r.x + r.pad, r.y + r.pad + 13);
      return;
    }

    // Flow chips left to right, wrapping to new rows.
    const h = GAME_CONFIG.chip.height;
    const gap = r.chipGap;
    const maxW = r.w - r.pad * 2;
    const rows = [[]];
    let rowW = 0;
    for (const e of entries) {
      const w = Game.measureChip(e.text);
      if (rowW && rowW + gap + w > maxW) {
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push({ e, w });
      rowW += (rowW ? gap : 0) + w;
    }

    // Overflow: keep the newest rows visible.
    const maxRows = Math.floor((r.h - r.pad * 2 + gap) / (h + gap));
    const shown = rows.slice(-maxRows);
    shown.forEach((row, ri) => {
      let x = r.x + r.pad;
      const cy = r.y + r.pad + h / 2 + ri * (h + gap);
      for (const { e, w } of row) {
        const age = e.born ? performance.now() - e.born : 1e9;
        const scale = age < 200 ? 1 + 0.4 * (1 - age / 200) : 1; // pop when it lands
        this.chip(e.kind, e.text, x + w / 2, cy, w, h, { wobble, scale });
        x += w + gap;
      }
    });
  },

  // Send whoosh: a bright band sweeps across the reply bubble while it flashes.
  drawSendSweep(p) {
    const r = CHAT_CONFIG.replyBubble;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.clip();
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - p)})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const x = r.x - 120 + p * (r.w + 240);
    const g = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, r.y, 120, r.h);
    ctx.restore();
  },

  // Live chat view during the bullet phase. Wobble and the protagonist's face follow anxiety;
  // the crush's face follows satisfaction (or turns suspicious on a death phrase warning).
  // sendP (0..1) is the progress of the send whoosh once the message is on its way.
  draw(crushMessage, entries, sendP) {
    const wobble = Anxiety.wobbleAmp();
    const flash = Game.deathWarning ? 0.3 + 0.2 * Math.sin(performance.now() / 80) : 0;
    const intro = Game.introPhase();
    this.drawCrushMessage(crushMessage, Game.crushFace(), 0, wobble, intro);
    this.drawReplyBar(entries, 'your reply...', wobble, flash);
    if (sendP !== undefined && sendP !== null) this.drawSendSweep(sendP);
    this.drawPlayerAvatar(Anxiety.face());
    Anxiety.drawMeter();
    Satisfaction.drawMeter();
  },
};
