/* ═══════════════════════ Sounds — نغمات الإشعار ═══════════════════════
   🔔 دينغ ملي توصل رسالة · ✈️ بوب خفيف ملي تصيفط
   (Web Audio — بلا ملفات، كيتولدو فـ المتصفح مباشرة)
   ═══════════════════════════════════════════════════════════════════════ */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const c = getCtx();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* ignore */ }
}

export const MUTE_KEY = "afrizon_chat_mute_v1";
export const isMuted = () => {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
};
export const toggleMute = () => {
  try { localStorage.setItem(MUTE_KEY, isMuted() ? "0" : "1"); } catch { /* */ }
};

/** 🔔 رسالة جديدة وصلات — دينغ دونغ لطيف */
export function playIncoming() {
  if (isMuted()) return;
  tone(659.25, 0, 0.22, 0.16, "sine");      // E5
  tone(880.0, 0.12, 0.38, 0.16, "sine");    // A5
}

/** ✈️ صيفطت رسالة — بوب خفيف */
export function playOutgoing() {
  if (isMuted()) return;
  tone(523.25, 0, 0.08, 0.10, "triangle");  // C5
  tone(783.99, 0.07, 0.14, 0.10, "triangle"); // G5
}
