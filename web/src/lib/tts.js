// Zero-dep text-to-speech via the browser's built-in Web Speech API.
// No keys, no network, uses the OS voices. Used to read briefings aloud.

export const ttsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Strip markdown-ish noise so it reads naturally.
function clean(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' (code block) ')   // skip code fences
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#>]+/g, ' ')
    .replace(/^\s*[-•]\s*/gm, ', ')                  // bullets → pauses
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')              // links → text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

export function speak(text, opts = {}) {
  if (!ttsAvailable) return false;
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(clean(text));
  u.rate = opts.rate || 1;
  u.pitch = opts.pitch || 1;
  if (opts.onend) u.onend = opts.onend;
  if (opts.onerror) u.onerror = opts.onerror;
  try { window.speechSynthesis.speak(u); return true; } catch (_) { return false; }
}

export function stopSpeaking() {
  try { window.speechSynthesis.cancel(); } catch (_) {}
}

export function isSpeaking() {
  try { return window.speechSynthesis.speaking; } catch (_) { return false; }
}
