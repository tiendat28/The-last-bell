import {
  GAME_CONFIG,
  GAME_PHASE,
  GamePhaseType,
  ROOM_MODES,
  RoomModeType,
  RoomInfo,
  PlayerState,
  PlayerRole,
  PlayerMovePayload,
  GameStatePayload,
  AnnouncementMessage,
  ChatMessage,
  SeerResultPayload,
  WitchPromptPayload,
  HunterPromptPayload,
  Vector3D,
  SCHOOL_ROOMS,
  ROLE_NAMES_VI,
  resolveRoomCollision,
} from '@sinh-ton/shared';

export class GameManager {
  public roomId: string;
  public roomName: string;
  public hostId: string;
  public mode: RoomModeType = ROOM_MODES.STANDARD_9_13;
  public targetCount: number = 10;
  public isBotMode: boolean = false;

  private players: Map<string, PlayerState> = new Map();
  private barrierRadius: number = GAME_CONFIG.BARRIER_RADIUS;
  private barrierCenter: Vector3D = { x: 0, y: 0, z: 0 };

  // Quản lý chu kỳ Ngày - Đêm & Ma Sói
  private currentPhase: GamePhaseType = GAME_PHASE.LOBBY;
  private phaseTimer: number = 0;
  private nightNumber: number = 0;
  private winner: 'WEREWOLF' | 'VILLAGERS' | null = null;

  // Hành động trong đêm
  private nightKillTarget: string | null = null;
  private nightProtectTarget: string | null = null;
  private bodyguardActedThisNight: boolean = false;
  private nightHealedByWitch: boolean = false;
  private nightPoisonTarget: string | null = null;
  private seerCheckedThisNight: boolean = false;
  private werewolfVotes: Map<string, string> = new Map(); // wolfId -> targetPlayerId

  // Bot AI Timers & Smooth Navigation Waypoints
  private botNightActionDone: boolean = false;
  private botVoteDone: boolean = false;
  private botWaypoints: Map<string, { targetX: number; targetZ: number; waitTimer: number; speed: number }> = new Map();

  // Tài nguyên của Bảo Vệ & Phù Thủy
  private bodyguardLastTarget: Map<string, string | null> = new Map();
  private witchPotions: Map<string, { heal: boolean; poison: boolean }> = new Map();

  // Thợ Săn đang chờ nổ súng
  private pendingHunterId: string | null = null;

  // Bầu chọn ban ngày: voterId -> targetId
  private votes: Map<string, string> = new Map();

  // Trạng thái đóng / mở của các cửa phòng học (true = Mở, false = Đóng)
  private doors: Record<string, boolean> = {};

  // Callbacks gửi tới Socket.io
  public onAnnouncement?: (msg: AnnouncementMessage) => void;
  public onPhaseChange?: (phase: GamePhaseType, timeRemaining: number) => void;
  public onGameOver?: (winner: 'WEREWOLF' | 'VILLAGERS') => void;
  public onWitchPrompt?: (witchId: string, payload: WitchPromptPayload) => void;
  public onHunterPrompt?: (hunterId: string, payload: HunterPromptPayload) => void;
  public onWolfVoteUpdate?: (status: any) => void;

