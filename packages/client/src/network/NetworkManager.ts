import { io, Socket } from 'socket.io-client';
import {
  GAME_CONFIG,
  SOCKET_EVENTS,
  PlayerState,
  GameStatePayload,
  PlayerMovePayload,
  ChatMessage,
  AnnouncementMessage,
  NightActionPayload,
  VotePayload,
  GamePhaseType,
  SeerResultPayload,
  WitchPromptPayload,
  WitchActionPayload,
  HunterPromptPayload,
  HunterShootPayload,
  RoomCreatePayload,
  PlayerRole,
  WolfVoteUpdatePayload,
  VoiceDataPayload
} from '@sinh-ton/shared';

export interface VoiceTokenPayload {
  provider: 'livekit' | 'fallback_webaudio';
  url?: string;
  token?: string;
  roomId?: string;
}

export interface NetworkCallbacks {
  onSelfJoined: (self: PlayerState, initialState: GameStatePayload) => void;
  onPlayerJoined: (player: PlayerState) => void;
  onSyncState: (state: GameStatePayload) => void;
  onPlayerLeft: (playerId: string) => void;
  onRespawn: (player: PlayerState) => void;
  onConnectionChange: (connected: boolean) => void;
  onAnnouncement: (msg: AnnouncementMessage) => void;
  onPhaseChanged: (data: { phase: GamePhaseType; timeRemaining: number }) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onVoteUpdate: (votes: { [targetId: string]: string[] }) => void;
  onGameOver: (winner: 'WEREWOLF' | 'VILLAGERS') => void;
  onSeerResult?: (result: SeerResultPayload) => void;
  onWitchPrompt?: (prompt: WitchPromptPayload) => void;
  onHunterPrompt?: (prompt: HunterPromptPayload) => void;
  onWolfVoteUpdate?: (data: WolfVoteUpdatePayload) => void;
  onVoiceData?: (data: VoiceDataPayload) => void;
  onVoiceTokenReady?: (data: VoiceTokenPayload) => void;
}

export class NetworkManager {
  private socket: Socket | null = null;
  private callbacks: NetworkCallbacks;
  private isConnected: boolean = false;
  private currentRoomId: string = 'SANH-CHINH';

  constructor(callbacks: NetworkCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(
    nickname: string,
    roomId: string = 'SANH-CHINH',
    skipAutoJoin: boolean = false,
    avatar: 'girl' | 'cun' = 'girl'
  ): void {
    const envServerUrl = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
    const isLocalDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port === String(GAME_CONFIG.CLIENT_PORT);

    const serverUrl = envServerUrl && envServerUrl.trim()
      ? envServerUrl.trim().replace(/\/+$/, '')
      : isLocalDev
        ? `${window.location.protocol}//${window.location.hostname}:${GAME_CONFIG.SERVER_PORT}`
        : window.location.origin;

    this.currentRoomId = roomId;

    this.socket = io(serverUrl, {
      query: { name: nickname, roomId, skipAutoJoin: skipAutoJoin ? 'true' : 'false', avatar },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this.isConnected = true;
      this.callbacks.onConnectionChange(true);
      console.log('[Network] Kết nối thành công tới Server! Socket ID:', this.socket?.id);
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      this.isConnected = false;
      this.callbacks.onConnectionChange(false);
      console.warn('[Network] Mất kết nối tới Server!');
    });

    this.socket.on(SOCKET_EVENTS.PLAYER_JOINED, (data: any) => {
      if (data.state && data.state.roomId) {
        this.currentRoomId = data.state.roomId;
      }
      if (data.self) {
        this.callbacks.onSelfJoined(data.self, data.state);
      } else if (data.player) {
        this.callbacks.onPlayerJoined(data.player);
      }
    });

    this.socket.on(SOCKET_EVENTS.SYNC_STATE, (state: GameStatePayload) => {
      if (state.roomId && this.currentRoomId && this.currentRoomId !== 'SANH-CHINH' && state.roomId !== this.currentRoomId) {
        return;
      }
      if (state.roomId) {
        this.currentRoomId = state.roomId;
      }
      this.callbacks.onSyncState(state);
    });

    this.socket.on(SOCKET_EVENTS.PLAYER_LEFT, (data: { playerId: string }) => {
      this.callbacks.onPlayerLeft(data.playerId);
    });

    this.socket.on(SOCKET_EVENTS.PLAYER_RESPAWN, (player: PlayerState) => {
      this.callbacks.onRespawn(player);
    });

    this.socket.on(SOCKET_EVENTS.ANNOUNCEMENT, (msg: AnnouncementMessage) => {
      this.callbacks.onAnnouncement(msg);
    });

    this.socket.on(SOCKET_EVENTS.PHASE_CHANGED, (data: { phase: GamePhaseType; timeRemaining: number }) => {
      this.callbacks.onPhaseChanged(data);
    });

    this.socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (msg: ChatMessage) => {
      this.callbacks.onChatMessage(msg);
    });

    this.socket.on(SOCKET_EVENTS.VOTE_UPDATE, (votes: { [targetId: string]: string[] }) => {
      this.callbacks.onVoteUpdate(votes);
    });

    this.socket.on(SOCKET_EVENTS.GAME_OVER, (data: { winner: 'WEREWOLF' | 'VILLAGERS' }) => {
      this.callbacks.onGameOver(data.winner);
    });

    this.socket.on(SOCKET_EVENTS.SEER_RESULT, (result: SeerResultPayload) => {
      if (this.callbacks.onSeerResult) this.callbacks.onSeerResult(result);
    });

    this.socket.on(SOCKET_EVENTS.WITCH_PROMPT, (prompt: WitchPromptPayload) => {
      if (this.callbacks.onWitchPrompt) this.callbacks.onWitchPrompt(prompt);
    });

    this.socket.on(SOCKET_EVENTS.HUNTER_PROMPT, (prompt: HunterPromptPayload) => {
      if (this.callbacks.onHunterPrompt) this.callbacks.onHunterPrompt(prompt);
    });

    this.socket.on(SOCKET_EVENTS.WOLF_VOTE_UPDATE, (data: WolfVoteUpdatePayload) => {
      if (this.callbacks.onWolfVoteUpdate) this.callbacks.onWolfVoteUpdate(data);
    });

    this.socket.on(SOCKET_EVENTS.VOICE_DATA, (data: VoiceDataPayload) => {
      if (this.callbacks.onVoiceData) this.callbacks.onVoiceData(data);
    });

    this.socket.on(SOCKET_EVENTS.VOICE_TOKEN_READY, (data: VoiceTokenPayload) => {
      if (this.callbacks.onVoiceTokenReady) this.callbacks.onVoiceTokenReady(data);
    });
  }

