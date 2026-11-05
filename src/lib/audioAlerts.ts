/**
 * audioAlerts.ts - Professional Audio & Voice Synthesizer for Trading Signals
 * Uses Web Audio API (zero external audio asset dependencies) & Web Speech API.
 */

class AudioAlertService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private voiceEnabled: boolean = true;
  private volume: number = 0.8;
  private lastPlayedSignalId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedSound = localStorage.getItem('po_sound_enabled');
        if (savedSound !== null) this.soundEnabled = savedSound === 'true';

        const savedVoice = localStorage.getItem('po_voice_enabled');
        if (savedVoice !== null) this.voiceEnabled = savedVoice === 'true';

        const savedVol = localStorage.getItem('po_volume');
        if (savedVol !== null) this.volume = parseFloat(savedVol) || 0.8;
      } catch (e) {
        // localStorage fallback
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('po_sound_enabled', String(enabled));
    } catch {}
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    try {
      localStorage.setItem('po_voice_enabled', String(enabled));
    } catch {}
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('po_volume', String(this.volume));
    } catch {}
  }

  /**
   * Bullish CALL / UP Chime: Harmonic major rising triad (C5 -> E5 -> G5)
   */
  public playBullishChime(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);

      gain.gain.setValueAtTime(0, startTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume, startTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.08);
      osc.stop(startTime + idx * 0.08 + 0.36);
    });
  }

  /**
   * Bearish PUT / DOWN Chime: Deep resonant descending chord (G5 -> Eb5 -> C5)
   */
  public playBearishChime(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [783.99, 622.25, 523.25, 392.0]; // G5, Eb5, C5, G4
    const startTime = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);

      gain.gain.setValueAtTime(0, startTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25 * this.volume, startTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.08 + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.08);
      osc.stop(startTime + idx * 0.08 + 0.4);
    });
  }

  /**
   * Pre-Candle Close Warning: Subtle double-tick
   */
  public playWarningTick(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, startTime + offset);

      gain.gain.setValueAtTime(0.08 * this.volume, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + offset);
      osc.stop(startTime + offset + 0.07);
    });
  }

  /**
   * Voice announcement using Web Speech API
   */
  public speak(text: string, lang: 'ar' | 'en' = 'ar'): void {
    if (!this.voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel(); // Stop prior speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
      utterance.rate = 1.05;
      utterance.volume = this.volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  /**
   * Trigger Signal Alert with deduplication
   */
  public notifySignal(signal: {
    id: string;
    type: 'UP' | 'DOWN' | 'WAIT';
    asset: string;
    confidence: number;
    signalGrade?: string;
  }): void {
    if (signal.type === 'WAIT' || signal.id === this.lastPlayedSignalId) return;
    this.lastPlayedSignalId = signal.id;

    if (signal.type === 'UP') {
      this.playBullishChime();
      if (this.voiceEnabled) {
        const cleanSymbol = signal.asset.replace('_otc', '').replace('/', ' ');
        this.speak(`إشارة شراء مؤكدة على ${cleanSymbol}`, 'ar');
      }
    } else if (signal.type === 'DOWN') {
      this.playBearishChime();
      if (this.voiceEnabled) {
        const cleanSymbol = signal.asset.replace('_otc', '').replace('/', ' ');
        this.speak(`إشارة بيع مؤكدة على ${cleanSymbol}`, 'ar');
      }
    }
  }
}

export const audioAlerts = new AudioAlertService();
