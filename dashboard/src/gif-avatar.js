// ─────────────────────────────────────────────────────────────────────────────
// gif-avatar.js — "GIF" avatar tier for Agent Ops Center.
//
// The third avatar tier (alongside the canvas-based "pixel" and "abstract"
// renderers). Unlike those, this tier does NOT draw to the <canvas>. Instead it
// shows an <img> animated GIF per agent and conveys state through CSS overlays
// (color tint, a corner badge pill, and a border pulse). It therefore registers
// a DOM-based renderer rather than a canvas draw() function.
//
// ── Exposed global ───────────────────────────────────────────────────────────
//   window.AOC_AVATARS.gif = {
//     dom: true,                 // marks this as a DOM (not canvas) renderer
//     sync(cardEl, agent, t),    // per-frame update for a tile in gif mode
//     teardown(cardEl),          // remove <img>/overlays, restore the canvas
//     draw(ctx, agent, t),       // compat shim so the existing canvas loop in
//                                // index.html (which only calls renderer.draw)
//                                // can drive this DOM renderer unmodified.
//   };
//
// The merge below never clobbers the pixel/abstract tiers.
//
// ── How a user supplies their own GIFs ───────────────────────────────────────
//   1. Set a global array of URLs BEFORE/while the page runs:
//          window.AOC_GIFS = ['assets/avatars/cat.gif', 'https://.../bot.gif'];
//      Each agent is assigned one deterministically: hash(agent.id) % length.
//   2. OR drop GIFs in dashboard/assets/avatars/ and list their filenames in
//      dashboard/assets/avatars/manifest.json, e.g.  ["cat.gif","bot.gif"].
//      The renderer fetches that manifest ONCE and builds
//      'assets/avatars/<name>' URLs.
//   3. If neither is available (manifest 404s, no AOC_GIFS), each agent falls
//      back to a generated colored placeholder (a rounded square in the agent's
//      shirt color with its first initial), rendered as an inline data: URI SVG
//      so SOMETHING always shows — zero asset files required.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // State color palette (per spec). Unknown states fall back to idle gray.
  const COLORS = {
    idle:     '#6B7280',
    thinking: '#6366F1',
    coding:   '#10B981',
    spawning: '#F59E0B',
    reading:  '#3B82F6',
    error:    '#EF4444',
    testing:  '#8B5CF6',
    done:     '#10B981',
  };

  // Human-readable labels for the badge pill.
  const LABELS = {
    idle: 'Idle', thinking: 'Thinking', coding: 'Coding', spawning: 'Spawning',
    reading: 'Reading', error: 'Error', testing: 'Testing', done: 'Done',
  };

  // All gif-mode states get the same baseline filter "feel"; specific states can
  // be punched up. Kept conservative so user GIFs stay recognizable.
  const ALL_STATES = Object.keys(COLORS);

  // ── tiny helpers ────────────────────────────────────────────────────────────

  // Stable hash for a (possibly string) agent id -> non-negative integer.
  function hashId(id) {
    if (typeof id === 'number' && isFinite(id)) return Math.abs(id | 0);
    let h = 0;
    const s = String(id == null ? '' : id);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // #RRGGBB -> {r,g,b}
  function hexRgb(hex) {
    const n = parseInt(String(hex || '#6B7280').slice(1), 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }

  // Build a self-contained colored placeholder avatar as a data: URI SVG.
  // Rounded square in `shirt` color with the agent's first initial centered.
  function placeholderDataUri(shirt, name) {
    const initial = (String(name || '?').trim()[0] || '?').toUpperCase();
    const { r, g, b } = hexRgb(shirt || '#6B7280');
    const fill = `rgb(${r},${g},${b})`;
    // Pick readable text color via perceived luminance.
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const text = lum > 0.6 ? '#1F2937' : '#FFFFFF';
    // 120x120 viewport; escape '#' for use inside a data URI.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
      `<rect x="6" y="6" width="108" height="108" rx="20" ry="20" fill="${fill}"/>` +
      `<text x="60" y="60" font-family="-apple-system,Segoe UI,Roboto,sans-serif" ` +
      `font-size="64" font-weight="600" fill="${text}" ` +
      `text-anchor="middle" dominant-baseline="central">${initial}</text>` +
      `</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ── GIF source resolution ─────────────────────────────────────────────────

  // Cache the manifest fetch so it only ever happens once per page load.
  // Resolves to an array of URL strings (possibly empty on failure).
  let manifestPromise = null;
  // Once resolved, hold the URL list here for synchronous per-frame access.
  let manifestUrls = null;

  function loadManifestOnce() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch('assets/avatars/manifest.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('manifest ' + res.status);
        return res.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error('manifest not an array');
        manifestUrls = list
          .filter(function (n) { return typeof n === 'string' && n; })
          .map(function (n) { return 'assets/avatars/' + n; });
        return manifestUrls;
      })
      .catch(function () {
        // 404 / parse error / offline — fall back to placeholders forever.
        manifestUrls = [];
        return manifestUrls;
      });
    return manifestPromise;
  }

  // Return the current pool of GIF URLs, or null if none are known yet.
  // window.AOC_GIFS (if non-empty) wins; otherwise the (lazily fetched)
  // manifest. Returns null while the manifest is still in flight so callers
  // know to use a placeholder for now.
  function gifPool() {
    const g = window.AOC_GIFS;
    if (Array.isArray(g) && g.length) return g;
    if (manifestUrls === null) { loadManifestOnce(); return null; } // pending
    return manifestUrls.length ? manifestUrls : null;              // resolved
  }

  // Resolve the desired image src for an agent for THIS frame.
  function srcForAgent(agent) {
    const pool = gifPool();
    if (pool && pool.length) {
      return pool[hashId(agent && agent.id) % pool.length];
    }
    // No usable pool (none configured, or manifest still loading / empty).
    return placeholderDataUri(agent && agent.shirt, agent && agent.name);
  }

  // ── one-time <style> injection ──────────────────────────────────────────────

  function injectStyleOnce() {
    if (document.getElementById('aoc-gif-style')) return;
    const style = document.createElement('style');
    style.id = 'aoc-gif-style';
    // One @keyframes per state color for the border pulse (CSS keyframes can't
    // read CSS vars in older engines reliably, but box-shadow color CAN use a
    // var — so we use a single keyframe set driven by --gif-pulse).
    style.textContent = [
      // The image fills the 120x100 canvas-wrap, cropped to a rounded tile.
      '.gif-avatar{',
      '  display:block;width:120px;height:100px;object-fit:cover;',
      '  border-radius:12px;',
      '  background:var(--color-background-secondary,#f5f4ef);',
      '  transition:filter .3s ease;',
      '  will-change:filter,box-shadow;',
      '}',
      // Color tint via a translucent overlay layered on top of the img.
      '.gif-wrap-tint{position:absolute;inset:0;border-radius:12px;',
      '  pointer-events:none;mix-blend-mode:color;opacity:.35;',
      '  background:var(--gif-pulse,#6B7280);transition:background .3s ease,opacity .3s ease;}',
      // Border pulse: animated box-shadow ring in the state color.
      '.gif-pulse-ring{position:absolute;inset:0;border-radius:12px;',
      '  pointer-events:none;box-shadow:0 0 0 2px var(--gif-pulse,#6B7280);',
      '  animation:aocGifPulse 1.6s ease-in-out infinite;}',
      '@keyframes aocGifPulse{',
      '  0%,100%{box-shadow:0 0 0 2px var(--gif-pulse,#6B7280),0 0 0 0 transparent;}',
      '  50%{box-shadow:0 0 0 2px var(--gif-pulse,#6B7280),0 0 10px 3px var(--gif-pulse,#6B7280);}',
      '}',
      // Error state pulses faster/harder for urgency.
      '.gif-pulse-ring.gif-state-error{animation-duration:.7s;}',
      // Done/idle are calmer.
      '.gif-pulse-ring.gif-state-done,.gif-pulse-ring.gif-state-idle{animation-duration:2.4s;}',
      // Corner badge pill: state label + colored dot.
      '.gif-badge{position:absolute;top:6px;left:6px;z-index:2;',
      '  display:flex;align-items:center;gap:5px;',
      '  padding:2px 8px;border-radius:99px;',
      '  font-family:var(--font-sans,sans-serif);font-size:9px;font-weight:600;',
      '  color:#fff;background:rgba(17,17,17,.55);',
      '  backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);',
      '  letter-spacing:.02em;line-height:1.4;white-space:nowrap;}',
      '.gif-badge-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;',
      '  background:var(--gif-pulse,#6B7280);}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  // ── per-card element management ──────────────────────────────────────────────
  // We cache the elements we create per card so sync() is cheap after the first
  // frame. WeakMap keyed by cardEl avoids leaks when cards are removed.
  const store = new WeakMap();

  // Ensure the gif <img> + overlay layers exist inside the card's .canvas-wrap.
  // Hides the sibling <canvas>. Returns the cached element bundle (or null if
  // the card has no .canvas-wrap yet).
  function ensureEls(cardEl) {
    let bundle = store.get(cardEl);
    if (bundle && bundle.img && bundle.img.isConnected) return bundle;

    const wrap = cardEl.querySelector('.canvas-wrap');
    if (!wrap) return null;

    // Hide the canvas this tier replaces (restored in teardown).
    const canvas = wrap.querySelector('canvas.agent-canvas');
    if (canvas) canvas.style.display = 'none';

    // Image element.
    let img = wrap.querySelector('img.gif-avatar');
    if (!img) {
      img = document.createElement('img');
      img.className = 'gif-avatar';
      img.alt = '';
      img.decoding = 'async';
      // If a user GIF URL 404s at runtime, swap to a placeholder so the tile
      // never shows a broken-image icon.
      img.addEventListener('error', function () {
        const b = store.get(cardEl);
        const ph = placeholderDataUri(
          b && b.lastShirt, b && b.lastName
        );
        if (img.getAttribute('src') !== ph) {
          img.src = ph;
          if (b) b.curSrc = ph;
        }
      });
      wrap.appendChild(img);
    }

    // Tint overlay.
    let tint = wrap.querySelector('.gif-wrap-tint');
    if (!tint) {
      tint = document.createElement('div');
      tint.className = 'gif-wrap-tint';
      wrap.appendChild(tint);
    }

    // Pulse ring.
    let ring = wrap.querySelector('.gif-pulse-ring');
    if (!ring) {
      ring = document.createElement('div');
      ring.className = 'gif-pulse-ring';
      wrap.appendChild(ring);
    }

    // Badge pill (label + dot).
    let badge = wrap.querySelector('.gif-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'gif-badge';
      const dot = document.createElement('span');
      dot.className = 'gif-badge-dot';
      const txt = document.createElement('span');
      txt.className = 'gif-badge-text';
      badge.appendChild(dot);
      badge.appendChild(txt);
      wrap.appendChild(badge);
    }

    bundle = {
      wrap: wrap,
      canvas: canvas,
      img: img,
      tint: tint,
      ring: ring,
      badge: badge,
      badgeText: badge.querySelector('.gif-badge-text'),
      // change-detection caches so we only touch the DOM when something changes
      curSrc: null,
      curState: null,
      lastShirt: null,
      lastName: null,
    };
    store.set(cardEl, bundle);
    return bundle;
  }

  // Apply the per-state color overlays. Cheap; only writes when state changes.
  function applyState(bundle, state) {
    if (bundle.curState === state) return;
    bundle.curState = state;

    const color = COLORS[state] || COLORS.idle;
    const label = LABELS[state] || (state ? state[0].toUpperCase() + state.slice(1) : 'Idle');

    // Drive tint, ring, and dot color from one CSS var on the wrap.
    bundle.wrap.style.setProperty('--gif-pulse', color);

    // Per-state tempo classes on the ring (drop old state-* classes first).
    ring_setStateClass(bundle.ring, state);

    // A light per-state filter on the image itself for extra differentiation
    // without hiding the GIF (errors desaturate+darken, done brightens, etc.).
    bundle.img.style.filter = filterFor(state);

    // Badge text.
    if (bundle.badgeText) bundle.badgeText.textContent = label;
  }

  // Swap the ring's gif-state-* class to match the current state.
  function ring_setStateClass(ring, state) {
    for (let i = 0; i < ALL_STATES.length; i++) {
      ring.classList.remove('gif-state-' + ALL_STATES[i]);
    }
    ring.classList.add('gif-state-' + (COLORS[state] ? state : 'idle'));
  }

  // Subtle image filters per state (the tint overlay does the heavy lifting).
  function filterFor(state) {
    switch (state) {
      case 'error':    return 'saturate(1.2) brightness(.92)';
      case 'idle':     return 'saturate(.6) brightness(.95)';
      case 'thinking': return 'saturate(.95)';
      case 'done':     return 'saturate(1.1) brightness(1.05)';
      default:         return 'none';
    }
  }

  // ── public interface ─────────────────────────────────────────────────────────

  // Per-frame update for one tile in gif mode.
  function sync(cardEl, agent, t) {
    if (!cardEl || !agent) return;
    injectStyleOnce();
    const bundle = ensureEls(cardEl);
    if (!bundle) return; // card not ready (no .canvas-wrap yet)

    // Remember identity bits for the <img> error fallback.
    bundle.lastShirt = agent.shirt;
    bundle.lastName = agent.name;

    // Resolve & set src only when it actually changes (avoids GIF restarts).
    const src = srcForAgent(agent);
    if (src !== bundle.curSrc) {
      bundle.curSrc = src;
      bundle.img.src = src;
    }

    // Apply state overlays (no-op when state is unchanged).
    applyState(bundle, (agent.state) || 'idle');
    // `t` is unused for GIF playback (the browser animates the GIF itself), but
    // it is part of the contract and available for future frame-driven effects.
  }

  // Remove everything we added and restore the canvas for the next tier.
  function teardown(cardEl) {
    if (!cardEl) return;
    const wrap = cardEl.querySelector('.canvas-wrap');
    if (wrap) {
      const sel = ['img.gif-avatar', '.gif-wrap-tint', '.gif-pulse-ring', '.gif-badge'];
      for (let i = 0; i < sel.length; i++) {
        const el = wrap.querySelector(sel[i]);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      wrap.style.removeProperty('--gif-pulse');
      const canvas = wrap.querySelector('canvas.agent-canvas');
      if (canvas) canvas.style.display = ''; // restore canvas for pixel/abstract
    }
    store.delete(cardEl);
  }

  // ── compatibility shim ───────────────────────────────────────────────────────
  // The animation loop in index.html only knows how to call `renderer.draw(ctx,
  // agent, t)` (canvas tiers). Since we cannot edit index.html, expose a draw()
  // that derives the cardEl from the canvas's context and forwards to sync(),
  // so selecting "gif" mode works with the existing, unmodified loop.
  //
  // It also lazily tears down the OTHER mode is handled by the loop switching
  // away from us (the loop simply stops calling draw); we additionally tear down
  // our own overlays on any card that is no longer in gif mode each frame would
  // be wasteful, so instead teardown() is the explicit exit path for callers who
  // know about the dom interface. For the shim path we only build up.
  function draw(ctx, agent, t) {
    if (!ctx || !ctx.canvas) return;
    // Walk up from the canvas to its .agent-card.
    let el = ctx.canvas;
    let card = null;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('agent-card')) { card = el; break; }
      el = el.parentNode;
    }
    if (card) sync(card, agent, t);
  }

  // Expose global. Merge so pixel/abstract tiers are never clobbered.
  window.AOC_AVATARS = window.AOC_AVATARS || {};
  window.AOC_AVATARS.gif = {
    dom: true,
    sync: sync,
    teardown: teardown,
    draw: draw, // compat with index.html's canvas-oriented loop
  };
})();
