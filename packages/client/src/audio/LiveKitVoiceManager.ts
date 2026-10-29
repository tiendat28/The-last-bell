import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';

export class LiveKitVoiceManager {
  private room: Room | null = null;
  private isConnected: boolean = false;
  private isMicEnabled: boolean = true;
  private isSpeakerEnabled: boolean = true;
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  // Callbacks
  public onSpeakingChanged?: (participantId: string, isSpeaking: boolean) => void;
  public onConnectionStateChanged?: (connected: boolean) => void;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.setupRoomEvents();
  }

  private setupRoomEvents(): void {
    if (!this.room) return;

    this.room
      .on(RoomEvent.Connected, () => {
        console.log('[LiveKit WebRTC] Đã kết nối thành công tới phòng voice chat!');
        this.isConnected = true;
        this.onConnectionStateChanged?.(true);
      })
      .on(RoomEvent.Disconnected, () => {
        console.log('[LiveKit WebRTC] Đã ngắt kết nối phòng voice.');
        this.isConnected = false;
        this.cleanupAudioElements();
        this.onConnectionStateChanged?.(false);
      })
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log(`[LiveKit WebRTC] Nhận audio stream của học sinh: ${participant.identity}`);
          const el = track.attach() as HTMLAudioElement;
          el.muted = !this.isSpeakerEnabled;
          this.audioElements.set(participant.identity, el);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        track.detach();
        const el = this.audioElements.get(participant.identity);
        if (el) {
          el.remove();
          this.audioElements.delete(participant.identity);
        }
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (this.onSpeakingChanged) {
          for (const s of speakers) {
            this.onSpeakingChanged(s.identity, true);
          }
        }
      });
  }

  /**
   * Kết nối vào phòng voice LiveKit WebRTC bằng URL và Token
   */
  public async connect(url: string, token: string): Promise<boolean> {
    if (!this.room) return false;
    try {
      if (this.isConnected) {
        await this.disconnect();
      }
      await this.room.connect(url, token);
      await this.room.localParticipant.setMicrophoneEnabled(this.isMicEnabled);
      return true;
    } catch (err) {
      console.error('[LiveKit WebRTC] Kết nối thất bại:', err);
      return false;
    }
  }

  /**
   * Bật / Tắt Microphone
   */
  public async toggleMicrophone(): Promise<boolean> {
    if (!this.room || !this.isConnected) return false;
    this.isMicEnabled = !this.isMicEnabled;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(this.isMicEnabled);
    } catch (err) {
      console.warn('[LiveKit WebRTC] Không thể đổi trạng thái mic:', err);
    }
    return this.isMicEnabled;
  }

  public async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.isMicEnabled = enabled;
    if (this.room && this.isConnected) {
      try {
        await this.room.localParticipant.setMicrophoneEnabled(enabled);
      } catch (err) {
        console.warn('[LiveKit WebRTC] Không thể thiết lập mic:', err);
      }
    }
  }

  /**
   * Bật / Tắt Loa (Speaker)
   */
  public toggleSpeaker(): boolean {
    this.isSpeakerEnabled = !this.isSpeakerEnabled;
    this.audioElements.forEach((el) => {
      el.muted = !this.isSpeakerEnabled;
    });
    return this.isSpeakerEnabled;
  }

  public setSpeakerEnabled(enabled: boolean): void {
    this.isSpeakerEnabled = enabled;
    this.audioElements.forEach((el) => {
      el.muted = !enabled;
    });
  }

  public getIsMicEnabled(): boolean {
    return this.isMicEnabled;
  }

  public getIsSpeakerEnabled(): boolean {
    return this.isSpeakerEnabled;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public async disconnect(): Promise<void> {
    if (this.room && this.isConnected) {
      await this.room.disconnect();
    }
    this.cleanupAudioElements();
  }

  private cleanupAudioElements(): void {
    this.audioElements.forEach((el) => el.remove());
    this.audioElements.clear();
  }
}

