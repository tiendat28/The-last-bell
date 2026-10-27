import {
  GAME_CONFIG,
  GAME_PHASE,
  GamePhaseType,
  PlayerState,
  PlayerRole,
  ChatMessage,
  AnnouncementMessage,
  SeerResultPayload,
  WitchPromptPayload,
  HunterPromptPayload,
  RoomCreatePayload,
  RoomModeType,
  ROOM_MODES,
  WolfVoteUpdatePayload,
  ROLE_NAMES_VI
} from '@sinh-ton/shared';
import { SoundManager } from '../audio/SoundManager';

export interface ActionButtonData {
  targetId: string;
  distance: number;
  role: PlayerRole;
  phase: GamePhaseType;
}

export class UIManager {
  public soundManager: SoundManager;

  // Elements cơ bản
  private elPlayerName: HTMLElement;
  private elRole: HTMLElement;
  private elHpBar: HTMLElement;
  private elHpText: HTMLElement;
  private elStatusDot: HTMLElement;
  private elServerStatus: HTMLElement;
  private elOnlineCount: HTMLElement;
  private elCoords: HTMLElement;
  private elDistance: HTMLElement;
  private elWarningBanner: HTMLElement;
  private elDamageVignette: HTMLElement;
  private elDeathScreen: HTMLElement;
  private elGameOverTitle: HTMLElement;
  private elGameOverReason: HTMLElement;
  private elBtnRespawn: HTMLButtonElement;
  private elBtnStartGame: HTMLButtonElement;

  // Room Lobby & Tabs
  private elJoinModal: HTMLElement;
  private elTabBtnCreate: HTMLButtonElement;
  private elTabBtnJoin: HTMLButtonElement;
  private elTabContentCreate: HTMLElement;
  private elTabContentJoin: HTMLElement;

  private elCreateNickname: HTMLInputElement;
  private elCreateRoomName: HTMLInputElement;
  private elSelectRoomMode: HTMLSelectElement;
  private elSelectTargetCount: HTMLSelectElement;
  private elCheckEnableBots: HTMLInputElement;
  private elBtnCreateRoomSubmit: HTMLButtonElement;

  private elJoinNickname: HTMLInputElement;
  private elInputRoomCode: HTMLInputElement;
  private elBtnJoinRoomSubmit: HTMLButtonElement;

  // Player List HUD & Wolf Pack Panel
  private elPlayerListCard: HTMLElement | null;
  private elHudAliveCount: HTMLElement | null;
  private elPlayerListItems: HTMLElement | null;
  private elWolfPackPanel: HTMLElement | null;
  private elWolfPackStatus: HTMLElement | null;
  private elWolfPackVotes: HTMLElement | null;

  // HUD Room & Bot Controls
  private elHudRoomId: HTMLElement;
  private elBtnCopyInvite: HTMLButtonElement;
  private elBtnFillBots: HTMLButtonElement;
  private elBtnAddBot: HTMLButtonElement;
  private elBtnClearBots: HTMLButtonElement;
  private currentRoomId: string = 'SANH-CHINH';

  // Phase & Timer
  private elPhaseIcon: HTMLElement;
  private elPhaseName: HTMLElement;
  private elPhaseCountdown: HTMLElement;

  // Loa Quản Trò Announcement
  private elAnnouncementBanner: HTMLElement;
  private elAnnouncementTitle: HTMLElement;
  private elAnnouncementContent: HTMLElement;
  private announcementTimeout: any = null;

  // Nút Hành Động Ban Đêm (Sói cắn)
  private elActionContainer: HTMLElement;
  private elBtnAction: HTMLButtonElement;
  private elActionIcon: HTMLElement;
  private elActionText: HTMLElement;
  private currentActionData: ActionButtonData | null = null;

  // Nút Dành Cho Vai Trò Bị Bất Động (Tiên Tri, Bảo Vệ, Phù Thủy)
  private elSpecialRolePanel: HTMLElement;
  private elBtnOpenRoleSkill: HTMLButtonElement;
  private elRoleSkillIcon: HTMLElement;
  private elRoleSkillLabel: HTMLElement;

  // Modals Vai Trò
  private elSeerModal: HTMLElement;
  private elSeerPlayerList: HTMLElement;
  private elSeerResultBox: HTMLElement;
  private elSeerResultText: HTMLElement;
  private elBtnCloseSeer: HTMLButtonElement;

  private elBodyguardModal: HTMLElement;
  private elBodyguardPlayerList: HTMLElement;
  private elBtnBodyguardSkip: HTMLButtonElement;

  private elWitchModal: HTMLElement;
  private elWitchHealSection: HTMLElement;
  private elWitchVictimName: HTMLElement;
  private elBtnWitchHeal: HTMLButtonElement;
  private elWitchPoisonList: HTMLElement;
  private elBtnCloseWitch: HTMLButtonElement;
  private pendingWitchVictimId: string | null = null;

  private elHunterModal: HTMLElement;
  private elHunterTargetList: HTMLElement;
  private elBtnHunterSkip: HTMLButtonElement;

  // Real-time Chat & Audio Status (Loa / Mic)
  private elChatMessages: HTMLElement;
  private elChatInput: HTMLInputElement;
  private elBtnChatSend: HTMLButtonElement;
  private elSpeakerStatus: HTMLElement | null;
  private elMicStatus: HTMLElement | null;
  private isCurrentlyAlive: boolean = true;

  // Voting Modal
  private elVotingModal: HTMLElement;
  private elVotePlayerList: HTMLElement;
  private elBtnVoteSkip: HTMLButtonElement;
  private hasVoted: boolean = false;
  private isVotingModalOpen: boolean = false;

  // Tiên Tri, Bảo Vệ, Phù Thủy & Player List Performance Cache
  private hasSeerCheckedThisNight: boolean = false;
  private hasProtectedThisNight: boolean = false;
  private protectedTargetIdThisNight: string | null = null;
  private protectedTargetNameThisNight: string | null = null;
  private lastProtectedTargetId: string | null = null;
  private hasUsedWitchPoison: boolean = false;
  private hasUsedWitchHeal: boolean = false;

  private lastPlayerListSignature: string = '';
  private lastPlayerListUpdateTime: number = 0;
  private lastPlayerInfoSig: string = '';
  private lastCountdownText: string = '';
  private lastCoordsText: string = '';
  private lastBarrierSig: string = '';
  private lastOnlineCount: number = -1;

  // Role Guide Modal
  private elRoleModal: HTMLElement;
  private elRoleGuideBadge: HTMLElement;
  private elRoleGuideTitle: HTMLElement;
  private elRoleGuideDesc: HTMLElement;
  private elBtnCloseRoleGuide: HTMLButtonElement;

  // Trạng thái Hồn Ma Quan Sát (Spectator)
  private isSpectating: boolean = false;
  private wasAlive: boolean = true;
  private currentRole: PlayerRole = 'VILLAGER';
  private currentPhase: GamePhaseType = GAME_PHASE.LOBBY;
  private cachedPlayers: PlayerState[] = [];
  private myPlayerId: string = '';

  // Callbacks
  private onJoinGameCallback?: (name: string) => void;
  private onCreateRoomCallback?: (payload: RoomCreatePayload) => void;
  private onJoinRoomCallback?: (roomId: string, name: string) => void;
  private onFillBotsCallback?: (targetCount: number) => void;
  private onAddBotCallback?: () => void;
  private onClearBotsCallback?: () => void;
  private onRespawnCallback?: () => void;
  private onStartGameCallback?: () => void;
  private onActionTriggerCallback?: (targetId: string, actionType: 'kill' | 'protect') => void;
  private onSeerActionCallback?: (targetId: string) => void;
  private onWitchActionCallback?: (useHeal: boolean, poisonTargetId: string | null) => void;
  private onHunterShootCallback?: (targetId: string | null) => void;
  private onVoteCallback?: (targetPlayerId: string | null) => void;
  private onSendChatCallback?: (text: string) => void;
  private onCheatSetRoleCallback?: (role: PlayerRole) => void;
  private onToggleDoorCallback?: (doorId: string) => void;
  private elDoorBtn!: HTMLButtonElement;
  private currentDoorId: string | null = null;
  private lastDoorBtnSig: string = '';

