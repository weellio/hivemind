<script>
  import { voiceAvailable, makeRecognizer } from './voice.js';
  // onappend(text) is called with finalized dictated text (parent appends it to its field).
  let { onappend } = $props();
  let listening = $state(false);
  let rec = null;

  function toggle() {
    if (listening) { try { rec && rec.stop(); } catch (_) {} return; }
    rec = makeRecognizer({
      onText: (t, isFinal) => { if (isFinal && t.trim()) onappend(t.trim()); },
      onEnd: () => { listening = false; },
    });
    if (!rec) return;
    try { rec.start(); listening = true; } catch (_) { listening = false; }
  }
</script>

{#if voiceAvailable}
  <button class="mic" class:on={listening} onclick={toggle} title={listening ? 'Stop dictation' : 'Dictate (voice input)'} aria-label="Voice input" type="button">
    {listening ? '●' : '🎤'}
  </button>
{/if}

<style>
  .mic { background: none; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md);
    cursor: pointer; font-size: 12px; padding: 4px 8px; color: var(--color-text-secondary); line-height: 1; }
  .mic:hover { color: var(--color-text-primary); border-color: var(--accent, #6366F1); }
  .mic.on { color: #fff; background: #EF4444; border-color: #EF4444; animation: micpulse 1s ease-in-out infinite; }
  @keyframes micpulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); } }
</style>
