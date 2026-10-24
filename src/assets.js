// Asset loading with labeled placeholder fallback.
// Art is human-made: load by exact filename from assets/art/, never replace it.
// Missing files are fine: draw() renders a labeled placeholder instead.

const Assets = (() => {
  const ART_DIR = 'assets/art/';
  const images = {}; // filename -> { img, ok, width, height }
  // On a local dev server, add a changing query so a re-exported PNG shows up on the next reload instead of
  // the browser's cached copy. Published builds (itch.io etc.) keep normal caching.
  const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const cacheBust = DEV ? `?v=${Date.now()}` : '';

  // Pick a stable color per filename so placeholders are easy to tell apart.
  function placeholderColor(name) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h}, 55%, 45%)`;
  }

  function load(name) {
    if (images[name]) return images[name].promise;
    const entry = { img: new Image(), ok: false, width: 0, height: 0 };
    images[name] = entry;
    entry.promise = new Promise((resolve) => {
      entry.img.onload = () => {
        entry.ok = true;
        entry.width = entry.img.naturalWidth;
        entry.height = entry.img.naturalHeight;
        resolve(entry);
      };
      entry.img.onerror = () => {
        console.warn(`[assets] missing ${ART_DIR}${name}, using placeholder`);
        resolve(entry);
      };
      entry.img.src = ART_DIR + name + cacheBust;
    });
    return entry.promise;
  }

  function loadAll(names) {
    return Promise.all(names.map(load));
  }

  function get(name) {
    return images[name];
  }

  function has(name) {
    return !!(images[name] && images[name].ok);
  }

  function drawPlaceholder(ctx, name, x, y, w, h, shape = 'rect') {
    ctx.save();
    ctx.fillStyle = placeholderColor(name);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    ctx.stroke();

    // Filename label, shrunk to fit the box. Big boxes (backgrounds) put it at
    // the bottom edge so it doesn't collide with UI drawn on top.
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = Math.max(8, Math.min(16, h / 3));
    ctx.font = `${size}px monospace`;
    while (size > 6 && ctx.measureText(name).width > w - 4) {
      size -= 1;
      ctx.font = `${size}px monospace`;
    }
    const labelY = h > 150 ? y + h - 10 : y + h / 2;
    ctx.fillText(name, x + w / 2, labelY);
    ctx.restore();
  }

  // Draw an image scaled to (w, h). Falls back to a labeled placeholder.
  function draw(ctx, name, x, y, w, h, shape) {
    const entry = images[name];
    if (entry && entry.ok) {
      ctx.drawImage(entry.img, x, y, w, h);
    } else {
      if (!entry) load(name); // lazy-load anything not preloaded
      drawPlaceholder(ctx, name, x, y, w, h, shape);
    }
  }

  return { load, loadAll, get, has, draw, drawPlaceholder };
})();