  constructor() {
    this.soundManager = new SoundManager();

    this.elPlayerName = document.getElementById('hud-player-name')!;
    this.elRole = document.getElementById('hud-role')!;
    this.elHpBar = document.getElementById('hud-hp-bar')!;
    this.elHpText = document.getElementById('hud-hp-text')!;
    this.elStatusDot = document.getElementById('hud-status-dot')!;
    this.elServerStatus = document.getElementById('hud-server-status')!;
    this.elOnlineCount = document.getElementById('hud-online-count')!;
    this.elCoords = document.getElementById('hud-coords')!;
    this.elDistance = document.getElementById('hud-distance')!;
    this.elWarningBanner = document.getElementById('barrier-warning')!;
    this.elDamageVignette = document.getElementById('damage-vignette')!;
    this.elDeathScreen = document.getElementById('death-screen')!;
    this.elGameOverTitle = document.getElementById('game-over-title')!;
    this.elGameOverReason = document.getElementById('game-over-reason')!;
    this.elBtnRespawn = document.getElementById('btn-respawn') as HTMLButtonElement;
    this.elBtnStartGame = document.getElementById('btn-start-game') as HTMLButtonElement;

    // Room Lobby & Tabs
    this.elJoinModal = document.getElementById('join-modal')!;
    this.elTabBtnCreate = document.getElementById('tab-btn-create') as HTMLButtonElement;
    this.elTabBtnJoin = document.getElementById('tab-btn-join') as HTMLButtonElement;
    this.elTabContentCreate = document.getElementById('tab-content-create')!;
    this.elTabContentJoin = document.getElementById('tab-content-join')!;

    this.elCreateNickname = document.getElementById('create-nickname') as HTMLInputElement;
    this.elCreateRoomName = document.getElementById('create-room-name') as HTMLInputElement;
    this.elSelectRoomMode = document.getElementById('select-room-mode') as HTMLSelectElement;
    this.elSelectTargetCount = document.getElementById('select-target-count') as HTMLSelectElement;
    this.elCheckEnableBots = document.getElementById('check-enable-bots') as HTMLInputElement;
    this.elBtnCreateRoomSubmit = document.getElementById('btn-create-room-submit') as HTMLButtonElement;

    this.elJoinNickname = document.getElementById('join-nickname') as HTMLInputElement;
    this.elInputRoomCode = document.getElementById('input-room-code') as HTMLInputElement;
    this.elBtnJoinRoomSubmit = document.getElementById('btn-join-room-submit') as HTMLButtonElement;

    // Player List HUD & Wolf Pack Panel
    this.elPlayerListCard = document.getElementById('player-list-card');
    this.elHudAliveCount = document.getElementById('hud-alive-count');
    this.elPlayerListItems = document.getElementById('player-list-items');
    this.elWolfPackPanel = document.getElementById('wolf-pack-panel');
    this.elWolfPackStatus = document.getElementById('wolf-pack-status');
    this.elWolfPackVotes = document.getElementById('wolf-pack-votes');

    // HUD Room & Bot Controls
    this.elHudRoomId = document.getElementById('hud-room-id')!;
    this.elBtnCopyInvite = document.getElementById('btn-copy-invite') as HTMLButtonElement;
    this.elBtnFillBots = document.getElementById('btn-fill-bots') as HTMLButtonElement;
    this.elBtnAddBot = document.getElementById('btn-add-bot') as HTMLButtonElement;
    this.elBtnClearBots = document.getElementById('btn-clear-bots') as HTMLButtonElement;

    this.elPhaseIcon = document.getElementById('phase-icon')!;
    this.elPhaseName = document.getElementById('phase-name')!;
    this.elPhaseCountdown = document.getElementById('phase-countdown')!;

    this.elAnnouncementBanner = document.getElementById('announcement-banner')!;
    this.elAnnouncementTitle = document.getElementById('announcement-title')!;
    this.elAnnouncementContent = document.getElementById('announcement-content')!;

    this.elActionContainer = document.getElementById('action-container')!;
    this.elBtnAction = document.getElementById('btn-action') as HTMLButtonElement;
    this.elActionIcon = document.getElementById('action-icon')!;
    this.elActionText = document.getElementById('action-text')!;

    this.elSpecialRolePanel = document.getElementById('special-role-panel')!;
    this.elBtnOpenRoleSkill = document.getElementById('btn-open-role-skill') as HTMLButtonElement;
    this.elRoleSkillIcon = document.getElementById('role-skill-icon')!;
    this.elRoleSkillLabel = document.getElementById('role-skill-label')!;

    // Modals
    this.elSeerModal = document.getElementById('seer-modal')!;
    this.elSeerPlayerList = document.getElementById('seer-player-list')!;
    this.elSeerResultBox = document.getElementById('seer-result-box')!;
    this.elSeerResultText = document.getElementById('seer-result-text')!;
    this.elBtnCloseSeer = document.getElementById('btn-close-seer') as HTMLButtonElement;

    this.elBodyguardModal = document.getElementById('bodyguard-modal')!;
    this.elBodyguardPlayerList = document.getElementById('bodyguard-player-list')!;
    this.elBtnBodyguardSkip = document.getElementById('btn-bodyguard-skip') as HTMLButtonElement;

    this.elWitchModal = document.getElementById('witch-modal')!;
    this.elWitchHealSection = document.getElementById('witch-heal-section')!;
    this.elWitchVictimName = document.getElementById('witch-victim-name')!;
    this.elBtnWitchHeal = document.getElementById('btn-witch-heal') as HTMLButtonElement;
    this.elWitchPoisonList = document.getElementById('witch-poison-list')!;
    this.elBtnCloseWitch = document.getElementById('btn-close-witch') as HTMLButtonElement;

    this.elHunterModal = document.getElementById('hunter-modal')!;
    this.elHunterTargetList = document.getElementById('hunter-target-list')!;
    this.elBtnHunterSkip = document.getElementById('btn-hunter-skip') as HTMLButtonElement;

    this.elChatMessages = document.getElementById('chat-messages')!;
    this.elChatInput = document.getElementById('chat-input') as HTMLInputElement;
    this.elBtnChatSend = document.getElementById('btn-chat-send') as HTMLButtonElement;
    this.elSpeakerStatus = document.getElementById('speaker-status');
    this.elMicStatus = document.getElementById('mic-status');

    this.elVotingModal = document.getElementById('voting-modal')!;
    this.elVotePlayerList = document.getElementById('vote-player-list')!;
    this.elBtnVoteSkip = document.getElementById('btn-vote-skip') as HTMLButtonElement;

    this.elRoleModal = document.getElementById('role-modal')!;
    this.elRoleGuideBadge = document.getElementById('role-guide-badge')!;
    this.elRoleGuideTitle = document.getElementById('role-guide-title')!;
    this.elRoleGuideDesc = document.getElementById('role-guide-desc')!;
    this.elBtnCloseRoleGuide = document.getElementById('btn-close-role-guide') as HTMLButtonElement;

    // Tạo nút Đóng / Mở cửa phòng học (Phím E)
    this.elDoorBtn = document.createElement('button');
    this.elDoorBtn.id = 'btn-toggle-door';
    this.elDoorBtn.className = 'door-toggle-btn hidden';
    document.body.appendChild(this.elDoorBtn);
    this.elDoorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentDoorId && this.onToggleDoorCallback) {
        this.soundManager.playActionBeep();
        this.onToggleDoorCallback(this.currentDoorId);
      }
    });

    // Cho phép thu gọn / mở rộng các bảng HUD trên màn hình nhỏ (Click vào tiêu đề bảng)
    const bindCollapsible = (cardSelector: string, headerSelector: string) => {
      const card = document.querySelector(cardSelector);
      const header = document.querySelector(headerSelector);
      if (card && header) {
        (header as HTMLElement).style.cursor = 'pointer';
        header.setAttribute('title', 'Chạm để thu gọn / mở rộng');
        header.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).tagName === 'BUTTON') return;
          card.classList.toggle('collapsed');
        });
      }
    };
    bindCollapsible('#player-list-card', '.player-list-header');
    bindCollapsible('#chat-card', '.chat-header');
    bindCollapsible('#minimap-card', '.minimap-header');

    this.bindEvents();
  }

  private bindEvents(): void {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const defaultNick = `HọcSinh_${randomId}`;
    if (this.elCreateNickname) this.elCreateNickname.value = defaultNick;
    if (this.elJoinNickname) this.elJoinNickname.value = defaultNick;

    // Kiểm tra URL xem có link mời ?room=... không
    const urlParams = new URLSearchParams(window.location.search);
    const inviteRoomId = urlParams.get('room');
    if (inviteRoomId) {
      if (this.elInputRoomCode) this.elInputRoomCode.value = inviteRoomId.trim().toUpperCase();
      this.switchTab('join');
    }

    // Chuyển Tab Sảnh
    this.elTabBtnCreate.addEventListener('click', () => this.switchTab('create'));
    this.elTabBtnJoin.addEventListener('click', () => this.switchTab('join'));

    // Đổi Chế Độ Phân Vai (9-13 người hoặc 14-16 người)
    this.elSelectRoomMode.addEventListener('change', () => {
      this.updateTargetCountOptions(this.elSelectRoomMode.value);
    });

    // Tạo Phòng Mới
    this.elBtnCreateRoomSubmit.addEventListener('click', () => {
      const name = this.elCreateNickname.value.trim() || defaultNick;
      const roomName = this.elCreateRoomName.value.trim() || 'Lớp Học Nửa Đêm';
      const mode = (this.elSelectRoomMode.value as RoomModeType) || ROOM_MODES.STANDARD_9_13;
      const targetCount = parseInt(this.elSelectTargetCount.value, 10) || 10;
      const enableBots = this.elCheckEnableBots.checked;

      this.elJoinModal.classList.add('hidden');
      this.soundManager.playActionBeep();

      if (this.onCreateRoomCallback) {
        this.onCreateRoomCallback({
          name,
          roomName,
          mode,
          targetCount,
          enableBots,
        });
      } else if (this.onJoinGameCallback) {
        this.onJoinGameCallback(name);
      }
    });

    // Vào Phòng Có Sẵn
    this.elBtnJoinRoomSubmit.addEventListener('click', () => {
      const name = this.elJoinNickname.value.trim() || defaultNick;
      const roomId = this.elInputRoomCode.value.trim().toUpperCase() || 'SANH-CHINH';

      this.elJoinModal.classList.add('hidden');
      this.soundManager.playActionBeep();

      if (this.onJoinRoomCallback) {
        this.onJoinRoomCallback(roomId, name);
      } else if (this.onJoinGameCallback) {
        this.onJoinGameCallback(name);
      }
    });

    // Phím Enter ở các ô input
    this.elCreateNickname.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.elBtnCreateRoomSubmit.click();
    });
    this.elCreateRoomName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.elBtnCreateRoomSubmit.click();
    });
    this.elJoinNickname.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.elBtnJoinRoomSubmit.click();
    });
    this.elInputRoomCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.elBtnJoinRoomSubmit.click();
    });

    // Sao chép Link mời bạn bè
    const copyInviteAction = () => {
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.currentRoomId}`;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.addChatMessage({
          id: `sys_copy_${Date.now()}`,
          senderId: 'system',
          senderName: 'HỆ THỐNG',
          text: `Đã sao chép link mời: ${inviteUrl}`,
          timestamp: Date.now(),
          isSystem: true,
        });
        const orig = this.elBtnCopyInvite.textContent;
        this.elBtnCopyInvite.textContent = '✅ ĐÃ CHÉP';
        setTimeout(() => {
          this.elBtnCopyInvite.textContent = orig;
        }, 2000);
      }).catch(() => {
        prompt('Mã phòng hoặc link mời của bạn:', inviteUrl);
      });
    };
    this.elBtnCopyInvite.addEventListener('click', copyInviteAction);
    this.elHudRoomId.addEventListener('click', copyInviteAction);

    // Bot quick controls
    this.elBtnFillBots.addEventListener('click', () => {
      const target = parseInt(this.elSelectTargetCount.value, 10) || 10;
      if (this.onFillBotsCallback) this.onFillBotsCallback(target);
      this.addChatMessage({
        id: `bot_fill_${Date.now()}`,
        senderId: 'system',
        senderName: 'HỆ THỐNG',
        text: `Đã yêu cầu máy chủ lấp đầy Bot AI (mục tiêu ${target} người).`,
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    this.elBtnAddBot.addEventListener('click', () => {
      if (this.onAddBotCallback) this.onAddBotCallback();
      this.addChatMessage({
        id: `bot_add_${Date.now()}`,
        senderId: 'system',
        senderName: 'HỆ THỐNG',
        text: 'Đã thêm 1 Bot AI vào phòng.',
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    this.elBtnClearBots.addEventListener('click', () => {
      if (this.onClearBotsCallback) this.onClearBotsCallback();
      this.addChatMessage({
        id: `bot_clear_${Date.now()}`,
        senderId: 'system',
        senderName: 'HỆ THỐNG',
        text: 'Đã xóa toàn bộ Bot AI khỏi phòng.',
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    this.elBtnStartGame.addEventListener('click', () => {
      this.soundManager.playSchoolBell();
      if (this.onStartGameCallback) this.onStartGameCallback();
    });

    this.elBtnRespawn.addEventListener('click', () => {
      this.isSpectating = true;
      this.elDeathScreen.classList.add('hidden');
      this.addChatMessage({
        id: `ghost_${Date.now()}`,
        senderId: 'system',
        senderName: 'HỆ THỐNG',
        text: 'Bạn đã chuyển sang chế độ Hồn Ma! Giờ bạn có thể bay lượn tự do để theo dõi trận đấu.',
        timestamp: Date.now(),
        isSystem: true,
      });
      if (this.onRespawnCallback) this.onRespawnCallback();
    });

    // Action button Sói cắn
    this.elBtnAction.addEventListener('click', () => this.triggerCurrentAction());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && document.activeElement !== this.elChatInput) {
        this.triggerCurrentAction();
      }
      if (e.code === 'Enter' && document.activeElement !== this.elChatInput) {
        this.elChatInput.focus();
      }
    });

    // Nút mở kỹ năng đêm cho vai trò bị bất động
    this.elBtnOpenRoleSkill.addEventListener('click', () => {
      this.soundManager.playActionBeep();
      if (this.currentRole === 'SEER') this.openSeerModal();
      else if (this.currentRole === 'BODYGUARD' || this.currentRole === 'DOCTOR') this.openBodyguardModal();
      else if (this.currentRole === 'WITCH') this.openWitchModal();
    });

    // Modal Tiên Tri
    this.elBtnCloseSeer.addEventListener('click', () => {
      this.elSeerModal.classList.add('hidden');
    });

    // Modal Bảo Vệ
    this.elBtnBodyguardSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elBodyguardModal.classList.add('hidden');
      if (!this.hasProtectedThisNight) {
        if (this.onActionTriggerCallback) this.onActionTriggerCallback('', 'protect');
      }
    });

    // Modal Phù Thủy
    this.elBtnWitchHeal.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hasUsedWitchHeal = true;
      this.elBtnWitchHeal.disabled = true;
      this.elBtnWitchHeal.textContent = '✅ ĐÃ SỬ DỤNG BÌNH CỨU';
      if (this.onWitchActionCallback) this.onWitchActionCallback(true, null);
    });

    this.elBtnCloseWitch.addEventListener('click', () => {
      this.elWitchModal.classList.add('hidden');
    });

    // Modal Thợ Săn
    this.elBtnHunterSkip.addEventListener('click', () => {
      this.elHunterModal.classList.add('hidden');
      if (this.onHunterShootCallback) this.onHunterShootCallback(null);
    });

    // Chat
    this.elBtnChatSend.addEventListener('click', () => this.sendChat());
    this.elChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendChat();
    });

    // Nút bấm Bật/Tắt Mic trên thanh tiêu đề Trò Chuyện (Tuân thủ quy tắc Loa & Mic)
    if (this.elMicStatus) {
      this.elMicStatus.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!this.isCurrentlyAlive) {
          this.addChatMessage({
            id: `mic_dead_${Date.now()}`,
            senderId: 'system',
            senderName: 'HỆ THỐNG',
            text: '🔇 Bạn đã chết nên chỉ có thể nghe (Loa: Bật) và nhắn tin trong nhóm những người đã chết!',
            timestamp: Date.now(),
            isSystem: true,
          });
          return;
        }
        if (this.currentPhase === GAME_PHASE.NIGHT && this.currentRole !== 'WEREWOLF') {
          this.addChatMessage({
            id: `mic_night_${Date.now()}`,
            senderId: 'system',
            senderName: 'HỆ THỐNG',
            text: '🔇 Ban đêm Loa & Mic của bạn bị tắt để không nghe được cuộc trò chuyện của Ma Sói!',
            timestamp: Date.now(),
            isSystem: true,
          });
          return;
        }
        await this.soundManager.toggleUserMic();
        this.updateAudioAndChatState();
      });
    }

    // Bỏ phiếu trắng (Chỉ được bấm 1 lần duy nhất)
    this.elBtnVoteSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hasVoted = true;
      this.hideVotingModal();
      this.elBtnVoteSkip.disabled = true;
      const allBtns = this.elVotePlayerList.querySelectorAll<HTMLButtonElement>('.vote-btn');
      allBtns.forEach((b) => (b.disabled = true));

      this.addChatMessage({
        id: `vote_skip_${Date.now()}`,
        senderId: 'system',
        senderName: 'HỆ THỐNG',
        text: 'Bạn đã chọn Bỏ Phiếu Trắng trong lượt biểu quyết này. (Phiếu đã khóa, mỗi người chỉ được vote 1 lần)',
        timestamp: Date.now(),
        isSystem: true,
      });
      if (this.onVoteCallback) this.onVoteCallback(null);
    });

    // Role modal
    this.elBtnCloseRoleGuide.addEventListener('click', () => {
      this.elRoleModal.classList.add('hidden');
    });

    this.elRole.addEventListener('click', () => {
      this.showRoleGuideModal(this.currentRole);
    });
  }

  private sendChat(): void {
    const text = this.elChatInput.value.trim();
    if (text && this.onSendChatCallback) {
      this.onSendChatCallback(text);
      this.elChatInput.value = '';
    }
    this.elChatInput.blur();
  }

  private triggerCurrentAction(): void {
    if (!this.currentActionData || !this.onActionTriggerCallback) return;
    this.soundManager.playActionBeep();
    this.onActionTriggerCallback(this.currentActionData.targetId, 'kill');
    this.updateActionButton(null);
  }

  // Setters Callbacks
  public setJoinHandler(cb: (name: string) => void) { this.onJoinGameCallback = cb; }
  public setCreateRoomHandler(cb: (payload: RoomCreatePayload) => void) { this.onCreateRoomCallback = cb; }
  public setJoinRoomHandler(cb: (roomId: string, name: string) => void) { this.onJoinRoomCallback = cb; }
  public setFillBotsHandler(cb: (targetCount: number) => void) { this.onFillBotsCallback = cb; }
  public setAddBotHandler(cb: () => void) { this.onAddBotCallback = cb; }
  public setClearBotsHandler(cb: () => void) { this.onClearBotsCallback = cb; }
  public setRespawnHandler(cb: () => void) { this.onRespawnCallback = cb; }
  public setStartGameHandler(cb: () => void) { this.onStartGameCallback = cb; }
  public setActionTriggerHandler(cb: (targetId: string, actionType: 'kill' | 'protect') => void) { this.onActionTriggerCallback = cb; }
  public setSeerActionHandler(cb: (targetId: string) => void) { this.onSeerActionCallback = cb; }
  public setWitchActionHandler(cb: (useHeal: boolean, poisonTargetId: string | null) => void) { this.onWitchActionCallback = cb; }
  public setHunterShootHandler(cb: (targetId: string | null) => void) { this.onHunterShootCallback = cb; }
  public setVoteHandler(cb: (targetPlayerId: string | null) => void) { this.onVoteCallback = cb; }
  public setSendChatHandler(cb: (text: string) => void) { this.onSendChatCallback = cb; }
  public setCheatRoleHandler(cb: (role: PlayerRole) => void) { this.onCheatSetRoleCallback = cb; }
  public setToggleDoorHandler(cb: (doorId: string) => void) { this.onToggleDoorCallback = cb; }

  public updateDoorButton(data: { doorId: string; roomName: string; isOpen: boolean } | null): void {
    const sig = data ? `${data.doorId}_${data.isOpen}` : 'null';
    if (sig === this.lastDoorBtnSig) return;
    this.lastDoorBtnSig = sig;

    if (!data) {
      this.currentDoorId = null;
      this.elDoorBtn.classList.add('hidden');
      return;
    }

    this.currentDoorId = data.doorId;
    const actionLabel = data.isOpen ? '🔒 ĐÓNG CỬA' : '🔓 MỞ CỬA';
    this.elDoorBtn.textContent = `🚪 [PHÍM E] ${actionLabel}: ${data.roomName.toUpperCase()}`;
    this.elDoorBtn.style.borderColor = data.isOpen ? '#f59e0b' : '#22c55e';
    this.elDoorBtn.classList.remove('hidden');
  }

  public switchTab(tab: 'create' | 'join'): void {
    if (tab === 'create') {
      this.elTabBtnCreate.classList.add('active');
      this.elTabBtnJoin.classList.remove('active');
      this.elTabContentCreate.classList.remove('hidden');
      this.elTabContentJoin.classList.add('hidden');
    } else {
      this.elTabBtnJoin.classList.add('active');
      this.elTabBtnCreate.classList.remove('active');
      this.elTabContentJoin.classList.remove('hidden');
      this.elTabContentCreate.classList.add('hidden');
    }
  }

  private updateTargetCountOptions(mode: string): void {
    this.elSelectTargetCount.innerHTML = '';
    if (mode === ROOM_MODES.LARGE_14_16) {
      for (let i = 14; i <= 16; i++) {
        const opt = document.createElement('option');
        opt.value = i.toString();
        opt.textContent = `${i} Học sinh (4 Sói, 1 Tri, 1 Vệ, 1 Thủy, 1 Săn, Dân)`;
        if (i === 14) opt.selected = true;
        this.elSelectTargetCount.appendChild(opt);
      }
    } else {
      for (let i = 9; i <= 13; i++) {
        const opt = document.createElement('option');
        opt.value = i.toString();
        opt.textContent = `${i} Học sinh (3 Sói, 1 Tri, 1 Vệ, 1 Thủy, 1 Săn, Dân)`;
        if (i === 10) opt.selected = true;
        this.elSelectTargetCount.appendChild(opt);
      }
    }
  }

  public setRoomId(roomId: string): void {
    this.currentRoomId = roomId;
    if (this.elHudRoomId) this.elHudRoomId.textContent = roomId;
  }

  public getRoomId(): string {
    return this.currentRoomId;
  }

  public getIsSpectating(): boolean { return this.isSpectating; }

  public setPlayersCache(players: PlayerState[], myId: string) {
    this.cachedPlayers = players;
    this.myPlayerId = myId;
  }

  public updatePlayerInfo(player: PlayerState): void {
    this.myPlayerId = player.id;
    this.currentRole = player.role;

    const hp = Math.max(0, Math.round(player.hp));
    const maxHp = player.maxHp || GAME_CONFIG.PLAYER_MAX_HP;
    const deathReasonStr = player.deathReason || '';
    const infoSig = `${player.id}_${player.name}_${player.role}_${hp}_${maxHp}_${player.isAlive}_${deathReasonStr}_${this.currentPhase}_${this.isSpectating}`;
    if (infoSig === this.lastPlayerInfoSig) return;
    this.lastPlayerInfoSig = infoSig;

    this.elPlayerName.textContent = player.name;

    this.elRole.className = 'player-role-badge';
    let roleText = 'HỌC SINH';
    if (player.role === 'WEREWOLF') {
      roleText = 'MA SÓI';
      this.elRole.classList.add('werewolf');
    } else if (player.role === 'SEER') {
      roleText = 'TIÊN TRI';
      this.elRole.classList.add('seer');
    } else if (player.role === 'BODYGUARD') {
      roleText = 'BẢO VỆ';
      this.elRole.classList.add('bodyguard');
    } else if (player.role === 'WITCH') {
      roleText = 'PHÙ THỦY';
      this.elRole.classList.add('witch');
    } else if (player.role === 'HUNTER') {
      roleText = 'THỢ SĂN';
      this.elRole.classList.add('hunter');
    } else if (player.role === 'DOCTOR') {
      roleText = 'BÁC SĨ';
      this.elRole.classList.add('doctor');
    } else if (player.role === 'SPECTATOR') {
      roleText = 'KHÁN GIẢ';
    }
    this.elRole.textContent = roleText;

    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

    this.elHpBar.style.width = `${hpPct}%`;
    this.elHpText.textContent = `${hp} / ${maxHp} HP`;

    this.elHpBar.classList.remove('warning', 'danger');
    if (hpPct <= 25) this.elHpBar.classList.add('danger');
    else if (hpPct <= 50) this.elHpBar.classList.add('warning');

    if (!player.isAlive || hp <= 0) {
      const reasonText =
        player.deathReason || 'Linh hồn bạn đã bị loại khỏi trận đấu trong trường học!';

      if (this.wasAlive) {
        this.wasAlive = false;
        this.addChatMessage({
          id: `death_reason_${Date.now()}`,
          senderId: 'system',
          senderName: 'HỆ THỐNG',
          text: `💀 [THÔNG BÁO LÝ DO BỊ DIE] Bạn (${roleText}) đã bị loại! Nguyên nhân: ${reasonText}`,
          timestamp: Date.now(),
          isSystem: true,
        });
      }

      if (!this.isSpectating && this.currentPhase !== GAME_PHASE.GAME_OVER) {
        this.elDeathScreen.classList.remove('hidden');
        this.elGameOverTitle.textContent = '💀 BẠN ĐÃ BỊ LOẠI!';
        this.elGameOverReason.innerHTML = `
          <div class="death-reason-highlight">
            <div class="death-reason-label">📢 THÔNG BÁO HỆ THỐNG — LÝ DO BỊ DIE:</div>
            <div class="death-reason-text">${reasonText}</div>
          </div>
          <div class="death-sub-hint">Vai trò của bạn: <strong>${roleText}</strong> — Bấm nút bên dưới để hóa thành Hồn Ma bay lượn quan sát tiếp trận đấu.</div>
        `;
      }
      this.elActionContainer.classList.add('hidden');
      this.elSpecialRolePanel.classList.add('hidden');
      this.hideVotingModal();
      this.isCurrentlyAlive = false;
    } else {
      this.wasAlive = true;
      this.isCurrentlyAlive = true;
      this.isSpectating = false;
      if (this.currentPhase !== GAME_PHASE.GAME_OVER) {
        this.elDeathScreen.classList.add('hidden');
      }
    }

    this.updateAudioAndChatState();

    // Hiển thị nút Dùng Kỹ Năng Đêm nếu là vai trò đặc biệt
    if (this.currentPhase === GAME_PHASE.NIGHT && player.isAlive) {
      if (player.role === 'SEER' || player.role === 'BODYGUARD' || player.role === 'WITCH' || player.role === 'DOCTOR') {
        this.elSpecialRolePanel.classList.remove('hidden');
        if (player.role === 'SEER') {
          this.elRoleSkillIcon.textContent = '🔮';
          this.elRoleSkillLabel.textContent = 'SOI DANH TÍNH (TIÊN TRI)';
        } else if (player.role === 'BODYGUARD') {
          this.elRoleSkillIcon.textContent = '🛡️';
          this.elRoleSkillLabel.textContent = 'THIẾT LẬP KHIÊN (BẢO VỆ)';
        } else if (player.role === 'DOCTOR') {
          this.elRoleSkillIcon.textContent = '🩺';
          this.elRoleSkillLabel.textContent = 'TIÊM THUỐC CỨU NGƯỜI (BÁC SĨ)';
        } else if (player.role === 'WITCH') {
          this.elRoleSkillIcon.textContent = '🧙';
          this.elRoleSkillLabel.textContent = 'DƯỢC PHÒNG (PHÙ THỦY)';
        }
      } else {
        this.elSpecialRolePanel.classList.add('hidden');
      }
    } else {
      this.elSpecialRolePanel.classList.add('hidden');
    }
  }

  public updatePhaseInfo(phase: GamePhaseType, timeRemaining: number, nightNumber: number): void {
    const prevPhase = this.currentPhase;
    this.currentPhase = phase;

    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const countdownStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (countdownStr !== this.lastCountdownText) {
      this.lastCountdownText = countdownStr;
      this.elPhaseCountdown.textContent = countdownStr;
    }

    if (prevPhase !== phase) {
      // Âm thanh chuyển phase
      if (phase === GAME_PHASE.NIGHT) {
        this.soundManager.playWolfHowl();
      } else if (phase === GAME_PHASE.DAY_DISCUSSION || phase === GAME_PHASE.DAY_HIDING) {
        this.soundManager.playSchoolBell();
      }

      // Reset khi bắt đầu ván mới hoặc về sảnh
      if (phase === GAME_PHASE.LOBBY || (phase === GAME_PHASE.DAY_HIDING && nightNumber === 0)) {
        this.lastProtectedTargetId = null;
        this.hasProtectedThisNight = false;
        this.protectedTargetIdThisNight = null;
        this.protectedTargetNameThisNight = null;
        this.hasUsedWitchPoison = false;
        this.hasUsedWitchHeal = false;
      }

      // Khi kết thúc đêm: ghi nhận mục tiêu Bảo Vệ đã chọn ở đêm vừa rồi để chặn chọn lại ở đêm kế tiếp
      if (prevPhase === GAME_PHASE.NIGHT && phase !== GAME_PHASE.NIGHT) {
        this.lastProtectedTargetId = this.protectedTargetIdThisNight;
      }

      if (phase === GAME_PHASE.DAY_VOTING) {
        // Bắt đầu phiên biểu quyết ban ngày: Cho phép vote nếu chưa vote
        if (prevPhase !== GAME_PHASE.DAY_VOTING) {
          this.hasVoted = false;
          if (this.elBtnVoteSkip) this.elBtnVoteSkip.disabled = false;
        }
      } else {
        this.hasVoted = false;
        this.hideVotingModal();
      }

      if (phase === GAME_PHASE.NIGHT) {
        // Đêm mới đến: reset lượt kỹ năng đêm của Tiên Tri và Bảo Vệ
        this.hasSeerCheckedThisNight = false;
        this.hasProtectedThisNight = false;
        this.protectedTargetIdThisNight = null;
        this.protectedTargetNameThisNight = null;
      } else {
        this.elSeerModal.classList.add('hidden');
        this.elBodyguardModal.classList.add('hidden');
        this.elWitchModal.classList.add('hidden');
        this.elSpecialRolePanel.classList.add('hidden');
        this.elWolfPackPanel?.classList.add('hidden');
      }

      this.updateAudioAndChatState();

      switch (phase) {
        case GAME_PHASE.LOBBY:
          this.elPhaseIcon.textContent = '⏳';
          this.elPhaseName.textContent = 'SẢNH CHỜ TRẬN ĐẤU';
          this.elBtnStartGame.classList.remove('hidden');
          break;

        case GAME_PHASE.DAY_HIDING:
          this.elPhaseIcon.textContent = '🏃';
          this.elPhaseName.textContent = 'CHUẨN BỊ ĐÊM - TÌM CHỖ TRỐN';
          this.elBtnStartGame.classList.add('hidden');
          break;

        case GAME_PHASE.NIGHT:
          this.elPhaseIcon.textContent = '🐺';
          this.elPhaseName.textContent = `BAN ĐÊM: SĂN MỒI (ĐÊM ${nightNumber})`;
          this.elBtnStartGame.classList.add('hidden');
          break;

        case GAME_PHASE.DAY_DISCUSSION:
          this.elPhaseIcon.textContent = '☀️';
          this.elPhaseName.textContent = 'BAN NGÀY: THẢO LUẬN TÌM SÓI';
          this.elBtnStartGame.classList.add('hidden');
          break;

        case GAME_PHASE.DAY_VOTING:
          this.elPhaseIcon.textContent = '⚖️';
          this.elPhaseName.textContent = 'BỎ PHIẾU XỬ PHẠT';
          this.elBtnStartGame.classList.add('hidden');
          break;

        case GAME_PHASE.GAME_OVER:
          this.elPhaseIcon.textContent = '🏆';
          this.elPhaseName.textContent = 'TRẬN ĐẤU KẾT THÚC';
          this.elBtnStartGame.classList.remove('hidden');
          break;
      }
    }
  }

  public showAnnouncement(msg: AnnouncementMessage): void {
    this.elAnnouncementTitle.textContent = msg.title;
    this.elAnnouncementContent.textContent = msg.content;
    this.elAnnouncementBanner.classList.remove('hidden');

    // Phát âm thanh chuông loa
    if (msg.type === 'death') {
      this.soundManager.playDeathBell();
    } else {
      this.soundManager.playSchoolBell();
    }

    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
    this.announcementTimeout = setTimeout(() => {
      this.elAnnouncementBanner.classList.add('hidden');
    }, 8000);
  }

  public updateActionButton(data: ActionButtonData | null): void {
    this.currentActionData = data;
    if (!data || data.phase !== GAME_PHASE.NIGHT || data.role !== 'WEREWOLF') {
      this.elActionContainer.classList.add('hidden');
      return;
    }
    this.elActionIcon.textContent = '🐺';
    this.elActionText.textContent = `CẮN MỤC TIÊU (${data.distance.toFixed(1)}m)`;
    this.elActionContainer.classList.remove('hidden');
  }

  // --- KỸ NĂNG TIÊN TRI ---
  private openSeerModal(): void {
    this.elSeerPlayerList.innerHTML = '';
    this.elSeerResultBox.classList.add('hidden');

    if (this.hasSeerCheckedThisNight) {
      this.elSeerResultBox.classList.remove('hidden');
      this.elSeerResultText.textContent = '✅ Bạn đã hoàn thành lượt thấu thị đêm nay!';
      const p = document.createElement('p');
      p.style.color = '#94a3b8';
      p.style.margin = '14px 0';
      p.textContent = 'Mỗi đêm Tiên Tri chỉ được soi danh tính 1 lần. Hãy bảo toàn tính mạng để chia sẻ thông tin cho lớp học vào ban ngày!';
      this.elSeerPlayerList.appendChild(p);
      this.elSeerModal.classList.remove('hidden');
      return;
    }

    const targets = this.cachedPlayers.filter((p) => p.isAlive && p.id !== this.myPlayerId);
    if (targets.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Không có học sinh nào khác để soi!';
      p.style.color = '#94a3b8';
      this.elSeerPlayerList.appendChild(p);
    } else {
      targets.forEach((target) => {
        const item = document.createElement('div');
        item.className = 'vote-player-item';
        item.innerHTML = `
          <span><strong>${target.name}</strong></span>
          <button class="vote-btn seer-btn" data-id="${target.id}">🔮 SOI DANH TÍNH</button>
        `;
        const btn = item.querySelector('.vote-btn') as HTMLButtonElement;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Khóa toàn bộ các nút soi ngay khi click để tránh spam hoặc lỗi giao diện
          const allBtns = this.elSeerPlayerList.querySelectorAll<HTMLButtonElement>('.vote-btn');
          allBtns.forEach((b) => (b.disabled = true));
          btn.textContent = 'ĐANG SOI...';

          if (this.onSeerActionCallback) this.onSeerActionCallback(target.id);
        });
        this.elSeerPlayerList.appendChild(item);
      });
    }

    this.elSeerModal.classList.remove('hidden');
  }

  public showSeerResult(result: SeerResultPayload): void {
    this.hasSeerCheckedThisNight = true;
    this.elSeerResultBox.classList.remove('hidden');
    const roleText = result.isWerewolf ? '🐺 LÀ MA SÓI HUNG ÁC!' : '👤 LÀ NGƯỜI LÀNH VÔ TỘI!';
    this.elSeerResultText.textContent = `Học sinh [${result.targetPlayerName}]: ${roleText}`;
    this.soundManager.playActionBeep();

    // Cập nhật trạng thái các nút soi trong modal
    const allBtns = this.elSeerPlayerList.querySelectorAll<HTMLButtonElement>('.vote-btn');
    allBtns.forEach((b) => {
      b.disabled = true;
      if (b.getAttribute('data-id') === result.targetPlayerId) {
        b.textContent = result.isWerewolf ? '🐺 SÓI' : '👤 DÂN';
      } else {
        b.textContent = 'ĐÃ XONG';
        b.style.opacity = '0.4';
      }
    });
  }

  // --- KỸ NĂNG BẢO VỆ / BÁC SĨ ---
  private openBodyguardModal(): void {
    this.elBodyguardPlayerList.innerHTML = '';

    if (this.hasProtectedThisNight) {
      const box = document.createElement('div');
      box.className = 'seer-result-box';
      box.style.borderColor = '#f59e0b';
      box.style.background = 'rgba(120, 53, 15, 0.55)';
      box.textContent = this.protectedTargetNameThisNight
        ? `🛡️ Đêm nay bạn đã bảo vệ: [${this.protectedTargetNameThisNight}]`
        : '🛡️ Bạn đã chọn không bảo vệ ai trong đêm nay.';
      this.elBodyguardPlayerList.appendChild(box);
      this.elBtnBodyguardSkip.textContent = 'ĐÓNG';
      this.elBodyguardModal.classList.remove('hidden');
      return;
    }

    this.elBtnBodyguardSkip.textContent = 'KHÔNG BẢO VỆ AI ĐÊM NAY';
    const targets = this.cachedPlayers.filter((p) => p.isAlive);

    targets.forEach((target) => {
      const isLastProtected = this.currentRole === 'BODYGUARD' && this.lastProtectedTargetId === target.id;
      const item = document.createElement('div');
      item.className = 'vote-player-item';
      item.innerHTML = `
        <span><strong>${target.name}</strong> ${target.id === this.myPlayerId ? '(Bản thân)' : ''}</span>
        <button class="vote-btn protect-btn" data-id="${target.id}" ${isLastProtected ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''}>
          ${isLastProtected ? '🚫 ĐÃ BẢO VỆ ĐÊM TRƯỚC' : (this.currentRole === 'DOCTOR' ? '🩺 CỨU CHỮA' : '🛡️ BẢO VỆ')}
        </button>
      `;
      const btn = item.querySelector('.vote-btn') as HTMLButtonElement;
      if (!isLastProtected) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allBtns = this.elBodyguardPlayerList.querySelectorAll<HTMLButtonElement>('.vote-btn');
          allBtns.forEach((b) => (b.disabled = true));
          btn.textContent = 'ĐANG BẢO VỆ...';
          if (this.onActionTriggerCallback) this.onActionTriggerCallback(target.id, 'protect');
        });
      }
      this.elBodyguardPlayerList.appendChild(item);
    });

    this.elBodyguardModal.classList.remove('hidden');
  }

  public showBodyguardResult(res: {
    success: boolean;
    message: string;
    protectedId?: string | null;
    protectedName?: string | null;
  }): void {
    if (res.success) {
      this.hasProtectedThisNight = true;
      this.protectedTargetIdThisNight = res.protectedId || null;
      this.protectedTargetNameThisNight = res.protectedName || null;
      this.soundManager.playActionBeep();

      // Hiển thị kết quả xác nhận rõ ràng trong modal nếu đang mở
      if (!this.elBodyguardModal.classList.contains('hidden')) {
        this.openBodyguardModal();
      }
    } else {
      // Nếu lỗi (ví dụ chọn trùng người đêm trước), hiển thị cảnh báo và mở lại nút
      if (!this.elBodyguardModal.classList.contains('hidden')) {
        if (res.protectedId === undefined && this.lastProtectedTargetId === null) {
          // Cập nhật lại danh sách nút
          this.openBodyguardModal();
        }
        const errP = document.createElement('div');
        errP.style.color = '#f87171';
        errP.style.fontWeight = '700';
        errP.style.marginBottom = '10px';
        errP.textContent = `⚠️ ${res.message}`;
        this.elBodyguardPlayerList.prepend(errP);
      }
    }
  }

  // --- KỸ NĂNG PHÙ THỦY ---
  private openWitchModal(): void {
    this.elWitchPoisonList.innerHTML = '';

    if (this.hasUsedWitchPoison) {
      const p = document.createElement('p');
      p.style.color = '#94a3b8';
      p.style.margin = '10px 0';
      p.textContent = '☠️ Bạn đã sử dụng Bình Độc duy nhất trong trận đấu này.';
      this.elWitchPoisonList.appendChild(p);
      this.elWitchModal.classList.remove('hidden');
      return;
    }

    const targets = this.cachedPlayers.filter((p) => p.isAlive && p.id !== this.myPlayerId);

    targets.forEach((target) => {
      const item = document.createElement('div');
      item.className = 'vote-player-item';
      item.innerHTML = `
        <span><strong>${target.name}</strong></span>
        <button class="vote-btn poison-btn" data-id="${target.id}">☠️ ĐẦU ĐỘC</button>
      `;
      const btn = item.querySelector('.vote-btn') as HTMLButtonElement;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hasUsedWitchPoison = true;
        this.soundManager.playActionBeep();
        this.elWitchModal.classList.add('hidden');
        if (this.onWitchActionCallback) this.onWitchActionCallback(false, target.id);
      });
      this.elWitchPoisonList.appendChild(item);
    });

    this.elWitchModal.classList.remove('hidden');
  }

  public showWitchPrompt(prompt: WitchPromptPayload): void {
    this.pendingWitchVictimId = prompt.victimId;
    this.elWitchVictimName.textContent = prompt.victimName;

    if (prompt.hasHealPotion && !this.hasUsedWitchHeal) {
      this.elWitchHealSection.classList.remove('hidden');
      this.elBtnWitchHeal.disabled = false;
      this.elBtnWitchHeal.textContent = '💉 DÙNG BÌNH CỨU (HỒI SINH NẠN NHÂN)';
    } else {
      this.elWitchHealSection.classList.add('hidden');
    }

    this.openWitchModal();
  }

  // --- KỸ NĂNG THỢ SĂN ---
  public showHunterPrompt(prompt: HunterPromptPayload): void {
    this.elHunterTargetList.innerHTML = '';
    const targets = this.cachedPlayers.filter((p) => p.isAlive && p.id !== this.myPlayerId);

    targets.forEach((target) => {
      const item = document.createElement('div');
      item.className = 'vote-player-item';
      item.innerHTML = `
        <span><strong>${target.name}</strong></span>
        <button class="vote-btn" data-id="${target.id}">💥 BẮN HẠ</button>
      `;
      const btn = item.querySelector('.vote-btn') as HTMLButtonElement;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.elHunterModal.classList.add('hidden');
        this.soundManager.playGunshot();
        if (this.onHunterShootCallback) this.onHunterShootCallback(target.id);
      });
      this.elHunterTargetList.appendChild(item);
    });

    this.elHunterModal.classList.remove('hidden');
    this.soundManager.playGunshot();
  }

  // --- BỎ PHIẾU BAN NGÀY ---
  public showVotingModal(players: PlayerState[], myId: string): void {
    const me = players.find((p) => p.id === myId);
    if (!me || !me.isAlive) {
      // Học sinh đã bị loại không được tham gia bỏ phiếu
      this.hideVotingModal();
      return;
    }

    // NẾU ĐÃ BỎ PHIẾU RỒI: ĐÓNG FORM VÀ TUYỆT ĐỐI KHÔNG HIỆN LẠI TRONG PHIÊN NÀY
    if (this.hasVoted) {
      this.hideVotingModal();
      return;
    }

    const totalAlive = players.filter((p) => p.isAlive).length;

    if (this.isVotingModalOpen) {
      for (const p of players) {
        const voteCountSpan = document.getElementById(`vote-count-${p.id}`);
        if (voteCountSpan) {
          voteCountSpan.textContent = `${p.votesReceived || 0}/${totalAlive} phiếu`;
        }
      }
      return;
    }

    this.elVotePlayerList.innerHTML = '';
    const aliveTargets = players.filter((p) => p.isAlive && p.id !== myId);

    if (aliveTargets.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Không có học sinh nào khác để bỏ phiếu!';
      p.style.color = '#94a3b8';
      this.elVotePlayerList.appendChild(p);
    } else {
      aliveTargets.forEach((target) => {
        const item = document.createElement('div');
        item.className = 'vote-player-item';
        item.innerHTML = `
          <span><strong>${target.name}</strong> (<span id="vote-count-${target.id}">${target.votesReceived || 0}/${totalAlive} phiếu</span>)</span>
          <button class="vote-btn" data-id="${target.id}">BỎ PHIẾU</button>
        `;

        const btn = item.querySelector('.vote-btn') as HTMLButtonElement;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Đánh dấu đã bỏ phiếu và đóng form ngay lập tức!
          this.hasVoted = true;
          this.hideVotingModal();

          const allBtns = this.elVotePlayerList.querySelectorAll<HTMLButtonElement>('.vote-btn');
          allBtns.forEach((b) => (b.disabled = true));
          if (this.elBtnVoteSkip) this.elBtnVoteSkip.disabled = true;

          this.addChatMessage({
            id: `voted_${Date.now()}`,
            senderId: 'system',
            senderName: 'HỆ THỐNG',
            text: `Bạn đã bỏ phiếu chỉ định học sinh [${target.name}]! (Phiếu đã khóa, mỗi người chỉ được vote 1 lần)`,
            timestamp: Date.now(),
            isSystem: true,
          });

          if (this.onVoteCallback) this.onVoteCallback(target.id);
        });

        this.elVotePlayerList.appendChild(item);
      });
    }

    this.isVotingModalOpen = true;
    this.elVotingModal.classList.remove('hidden');
  }

  public hideVotingModal(): void {
    this.isVotingModalOpen = false;
    this.elVotingModal.classList.add('hidden');
  }

  /**
   * Cập nhật trạng thái Loa & Mic và quyền nhắn tin theo đúng 3 quy tắc:
   * 1. Ban đêm: Loa & Mic của Sói được bật để trao đổi với nhau; Loa & Mic người chơi khác bị tắt.
   * 2. Ban ngày: Loa & Mic tất cả người chơi còn sống được bật để thảo luận.
   * 3. Người đã chết: Chỉ nghe được (Loa: Bật, Mic: Tắt), không nói hay nhắn vào kênh chung mà chỉ nhắn trong nhóm người chết.
   */
  private updateAudioAndChatState(): void {
    const isNight = this.currentPhase === GAME_PHASE.NIGHT;
    const isWolf = this.currentRole === 'WEREWOLF';

    if (!this.isCurrentlyAlive) {
      // Người đã chết: Chỉ nghe được cuộc thảo luận chung ban ngày, Mic bị tắt, chỉ chat nhóm người chết
      this.soundManager.setVoicePermissions(false, !isNight);
      if (this.elSpeakerStatus) {
        this.elSpeakerStatus.className = 'speaker-status listen-only';
        this.elSpeakerStatus.textContent = '🔊 Loa: Chỉ nghe';
      }
      if (this.elMicStatus) {
        this.elMicStatus.className = 'mic-status off';
        this.elMicStatus.textContent = '🔇 Mic: Tắt';
      }
      this.elChatInput.disabled = false;
      this.elBtnChatSend.disabled = false;
      this.elChatInput.placeholder = '👻 Nhóm người chết (người sống không thấy)...';
      return;
    }

    if (isNight) {
      if (isWolf) {
        // Sói trong đêm: Loa & Mic bật để trao đổi riêng với nhau
        this.soundManager.setVoicePermissions(true, true);
        const micOn = this.soundManager.isMicActive();
        if (this.elSpeakerStatus) {
          this.elSpeakerStatus.className = 'speaker-status on wolf';
          this.elSpeakerStatus.textContent = '🔊 Loa: Sói';
        }
        if (this.elMicStatus) {
          this.elMicStatus.className = micOn ? 'mic-status on wolf' : 'mic-status off';
          this.elMicStatus.textContent = micOn ? '🎙️ Mic: Sói' : '🔇 Mic: Tắt';
        }
        this.elChatInput.disabled = false;
        this.elBtnChatSend.disabled = false;
        this.elChatInput.placeholder = '🐺 Trò chuyện mật bầy Sói...';
      } else {
        // Người chơi khác trong đêm: Loa & Mic bị tắt hoàn toàn để không nghe được Sói
        this.soundManager.setVoicePermissions(false, false);
        if (this.elSpeakerStatus) {
          this.elSpeakerStatus.className = 'speaker-status off';
          this.elSpeakerStatus.textContent = '🔇 Loa: Tắt';
        }
        if (this.elMicStatus) {
          this.elMicStatus.className = 'mic-status off';
          this.elMicStatus.textContent = '🔇 Mic: Tắt';
        }
        this.elChatInput.disabled = true;
        this.elBtnChatSend.disabled = true;
        this.elChatInput.placeholder = '🔇 Đêm: Loa & Mic đã tắt...';
      }
      return;
    }

    // Ban ngày / Sảnh chờ: Loa & Mic của tất cả người chơi còn sống được bật để thảo luận
    this.soundManager.setVoicePermissions(true, true);
    const micOn = this.soundManager.isMicActive();
    if (this.elSpeakerStatus) {
      this.elSpeakerStatus.className = 'speaker-status on';
      this.elSpeakerStatus.textContent = '🔊 Loa: Bật';
    }
    if (this.elMicStatus) {
      this.elMicStatus.className = micOn ? 'mic-status on' : 'mic-status off';
      this.elMicStatus.textContent = micOn ? '🎙️ Mic: Bật' : '🔇 Mic: Tắt';
    }
    this.elChatInput.disabled = false;
    this.elBtnChatSend.disabled = false;
    this.elChatInput.placeholder = 'Nhấn Enter để thảo luận...';
  }

  public addChatMessage(msg: ChatMessage): void {
    const div = document.createElement('div');
    div.className = 'chat-msg';

    if (msg.isSystem) {
      div.classList.add('system');
      div.textContent = `[HỆ THỐNG] ${msg.text}`;
    } else if (msg.isDead) {
      div.classList.add('dead');
      div.innerHTML = `👻 <strong>[Nhóm Hồn Ma] ${msg.senderName}:</strong> ${msg.text}`;
    } else if (msg.isWolfChat) {
      div.classList.add('wolf-chat');
      div.innerHTML = `🐺 <strong>[Kênh Sói] ${msg.senderName}:</strong> ${msg.text}`;
    } else {
      div.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.text}`;
    }

    this.elChatMessages.appendChild(div);
    this.elChatMessages.scrollTop = this.elChatMessages.scrollHeight;
  }

  public showRoleGuideModal(role: PlayerRole): void {
    this.elRoleModal.classList.remove('hidden');
    if (role === 'WEREWOLF') {
      this.elRoleGuideTitle.textContent = '🐺 MA SÓI HỌC ĐƯỜNG';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Tiêu diệt học sinh trong trường. Ban đêm, cả bản đồ tối đen nhưng Ma Sói có tầm nhìn sáng bán kính 5m đi tới đâu sáng tới đó để tìm nạn nhân (có thể mở cửa phòng bằng phím E). Lưu ý: Nếu trong đêm bầy Sói không giết được ai thì sáng hôm sau 1 Sói sẽ bị chết ngẫu nhiên!';
    } else if (role === 'SEER') {
      this.elRoleGuideTitle.textContent = '🔮 TIÊN TRI HỌC ĐƯỜNG';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Dùng năng lực thấu thị để tìm ra Ma Sói. Ban đêm, dù bị bất động, bạn có thể bấm nút "SOI DANH TÍNH" để kiểm tra thân phận 1 người chơi bất kỳ. Hãy sống sót để chia sẻ thông tin cho dân làng ban ngày!';
    } else if (role === 'BODYGUARD') {
      this.elRoleGuideTitle.textContent = '🛡️ BẢO VỆ TRƯỜNG HỌC';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Bảo vệ học sinh khỏi nanh vuốt Sói. Mỗi đêm, bạn chọn 1 người để bảo vệ (có thể bảo vệ chính mình). QUY TẮC: Không được bảo vệ cùng 1 người trong hai đêm liên tiếp!';
    } else if (role === 'WITCH') {
      this.elRoleGuideTitle.textContent = '🧙 PHÙ THỦY HỌC ĐƯỜNG';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Hỗ trợ phe học sinh bằng 2 bình thuốc dùng 1 lần: 1 Bình Cứu (cứu người vừa bị sói cắn) và 1 Bình Độc (đầu độc 1 người bất kỳ trong đêm).';
    } else if (role === 'HUNTER') {
      this.elRoleGuideTitle.textContent = '💥 THỢ SĂN';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Khi bạn bị loại (do sói cắn, phù thủy đầu độc hay bị biểu quyết treo cổ), bạn có quyền nổ một phát súng cuối cùng để kéo theo 1 người bất kỳ chết cùng!';
    } else if (role === 'DOCTOR') {
      this.elRoleGuideTitle.textContent = '🩺 BÁC SĨ TRƯỜNG HỌC';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Cứu chữa học sinh bị thương. Mỗi đêm, bạn chọn 1 người để bảo vệ / tiêm thuốc hồi phục, giúp người đó sống sót nếu bị Sói cắn!';
    } else {
      this.elRoleGuideTitle.textContent = '👤 HỌC SINH / DÂN LÀNG';
      this.elRoleGuideDesc.textContent = 'Mục tiêu: Ẩn nấp thật kỹ trong các phòng học, nhà vệ sinh, bể bơi, kho hàng vào ban đêm. Ban ngày thảo luận sôi nổi và bỏ phiếu để loại bỏ Ma Sói!';
    }
  }

  public showGameOver(winner: 'WEREWOLF' | 'VILLAGERS'): void {
    this.elDeathScreen.classList.remove('hidden');
    if (winner === 'WEREWOLF') {
      this.elGameOverTitle.textContent = '🐺 MA SÓI CHIẾN THẮNG!';
      this.elGameOverReason.textContent = 'Số lượng Ma Sói đã hoàn toàn áp đảo học sinh! Toàn bộ trường học đã rơi vào đêm tối vĩnh hằng.';
    } else {
      this.elGameOverTitle.textContent = '🏆 HỌC SINH CHIẾN THẮNG!';
      this.elGameOverReason.textContent = 'Toàn bộ Ma Sói đã bị vạch trần và tiêu diệt! Ánh sáng công lý đã trở lại trường học.';
    }
  }

  public updateBarrierStatus(isOutside: boolean, distance: number): void {
    const distStr = `${distance.toFixed(1)}m / ${GAME_CONFIG.BARRIER_RADIUS}m`;
    const sig = `${isOutside}_${distStr}`;
    if (sig === this.lastBarrierSig) return;
    this.lastBarrierSig = sig;

    this.elDistance.textContent = distStr;
    if (isOutside) {
      this.elWarningBanner.classList.remove('hidden');
      this.elDamageVignette.classList.remove('hidden');
    } else {
      this.elWarningBanner.classList.add('hidden');
      this.elDamageVignette.classList.add('hidden');
    }
  }

  public updateCoordinates(x: number, z: number): void {
    const coordStr = `X: ${x.toFixed(1)} | Z: ${z.toFixed(1)}`;
    if (coordStr === this.lastCoordsText) return;
    this.lastCoordsText = coordStr;
    this.elCoords.textContent = coordStr;
  }

  public updateOnlineCount(count: number): void {
    if (count === this.lastOnlineCount) return;
    this.lastOnlineCount = count;
    this.elOnlineCount.textContent = count.toString();
  }

  public updateConnectionStatus(connected: boolean): void {
    if (connected) {
      this.elStatusDot.classList.remove('disconnected');
      this.elServerStatus.textContent = 'Máy chủ: Trực tuyến';
    } else {
      this.elStatusDot.classList.add('disconnected');
      this.elServerStatus.textContent = 'Mất kết nối!';
    }
  }

  /**
   * Cập nhật danh sách học sinh trên HUD: Hiển thị ai còn sống, gạch tên ai đã chết (Tối ưu hóa tránh giật DOM)
   */
  public updatePlayerList(players: PlayerState[], localPlayerId: string): void {
    if (!this.elPlayerListItems || !this.elHudAliveCount) return;

    const totalCount = players.length;
    const aliveCount = players.filter((p) => p.isAlive).length;

    // Throttle / Dirty-check: Chỉ vẽ lại DOM khi danh sách thay đổi hoặc đã qua 400ms
    const signature = `${totalCount}_${aliveCount}_` + players.map((p) => `${p.id}:${p.isAlive}:${Math.round(p.hp)}`).join(',');
    const now = performance.now();
    if (signature === this.lastPlayerListSignature && now - this.lastPlayerListUpdateTime < 400) {
      return;
    }
    this.lastPlayerListSignature = signature;
    this.lastPlayerListUpdateTime = now;

    this.elHudAliveCount.textContent = `${aliveCount}/${totalCount}`;

    let html = '';
    for (const p of players) {
      const isMe = p.id === localPlayerId;
      const isDead = !p.isAlive;
      const itemClass = `player-item ${isMe ? 'is-me' : ''} ${isDead ? 'dead' : ''}`;
      const nameClass = isDead ? 'player-name-struck' : '';
      const icon = isDead ? '💀' : (p.isBot ? '🤖' : '👤');
      const revealedRole = ROLE_NAMES_VI[p.role] || p.role;
      const statusText = isDead ? `💀 ${revealedRole}` : `${Math.round(p.hp)}%`;
      const statusClass = isDead ? 'dead' : 'alive';
      // Chỉ bản thân người chết (isMe) mới được biết lý do mình chết, người khác không được biết
      const tooltipText = isMe && isDead && p.deathReason ? `${p.name} (${revealedRole}) - ${p.deathReason}` : p.name;

      html += `
        <div class="${itemClass}" title="${tooltipText}">
          <div class="player-item-left">
            <span>${icon}</span>
            <span class="player-item-name ${nameClass}">${p.name}${isMe ? ' (Bạn)' : ''}</span>
          </div>
          <span class="player-item-status ${statusClass}">${statusText}</span>
        </div>
      `;
    }

    this.elPlayerListItems.innerHTML = html;
  }

  /**
   * Cập nhật banner trạng thái đồng thuận của bầy Sói trong đêm
   */
  public updateWolfPackVotes(
    status: WolfVoteUpdatePayload,
    isNight: boolean,
    localRole: PlayerRole
  ): void {
    if (!this.elWolfPackPanel || !this.elWolfPackStatus || !this.elWolfPackVotes) return;

    if (!isNight || localRole !== 'WEREWOLF') {
      this.elWolfPackPanel.classList.add('hidden');
      return;
    }

    this.elWolfPackPanel.classList.remove('hidden');

    if (status.isKillSuccessful) {
      this.elWolfPackStatus.textContent = `🩸 ĐÃ CẮN HẠ [${status.targetName || 'MỤC TIÊU'}]!`;
    } else if (status.hasConsensus) {
      if (status.hasWolfNearby) {
        this.elWolfPackStatus.textContent = `🐺 ĐÃ THỐNG NHẤT CẮN [${status.targetName}] - NHẤN F ĐỂ CẮN!`;
      } else {
        this.elWolfPackStatus.textContent = `⚠️ ĐÃ THỐNG NHẤT (${status.votesForTarget}/${status.totalWolves}) - CẦN ÁP SÁT [${status.targetName}] (<= 4.5m)`;
      }
    } else if (status.targetName) {
      this.elWolfPackStatus.textContent = `🐺 BẦY SÓI ĐANG CHỌN: [${status.targetName}] (${status.votesForTarget}/${status.totalWolves})`;
    } else {
      this.elWolfPackStatus.textContent = `🐺 BẦY SÓI: CHƯA THỐNG NHẤT MỤC TIÊU (0/${status.totalWolves})`;
    }

    if (status.wolfVotes && status.wolfVotes.length > 0) {
      this.elWolfPackVotes.innerHTML = status.wolfVotes
        .map(
          (wv) => `
          <div class="wolf-vote-chip ${status.hasConsensus ? 'consensus-ok' : ''}">
            <strong>${wv.wolfName}</strong>: ${wv.targetName}
          </div>
        `
        )
        .join('');
    } else {
      this.elWolfPackVotes.innerHTML = '';
    }
  }
}
