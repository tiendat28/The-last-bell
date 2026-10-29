import { LiveKitVoiceManager } from './LiveKitVoiceManager';

/**
 * Hệ thống âm thanh Web Audio API Synthesizer (Đã nâng cấp chất lượng cao)
 * Tự động tạo âm thanh chuông trường học, chuông báo tử, tiếng súng, tiếng sói hú
 * Tích hợp Master Compressor & Biquad Filter chống rè, chống đè vọng (Anti-clipping & Debouncing)
 * Hỗ trợ chuyển đổi sang LiveKit WebRTC Voice Engine khi có kết nối
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  // LiveKit WebRTC Voice Engine
  public liveKitVoiceManager: LiveKitVoiceManager | null = null;
  public isLiveKitActive: boolean = false;

  // Debounce cooldowns (tránh các âm thanh bị gọi trùng lặp cùng lúc gây đè vọng / rè)
  private lastBellTime: number = 0;
  private lastDeathBellTime: number = 0;
  private lastHowlTime: number = 0;
  private lastGunshotTime: number = 0;
  private lastBeepTime: number = 0;

  // Quản lý Loa & Mic giao tiếp giọng nói theo quy tắc Ngày / Đêm / Sống / Chết
  private canSpeakByRule: boolean = true;
  private canListenByRule: boolean = true;
  private isUserMicMuted: boolean = false;
  private micStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  public onVoiceSamples?: (samples: number[], sampleRate: number) => void;

  constructor() {
    // Unlock AudioContext an toàn khi người dùng tương tác lần đầu
    const unlock = () => {
      this.initContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain: Âm lượng tổng êm dịu, không chói tai
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      // Dynamics Compressor: Chống clipping tuyệt đối khi nhiều âm thanh phát cùng lúc
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(25, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      // Master Lowpass Filter: Cắt bỏ dải tần cao chói gắt, làm âm thanh ấm áp, êm dịu
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(7000, this.ctx.currentTime);

      // Kết nối: Sound -> masterGain -> compressor -> masterFilter -> destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.masterFilter);
      this.masterFilter.connect(this.ctx.destination);
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private getDestinationNode(): AudioNode | null {
    if (!this.ctx) this.initContext();
    return this.masterGain || this.ctx?.destination || null;
  }

  /**
   * Helper tạo chuỗi node synthesizer chuẩn: Oscillator -> Filter -> Gain -> Destination
   */
  private createSynthVoice(
    type: OscillatorType = 'sine',
    filterFreq: number = 2000,
    filterType: BiquadFilterType = 'lowpass'
  ): { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null {
    const dest = this.getDestinationNode();
    if (!this.ctx || !dest) return null;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = type;
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    return { osc, gain, filter };
  }

  /**
   * 1. Tiếng chuông trường học (Reng reng reng... Westminster Chime)
   * Âm sắc kim loại êm dịu, ấm áp, không chói gắt, có chống đè vọng
   */
  public playSchoolBell(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastBellTime < 1500) return; // Chống đè vọng trong vòng 1.5s
    this.lastBellTime = nowMs;

    if (!this.ctx) this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Hợp âm 4 nốt chuông trường học êm ái: C5, E5, G5, C6
    const notes = [
      { freq: 523.25, delay: 0.0 },
      { freq: 659.25, delay: 0.28 },
      { freq: 783.99, delay: 0.56 },
      { freq: 1046.50, delay: 0.84 },
    ];

    notes.forEach((note) => {
      const voice = this.createSynthVoice('sine', 3200);
      if (!voice) return;
      const { osc, gain } = voice;
      const startTime = now + note.delay;

      osc.frequency.setValueAtTime(note.freq, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.22, startTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.1);

      osc.start(startTime);
      osc.stop(startTime + 1.15);
    });
  }

  /**
   * 2. Tiếng chuông báo tử (Death Bell / Gong trầm đục)
   * Ngân dài sâu lắng, không rè rách, không chát chúa
   */
  public playDeathBell(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastDeathBellTime < 2000) return; // Chống gọi dồn dập
    this.lastDeathBellTime = nowMs;

    if (!this.ctx) this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Tần số trầm ấm A2 (110Hz) và các họa âm êm
    const harmonics = [
      { freq: 110.0, gainVal: 0.35, dur: 2.8 },
      { freq: 220.0, gainVal: 0.18, dur: 2.2 },
      { freq: 330.0, gainVal: 0.08, dur: 1.6 },
    ];

    harmonics.forEach((h) => {
      const voice = this.createSynthVoice('sine', 1000);
      if (!voice) return;
      const { osc, gain } = voice;

      osc.frequency.setValueAtTime(h.freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(h.gainVal, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + h.dur);

      osc.start(now);
      osc.stop(now + h.dur + 0.1);
    });
  }

  /**
   * 3. Tiếng Ma Sói Hú (Wolf Howl)
   * Sóng Sine/Triangle kết hợp Vibrato điện ảnh mượt mà, loại bỏ hoàn toàn tiếng cưa (sawtooth) rè
   */
  public playWolfHowl(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastHowlTime < 3000) return; // Chống hú dồn dập
    this.lastHowlTime = nowMs;

    const dest = this.getDestinationNode();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Sóng triangle mềm hơn nhiều so với sawtooth
    osc.type = 'triangle';

    // Đường cong cao độ tiếng hú tự nhiên
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 1.1);
    osc.frequency.exponentialRampToValueAtTime(320, now + 2.6);

    // LFO Vibrato nhẹ nhàng (4.5 Hz) tạo độ rung rùng rợn mà êm dịu
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(4.5, now);
    lfoGain.gain.setValueAtTime(12, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 2.8);

    // Filter làm ấm tiếng hú, triệt tiêu dải rè
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 2.8);
  }

  /**
   * 4. Tiếng súng nổ vang trời của Thợ Săn (Gunshot)
   * Tiếng nổ gọn, có âm trầm uy lực nhưng không quá chát
   */
  public playGunshot(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastGunshotTime < 500) return;
    this.lastGunshotTime = nowMs;

    const dest = this.getDestinationNode();
    if (!this.ctx || !dest) return;

    const now = this.ctx.currentTime;

    // 1. Tiếng trầm (Thump bass punch)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(now);
    subOsc.stop(now + 0.42);

    // 2. Tiếng nổ xé gió (Filtered Noise)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.35);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);

    noise.start(now);
    noise.stop(now + 0.4);
  }

  /**
   * 5. Tiếng bíp bấm kỹ năng / UI Beep
   * Êm ái, thanh thoát
   */
  public playActionBeep(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastBeepTime < 80) return;
    this.lastBeepTime = nowMs;

    if (!this.ctx) this.initContext();
    if (!this.ctx) return;

    const voice = this.createSynthVoice('sine', 2800);
    if (!voice) return;
    const { osc, gain } = voice;
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Kích hoạt engine giọng nói LiveKit WebRTC
   */
  public enableLiveKit(liveKitManager: LiveKitVoiceManager): void {
    this.liveKitVoiceManager = liveKitManager;
    this.isLiveKitActive = true;
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  /**
   * 6. Cập nhật quyền Bật/Tắt Loa & Mic tự động theo quy tắc trận đấu:
   * - Đêm: Sói được bật Loa & Mic để trao đổi; người chơi khác bị tắt Loa & Mic.
   * - Ngày: Tất cả người chơi còn sống được bật Loa & Mic.
   * - Người đã chết: Chỉ được bật Loa để nghe, Mic bị khóa hoàn toàn.
   */
  public setVoicePermissions(canSpeak: boolean, canListen: boolean): void {
    this.canSpeakByRule = canSpeak;
    this.canListenByRule = canListen;

    if (this.isLiveKitActive && this.liveKitVoiceManager) {
      this.liveKitVoiceManager.setMicrophoneEnabled(canSpeak && !this.isUserMicMuted);
      this.liveKitVoiceManager.setSpeakerEnabled(canListen);
      return;
    }

    if (this.micStream) {
      const active = this.canSpeakByRule && !this.isUserMicMuted;
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = active;
      });
    }
  }

  public isMicActive(): boolean {
    if (this.isLiveKitActive && this.liveKitVoiceManager) {
      return this.canSpeakByRule && this.liveKitVoiceManager.getIsMicEnabled();
    }
    return this.canSpeakByRule && !this.isUserMicMuted;
  }

  public isSpeakerActive(): boolean {
    if (this.isLiveKitActive && this.liveKitVoiceManager) {
      return this.canListenByRule && this.liveKitVoiceManager.getIsSpeakerEnabled();
    }
    return this.canListenByRule;
  }

  public canPlayerSpeak(): boolean {
    return this.canSpeakByRule;
  }

  public async toggleUserMic(): Promise<boolean> {
    if (!this.canSpeakByRule) {
      return false;
    }

    if (this.isLiveKitActive && this.liveKitVoiceManager) {
      const state = await this.liveKitVoiceManager.toggleMicrophone();
      this.isUserMicMuted = !state;
      return state;
    }

    if (!this.micStream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.initContext();
        if (this.ctx) {
          const source = this.ctx.createMediaStreamSource(this.micStream);
          this.micProcessor = this.ctx.createScriptProcessor(2048, 1, 1);
          const muteGain = this.ctx.createGain();
          muteGain.gain.value = 0;

          this.micProcessor.onaudioprocess = (e) => {
            if (!this.canSpeakByRule || this.isUserMicMuted || !this.onVoiceSamples) return;
            const input = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
            const rms = Math.sqrt(sum / input.length);
            if (rms < 0.012) return; // Lọc tạp âm nền khi không nói

            const downsampled: number[] = [];
            for (let i = 0; i < input.length; i += 2) {
              downsampled.push(Math.round(input[i] * 1000) / 1000);
            }
            this.onVoiceSamples(downsampled, Math.round((this.ctx?.sampleRate || 44100) / 2));
          };

          source.connect(this.micProcessor);
          this.micProcessor.connect(muteGain);
          muteGain.connect(this.ctx.destination);
        }
        this.isUserMicMuted = false;
        return true;
      } catch {
        // Nếu trình duyệt chưa cấp quyền Mic vẫn cho phép đổi trạng thái nút
      }
    }

    this.isUserMicMuted = !this.isUserMicMuted;
    if (this.micStream) {
      const active = this.canSpeakByRule && !this.isUserMicMuted;
      this.micStream.getAudioTracks().forEach((t) => (t.enabled = active));
    }
    return this.isMicActive();
  }

  public playIncomingVoice(samples: number[], sampleRate: number): void {
    // Nếu LiveKit WebRTC đang hoạt động, bỏ qua audio raw từ socket để tránh phát trùng lặp
    if (this.isLiveKitActive) return;
    if (!this.canListenByRule || !samples || samples.length === 0) return;
    const dest = this.getDestinationNode();
    if (!this.ctx || !dest) return;

    const buffer = this.ctx.createBuffer(1, samples.length, sampleRate || 22050);
    const channel = buffer.getChannelData(0);
    // Áp dụng micro-ramp taper ở đầu và đuôi chunk âm thanh (triệt tiêu tiếng lách tách / rè do ngắt quãng gói tin)
    const rampLen = Math.min(64, Math.floor(samples.length / 8));
    for (let i = 0; i < samples.length; i++) {
      let val = samples[i];
      if (i < rampLen) {
        val *= i / rampLen;
      } else if (i >= samples.length - rampLen) {
        val *= (samples.length - 1 - i) / rampLen;
      }
      channel[i] = val;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    src.start();
  }
}
