import { GamePhaseType, RoomModeType } from './constants';

export type PlayerRole = 'WEREWOLF' | 'VILLAGER' | 'SEER' | 'BODYGUARD' | 'WITCH' | 'HUNTER' | 'DOCTOR' | 'SPECTATOR';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  name: string;
  role: PlayerRole;
  hp: number;
  maxHp: number;
  position: Vector3D;
  rotationY: number;
  isAlive: boolean;
  isHiding: boolean;
  isOutsideBarrier: boolean;
  votesReceived?: number;
  isBot?: boolean;
  deathReason?: string;
}

export interface PlayerMovePayload {
  position: Vector3D;
  rotationY: number;
}

export interface PlayerJoinPayload {
  name: string;
  roomId?: string;
}

export interface RoomInfo {
  roomId: string;
  roomName: string;
  hostId: string;
  mode: RoomModeType;
  targetCount: number;
  playerCount: number;
  isBotMode: boolean;
  phase: GamePhaseType;
}

export interface RoomCreatePayload {
  name: string;
  roomName: string;
  mode: RoomModeType;
  targetCount: number;
  enableBots: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isDead?: boolean;
  isWolfChat?: boolean;
  role?: PlayerRole;
}

export interface VoiceDataPayload {
  senderId: string;
  senderName: string;
  samples: number[];
  sampleRate: number;
  isWolfChannel?: boolean;
}

export interface AnnouncementMessage {
  id: string;
  title: string;
  content: string;
  type: 'bell' | 'death' | 'vote' | 'warning' | 'info';
  timestamp: number;
}

export interface NightActionPayload {
  targetPlayerId?: string;
  actionType: 'kill' | 'protect' | 'seer_check' | 'witch_heal' | 'witch_poison' | 'skip';
}

export interface SeerResultPayload {
  targetPlayerId: string;
  targetPlayerName: string;
  role: PlayerRole;
  isWerewolf: boolean;
}

export interface WitchPromptPayload {
  victimId: string;
  victimName: string;
  hasHealPotion: boolean;
  hasPoisonPotion: boolean;
}

export interface WitchActionPayload {
  useHeal: boolean;
  poisonTargetId?: string | null;
}

export interface HunterPromptPayload {
  reason: 'werewolf' | 'vote' | 'poison' | 'barrier';
}

export interface HunterShootPayload {
  targetPlayerId: string | null;
}

export interface WolfVoteUpdatePayload {
  targetName: string | null;
  votesForTarget: number;
  totalWolves: number;
  hasConsensus: boolean;
  hasWolfNearby: boolean;
  isKillSuccessful: boolean;
  wolfVotes: { wolfName: string; targetName: string }[];
}

export interface VotePayload {
  votedPlayerId: string | null;
}

export interface ToggleDoorPayload {
  doorId: string;
}

export interface GameStatePayload {
  phase: GamePhaseType;
  phaseTimeRemaining: number;
  nightNumber: number;
  players: PlayerState[];
  serverTime: number;
  barrierRadius: number;
  barrierCenter: Vector3D;
  votes?: { [targetId: string]: string[] };
  doors?: { [doorId: string]: boolean };
  winner?: 'WEREWOLF' | 'VILLAGERS' | null;
  roomId?: string;
  roomInfo?: RoomInfo;
}

export interface PlayerDamagedPayload {
  playerId: string;
  damage: number;
  currentHp: number;
  reason: 'barrier' | 'attack';
}
