<script>
  import { onMount } from 'svelte';
  import { STATE_COLORS } from './states.js';

  let { agents = [] } = $props();

  let view = $state({ edges: [], phase: 0 });
  const ACTIVE = ['coding', 'reading', 'thinking', 'spawning', 'testing', 'running', 'searching'];

  function bez(t, a, b, c, d) { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
  function point(e, t) {
    return { x: bez(t, e.p0.x, e.c1.x, e.c2.x, e.p1.x), y: bez(t, e.p0.y, e.c1.y, e.c2.y, e.p1.y) };
  }
  function pathD(e) { return `M ${e.p0.x} ${e.p0.y} C ${e.c1.x} ${e.c1.y} ${e.c2.x} ${e.c2.y} ${e.p1.x} ${e.p1.y}`; }
  function packets(e, phase) {
    const n = e.active ? 3 : 1;
    const sp = e.active ? 1 : 0.5;
    const out = [];
    for (let i = 0; i < n; i++) out.push(point(e, ((phase * sp) + i / n) % 1));
    return out;
  }

  onMount(() => {
    let raf, last = performance.now(), phase = 0;
    const loop = (ts) => {
      const dt = Math.min(64, ts - last); last = ts;
      phase = (phase + dt * 0.0005) % 1000;
      const edges = [];
      for (const a of agents) {
        if (!a.parentId) continue;
        const childEl = document.querySelector(`[data-id="${a.id}"]`);
        const parentEl = document.querySelector(`[data-id="${a.parentId}"]`);
        if (!childEl || !parentEl) continue;
        const pr = parentEl.getBoundingClientRect();
        const cr = childEl.getBoundingClientRect();
        const p0 = { x: pr.left + pr.width / 2, y: pr.bottom };
        const p1 = { x: cr.left + cr.width / 2, y: cr.top };
        const dy = Math.max(18, Math.abs(p1.y - p0.y) * 0.5);
        edges.push({
          key: a.parentId + '>' + a.id,
          p0, p1, c1: { x: p0.x, y: p0.y + dy }, c2: { x: p1.x, y: p1.y - dy },
          color: STATE_COLORS[a.state] || '#94a3b8',
          active: ACTIVE.includes(a.state),
        });
      }
      view = { edges, phase };
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<svg class="overlay" width="100%" height="100%">
  {#each view.edges as e (e.key)}
    <path d={pathD(e)} stroke={e.color} class="link" class:active={e.active} />
    {#each packets(e, view.phase) as p, i (i)}
      <circle cx={p.x} cy={p.y} r={e.active ? 2.8 : 2.2} fill={e.color} class="pkt" />
    {/each}
  {/each}
</svg>

<style>
  .overlay {
    position: fixed; inset: 0; width: 100vw; height: 100vh;
    pointer-events: none; z-index: 40;
  }
  .link { fill: none; stroke-width: 1.5; opacity: 0.28; }
  .link.active { opacity: 0.5; }
  .pkt { filter: drop-shadow(0 0 3px currentColor); }
</style>
