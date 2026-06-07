// ─────────────────────────────────────────────────────────────────────────────
// abstract-avatar.js — "Abstract" avatar tier for Agent Ops Center.
//
// Drop-in alternative to the built-in pixel-art renderer. Exposes a single
// global, matching the pixel renderer's draw signature so it can be swapped in:
//
//     window.AOC_AVATARS = { abstract: { draw(ctx, agent, t) { ... } } }
//
// Interface contract (mirrors the pixel renderer in index.html):
//   ctx   — CanvasRenderingContext2D. Backing store is 240x200 (DPR=2), shown at
//           CSS 120x100. We ctx.save()+scale(2,2) so all drawing below works in a
//           120x100 logical space, then ctx.restore() at the end.
//   agent — { id, name, shirt, state, ... }. Only agent.state is used here.
//   t     — monotonically increasing integer tick (one per animation frame).
//           ALL motion is derived from `t` (no internal timers / Date.now), so
//           rendering is deterministic and requestAnimationFrame-friendly.
//
// Background stays transparent: we only clearRect the full backing store.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // Logical drawing surface (post-scale). Backing store is W*DPR x H*DPR.
  const W = 120, H = 100, DPR = 2;
  const CX = W / 2, CY = H / 2; // center of the tile

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

  // ── small helpers ──────────────────────────────────────────────────────────

  // Convert a #RRGGBB hex color + alpha (0..1) to an rgba() string.
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `rgba(${r},${g},${b},${a})`;
  }

  // Deterministic pseudo-random in [0,1) from an integer seed (for glitch jitter).
  function rand(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // ── per-state renderers (all draw in 120x100 logical space) ─────────────────

  // idle: slow dim pulsing ring.
  function drawIdle(ctx, color, t) {
    const pulse = (Math.sin(t * 0.04) + 1) / 2;          // 0..1, slow
    const radius = 22 + pulse * 6;
    const alpha = 0.25 + pulse * 0.35;
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.beginPath();
    ctx.arc(CX, CY, radius, 0, Math.PI * 2);
    ctx.stroke();
    // faint inner dot
    ctx.fillStyle = rgba(color, alpha * 0.6);
    ctx.beginPath();
    ctx.arc(CX, CY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // thinking: small dots orbiting a center point.
  function drawThinking(ctx, color, t) {
    const DOTS = 5;
    const orbit = 24;
    const base = t * 0.06;
    // faint center anchor
    ctx.fillStyle = rgba(color, 0.5);
    ctx.beginPath();
    ctx.arc(CX, CY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < DOTS; i++) {
      const ang = base + (i / DOTS) * Math.PI * 2;
      const x = CX + Math.cos(ang) * orbit;
      const y = CY + Math.sin(ang) * orbit;
      // trailing fade: leading dot brightest
      const a = 0.3 + 0.6 * (i / (DOTS - 1));
      const r = 2 + 1.5 * (i / (DOTS - 1));
      ctx.fillStyle = rgba(color, a);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // coding: fast vertical equalizer bars.
  function drawCoding(ctx, color, t) {
    const BARS = 7;
    const barW = 8;
    const gap = 4;
    const totalW = BARS * barW + (BARS - 1) * gap;
    const x0 = CX - totalW / 2;
    const maxH = 50;
    const baseY = CY + maxH / 2;
    for (let i = 0; i < BARS; i++) {
      // each bar oscillates at a slightly different speed/phase -> lively EQ
      const phase = i * 1.7;
      const speed = 0.22 + (i % 3) * 0.05;
      const h = 8 + ((Math.sin(t * speed + phase) + 1) / 2) * maxH;
      const x = x0 + i * (barW + gap);
      ctx.fillStyle = rgba(color, 0.85);
      ctx.fillRect(x, baseY - h, barW, h);
      // brighter cap
      ctx.fillStyle = rgba(color, 1);
      ctx.fillRect(x, baseY - h, barW, 3);
    }
  }

  // reading: horizontal scan line sweeping over faint text-like ticks.
  function drawReading(ctx, color, t) {
    const left = CX - 38, right = CX + 38;
    const top = CY - 28, lineGap = 9, lines = 6;
    // faint "text" ticks (static rows of short dashes)
    ctx.fillStyle = rgba(color, 0.22);
    for (let r = 0; r < lines; r++) {
      const y = top + r * lineGap;
      // pseudo-random dash widths per row for a text-like look
      let x = left;
      let seed = r * 3 + 1;
      while (x < right) {
        const w = 3 + Math.floor(rand(seed) * 9);
        if (x + w > right) break;
        ctx.fillRect(x, y, w, 2);
        x += w + 3 + Math.floor(rand(seed + 100) * 4);
        seed++;
      }
    }
    // sweeping scan line (ping-pong left<->right)
    const span = right - left;
    const tri = Math.abs(((t * 0.03) % 2) - 1); // 0..1..0 triangle wave
    const sx = left + tri * span;
    ctx.fillStyle = rgba(color, 0.9);
    ctx.fillRect(sx - 1, top - 4, 2, lines * lineGap + 6);
    // soft glow trail
    ctx.fillStyle = rgba(color, 0.25);
    ctx.fillRect(sx - 5, top - 4, 4, lines * lineGap + 6);
  }

  // spawning: concentric rings expanding outward and fading.
  function drawSpawning(ctx, color, t) {
    const RINGS = 3;
    const period = 60;             // ticks per full ring lifecycle
    const maxR = 40;
    for (let i = 0; i < RINGS; i++) {
      // stagger rings evenly across the period
      const phase = ((t + i * (period / RINGS)) % period) / period; // 0..1
      const radius = phase * maxR;
      const alpha = (1 - phase) * 0.8;
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    // solid emitter core
    ctx.fillStyle = rgba(color, 0.95);
    ctx.beginPath();
    ctx.arc(CX, CY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // error: red jittering / glitching shape.
  function drawError(ctx, color, t) {
    const SLICES = 5;
    const sliceH = 10;
    const baseW = 44;
    const top = CY - (SLICES * sliceH) / 2;
    // horizontally displaced slices = "glitch" / datamosh look
    for (let i = 0; i < SLICES; i++) {
      const seed = i + Math.floor(t / 2); // re-jitter every couple ticks
      const dx = (rand(seed) - 0.5) * 22;
      const a = 0.6 + rand(seed + 9) * 0.4;
      const y = top + i * sliceH;
      ctx.fillStyle = rgba(color, a);
      ctx.fillRect(CX - baseW / 2 + dx, y, baseW, sliceH - 2);
    }
    // occasional bright glitch streak
    if (Math.floor(t / 4) % 3 === 0) {
      const gy = top + (Math.floor(rand(t) * SLICES)) * sliceH;
      ctx.fillStyle = rgba('#FFFFFF', 0.7);
      ctx.fillRect(CX - baseW / 2, gy, baseW, 2);
    }
  }

  // testing: flipping square that alternates green / red.
  function drawTesting(ctx, color, t) {
    const period = 30;
    const phase = (t % period) / period;        // 0..1
    // horizontal "flip" via cosine scale on X
    const scaleX = Math.cos(phase * Math.PI * 2);
    const side = 44;
    // pass (green) on the front face, fail (red) on the back face
    const showingFront = scaleX >= 0;
    const faceColor = showingFront ? '#10B981' : '#EF4444';
    ctx.save();
    ctx.translate(CX, CY);
    ctx.scale(Math.max(Math.abs(scaleX), 0.05), 1);
    ctx.fillStyle = rgba(faceColor, 0.9);
    ctx.fillRect(-side / 2, -side / 2, side, side);
    // mark: check on front, cross on back
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (showingFront) {
      ctx.moveTo(-11, 2); ctx.lineTo(-3, 11); ctx.lineTo(12, -9);   // ✓
    } else {
      ctx.moveTo(-10, -10); ctx.lineTo(10, 10);                     // ✗
      ctx.moveTo(10, -10);  ctx.lineTo(-10, 10);
    }
    ctx.stroke();
    ctx.restore();
    // subtle tint of the state color as an outer ring
    ctx.strokeStyle = rgba(color, 0.4);
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - side / 2 - 5, CY - side / 2 - 5, side + 10, side + 10);
  }

  // done: steady pulse with a check-style motif.
  function drawDone(ctx, color, t) {
    const pulse = (Math.sin(t * 0.12) + 1) / 2;   // 0..1
    const radius = 24 + pulse * 4;
    // filled disc that gently pulses
    ctx.fillStyle = rgba(color, 0.18 + pulse * 0.15);
    ctx.beginPath();
    ctx.arc(CX, CY, radius, 0, Math.PI * 2);
    ctx.fill();
    // ring outline
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(color, 0.8 + pulse * 0.2);
    ctx.beginPath();
    ctx.arc(CX, CY, radius, 0, Math.PI * 2);
    ctx.stroke();
    // steady check mark
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(CX - 12, CY + 2);
    ctx.lineTo(CX - 3, CY + 11);
    ctx.lineTo(CX + 13, CY - 10);
    ctx.stroke();
  }

  // map state -> renderer
  const RENDERERS = {
    idle:     drawIdle,
    thinking: drawThinking,
    coding:   drawCoding,
    spawning: drawSpawning,
    reading:  drawReading,
    error:    drawError,
    testing:  drawTesting,
    done:     drawDone,
  };

  // ── public draw entrypoint ──────────────────────────────────────────────────
  function draw(ctx, agent, t) {
    // Always clear the FULL backing store (unscaled coords) for transparency.
    ctx.clearRect(0, 0, W * DPR, H * DPR);

    const state = (agent && agent.state) || 'idle';
    const color = COLORS[state] || COLORS.idle;
    const render = RENDERERS[state] || drawIdle;

    // Work in logical 120x100 space; DPR scale handles the hi-dpi backing store.
    ctx.save();
    ctx.scale(DPR, DPR);
    // reset stroke/line defaults each frame (state renderers set what they need)
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    render(ctx, color, t);
    ctx.restore();
  }

  // Expose global. Merge rather than overwrite, so other tiers can coexist.
  window.AOC_AVATARS = window.AOC_AVATARS || {};
  window.AOC_AVATARS.abstract = { draw };
})();
