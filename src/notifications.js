// Group chat sabotage: notification banners slide in over the play area and hide what's under
// them. They never hurt the player or block collisions. Dismiss by dragging/clicking them with the
// mouse or pressing Q (newest first). Every banner left on screen slowly raises anxiety.
// Level data (levels.json): notificationsEnabled, notificationRate (banners per minute), notifications.

const NOTIF_CONFIG = {
  maxOnScreen: 3,         // never more banners than this at once
  firstDelay: 4,          // seconds into the bullet phase before the first banner
  rateJitter: 0.3,        // each gap is the average gap x (1 +/- this)
  retryDelay: 1.0,        // when the screen is full, check again after this many seconds
  slideTime: 0.35,        // seconds for a banner to slide in
  width: 360,             // banner size (the art is 720x160 at 2x)
  height: 80,
  anxietyPerSecond: 0.8,  // anxiety per second for EACH banner left on screen
  dismissDrop: 2,         // anxiety removed when you dismiss one
  swipeDistance: 60,      // px you must drag a banner for it to fly off (shorter drags spring back)
  tapDistance: 6,         // a press that moves less than this counts as a click (dismisses too)
  flyOffSpeed: 1400,      // px/sec when a dismissed banner leaves
  gap: 6,                 // min px between banners when placing a new one
};

