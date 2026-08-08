// Web Audio API Audio Synthesizer (Bebas dari masalah file .mp3 404 / CORS)
class AudioService {
  constructor() {
    this.ctx = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, startTime = 0) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + startTime);
      osc.stop(this.ctx.currentTime + startTime + duration);
    } catch (e) {
      console.warn('Audio playback not allowed or failed:', e);
    }
  }

  playSuccess() {
    // Nada sukses ganda (beep-boop tinggi)
    this.playTone(880, 'sine', 0.1, 0);       // A5
    this.playTone(1174.66, 'sine', 0.25, 0.1); // D6
  }

  playError() {
    // Nada error (buzz rendah)
    this.playTone(220, 'sawtooth', 0.18, 0);   // A3
    this.playTone(164.81, 'sawtooth', 0.35, 0.15); // E3
  }

  playWarning() {
    // Nada peringatan
    this.playTone(440, 'triangle', 0.15, 0);   // A4
    this.playTone(440, 'triangle', 0.15, 0.18); // A4
  }
}

export const audioPlayer = new AudioService();