  public requestVoiceToken(): void {
    if (!this.socket) return;
    this.socket.emit(SOCKET_EVENTS.REQUEST_VOICE_TOKEN);
  }

  public getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  private ensureConnectedAndEmit(
    name: string,
    roomId: string,
    emitFn: () => void,
    avatar?: 'girl' | 'cun'
  ): void {
    if (!this.socket) {
      this.connect(name, roomId, true, avatar || 'girl');
    }
    if (this.socket) {
      if (!this.isConnected) {
        this.socket.once(SOCKET_EVENTS.CONNECT, emitFn);
      } else {
        emitFn();
      }
    }
  }

  public createRoom(payload: RoomCreatePayload, callback?: (res: any) => void): void {
    this.ensureConnectedAndEmit(payload.name, 'SANH-CHINH', () => {
      this.socket?.emit(SOCKET_EVENTS.CREATE_ROOM, payload, (res: any) => {
        if (res && res.roomId) this.currentRoomId = res.roomId;
        if (callback) callback(res);
      });
    }, payload.avatar);
  }

  public joinRoom(
    roomId: string,
    name: string,
    avatar: 'girl' | 'cun' = 'girl',
    callback?: (res: any) => void
  ): void {
    this.ensureConnectedAndEmit(name, roomId, () => {
      this.socket?.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, name, avatar }, (res: any) => {
        if (res && res.roomId) this.currentRoomId = res.roomId;
        if (callback) callback(res);
      });
    }, avatar);
  }

  public sendSwitchAvatar(avatar: 'girl' | 'cun'): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('switch_avatar', { avatar });
  }

  public fillBots(targetCount: number): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.FILL_BOTS, { targetCount });
  }

  public addBot(): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.ADD_BOT);
  }

  public clearBots(): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.CLEAR_BOTS);
  }

  public startGame(): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.START_GAME);
  }

  public sendMove(position: { x: number; y: number; z: number }, rotationY: number): void {
    if (!this.socket || !this.isConnected) return;
    const payload: PlayerMovePayload = { position, rotationY };
    this.socket.emit(SOCKET_EVENTS.PLAYER_MOVE, payload);
  }

  public sendNightAction(
    targetPlayerId: string,
    actionType: 'kill' | 'protect' | 'classic_wolf_vote',
    callback?: (res: { success: boolean; message: string }) => void
  ): void {
    if (!this.socket || !this.isConnected) return;
    const payload: NightActionPayload = { targetPlayerId, actionType };
    this.socket.emit(SOCKET_EVENTS.NIGHT_ACTION, payload, callback);
  }

  public sendSeerCheck(
    targetPlayerId: string,
    callback?: (res: SeerResultPayload | null) => void
  ): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.SEER_ACTION, { targetPlayerId }, callback);
  }

  public sendWitchAction(
    useHeal: boolean,
    poisonTargetId: string | null,
    callback?: (res: { success: boolean; message: string }) => void
  ): void {
    if (!this.socket || !this.isConnected) return;
    const payload: WitchActionPayload = { useHeal, poisonTargetId };
    this.socket.emit(SOCKET_EVENTS.WITCH_ACTION, payload, callback);
  }

  public sendHunterShoot(
    targetPlayerId: string | null,
    callback?: (res: { success: boolean }) => void
  ): void {
    if (!this.socket || !this.isConnected) return;
    const payload: HunterShootPayload = { targetPlayerId };
    this.socket.emit(SOCKET_EVENTS.HUNTER_SHOOT, payload, callback);
  }

  public sendToggleDoor(
    doorId: string,
    callback?: (res: { success: boolean; isOpen?: boolean; message?: string }) => void
  ): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.TOGGLE_DOOR, { doorId }, callback);
  }

  public sendVote(votedPlayerId: string | null): void {
    if (!this.socket || !this.isConnected) return;
    const payload: VotePayload = { votedPlayerId };
    this.socket.emit(SOCKET_EVENTS.CAST_VOTE, payload);
  }

  public sendChatMessage(text: string): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { text });
  }

  public sendVoiceData(samples: number[], sampleRate: number): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.VOICE_DATA, { samples, sampleRate });
  }

  public requestRespawn(): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.PLAYER_RESPAWN);
  }

  public cheatSetRole(role: PlayerRole): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(SOCKET_EVENTS.CHEAT_SET_ROLE, { role });
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }
}
