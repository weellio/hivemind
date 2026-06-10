<script>
  // Lightweight zero-dep spotlight tour. Steps: { sel?, title, body }.
  // sel is a CSS selector for the element to highlight; omit for a centered card.
  let { open = $bindable(false), steps = [] } = $props();
  let i = $state(0);
  let rect = $state(null);
  let place = $state('bottom');

  const PAD = 8;
  function measure() {
    const s = steps[i];
    if (!s || !s.sel) { rect = null; return; }
    const el = document.querySelector(s.sel);
    if (!el) { rect = null; return; }
    const r = el.getBoundingClientRect();
    rect = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, b: r.bottom };
    place = (window.innerHeight - r.bottom) > 190 ? 'bottom' : 'top';
  }
  // re-measure whenever the tour opens or the step changes
  $effect(() => { open; i; if (open) requestAnimationFrame(measure); });

  function next() { if (i < steps.length - 1) i++; else finish(); }
  function back() { if (i > 0) i--; }
  function finish() { try { localStorage.setItem('aoc-toured', '1'); } catch (_) {} open = false; i = 0; }
  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { finish(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { back(); }
  }

  let tip = $derived.by(() => {
    const w = 300;
    if (!rect) return { centered: true, w };
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(12, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - w - 12, left));
    if (place === 'bottom') return { centered: false, left, top: rect.top + rect.height + 12, w, above: false };
    return { centered: false, left, bottom: (typeof window !== 'undefined' ? window.innerHeight : 800) - rect.top + 12, w, above: true };
  });
</script>

<svelte:window onkeydown={onKey} onresize={measure} />

{#if open && steps.length}
  <div class="tour" role="dialog" aria-label="Tour">
    <div class="block"></div>
    {#if rect}
      <div class="spot" style="top:{rect.top}px;left:{rect.left}px;width:{rect.width}px;height:{rect.height}px"></div>
    {:else}
      <div class="dim"></div>
    {/if}
    <div class="card" class:centered={tip.centered}
      style={tip.centered ? `width:${tip.w}px` : `left:${tip.left}px;${tip.above ? `bottom:${tip.bottom}px` : `top:${tip.top}px`};width:${tip.w}px`}>
      <div class="hd"><span class="step">{i + 1} / {steps.length}</span><button class="skip" onclick={finish}>Skip ✕</button></div>
      <h3>{steps[i].title}</h3>
      <p>{steps[i].body}</p>
      <div class="row">
        <div class="dots">{#each steps as _, k (k)}<span class="dot" class:on={k === i}></span>{/each}</div>
        <div class="nav">
          {#if i > 0}<button onclick={back}>Back</button>{/if}
          <button class="primary" onclick={next}>{i < steps.length - 1 ? 'Next →' : 'Done'}</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour { position: fixed; inset: 0; z-index: 200; }
  .block { position: fixed; inset: 0; }                    /* captures clicks during the tour */
  .dim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); }
  .spot { position: fixed; border-radius: 8px; pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 0 2px var(--accent, #6366F1);
    animation: spot 1.6s ease-in-out infinite; }
  @keyframes spot { 0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px var(--accent, #6366F1); }
                    50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 4px var(--accent, #6366F1); } }
  .card { position: fixed; z-index: 2; background: var(--color-background-primary); color: var(--color-text-primary);
    border: 0.5px solid var(--color-border-secondary); border-radius: var(--border-radius-lg);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4); padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; }
  .card.centered { top: 50%; left: 50%; transform: translate(-50%, -50%); }
  .hd { display: flex; align-items: center; justify-content: space-between; }
  .step { font-size: 10px; font-family: var(--font-mono); color: var(--color-text-tertiary); }
  .skip { background: none; border: none; cursor: pointer; font-size: 11px; color: var(--color-text-tertiary); }
  h3 { margin: 0; font-size: 14px; }
  p { margin: 0; font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
  .row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
  .dots { display: flex; gap: 4px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border-secondary); }
  .dot.on { background: var(--accent, #6366F1); }
  .nav { display: flex; gap: 6px; }
  .nav button { font-size: 11px; padding: 5px 12px; border-radius: var(--border-radius-md); cursor: pointer;
    border: 0.5px solid var(--color-border-secondary); background: var(--color-background-primary); color: var(--color-text-primary); }
  .nav button.primary { background: var(--accent, #6366F1); color: #fff; border: none; font-weight: 600; }
</style>
