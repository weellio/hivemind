// Zero-dep speech-to-text via the browser's Web Speech API (Chrome/Edge/Safari).
// No keys, no network beyond the browser's own recognizer. Firefox lacks it — the
// mic button hides when unavailable.

export const voiceAvailable =
  typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Make a recognizer. onText(text, isFinal) fires as you speak; onEnd() when it stops.
export function makeRecognizer({ onText, onEnd, lang = 'en-US' }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let fin = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) fin += t; else interim += t;
    }
    if (fin) onText && onText(fin, true);
    else if (interim) onText && onText(interim, false);
  };
  rec.onend = () => onEnd && onEnd();
  rec.onerror = () => onEnd && onEnd();
  return rec;
}