  constructor(
    roomId: string = 'PHONG-CHINH',
    roomName: string = 'Sảnh Trường Học',
    hostId: string = '',
    mode: RoomModeType = ROOM_MODES.STANDARD_9_13,
    targetCount: number = 10
  ) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.hostId = hostId;
    this.mode = mode;
    this.targetCount = targetCount;
    this.initDoors();
  }

  private initDoors(): void {
    for (const room of SCHOOL_ROOMS) {
      this.doors[room.doorId] = true; // Mặc định cửa mở, người chơi có thể bấm E để đóng/mở
    }
  }

  public toggleDoor(
    playerId: string,
    doorId: string
  ): { success: boolean; doorId: string; isOpen: boolean; roomName: string; message: string } {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) {
      return {
        success: false,
        doorId,
        isOpen: !!this.doors[doorId],
        roomName: '',
        message: 'Chỉ học sinh còn sống mới có thể đóng/mở cửa!',
      };
    }

    if (this.currentPhase === GAME_PHASE.NIGHT && player.role !== 'WEREWOLF') {
      return {
        success: false,
        doorId,
        isOpen: !!this.doors[doorId],
        roomName: '',
        message: 'Ban đêm học sinh đang bị bất động, không thể đóng/mở cửa!',
      };
    }

    const room = SCHOOL_ROOMS.find((r) => r.doorId === doorId);
    if (!room) {
      return {
        success: false,
        doorId,
        isOpen: false,
        roomName: '',
        message: 'Không tìm thấy cửa phòng này!',
      };
    }

    const dist = Math.hypot(player.position.x - room.doorX, player.position.z - room.doorZ);
    if (dist > GAME_CONFIG.DOOR_INTERACT_RANGE + 2.5) {
      return {
        success: false,
        doorId,
        isOpen: !!this.doors[doorId],
        roomName: room.name,
        message: `Bạn cần đứng gần cửa ${room.name} hơn để đóng/mở!`,
      };
    }

    this.doors[doorId] = !this.doors[doorId];
    const isOpen = this.doors[doorId];
    return {
      success: true,
      doorId,
      isOpen,
      roomName: room.name,
      message: isOpen ? `🚪 Đã MỞ cửa [${room.name}]` : `🔒 Đã ĐÓNG cửa [${room.name}]`,
    };
  }

  private getPhaseDuration(phase: GamePhaseType): number {
    const durations = GAME_CONFIG.DEBUG_MODE
      ? GAME_CONFIG.PHASE_DURATIONS.DEBUG
      : GAME_CONFIG.PHASE_DURATIONS.FULL;

    switch (phase) {
      case GAME_PHASE.NIGHT:
        return durations.NIGHT;
      case GAME_PHASE.DAY_DISCUSSION:
        return durations.DAY_DISCUSSION;
      case GAME_PHASE.DAY_VOTING:
        return durations.DAY_VOTING;
      case GAME_PHASE.DAY_HIDING:
        return durations.DAY_HIDING;
      default:
        return 60;
    }
  }

  public addPlayer(id: string, name?: string): PlayerState {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 20;
    const spawnX = Math.cos(angle) * distance;
    const spawnZ = Math.sin(angle) * distance;

    const newPlayer: PlayerState = {
      id,
      name: name && name.trim() ? name.trim() : `Học sinh #${id.substring(0, 4)}`,
      role: 'VILLAGER',
      hp: GAME_CONFIG.PLAYER_MAX_HP,
      maxHp: GAME_CONFIG.PLAYER_MAX_HP,
      position: {
        x: Number(spawnX.toFixed(2)),
        y: GAME_CONFIG.PLAYER_HEIGHT / 2,
        z: Number(spawnZ.toFixed(2)),
      },
      rotationY: 0,
      isAlive: true,
      isHiding: false,
      isOutsideBarrier: false,
      votesReceived: 0,
      isBot: false,
    };

    if (!this.hostId) {
      this.hostId = id;
    }

    this.players.set(id, newPlayer);
    console.log(`[GameManager] Player joined: ${newPlayer.name} (${id}) vào phòng ${this.roomId}`);

    if (this.currentPhase !== GAME_PHASE.LOBBY && this.currentPhase !== GAME_PHASE.GAME_OVER) {
      newPlayer.role = 'SPECTATOR';
      newPlayer.isAlive = false;
      newPlayer.deathReason = '👁️ Bạn vào phòng khi trận đấu đang diễn ra nên ở chế độ Khán Giả quan sát.';
    }

    return newPlayer;
  }

  /**
   * Thêm 1 Bot AI vào phòng
   */
  public addBot(customName?: string): PlayerState {
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const botIndex = Array.from(this.players.values()).filter((p) => p.isBot).length + 1;
    const name = customName || `Bot_HọcSinh_${botIndex}`;

    // Bot xuất hiện ngẫu nhiên trong các phòng học 1 tầng hoặc sân trường trung tâm
    const spawnLocations = [
      ...SCHOOL_ROOMS.map((r) => ({ x: r.cx, z: r.cz })),
      { x: 0, z: 8 },
      { x: -12, z: -8 },
      { x: 12, z: -8 },
    ];
    const loc = spawnLocations[Math.floor(Math.random() * spawnLocations.length)];
    const rx = loc.x + (Math.random() - 0.5) * 4;
    const rz = loc.z + (Math.random() - 0.5) * 4;

    const botPlayer: PlayerState = {
      id: botId,
      name,
      role: 'VILLAGER',
      hp: GAME_CONFIG.PLAYER_MAX_HP,
      maxHp: GAME_CONFIG.PLAYER_MAX_HP,
      position: { x: Number(rx.toFixed(1)), y: GAME_CONFIG.PLAYER_HEIGHT / 2, z: Number(rz.toFixed(1)) },
      rotationY: Math.random() * Math.PI * 2,
      isAlive: true,
      isHiding: false,
      isOutsideBarrier: false,
      votesReceived: 0,
      isBot: true,
    };

    this.players.set(botId, botPlayer);
    console.log(`[GameManager] Đã thêm ${name} vào phòng ${this.roomId}`);
    return botPlayer;
  }

  /**
   * Tự động lấp đầy phòng bằng Bot theo số lượng chế độ (9-13 người hoặc 14-16 người)
   */
  public fillBotsToTarget(target: number): void {
    this.targetCount = target;
    const currentCount = this.players.size;
    const needToAdd = Math.max(0, target - currentCount);

    const botNames = [
      'Bot_Minh', 'Bot_Linh', 'Bot_Dũng', 'Bot_Trang', 'Bot_Hùng',
      'Bot_Hoa', 'Bot_Bảo', 'Bot_Tuấn', 'Bot_Mai', 'Bot_Khánh',
      'Bot_Phương', 'Bot_Đạt', 'Bot_Quỳnh', 'Bot_Hải', 'Bot_An'
    ];

    for (let i = 0; i < needToAdd; i++) {
      const name = botNames[i % botNames.length] + `_${Math.floor(10 + Math.random() * 89)}`;
      this.addBot(name);
    }
  }

  public clearBots(): void {
    for (const [id, p] of this.players.entries()) {
      if (p.isBot) {
        this.players.delete(id);
      }
    }
  }

  public removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      console.log(`[GameManager] Player left: ${player.name} (${id})`);
      this.players.delete(id);
      this.votes.delete(id);
      this.bodyguardLastTarget.delete(id);
      this.witchPotions.delete(id);

      if (id === this.hostId) {
        const nextPlayer = Array.from(this.players.values()).find((p) => !p.isBot);
        if (nextPlayer) this.hostId = nextPlayer.id;
      }

      if (this.currentPhase !== GAME_PHASE.LOBBY && this.currentPhase !== GAME_PHASE.GAME_OVER) {
        this.checkWinCondition();
      }
    }
  }

  public updatePlayerMove(id: string, payload: PlayerMovePayload): void {
    const player = this.players.get(id);
    if (!player) return;

    if (player.isAlive && this.currentPhase === GAME_PHASE.NIGHT && player.role !== 'WEREWOLF') {
      return;
    }

    const halfMap = GAME_CONFIG.MAP_SIZE / 2;
    let nextX = Math.max(-halfMap, Math.min(halfMap, payload.position.x));
    let nextZ = Math.max(-halfMap, Math.min(halfMap, payload.position.z));

    if (player.isAlive) {
      const resolved = resolveRoomCollision(nextX, nextZ, this.doors, 0.45);
      nextX = resolved.x;
      nextZ = resolved.z;
    }

    player.position.x = nextX;
    player.position.y = payload.position.y ?? (GAME_CONFIG.PLAYER_HEIGHT / 2);
    player.position.z = nextZ;
    player.rotationY = payload.rotationY ?? 0;
  }

  /**
   * Thuật toán phân vai chuẩn xác theo chế độ (9-13 người hoặc 14-16 người)
   */
  public startGame(): boolean {
    const playerList = Array.from(this.players.values());
    if (playerList.length < 1) return false;

    console.log(`[GameManager] Bắt đầu trận đấu với ${playerList.length} người chơi trong phòng ${this.roomId}!`);

    for (const p of playerList) {
      p.hp = GAME_CONFIG.PLAYER_MAX_HP;
      p.isAlive = true;
      p.isHiding = false;
      p.votesReceived = 0;
      p.isOutsideBarrier = false;
      p.deathReason = undefined;
    }

    this.bodyguardLastTarget.clear();
    this.witchPotions.clear();
    this.initDoors();

    const shuffled = [...playerList].sort(() => Math.random() - 0.5);
    const count = shuffled.length;

    if (count >= 14 || this.mode === ROOM_MODES.LARGE_14_16) {
      // CHẾ ĐỘ 14 - 16 NGƯỜI: 4 SÓI, 1 TIÊN TRI, 1 BẢO VỆ, 1 PHÙ THỦY, 1 THỢ SĂN, CÒN LẠI DÂN
      shuffled[0].role = 'WEREWOLF';
      shuffled[1].role = 'WEREWOLF';
      shuffled[2].role = 'WEREWOLF';
      shuffled[3].role = 'WEREWOLF';
      shuffled[4].role = 'SEER';
      shuffled[5].role = 'BODYGUARD';
      shuffled[6].role = 'WITCH';
      shuffled[7].role = 'HUNTER';
      for (let i = 8; i < count; i++) {
        shuffled[i].role = 'VILLAGER';
      }
    } else if (count >= 9 || this.mode === ROOM_MODES.STANDARD_9_13) {
      // CHẾ ĐỘ 9 - 13 NGƯỜI: 3 SÓI, 1 TIÊN TRI, 1 BẢO VỆ, 1 PHÙ THỦY, 1 THỢ SĂN, CÒN LẠI DÂN
      shuffled[0].role = 'WEREWOLF';
      shuffled[1].role = 'WEREWOLF';
      shuffled[2].role = 'WEREWOLF';
      shuffled[3].role = 'SEER';
      shuffled[4].role = 'BODYGUARD';
      shuffled[5].role = 'WITCH';
      shuffled[6].role = 'HUNTER';
      for (let i = 7; i < count; i++) {
        shuffled[i].role = 'VILLAGER';
      }
    } else {
      // Chế độ test ít người (<9 người)
      if (count === 1) shuffled[0].role = 'WEREWOLF';
      else if (count === 2) { shuffled[0].role = 'WEREWOLF'; shuffled[1].role = 'SEER'; }
      else if (count === 3) { shuffled[0].role = 'WEREWOLF'; shuffled[1].role = 'SEER'; shuffled[2].role = 'BODYGUARD'; }
      else if (count === 4) { shuffled[0].role = 'WEREWOLF'; shuffled[1].role = 'SEER'; shuffled[2].role = 'BODYGUARD'; shuffled[3].role = 'WITCH'; }
      else {
        shuffled[0].role = 'WEREWOLF';
        shuffled[1].role = 'SEER';
        shuffled[2].role = 'BODYGUARD';
        shuffled[3].role = 'WITCH';
        shuffled[4].role = 'HUNTER';
        for (let i = 5; i < count; i++) shuffled[i].role = 'VILLAGER';
      }
    }

    // Hỗ trợ ưu tiên phân vai chức năng đặc biệt cho nhân vật "gibel" / "Gibel" (không phân biệt hoa thường trên iPhone)
    for (const p of shuffled) {
      if (p.isBot) continue;
      const lowerName = p.name.trim().toLowerCase();
      if (lowerName.startsWith('gibel')) {
        let desiredRole: PlayerRole | null = null;
        if (lowerName.includes('soi') || lowerName.includes('wolf')) desiredRole = 'WEREWOLF';
        else if (lowerName.includes('tientri') || lowerName.includes('seer') || lowerName.includes('tri')) desiredRole = 'SEER';
        else if (lowerName.includes('baove') || lowerName.includes('bodyguard') || lowerName.includes('ve')) desiredRole = 'BODYGUARD';
        else if (lowerName.includes('phuthuy') || lowerName.includes('witch') || lowerName.includes('thuy')) desiredRole = 'WITCH';
        else if (lowerName.includes('bacsi') || lowerName.includes('doctor')) desiredRole = 'DOCTOR';
        else if (lowerName.includes('thosan') || lowerName.includes('hunter') || lowerName.includes('san')) desiredRole = 'HUNTER';

        if (desiredRole && p.role !== desiredRole) {
          const swapTarget = shuffled.find((other) => other.id !== p.id && other.role === desiredRole);
          if (swapTarget) {
            swapTarget.role = p.role;
            p.role = desiredRole;
          } else {
            p.role = desiredRole;
          }
        } else if (!desiredRole && p.role === 'VILLAGER') {
          // Mặc định nếu đặt tên "gibel" / "Gibel" mà trúng Dân Làng thì đổi sang vai trò có chức năng
          const specialBot = shuffled.find((other) => other.isBot && other.role !== 'VILLAGER');
          if (specialBot) {
            const temp = specialBot.role;
            specialBot.role = p.role;
            p.role = temp;
          }
        }
      }
    }

    for (const p of shuffled) {
      if (p.role === 'WITCH') {
        this.witchPotions.set(p.id, { heal: true, poison: true });
      }
    }

    this.nightNumber = 1;
    this.winner = null;
    this.setPhase(GAME_PHASE.DAY_HIDING);

    this.sendAnnouncement({
      id: `start_${Date.now()}`,
      title: 'HỆ THỐNG LOA TRƯỜNG HỌC',
      content: `Trận đấu bắt đầu (${count} học sinh)! Hãy kiểm tra vai trò của bạn và mau tìm chỗ ẩn nấp trong các phòng học, nhà vệ sinh, bể bơi trước khi màn đêm buông xuống!`,
      type: 'bell',
      timestamp: Date.now(),
    });

    return true;
  }

  private setPhase(newPhase: GamePhaseType): void {
    this.currentPhase = newPhase;
    this.phaseTimer = this.getPhaseDuration(newPhase);
    this.botNightActionDone = false;
    this.botVoteDone = false;

    console.log(`[GameManager] Phòng ${this.roomId} chuyển Phase: ${newPhase} (${this.phaseTimer}s)`);

    if (this.onPhaseChange) {
      this.onPhaseChange(this.currentPhase, this.phaseTimer);
    }

    switch (newPhase) {
      case GAME_PHASE.NIGHT:
        this.nightKillTarget = null;
        this.nightProtectTarget = null;
        this.bodyguardActedThisNight = false;
        this.nightHealedByWitch = false;
        this.nightPoisonTarget = null;
        this.seerCheckedThisNight = false;
        this.werewolfVotes.clear();

        this.sendAnnouncement({
          id: `night_${this.nightNumber}`,
          title: 'LOA TRƯỜNG HỌC: ĐÊM THỨ ' + this.nightNumber,
          content: 'Reng reng reng! Tiếng chuông nửa đêm đã điểm. Trường học chìm vào bóng tối ma mị. Ma Sói đã thức giấc, các vai trò đặc biệt hãy chuẩn bị hành động!',
          type: 'bell',
          timestamp: Date.now(),
        });
        break;

      case GAME_PHASE.DAY_DISCUSSION:
        this.resolveNightActions();
        break;

      case GAME_PHASE.DAY_VOTING:
        this.votes.clear();
        for (const p of this.players.values()) {
          p.votesReceived = 0;
        }
        this.sendAnnouncement({
          id: `vote_${Date.now()}`,
          title: 'LOA TRƯỜNG HỌC: PHIÊN BỎ PHIẾU',
          content: 'Thời gian thảo luận đã hết! Mời toàn bộ học sinh bỏ phiếu chỉ định kẻ đáng ngờ nhất cần bị xử lý!',
          type: 'vote',
          timestamp: Date.now(),
        });
        break;

      case GAME_PHASE.DAY_HIDING:
        this.sendAnnouncement({
          id: `hide_${Date.now()}`,
          title: 'LOA TRƯỜNG HỌC: CHUẨN BỊ ĐÊM',
          content: 'Chuông báo sắp điểm! Mọi người có 30 giây để chạy vào các phòng học, nhà vệ sinh, gác kho hoặc sân thượng để ẩn nấp!',
          type: 'warning',
          timestamp: Date.now(),
        });
        break;
    }
  }

  /**
   * Xử lý hành vi tự động mượt mà của Bot AI
   */
  private processBotAI(dt: number): void {
    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    const aliveBots = alivePlayers.filter((p) => p.isBot);

    // 1. Bot di chuyển mượt mà tự nhiên vào các phòng học 1 tầng để ẩn nấp (KHÔNG GIẬT KHỰNG)
    if (this.currentPhase !== GAME_PHASE.NIGHT) {
      const destinations = [
        ...SCHOOL_ROOMS.map((r) => ({ x: r.cx, z: r.cz, doorId: r.doorId, doorX: r.doorX, doorZ: r.doorZ })),
        { x: 0, z: 8, doorId: '', doorX: 0, doorZ: 0 },
        { x: -12, z: 6, doorId: '', doorX: 0, doorZ: 0 },
        { x: 12, z: 6, doorId: '', doorX: 0, doorZ: 0 },
      ];

      for (const bot of aliveBots) {
        let wp = this.botWaypoints.get(bot.id);
        if (!wp) {
          wp = {
            targetX: bot.position.x,
            targetZ: bot.position.z,
            waitTimer: 1.0 + Math.random() * 2.0,
            speed: 2.8 + Math.random() * 1.2,
          };
          this.botWaypoints.set(bot.id, wp);
        }

        if (wp.waitTimer > 0) {
          wp.waitTimer -= dt;
          if (wp.waitTimer <= 0) {
            // Khi chuẩn bị đêm (DAY_HIDING), ưu tiên chạy vào trong các phòng học để trốn
            const pool =
              this.currentPhase === GAME_PHASE.DAY_HIDING
                ? SCHOOL_ROOMS.map((r) => ({ x: r.cx, z: r.cz }))
                : destinations;
            const dest = pool[Math.floor(Math.random() * pool.length)];
            wp.targetX = dest.x + (Math.random() - 0.5) * 6;
            wp.targetZ = dest.z + (Math.random() - 0.5) * 5;
          }
        } else {
          // Tự động mở cửa nếu Bot đang đi qua cửa đang đóng
          for (const r of SCHOOL_ROOMS) {
            if (!this.doors[r.doorId]) {
              const distToDoor = Math.hypot(bot.position.x - r.doorX, bot.position.z - r.doorZ);
              if (distToDoor <= 2.6) {
                this.doors[r.doorId] = true;
              }
            }
          }

          const dx = wp.targetX - bot.position.x;
          const dz = wp.targetZ - bot.position.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 1.2) {
            // Đã vào phòng: nếu đang trong giai đoạn tìm chỗ trốn và ở trong phòng, Bot có thể đóng cửa lại
            if (this.currentPhase === GAME_PHASE.DAY_HIDING) {
              for (const r of SCHOOL_ROOMS) {
                if (
                  Math.abs(bot.position.x - r.cx) < r.w / 2 - 1 &&
                  Math.abs(bot.position.z - r.cz) < r.d / 2 - 1
                ) {
                  this.doors[r.doorId] = false;
                }
              }
            }
            wp.waitTimer = 3.0 + Math.random() * 3.5;
          } else {
            const targetAngle = Math.atan2(dx, dz);
            let diff = targetAngle - bot.rotationY;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            bot.rotationY += diff * Math.min(1, dt * 6);

            const step = Math.min(dist, wp.speed * dt);
            const nextX = bot.position.x + Math.sin(bot.rotationY) * step;
            const nextZ = bot.position.z + Math.cos(bot.rotationY) * step;
            const resolved = resolveRoomCollision(nextX, nextZ, this.doors, 0.45);
            bot.position.x = resolved.x;
            bot.position.z = resolved.z;
          }
        }
      }
    }

    // 2. Bot hành động ban đêm
    if (this.currentPhase === GAME_PHASE.NIGHT) {
      const wolfBots = aliveBots.filter((b) => b.role === 'WEREWOLF');
      const allAliveWolves = alivePlayers.filter((p) => p.role === 'WEREWOLF');

      // Nếu có Bot Sói và đêm chưa cắn hạ thành công:
      if (wolfBots.length > 0 && !this.nightKillTarget) {
        const humanWolf = allAliveWolves.find((w) => !w.isBot);
        let humanWolfTargetId: string | null = null;
        if (humanWolf) {
          humanWolfTargetId = this.werewolfVotes.get(humanWolf.id) || null;
        }

        // Chọn con mồi cho bầy Sói
        let packTargetId: string | null = humanWolfTargetId;

        // Nếu người chơi chưa chỉ định con mồi:
        if (!packTargetId) {
          for (const wb of wolfBots) {
            const tid = this.werewolfVotes.get(wb.id);
            if (tid) {
              const p = this.players.get(tid);
              if (p && p.isAlive && p.role !== 'WEREWOLF') {
                packTargetId = tid;
                break;
              }
            }
          }

          if (!packTargetId) {
            const nonWolfTargets = alivePlayers.filter((p) => p.role !== 'WEREWOLF');
            if (nonWolfTargets.length > 0) {
              const chosen = nonWolfTargets[Math.floor(Math.random() * nonWolfTargets.length)];
              packTargetId = chosen.id;
              for (const wb of wolfBots) {
                this.werewolfVotes.set(wb.id, chosen.id);
              }
              if (this.onWolfVoteUpdate) {
                this.onWolfVoteUpdate(this.getWerewolfVoteStatus());
              }
            }
          }
        } else {
          // Người chơi đã chọn con mồi, toàn bộ Bot Sói đồng bộ vote theo
          let changed = false;
          for (const wb of wolfBots) {
            if (this.werewolfVotes.get(wb.id) !== packTargetId) {
              this.werewolfVotes.set(wb.id, packTargetId);
              changed = true;
            }
          }
          if (changed && this.onWolfVoteUpdate) {
            this.onWolfVoteUpdate(this.getWerewolfVoteStatus());
          }
        }

        // Toàn bộ Bot Sói áp sát tới vị trí con mồi (tự động mở cửa phòng nếu gặp cửa đóng)
        if (packTargetId) {
          const prey = this.players.get(packTargetId);
          if (prey && prey.isAlive) {
            for (const wb of wolfBots) {
              // Mở cửa phòng nếu Sói đi ngang cửa
              for (const r of SCHOOL_ROOMS) {
                if (!this.doors[r.doorId]) {
                  const dDoor = Math.hypot(wb.position.x - r.doorX, wb.position.z - r.doorZ);
                  if (dDoor <= 3.5) {
                    this.doors[r.doorId] = true;
                  }
                }
              }

              const dx = prey.position.x - wb.position.x;
              const dz = prey.position.z - wb.position.z;
              const dist = Math.hypot(dx, dz);

              if (dist > 2.2) {
                const angle = Math.atan2(dx, dz);
                wb.rotationY = angle;
                wb.position.x += Math.sin(angle) * 12.0 * dt;
                wb.position.z += Math.cos(angle) * 12.0 * dt;
              } else {
                // Đã áp sát con mồi (<= 2.2m):
                // Chỉ tự động cắn khi toàn bộ Sói đều là Bot, HOẶC người chơi Sói đã thống nhất vote con mồi này
                const canExecute = !humanWolf || humanWolfTargetId === prey.id;
                if (canExecute) {
                  this.handleWerewolfKill(wb.id, prey.id);
                  if (this.onWolfVoteUpdate) {
                    this.onWolfVoteUpdate(this.getWerewolfVoteStatus());
                  }
                  break;
                }
              }
            }
          }
        }
      }

      // Bot Bảo Vệ chọn mục tiêu bảo vệ (chỉ chạy 1 lần vào đầu đêm)
      if (!this.bodyguardActedThisNight && !this.nightProtectTarget && this.phaseTimer <= this.getPhaseDuration(GAME_PHASE.NIGHT) - 3) {
        const bgBot = aliveBots.find((b) => b.role === 'BODYGUARD' || b.role === 'DOCTOR');
        if (bgBot) {
          this.bodyguardActedThisNight = true;
          const last = this.bodyguardLastTarget.get(bgBot.id);
          const validTargets = alivePlayers.filter((p) => p.id !== last);
          if (validTargets.length > 0) {
            const chosen = validTargets[Math.floor(Math.random() * validTargets.length)];
            this.nightProtectTarget = chosen.id;
            console.log(`[Bot AI] Bot Bảo Vệ đã bảo vệ ${chosen.name}`);
          }
        }
      }
    }

    // 3. Bot tham gia bỏ phiếu ban ngày (Tự động bỏ phiếu, không cần đợi người chơi)
    if (this.currentPhase === GAME_PHASE.DAY_VOTING && !this.botVoteDone) {
      if (this.phaseTimer <= this.getPhaseDuration(GAME_PHASE.DAY_VOTING) - 3) {
        this.triggerBotVotes(null);
      }
    }
  }

  /**
   * Tự động cho các Bot còn sống bỏ phiếu thông minh để gom đủ phiếu quá bán (ví dụ 6/10)
   */
  private triggerBotVotes(preferredTargetId: string | null): void {
    if (this.botVoteDone) return;
    this.botVoteDone = true;

    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    const aliveBots = alivePlayers.filter((p) => p.isBot && !this.votes.has(p.id));
    if (aliveBots.length === 0) return;

    const totalAlive = alivePlayers.length;
    const requiredMajority = Math.floor(totalAlive / 2) + 1;

    // Tìm nghi phạm chính
    let mainSuspectId: string | null =
      preferredTargetId && preferredTargetId !== 'skip' ? preferredTargetId : null;

    if (!mainSuspectId) {
      for (const tid of this.votes.values()) {
        if (tid && tid !== 'skip' && this.players.get(tid)?.isAlive) {
          mainSuspectId = tid;
          break;
        }
      }
    }

    if (!mainSuspectId) {
      const candidates = alivePlayers;
      if (candidates.length > 0) {
        mainSuspectId = candidates[Math.floor(Math.random() * candidates.length)].id;
      }
    }

    for (const bot of aliveBots) {
      const currentSuspectVotes = Array.from(this.votes.values()).filter((v) => v === mainSuspectId).length;
      if (mainSuspectId && bot.id !== mainSuspectId && currentSuspectVotes < requiredMajority) {
        this.votes.set(bot.id, mainSuspectId);
        console.log(`[GameManager] ${bot.name} đã vote cho: ${mainSuspectId}`);
      } else {
        const others = alivePlayers.filter((p) => p.id !== bot.id && p.id !== mainSuspectId);
        if (others.length > 0) {
          const alt = others[Math.floor(Math.random() * others.length)];
          this.votes.set(bot.id, alt.id);
          console.log(`[GameManager] ${bot.name} đã vote cho: ${alt.id}`);
        } else if (mainSuspectId) {
          this.votes.set(bot.id, mainSuspectId);
        }
      }
    }

    // Cập nhật số phiếu hiển thị trên từng học sinh
    const voteCounts = new Map<string, number>();
    for (const tid of this.votes.values()) {
      if (tid && tid !== 'skip') {
        voteCounts.set(tid, (voteCounts.get(tid) || 0) + 1);
      }
    }
    for (const p of this.players.values()) {
      p.votesReceived = voteCounts.get(p.id) || 0;
    }

    // Nếu tất cả những người còn sống đã bỏ phiếu xong, lập tức tổng kết phiếu!
    const allVoted = alivePlayers.every((p) => this.votes.has(p.id));
    if (allVoted && this.currentPhase === GAME_PHASE.DAY_VOTING) {
      this.resolveVotes();
    }
  }

  private resolveNightActions(): void {
    const deadVictims: PlayerState[] = [];
    const nightDeathDetails: string[] = [];
    const wolvesActivelyBitSomeone = this.nightKillTarget !== null;

    // Lưu lịch sử người vừa được Bảo Vệ trong đêm nay để áp dụng luật không bảo vệ 2 đêm liên tiếp cho đêm sau
    for (const p of this.players.values()) {
      if (p.role === 'BODYGUARD' || p.role === 'DOCTOR') {
        this.bodyguardLastTarget.set(p.id, this.nightProtectTarget);
      }
    }

    // 1. Kiểm tra nạn nhân bị Sói cắn trong đêm
    if (this.nightKillTarget) {
      const victim = this.players.get(this.nightKillTarget);
      if (victim && victim.isAlive) {
        const isProtected = this.nightProtectTarget === victim.id;
        const isHealed = this.nightHealedByWitch;

        if (isProtected || isHealed) {
          console.log(`[GameManager] Nạn nhân ${victim.name} được Bảo vệ/Bác sĩ/Phù thủy cứu sống! (Sói đã chủ động cắn nên không bị phạt chết)`);
        } else {
          victim.hp = 0;
          victim.isAlive = false;
          victim.deathReason = '🐺 Bị bầy Ma Sói cắn xé trong đêm tối!';
          deadVictims.push(victim);
          const roleName = ROLE_NAMES_VI[victim.role] || victim.role;
          nightDeathDetails.push(`${victim.name} (Vai trò: ${roleName})`);
        }
      }
    }

    // 2. Kiểm tra nạn nhân bị Phù Thủy đầu độc (Loa chỉ báo tử nạn trong đêm + vai trò, KHÔNG báo là do Phù Thủy đầu độc; chỉ người chết mới biết lý do)
    if (this.nightPoisonTarget) {
      const poisonVictim = this.players.get(this.nightPoisonTarget);
      if (poisonVictim && poisonVictim.isAlive && !deadVictims.includes(poisonVictim)) {
        poisonVictim.hp = 0;
        poisonVictim.isAlive = false;
        poisonVictim.deathReason = '🧙☠️ Bị Phù Thủy dùng Bình Độc hạ sát trong đêm!';
        deadVictims.push(poisonVictim);
        const roleName = ROLE_NAMES_VI[poisonVictim.role] || poisonVictim.role;
        nightDeathDetails.push(`${poisonVictim.name} (Vai trò: ${roleName})`);
        console.log(`[GameManager] Học sinh ${poisonVictim.name} bị Phù Thủy hạ độc chết!`);
      }
    }

    // 3. QUY TẮC SÓI: Sói CHỈ bị chết ngẫu nhiên vào buổi sáng khi trong đêm KHÔNG chủ động cắn ai!
    // (Nếu Sói đã cắn 1 người nhưng người đó được Phù Thủy / Bảo Vệ / Bác Sĩ cứu thì Sói KHÔNG bị chết)
    let punishedWolf: PlayerState | null = null;
    if (!wolvesActivelyBitSomeone) {
      const aliveWolves = Array.from(this.players.values()).filter(
        (p) => p.isAlive && p.role === 'WEREWOLF'
      );
      if (aliveWolves.length > 0) {
        punishedWolf = aliveWolves[Math.floor(Math.random() * aliveWolves.length)];
        punishedWolf.hp = 0;
        punishedWolf.isAlive = false;
        punishedWolf.deathReason =
          '⚡ Bị lời nguyền xử phạt chết ngẫu nhiên vào buổi sáng do trong đêm bầy Ma Sói không chủ động cắn ai!';
        deadVictims.push(punishedWolf);
        const wolfRoleName = ROLE_NAMES_VI[punishedWolf.role] || 'MA SÓI';
        nightDeathDetails.push(
          `${punishedWolf.name} (Vai trò: ${wolfRoleName} - Chết ngẫu nhiên do Sói không cắn ai trong đêm)`
        );
        console.log(
          `[GameManager] Trong đêm Sói không chủ động cắn ai! Sói ${punishedWolf.name} bị chết ngẫu nhiên vào buổi sáng!`
        );
      }
    }

    // 4. Loa thông báo buổi sáng cho các trường hợp chết trong đêm (Công bố Tên + Vai trò, không lộ nguyên nhân Phù Thủy giết)
    if (deadVictims.length > 0) {
      const summaryText = nightDeathDetails.join(' | ');
      const title = punishedWolf
        ? '📢 LOA TRƯỜNG HỌC: SÓI CHẾT NGẪU NHIÊN & THÔNG BÁO VAI TRÒ'
        : '📢 LOA TRƯỜNG HỌC: ÁN MẠNG & CÔNG BỐ VAI TRÒ BUỔI SÁNG';
      const content = punishedWolf && deadVictims.length === 1
        ? `Reng reng reng! Đêm qua bầy Ma Sói không chủ động cắn học sinh nào! Theo luật nguyền, 1 Ma Sói đã bị chết ngẫu nhiên: ${summaryText}!`
        : `Reng reng reng! Trời đã sáng! Danh sách học sinh tử nạn đêm qua và vai trò thực sự: ${summaryText}!`;

      this.sendAnnouncement({
        id: `death_${this.nightNumber}_${Date.now()}`,
        title,
        content,
        type: 'death',
        timestamp: Date.now(),
      });

      for (const victim of deadVictims) {
        if (victim.role === 'HUNTER') {
          this.triggerHunterDeath(victim.id);
        }
      }
    } else {
      this.sendAnnouncement({
        id: `peace_${this.nightNumber}`,
        title: 'LOA TRƯỜNG HỌC: BÌNH MINH',
        content: 'Trời đã sáng! Đêm qua trôi qua trong bình yên, không có ai tử nạn! Mời mọi người tập trung thảo luận.',
        type: 'info',
        timestamp: Date.now(),
      });
    }

    this.checkWinCondition();
  }

  public triggerHunterDeath(hunterId: string): void {
    const hunter = this.players.get(hunterId);
    if (!hunter) return;

    this.pendingHunterId = hunterId;

    // QUY TẮC: Trường hợp Thợ Săn bắn không thông báo chung trên Loa, chỉ người bị bắn chết mới biết lý do!
    if (hunter.isBot) {
      // Bot Thợ Săn tự động nổ súng bắn ngẫu nhiên 1 người
      const targets = Array.from(this.players.values()).filter((p) => p.isAlive && p.id !== hunterId);
      if (targets.length > 0) {
        const shootTarget = targets[Math.floor(Math.random() * targets.length)];
        this.handleHunterShoot(hunterId, shootTarget.id);
      }
    } else if (this.onHunterPrompt) {
      this.onHunterPrompt(hunterId, { reason: 'werewolf' });
    }
  }

  public handleHunterShoot(hunterId: string, targetId: string | null): boolean {
    if (this.pendingHunterId !== hunterId) return false;
    this.pendingHunterId = null;

    if (!targetId) {
      this.checkWinCondition();
      return true;
    }

    const hunter = this.players.get(hunterId);
    const target = this.players.get(targetId);
    if (!target || !target.isAlive) return false;

    target.hp = 0;
    target.isAlive = false;
    // Chỉ người bị Thợ Săn bắn mới nhận được lý do bị die này trên màn hình của họ, Loa KHÔNG thông báo chung!
    target.deathReason = `💥 Bị Thợ Săn [${hunter ? hunter.name : 'Thợ Săn'}] nổ súng bắn hạ kéo theo khi chết!`;
    console.log(`[GameManager] Thợ Săn ${hunter?.name} đã bắn hạ ${target.name} (chỉ người chết biết lý do)!`);

    this.checkWinCondition();
    return true;
  }

  public handleSeerCheck(seerId: string, targetId: string): SeerResultPayload | null {
    if (this.currentPhase !== GAME_PHASE.NIGHT) return null;

    const seer = this.players.get(seerId);
    if (!seer || !seer.isAlive || seer.role !== 'SEER') return null;

    if (this.seerCheckedThisNight) return null;
    this.seerCheckedThisNight = true;

    const target = this.players.get(targetId);
    if (!target) return null;

    console.log(`[GameManager] Tiên Tri ${seer.name} soi ${target.name} (${target.role})`);

    return {
      targetPlayerId: target.id,
      targetPlayerName: target.name,
      role: target.role,
      isWerewolf: target.role === 'WEREWOLF',
    };
  }

  /**
   * Lệnh Cheat: Cho phép người chơi "gibel" hoặc admin đổi vai trò tức thì để test tính năng
   */
  public forceSetPlayerRole(playerId: string, targetRole: PlayerRole): { success: boolean; role: PlayerRole; message: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, role: 'VILLAGER', message: 'Không tìm thấy người chơi!' };

    const oldRole = player.role;
    player.role = targetRole;

    if (targetRole === 'WITCH') {
      this.witchPotions.set(playerId, { heal: true, poison: true });
    }

    console.log(`[Cheat Gibel] Đổi vai trò của ${player.name} (${playerId}) từ ${oldRole} -> ${targetRole}`);
    return {
      success: true,
      role: targetRole,
      message: `Đã đổi chức năng của [${player.name}] thành ${targetRole}!`,
    };
  }

  public handleBodyguardProtect(
    bodyguardId: string,
    targetId: string | null
  ): { success: boolean; message: string; protectedId?: string | null; protectedName?: string } {
    if (this.currentPhase !== GAME_PHASE.NIGHT) {
      return { success: false, message: 'Chỉ có thể bảo vệ trong ban đêm!' };
    }

    const bg = this.players.get(bodyguardId);
    if (!bg || !bg.isAlive || (bg.role !== 'BODYGUARD' && bg.role !== 'DOCTOR')) {
      return { success: false, message: 'Bạn không phải Bảo Vệ/Bác Sĩ hoặc đã chết!' };
    }

    if (this.bodyguardActedThisNight) {
      return { success: false, message: 'Bạn đã thiết lập khiên bảo vệ trong đêm nay rồi!' };
    }

    const roleTitle = bg.role === 'DOCTOR' ? 'Bác Sĩ' : 'Bảo Vệ';

    if (!targetId) {
      this.bodyguardActedThisNight = true;
      this.nightProtectTarget = null;
      return {
        success: true,
        protectedId: null,
        message: `Bạn đã chọn không bảo vệ ai trong đêm nay.`,
      };
    }

    const lastTarget = this.bodyguardLastTarget.get(bodyguardId);
    if (lastTarget && lastTarget === targetId) {
      return { success: false, message: `Không thể bảo vệ cùng một người trong hai đêm liên tiếp! Hãy chọn người khác.` };
    }

    const target = this.players.get(targetId);
    if (!target || !target.isAlive) {
      return { success: false, message: 'Mục tiêu không hợp lệ hoặc đã chết!' };
    }

    this.bodyguardActedThisNight = true;
    this.nightProtectTarget = target.id;
    console.log(`[GameManager] ${roleTitle} ${bg.name} bảo vệ ${target.name}`);

    return {
      success: true,
      protectedId: target.id,
      protectedName: target.name,
      message: `🛡️ Đã thiết lập khiên bảo vệ an toàn cho học sinh [${target.name}] trong đêm nay!`,
    };
  }

  public handleWitchAction(
    witchId: string,
    action: { useHeal: boolean; poisonTargetId?: string | null }
  ): { success: boolean; message: string } {
    if (this.currentPhase !== GAME_PHASE.NIGHT) {
      return { success: false, message: 'Chỉ có thể dùng thuốc trong ban đêm!' };
    }

    const witch = this.players.get(witchId);
    if (!witch || !witch.isAlive || witch.role !== 'WITCH') {
      return { success: false, message: 'Bạn không phải Phù Thủy hoặc đã chết!' };
    }

    const potions = this.witchPotions.get(witchId) || { heal: true, poison: true };

    if (action.useHeal) {
      if (!potions.heal) return { success: false, message: 'Bạn đã dùng hết bình cứu!' };
      this.nightHealedByWitch = true;
      potions.heal = false;
      console.log(`[GameManager] Phù Thủy ${witch.name} đã dùng bình cứu nạn nhân!`);
    }

    if (action.poisonTargetId) {
      if (!potions.poison) return { success: false, message: 'Bạn đã dùng hết bình độc!' };
      const pTarget = this.players.get(action.poisonTargetId);
      if (pTarget && pTarget.isAlive) {
        this.nightPoisonTarget = pTarget.id;
        potions.poison = false;
        console.log(`[GameManager] Phù Thủy ${witch.name} đã đầu độc ${pTarget.name}!`);
      }
    }

    this.witchPotions.set(witchId, potions);
    return { success: true, message: 'Hành động dùng thuốc của Phù Thủy đã được ghi nhận!' };
  }

  public handleWerewolfKill(actorId: string, targetId: string): { success: boolean; message: string; consensus?: boolean } {
    if (this.currentPhase !== GAME_PHASE.NIGHT) {
      return { success: false, message: 'Chỉ có thể săn mồi vào ban đêm!' };
    }

    const actor = this.players.get(actorId);
    if (!actor || !actor.isAlive || actor.role !== 'WEREWOLF') {
      return { success: false, message: 'Chỉ Ma Sói mới có thể cắn người!' };
    }

    const target = this.players.get(targetId);
    if (!target || !target.isAlive) {
      return { success: false, message: 'Mục tiêu không hợp lệ hoặc đã chết!' };
    }

    if (target.role === 'WEREWOLF') {
      return { success: false, message: 'Không thể cắn đồng loại Ma Sói!' };
    }

    // Ghi nhận vote của con Sói này
    this.werewolfVotes.set(actorId, target.id);

    // Tự động đồng bộ các Bot Sói trong bầy cùng vote cho mục tiêu này
    const wolfBots = Array.from(this.players.values()).filter((p) => p.isAlive && p.isBot && p.role === 'WEREWOLF');
    for (const wb of wolfBots) {
      this.werewolfVotes.set(wb.id, target.id);
    }

    // Danh sách toàn bộ Ma Sói còn sống
    const aliveWolves = Array.from(this.players.values()).filter((p) => p.isAlive && p.role === 'WEREWOLF');
    const totalWolves = aliveWolves.length;

    // Đếm số Sói đã vote cho target này
    const votesForTarget = aliveWolves.filter((w) => this.werewolfVotes.get(w.id) === target.id).length;
    const hasConsensus = votesForTarget === totalWolves;

    // Kiểm tra xem có ít nhất 1 Sói đứng cạnh con mồi (<= 4.5m)
    const wolfNearTarget = aliveWolves.find((w) => {
      const dist = Math.hypot(w.position.x - target.position.x, w.position.z - target.position.z);
      return dist <= GAME_CONFIG.ACTION_RANGE;
    });

    // 1. Chưa đủ 100% Sói cùng vote
    if (!hasConsensus) {
      if (this.onWolfVoteUpdate) this.onWolfVoteUpdate(this.getWerewolfVoteStatus());
      return {
        success: false,
        consensus: false,
        message: `🐺 Bạn đã vote cắn [${target.name}]. Đồng thuận bầy Sói: ${votesForTarget}/${totalWolves} phiếu. Cần tất cả Sói cùng chọn con mồi này!`,
      };
    }

    // 2. Toàn bộ Sói đã cùng vote nhưng chưa có con Sói nào đứng cạnh con mồi
    if (!wolfNearTarget) {
      if (this.onWolfVoteUpdate) this.onWolfVoteUpdate(this.getWerewolfVoteStatus());
      return {
        success: false,
        consensus: true,
        message: `⚠️ Bầy Sói đã thống nhất (${votesForTarget}/${totalWolves}) cắn [${target.name}]! Nhưng cần ít nhất 1 Sói áp sát con mồi trong phạm vi ${GAME_CONFIG.ACTION_RANGE}m để cắn!`,
      };
    }

    // CẢ 2 ĐIỀU KIỆN ĐẠT: Toàn bộ Sói thống nhất + Có Sói đứng cạnh!
    const isFirstKillConfirm = this.nightKillTarget !== target.id;
    this.nightKillTarget = target.id;
    console.log(`[GameManager] Bầy Sói (${totalWolves}/${totalWolves}) đã thống nhất và Sói ${wolfNearTarget.name} đã cắn ${target.name}!`);

    // Báo cho Phù Thủy ngay lập tức (Bot Phù Thủy vẫn cứu bình thường như trước đó)
    if (isFirstKillConfirm) {
      for (const [id, p] of this.players.entries()) {
        if (p.isAlive && p.role === 'WITCH') {
          const pots = this.witchPotions.get(id) || { heal: true, poison: true };
          if (p.isBot) {
            if (pots.heal && Math.random() < 0.2) {
              this.nightHealedByWitch = true;
              pots.heal = false;
              this.witchPotions.set(id, pots);
              console.log(`[GameManager] Bot Phù Thủy đã dùng bình cứu hồi sinh ${target.name}!`);
            }
          } else if (this.onWitchPrompt) {
            this.onWitchPrompt(id, {
              victimId: target.id,
              victimName: target.name,
              hasHealPotion: pots.heal,
              hasPoisonPotion: pots.poison,
            });
          }
        }
      }
    }

    if (this.onWolfVoteUpdate) {
      this.onWolfVoteUpdate(this.getWerewolfVoteStatus());
    }

    return {
      success: true,
      consensus: true,
      message: `🩸 Thành công! Sói [${wolfNearTarget.name}] đã áp sát và cắn xé học sinh [${target.name}] theo lệnh bầy Sói!`,
    };
  }

  public getWerewolfVoteStatus(): {
    targetName: string | null;
    votesForTarget: number;
    totalWolves: number;
    hasConsensus: boolean;
    hasWolfNearby: boolean;
    isKillSuccessful: boolean;
    wolfVotes: { wolfName: string; targetName: string }[];
  } {
    const aliveWolves = Array.from(this.players.values()).filter((p) => p.isAlive && p.role === 'WEREWOLF');
    const totalWolves = aliveWolves.length;

    const targetCounts = new Map<string, number>();
    for (const w of aliveWolves) {
      const tid = this.werewolfVotes.get(w.id);
      if (tid) {
        targetCounts.set(tid, (targetCounts.get(tid) || 0) + 1);
      }
    }

    let topTargetId: string | null = null;
    let maxVotes = 0;
    for (const [tid, count] of targetCounts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        topTargetId = tid;
      }
    }

    const topTarget = topTargetId ? this.players.get(topTargetId) : null;
    const hasConsensus = maxVotes === totalWolves && totalWolves > 0;

    let hasWolfNearby = false;
    if (topTarget) {
      hasWolfNearby = aliveWolves.some((w) => {
        const dist = Math.hypot(w.position.x - topTarget.position.x, w.position.z - topTarget.position.z);
        return dist <= GAME_CONFIG.ACTION_RANGE;
      });
    }

    const wolfVotesList = aliveWolves.map((w) => {
      const tid = this.werewolfVotes.get(w.id);
      const targetP = tid ? this.players.get(tid) : null;
      return {
        wolfName: w.name,
        targetName: targetP ? targetP.name : 'Chưa vote',
      };
    });

    return {
      targetName: topTarget ? topTarget.name : null,
      votesForTarget: maxVotes,
      totalWolves,
      hasConsensus,
      hasWolfNearby,
      isKillSuccessful: this.nightKillTarget !== null,
      wolfVotes: wolfVotesList,
    };
  }

  public castVote(voterId: string, targetId: string | null): boolean {
    if (this.currentPhase !== GAME_PHASE.DAY_VOTING) return false;

    const voter = this.players.get(voterId);
    if (!voter || !voter.isAlive) return false;

    // QUY TẮC: MỖI NGƯỜI CHỈ ĐƯỢC BỎ PHIẾU 1 LẦN DUY NHẤT TRONG PHIÊN
    if (this.votes.has(voterId)) {
      console.log(`[GameManager] ${voter.name} đã bỏ phiếu rồi, không được phép thay đổi hoặc bỏ phiếu lần 2!`);
      return false;
    }

    this.votes.set(voterId, targetId || 'skip');
    console.log(`[GameManager] ${voter.name} đã vote cho: ${targetId || 'Bỏ phiếu trắng'}`);

    const voteCounts = new Map<string, number>();
    for (const tid of this.votes.values()) {
      if (tid && tid !== 'skip') {
        voteCounts.set(tid, (voteCounts.get(tid) || 0) + 1);
      }
    }
    for (const p of this.players.values()) {
      p.votesReceived = voteCounts.get(p.id) || 0;
    }

    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    const aliveHumans = alivePlayers.filter((p) => !p.isBot);

    // Nếu toàn bộ người chơi thật còn sống đã vote xong -> Cho các Bot còn lại vote ngay để chốt kết quả
    if (!voter.isBot && aliveHumans.every((h) => this.votes.has(h.id))) {
      this.triggerBotVotes(targetId && targetId !== 'skip' ? targetId : null);
      return true;
    }

    // Nếu toàn bộ người chơi còn sống đã bỏ phiếu xong -> Tổng kết phiếu treo cổ ngay lập tức
    if (alivePlayers.every((p) => this.votes.has(p.id)) && this.currentPhase === GAME_PHASE.DAY_VOTING) {
      this.resolveVotes();
    }

    return true;
  }

  private resolveVotes(): void {
    const voteCounts = new Map<string, number>();
    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    const totalAlive = alivePlayers.length;
    const requiredVotes = totalAlive <= 2 ? 1 : Math.floor(totalAlive / 2) + 1;

    for (const targetId of this.votes.values()) {
      if (targetId && targetId !== 'skip') {
        voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
      }
    }

    for (const [id, count] of voteCounts.entries()) {
      const p = this.players.get(id);
      if (p) p.votesReceived = count;
    }

    let highestVotes = 0;
    let targetWithHighest: string | null = null;
    let isTie = false;

    for (const [targetId, count] of voteCounts.entries()) {
      if (count > highestVotes) {
        highestVotes = count;
        targetWithHighest = targetId;
        isTie = false;
      } else if (count === highestVotes) {
        isTie = true;
      }
    }

    if (targetWithHighest && !isTie && highestVotes >= requiredVotes) {
      const eliminated = this.players.get(targetWithHighest);
      if (eliminated && eliminated.isAlive) {
        eliminated.hp = 0;
        eliminated.isAlive = false;
        eliminated.deathReason = `⚖️ Bị toàn trường bỏ phiếu biểu quyết TREO CỔ (${highestVotes}/${totalAlive} phiếu)!`;

        const roleText = ROLE_NAMES_VI[eliminated.role] || eliminated.role;

        this.sendAnnouncement({
          id: `lynch_${Date.now()}`,
          title: '⚖️ LOA TRƯỜNG HỌC: KẾT QUẢ BỎ PHIẾU TREO CỔ',
          content: `Đã đủ phiếu biểu quyết! Nhân vật ${eliminated.name} nhận số phiếu ${highestVotes}/${totalAlive} và đã bị TREO CỔ! Vai trò thực sự là: ${roleText}!`,
          type: 'death',
          timestamp: Date.now(),
        });

        if (eliminated.role === 'HUNTER') {
          this.triggerHunterDeath(eliminated.id);
        }
      }
    } else {
      const topPlayer = targetWithHighest ? this.players.get(targetWithHighest) : null;
      this.sendAnnouncement({
        id: `tie_${Date.now()}`,
        title: '⚖️ LOA TRƯỜNG HỌC: KẾT QUẢ BỎ PHIẾU',
        content: isTie
          ? `Số phiếu bị hòa nhau (${highestVotes}/${totalAlive} phiếu)! Không ai bị treo cổ trong ngày hôm nay.`
          : topPlayer
            ? `Nhân vật ${topPlayer.name} chỉ có ${highestVotes}/${totalAlive} phiếu (cần tối thiểu ${requiredVotes}/${totalAlive} phiếu để treo cổ). Không ai bị xử phạt!`
            : `Không có đủ phiếu biểu quyết (0/${totalAlive} phiếu), không ai bị treo cổ hôm nay.`,
        type: 'info',
        timestamp: Date.now(),
      });
    }

    if (this.checkWinCondition()) return;

    this.setPhase(GAME_PHASE.DAY_HIDING);
  }

  private checkWinCondition(): boolean {
    const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);
    const aliveWerewolves = alivePlayers.filter((p) => p.role === 'WEREWOLF').length;
    const aliveVillagers = alivePlayers.filter((p) => p.role !== 'WEREWOLF').length;

    if (this.players.size < 1) return false;
    if (this.currentPhase === GAME_PHASE.LOBBY) return false;

    if (aliveWerewolves === 0) {
      this.winner = 'VILLAGERS';
      this.currentPhase = GAME_PHASE.GAME_OVER;
      this.sendAnnouncement({
        id: `gameover_${Date.now()}`,
        title: '🏆 PHE HỌC SINH & DÂN LÀNG CHIẾN THẮNG!',
        content: 'Toàn bộ Ma Sói đã bị loại bỏ khỏi trường học! Ngôi trường đã được giải thoát khỏi lời nguyền bóng tối.',
        type: 'bell',
        timestamp: Date.now(),
      });
      if (this.onGameOver) this.onGameOver('VILLAGERS');
      return true;
    }

    // Phe Sói thắng khi: Toàn bộ dân làng chết HẾT, HOẶC số Sói áp đảo dân làng (khi trận đấu đủ đông >= 3 người)
    if (aliveVillagers === 0 || (aliveWerewolves >= aliveVillagers && alivePlayers.length > 2)) {
      this.winner = 'WEREWOLF';
      this.currentPhase = GAME_PHASE.GAME_OVER;
      this.sendAnnouncement({
        id: `gameover_${Date.now()}`,
        title: '🐺 PHE MA SÓI CHIẾN THẮNG!',
        content: 'Số lượng Ma Sói đã hoàn toàn áp đảo phe học sinh! Toàn bộ ngôi trường đã bị ma sói nuốt chửng.',
        type: 'bell',
        timestamp: Date.now(),
      });
      if (this.onGameOver) this.onGameOver('WEREWOLF');
      return true;
    }

    return false;
  }

  public sendAnnouncement(announcement: AnnouncementMessage): void {
    if (this.onAnnouncement) {
      this.onAnnouncement(announcement);
    }
  }

  public tick(dt: number): void {
    // 1. Quản lý phase
    if (this.currentPhase !== GAME_PHASE.LOBBY && this.currentPhase !== GAME_PHASE.GAME_OVER) {
      this.phaseTimer -= dt;

      if (this.phaseTimer <= 0) {
        switch (this.currentPhase) {
          case GAME_PHASE.DAY_HIDING:
            this.nightNumber++;
            this.setPhase(GAME_PHASE.NIGHT);
            break;

          case GAME_PHASE.NIGHT:
            this.setPhase(GAME_PHASE.DAY_DISCUSSION);
            break;

          case GAME_PHASE.DAY_DISCUSSION:
            this.setPhase(GAME_PHASE.DAY_VOTING);
            break;

          case GAME_PHASE.DAY_VOTING:
            this.resolveVotes();
            break;
        }
      }
    }

    // 2. Xử lý Bot AI mượt mà
    this.processBotAI(dt);

    // 3. Kết giới Check (500m)
    for (const player of this.players.values()) {
      if (!player.isAlive) continue;

      const distFromCenter = Math.hypot(
        player.position.x - this.barrierCenter.x,
        player.position.z - this.barrierCenter.z
      );

      const isOutside = distFromCenter > this.barrierRadius;
      player.isOutsideBarrier = isOutside;

      if (isOutside) {
        const damage = GAME_CONFIG.BARRIER_DPS * dt;
        player.hp = Math.max(0, player.hp - damage);

        if (player.hp <= 0) {
          player.hp = 0;
          player.isAlive = false;
          player.deathReason = '🔮 Bị rút cạn sinh lực (-10 HP/giây) do đứng ngoài Vòng Kết Giới 300m!';
          console.log(`[GameManager] Học sinh ${player.name} (${player.id}) đã chết ngoài kết giới!`);
          if (player.role === 'HUNTER') {
            this.triggerHunterDeath(player.id);
          }
          this.checkWinCondition();
        }
      }
    }
  }

  public getRoomInfo(): RoomInfo {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      hostId: this.hostId,
      mode: this.mode,
      targetCount: this.targetCount,
      playerCount: this.players.size,
      isBotMode: this.isBotMode,
      phase: this.currentPhase,
    };
  }

  public getGameState(): GameStatePayload {
    const votesGrouped: { [targetId: string]: string[] } = {};
    for (const [voterId, targetId] of this.votes.entries()) {
      if (!votesGrouped[targetId]) votesGrouped[targetId] = [];
      votesGrouped[targetId].push(voterId);
    }

    return {
      phase: this.currentPhase,
      phaseTimeRemaining: Math.max(0, Math.ceil(this.phaseTimer)),
      nightNumber: this.nightNumber,
      players: Array.from(this.players.values()),
      serverTime: Date.now(),
      barrierRadius: this.barrierRadius,
      barrierCenter: this.barrierCenter,
      votes: votesGrouped,
      winner: this.winner,
      roomId: this.roomId,
      roomInfo: this.getRoomInfo(),
      doors: { ...this.doors },
    };
  }

  public getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  public getPlayerCount(): number {
    return this.players.size;
  }
}
