// Chat UI: crush message bubble, reply bar, and shared word-chip drawing.
// Reads GAME_CONFIG.chip (game.js) for the chip font/size at draw time.

const CHAT_CONFIG = {
  crushAvatar: { x: 15, y: 12, size: 96 },
  crushBubble: { x: 122, y: 24, w: 313, h: 80, pad: 14, font: '16px system-ui, sans-serif', lineHeight: 22 },
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
  drawCrushMessage(text, face = 'neutral', dy = 0, wobble = 0) {
    const av = CHAT_CONFIG.crushAvatar;
    Assets.draw(ctx, `char_crush_${face}.png`, av.x, av.y + dy, av.size, av.size, 'circle');

    const b = { ...CHAT_CONFIG.crushBubble, y: CHAT_CONFIG.crushBubble.y + dy };
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
  },

  // entries: [{ text, kind: 'good' | 'bad' | 'misplaced' }]
  drawPlayerAvatar(face) {
    const av = CHAT_CONFIG.playerAvatar;
    Assets.draw(ctx, `char_player_${face}.png`, av.x, av.y, av.size, av.size, 'circle');
  },

  drawReplyBar(entries, emptyText = 'your reply...', wobble = 0) {
    const r = CHAT_CONFIG.replyBubble;
    this.bubble('bubble_player.png', CHAT_CONFIG.colors.bubblePlayer, r);

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
        this.chip(e.kind, e.text, x + w / 2, cy, w, h, { wobble });
        x += w + gap;
      }
    });
  },

  // Live chat view during the bullet phase: face and wobble follow anxiety.
  draw(crushMessage, entries) {
    const wobble = Anxiety.wobbleAmp();
    this.drawCrushMessage(crushMessage, 'neutral', 0, wobble);
    this.drawReplyBar(entries, 'your reply...', wobble);
    this.drawPlayerAvatar(Anxiety.face());
    Anxiety.drawMeter();
  },
};
