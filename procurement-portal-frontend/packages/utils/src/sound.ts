/**
 * Web Audio API Acoustic Feedback System
 * Pure oscillator synthesis: zero network latency, no external mp3 assets, zero dependencies.
 */

let sharedAudioContext: AudioContext | null = null;
let lastNotificationChimeAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// User-gesture audio unlocker for browser autoplay policies
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    try {
      if (sharedAudioContext && sharedAudioContext.state === "suspended") {
        sharedAudioContext.resume().catch(() => {});
      }
    } catch {
      // ignore
    }
  };
  window.addEventListener("click", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
}

/**
 * Synthesizes a loud, crisp, executive notification chime.
 * Combines an acoustic fundamental bell tone with a bright ascending harmonic shimmer,
 * processed through dynamic compression for maximum acoustic clarity and volume.
 */
export function playNotificationChime(): void {
  const nowMs = Date.now();
  // Prevent duplicate concurrent chimes within 300ms
  if (nowMs - lastNotificationChimeAt < 300) {
    return;
  }
  lastNotificationChimeAt = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Master Compressor & Limiter to prevent clipping at high loudness
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, now);
    compressor.knee.setValueAtTime(12, now);
    compressor.ratio.setValueAtTime(8, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.2, now);
    compressor.connect(ctx.destination);

    // Master Gain (Loud & authoritative: 0.90 master volume)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);
    masterGain.connect(compressor);

    // --- Bell Strike 1: A5 (880 Hz) fundamental + triangle warmth ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.75, now + 0.005);
    gain1.gain.setValueAtTime(0.7, now + 0.12);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.95);

    const osc1Tri = ctx.createOscillator();
    const gain1Tri = ctx.createGain();
    osc1Tri.type = "triangle";
    osc1Tri.frequency.setValueAtTime(880, now);
    gain1Tri.gain.setValueAtTime(0.001, now);
    gain1Tri.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
    gain1Tri.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc1Tri.connect(gain1Tri);
    gain1Tri.connect(masterGain);
    osc1Tri.start(now);
    osc1Tri.stop(now + 0.45);

    // --- Bell Strike 2: Ascending High Harmonic E6 (1318.5 Hz, offset +0.075s) ---
    const t2 = now + 0.075;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.5, t2);
    gain2.gain.setValueAtTime(0.001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.85, t2 + 0.005);
    gain2.gain.setValueAtTime(0.8, t2 + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.2);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(t2);
    osc2.stop(t2 + 1.25);

    // --- High Crystal Shimmer: A6 (1760 Hz) & E7 (2637 Hz) ---
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1760, t2);
    gain3.gain.setValueAtTime(0.001, t2);
    gain3.gain.exponentialRampToValueAtTime(0.4, t2 + 0.005);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.8);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.start(t2);
    osc3.stop(t2 + 0.85);

    const osc4 = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc4.type = "sine";
    osc4.frequency.setValueAtTime(2637, t2);
    gain4.gain.setValueAtTime(0.001, t2);
    gain4.gain.exponentialRampToValueAtTime(0.25, t2 + 0.005);
    gain4.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.6);
    osc4.connect(gain4);
    gain4.connect(masterGain);
    osc4.start(t2);
    osc4.stop(t2 + 0.65);
  } catch {
    // Gracefully ignore audio restrictions
  }
}

/**
 * Synthesizes a bright, gentle positive confirmation chime.
 * Ascending triad (C6 -> E6 -> G6) with warm decay.
 */
export function playSuccessChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const notes = [1046.5, 1318.5, 1568.0]; // C6, E6, G6

    notes.forEach((freq, i) => {
      const start = now + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.55, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch {
    // Gracefully ignore
  }
}

/**
 * Synthesizes a crisp tactile click sound for interactions.
 */
export function playActionChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Gracefully ignore
  }
}
