/**
 * Conway's Game of Life — ambient background animation.
 * Avoids content cards. Move the mouse to paint new life.
 */
(function () {
  // Skip on mobile / narrow viewports — there's no margin space for cells
  // and they end up crammed awkwardly next to the content.
  if (window.innerWidth < 760 || 'ontouchstart' in window && window.innerWidth < 900) {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'life-canvas';
  canvas.style.cssText =
    'position:absolute;top:0;left:0;width:100%;pointer-events:none;z-index:0;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const CELL = 18;
  const STEP_MS = 220;
  const SEED_DENSITY = 0.16;
  const PAINT_RADIUS = 3; // cells

  let cols = 0, rows = 0;
  let docW = 0, docH = 0;
  let grid, next, age, vis;
  let occluders = [];

  const FADE_RATE = 0.10; // per-frame lerp toward target opacity

  function getDocSize() {
    const w = window.innerWidth;
    const h = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.innerHeight
    );
    return [w, h];
  }

  function resize() {
    const [w, h] = getDocSize();
    docW = w;
    docH = h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const newCols = Math.ceil(w / CELL) + 1;
    const newRows = Math.ceil(h / CELL) + 1;
    if (newCols !== cols || newRows !== rows) {
      cols = newCols;
      rows = newRows;
      initGrid();
    }
    computeOccluders();
  }

  function initGrid() {
    grid = new Uint8Array(cols * rows);
    next = new Uint8Array(cols * rows);
    age = new Uint16Array(cols * rows);
    vis = new Float32Array(cols * rows);
    for (let i = 0; i < grid.length; i++) {
      if (Math.random() < SEED_DENSITY) grid[i] = 1;
    }
  }

  // Occluders use document coordinates (page-relative)
  function pushRect(r, padX = 8, padY = 6, extraH = 0) {
    if (r.width <= 0 || r.height <= 0) return;
    occluders.push({
      x: r.left + window.scrollX - padX,
      y: r.top + window.scrollY - padY,
      w: r.width + padX * 2,
      h: r.height + padY * 2 + extraH,
    });
  }

  function computeOccluders() {
    occluders = [];

    // Nav bar
    const nav = document.querySelector('.nav');
    if (nav) pushRect(nav.getBoundingClientRect());

    // Helper: get actual text bounds via Range API (instead of block width).
    function textRect(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    }

    const h1 = document.querySelector('.header h1');
    const subtitle = document.querySelector('.subtitle');
    const cards = Array.from(document.querySelectorAll('.card'));
    const firstCardTop = cards.length
      ? cards[0].getBoundingClientRect().top
      : null;

    // h1 — text width, extended down to subtitle top to cover the gap.
    if (h1) {
      const tr = textRect(h1);
      if (tr) {
        const bottom = subtitle
          ? subtitle.getBoundingClientRect().top
          : tr.bottom;
        pushRect({
          left: tr.left,
          top: tr.top,
          right: tr.right,
          bottom,
          width: tr.width,
          height: bottom - tr.top,
        });
      }
    }

    // Subtitle quote — text width, extended down to the first card's top.
    if (subtitle) {
      const tr = textRect(subtitle);
      if (tr) {
        const bottom = firstCardTop ?? tr.bottom;
        pushRect({
          left: tr.left,
          top: tr.top,
          right: tr.right,
          bottom,
          width: tr.width,
          height: bottom - tr.top,
        });
      }
    }

    // Cards — one merged occluder covering first card top through last card bottom.
    if (cards.length > 0) {
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      if (isFinite(left)) {
        pushRect({
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        });
      }
    }
  }

  function step() {
    let livingCount = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + cols) % cols;
            const ny = (y + dy + rows) % rows;
            n += grid[ny * cols + nx];
          }
        }
        const alive = grid[idx];
        const nowAlive = alive ? n === 2 || n === 3 : n === 3;
        next[idx] = nowAlive ? 1 : 0;
        if (nowAlive) {
          age[idx] = alive ? age[idx] + 1 : 1;
          livingCount++;
        } else {
          age[idx] = 0;
        }
      }
    }
    const tmp = grid;
    grid = next;
    next = tmp;
    return livingCount;
  }

  function injectCluster(cx, cy, w, h, density) {
    cx = cx ?? Math.floor(Math.random() * cols);
    cy = cy ?? Math.floor(Math.random() * rows);
    w = w ?? 4 + Math.floor(Math.random() * 4);
    h = h ?? 4 + Math.floor(Math.random() * 4);
    density = density ?? 0.45;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (Math.random() < density) {
          const nx = (cx + dx + cols) % cols;
          const ny = (cy + dy + rows) % rows;
          grid[ny * cols + nx] = 1;
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, docW, docH);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        // Compute target opacity for this cell
        let target = 0;
        if (grid[idx]) {
          const a = Math.min(age[idx], 20) / 20;
          target = 0.34 - a * 0.16;
        }
        // Smoothly lerp visible opacity toward target
        vis[idx] += (target - vis[idx]) * FADE_RATE;
        if (vis[idx] < 0.005) continue;
        ctx.fillStyle = `rgba(44, 80, 44, ${vis[idx]})`;
        ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
      }
    }
    for (const o of occluders) {
      ctx.clearRect(o.x, o.y, o.w, o.h);
    }
  }

  // ── Mouse painting ──
  function paintAt(pageX, pageY) {
    const cx = Math.floor(pageX / CELL);
    const cy = Math.floor(pageY / CELL);
    for (let dy = -PAINT_RADIUS; dy <= PAINT_RADIUS; dy++) {
      for (let dx = -PAINT_RADIUS; dx <= PAINT_RADIUS; dx++) {
        const distSq = dx * dx + dy * dy;
        if (distSq > PAINT_RADIUS * PAINT_RADIUS) continue;
        // Solid in center, sparser at edges so it forms an organic blob
        const fill = distSq <= 1 ? 1 : Math.random() < 0.85 ? 1 : 0;
        if (!fill) continue;
        const nx = (cx + dx + cols) % cols;
        const ny = (cy + dy + rows) % rows;
        const idx = ny * cols + nx;
        grid[idx] = 1;
        age[idx] = 1;
      }
    }
  }

  document.addEventListener('mousemove', (e) => {
    paintAt(e.pageX, e.pageY);
  });
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length) {
        const t = e.touches[0];
        paintAt(t.pageX, t.pageY);
      }
    },
    { passive: true }
  );

  let lastStep = 0;
  let stepsSinceInject = 0;
  let lowActivityFrames = 0;

  function loop(t) {
    if (t - lastStep >= STEP_MS) {
      const living = step();
      stepsSinceInject++;

      if (stepsSinceInject > 25 && Math.random() < 0.12) {
        injectCluster();
        stepsSinceInject = 0;
      }

      const totalCells = cols * rows;
      if (living < totalCells * 0.02) {
        lowActivityFrames++;
        if (lowActivityFrames > 8) {
          for (let i = 0; i < 6; i++) injectCluster();
          lowActivityFrames = 0;
        }
      } else {
        lowActivityFrames = 0;
      }
      lastStep = t;
    }
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  // Recompute occluders when content loads or layout changes
  setTimeout(() => { resize(); }, 100);
  setTimeout(() => { resize(); }, 600);
  setTimeout(() => { resize(); }, 1500);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => resize());
    ro.observe(document.body);
  }
  requestAnimationFrame(loop);
})();