const Notifs = {
  list: [],        // banners: { sender, text, lines, from, x, y, sx, sy, tx, ty, t, state, vx, vy }
  enabled: false,
  interval: 10,    // average seconds between banners
  timer: 0,
  bag: [],         // messages still to show in this shuffle
  messages: [],
  drag: null,      // { n, offX, offY, startX, startY, moved } while the mouse holds a banner
  dismissed: 0,    // how many were dismissed this level (handy for testing)

  // ----- level setup -----

  start(level) {
    this.list = [];
    this.bag = [];
    this.drag = null;
    this.dismissed = 0;
    this.messages = level.notifications || [];
    const rate = level.notificationRate || 0;
    this.enabled = level.notificationsEnabled !== false && this.messages.length > 0 && rate > 0;
    this.interval = rate > 0 ? 60 / rate : 1e9;
    this.timer = NOTIF_CONFIG.firstDelay;
  },

  // Filenames of every sender's avatar and the banner, so main.js can preload them.
  assetNames(levels) {
    const names = new Set(['notif_banner.png']);
    for (const l of levels) for (const m of l.notifications || []) names.add(this.avatarFile(m.sender));
    return [...names];
  },

  avatarFile(sender) {
    return `notif_avatar_${sender.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
  },

  // Warns about levels that turn notifications on without anything to show.
  validate(levels) {
    const out = [];
    const warn = (msg) => { out.push(msg); console.warn(`[notifications] ${msg}`); };
    for (const l of levels) {
      if (l.notificationsEnabled === true && !(l.notifications && l.notifications.length)) warn(`level "${l.id}": notificationsEnabled but no "notifications"`);
      if (l.notificationsEnabled === true && !(l.notificationRate > 0)) warn(`level "${l.id}": notificationsEnabled but no "notificationRate"`);
      for (const m of l.notifications || []) if (!m.sender || !m.text) warn(`level "${l.id}": notification needs "sender" and "text"`);
    }
    return out;
  },

  // ----- per-frame -----

  active() {
    return this.list.filter((n) => n.state !== 'out');
  },

  // Bullet-phase logic: spawn new banners, and let the ones on screen make him more anxious.
  update(dt) {
    const count = this.active().length;
    if (count) Anxiety.add(NOTIF_CONFIG.anxietyPerSecond * count * dt);
    if (!this.enabled) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (count >= NOTIF_CONFIG.maxOnScreen) { this.timer = NOTIF_CONFIG.retryDelay; return; }
    this.spawn();
    this.timer = this.interval * (1 + (Math.random() * 2 - 1) * NOTIF_CONFIG.rateJitter);
  },

  // Animations (slide in, fly off). Runs even after the level ends so nothing freezes mid-air.
  animate(dt) {
    const a = Game.area, c = NOTIF_CONFIG;
    for (const n of this.list) {
      if (n.state === 'in') {
        n.t += dt;
        const k = Math.min(1, n.t / c.slideTime);
        const e = 1 - Math.pow(1 - k, 3); // ease out
        n.x = n.sx + (n.tx - n.sx) * e;
        n.y = n.sy + (n.ty - n.sy) * e;
        if (k >= 1) n.state = 'idle';
      } else if (n.state === 'out') {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }
    }
    this.list = this.list.filter((n) =>
      !(n.state === 'out' && (n.x > a.x + a.w || n.x + c.width < a.x || n.y > a.y + a.h || n.y + c.height < a.y)));
  },

  nextMessage() {
    if (!this.bag.length) {
      this.bag = [...this.messages];
      for (let i = this.bag.length - 1; i > 0; i--) { // shuffle
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  },

  // Picks a spot inside the play area that doesn't overlap other banners if there's room.
  pickTarget() {
    const a = Game.area, c = NOTIF_CONFIG;
    const others = this.active();
    let best = null, bestOverlap = Infinity;
    for (let i = 0; i < 12; i++) {
      const tx = a.x + Math.random() * (a.w - c.width);
      const ty = a.y + Math.random() * (a.h - c.height);
      let overlap = 0;
      for (const o of others) {
        const w = Math.min(tx + c.width, o.tx + c.width) - Math.max(tx, o.tx) + c.gap;
        const h = Math.min(ty + c.height, o.ty + c.height) - Math.max(ty, o.ty) + c.gap;
        if (w > 0 && h > 0) overlap += w * h;
      }
      if (overlap < bestOverlap) { best = { tx, ty }; bestOverlap = overlap; }
      if (overlap === 0) break;
    }
    return best;
  },

  spawn() {
    const a = Game.area, c = NOTIF_CONFIG;
    const msg = this.nextMessage();
    const { tx, ty } = this.pickTarget();
    const from = ['top', 'left', 'right'][Math.floor(Math.random() * 3)];
    const sx = from === 'left' ? a.x - c.width - 10 : from === 'right' ? a.x + a.w + 10 : tx;
    const sy = from === 'top' ? a.y - c.height - 10 : ty;

    ctx.font = '14px system-ui, sans-serif';
    let lines = Chat.wrapLines(msg.text, c.width - 62 - 14, '14px system-ui, sans-serif');
    if (lines.length > 2) lines = [lines[0], lines[1].replace(/\s*\S*$/, '') + '…'];

    this.list.push({ sender: msg.sender, text: msg.text, lines, from, x: sx, y: sy, sx, sy, tx, ty, t: 0, state: 'in', vx: 0, vy: 0 });
    Sfx.play('buzz');
  },

  // ----- dismissing -----

  // dir is a direction vector (it gets normalized); the banner flies off that way.
  dismiss(n, dirX, dirY) {
    const len = Math.hypot(dirX, dirY) || 1;
    n.state = 'out';
    n.vx = (dirX / len) * NOTIF_CONFIG.flyOffSpeed;
    n.vy = (dirY / len) * NOTIF_CONFIG.flyOffSpeed;
    if (this.drag && this.drag.n === n) this.drag = null;
    this.dismissed++;
    Anxiety.add(-NOTIF_CONFIG.dismissDrop);
    Sfx.play('swipe');
  },

  // Back out the way it came in.
  exitDirection(n) {
    return n.from === 'left' ? [-1, 0] : n.from === 'right' ? [1, 0] : [0, -1];
  },

  // Q: dismiss the most recent banner.
  dismissNewest() {
    const live = this.active().filter((n) => n.state !== 'drag');
    const n = live[live.length - 1];
    if (!n) return false;
    this.dismiss(n, ...this.exitDirection(n));
    return true;
  },

  // ----- mouse -----

  at(x, y) { // topmost (newest) banner under the point
    const c = NOTIF_CONFIG;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i];
      if (n.state !== 'out' && x >= n.x && x <= n.x + c.width && y >= n.y && y <= n.y + c.height) return n;
    }
    return null;
  },

  // Returns true if a banner was grabbed.
  pointerDown(x, y) {
    const n = this.at(x, y);
    if (!n) return false;
    this.drag = { n, offX: x - n.x, offY: y - n.y, startX: x, startY: y, moved: 0 };
    n.state = 'drag';
    return true;
  },

  pointerMove(x, y) {
    const d = this.drag;
    if (!d) return;
    d.n.x = x - d.offX;
    d.n.y = y - d.offY;
    d.moved = Math.max(d.moved, Math.hypot(x - d.startX, y - d.startY));
  },

  pointerUp(x, y) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const n = d.n, dist = Math.hypot(x - d.startX, y - d.startY);
    if (d.moved < NOTIF_CONFIG.tapDistance) this.dismiss(n, ...this.exitDirection(n));       // a click
    else if (dist >= NOTIF_CONFIG.swipeDistance) this.dismiss(n, x - d.startX, y - d.startY); // a swipe
    else { n.state = 'in'; n.t = 0; n.sx = n.x; n.sy = n.y; }                                   // too short: spring back
  },

  // ----- drawing -----

  draw() {
    for (const n of this.list) this.drawBanner(n);
  },

  drawBanner(n) {
    const c = NOTIF_CONFIG, x = n.x, y = n.y, W = c.width, H = c.height;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = n.state === 'drag' ? 18 : 10;
    ctx.shadowOffsetY = n.state === 'drag' ? 6 : 3;
    if (Assets.has('notif_banner.png')) {
      Assets.draw(ctx, 'notif_banner.png', x, y, W, H);
    } else {
      ctx.fillStyle = '#f6f6fb';
      ctx.beginPath();
      ctx.roundRect(x, y, W, H, 16);
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';

    if (!Assets.has('notif_banner.png')) { // labeled placeholder: filename tucked in a corner
      ctx.strokeStyle = '#c9c9d6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, W, H, 16);
      ctx.stroke();
      ctx.fillStyle = '#aaa';
      ctx.font = '7px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('notif_banner.png', x + W - 14, y + H - 5);
    }

    Assets.draw(ctx, this.avatarFile(n.sender), x + 12, y + 20, 40, 40, 'circle');

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#222';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(n.sender, x + 62, y + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9a9aa8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('swipe / Q  ✕', x + W - 14, y + 12);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    ctx.font = '14px system-ui, sans-serif';
    n.lines.forEach((l, i) => ctx.fillText(l, x + 62, y + 32 + i * 18));
    ctx.restore();
  },
};
