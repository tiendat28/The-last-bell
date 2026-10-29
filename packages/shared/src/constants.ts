export const GAME_PHASE = {
  LOBBY: 'LOBBY',
  NIGHT: 'NIGHT',
  DAY_DISCUSSION: 'DAY_DISCUSSION',
  DAY_VOTING: 'DAY_VOTING',
  DAY_HIDING: 'DAY_HIDING',
  GAME_OVER: 'GAME_OVER',
} as const;

export type GamePhaseType = typeof GAME_PHASE[keyof typeof GAME_PHASE];

export const ROOM_MODES = {
  STANDARD_9_13: 'STANDARD_9_13', // 9 - 13 Người (3 Sói, 1 Tiên Tri, 1 Bảo Vệ, 1 Phù Thủy, 1 Thợ Săn, Dân Làng)
  LARGE_14_16: 'LARGE_14_16',     // 14 - 16 Người (4 Sói, 1 Tiên Tri, 1 Bảo Vệ, 1 Phù Thủy, 1 Thợ Săn, Dân Làng)
  CUSTOM: 'CUSTOM',
} as const;

export type RoomModeType = typeof ROOM_MODES[keyof typeof ROOM_MODES];

export const GAME_EDITIONS = {
  CLASSIC: 'CLASSIC',   // Bản Gốc: Ma Sói truyền thống, Sói thảo luận 45s & bỏ phiếu (>2/3), Phù thủy dùng sau khi Sói chốt
  SPINOFF: 'SPINOFF',   // Bản Ngoại Truyện: Sinh Tồn 3D di chuyển tự do, Sói hóa thú áp sát cắn trực tiếp
} as const;

export type GameEditionType = typeof GAME_EDITIONS[keyof typeof GAME_EDITIONS];

export const GAME_CONFIG = {
  SERVER_PORT: 3000,
  CLIENT_PORT: 5173,

  // Chế độ kiểm thử nhanh (Debug Mode: Đêm 90s, Ngày 60s, Vote 30s, Trốn 30s)
  DEBUG_MODE: true,

  // Thời lượng các giai đoạn (giây)
  PHASE_DURATIONS: {
    DEBUG: {
      NIGHT: 90,
      DAY_DISCUSSION: 60,
      DAY_VOTING: 30,
      DAY_HIDING: 30,
    },
    FULL: {
      NIGHT: 720, // 12 phút
      DAY_DISCUSSION: 600, // 10 phút
      DAY_VOTING: 60, // 1 phút
      DAY_HIDING: 180, // 3 phút
    },
  },

  // Thời gian riêng cho Bản Gốc (Classic Mode)
  CLASSIC_MODE: {
    WOLF_DISCUSSION_TIME: 45, // 45 giây để bầy Sói thảo luận & bỏ phiếu cắn
    WITCH_ACTION_TIME: 20,    // 20 giây để Phù Thủy quyết định dùng bình Cứu / Độc sau khi Sói chốt
    NIGHT_TOTAL_TIME: 65,     // Tổng thời gian Đêm Bản Gốc = 45s + 20s = 65s
  },

  // Game Loop
  TICK_RATE: 20, // 20 ticks per second
  TICK_INTERVAL_MS: 50, // 1000ms / 20 = 50ms

  // Kết giới (Barrier)
  BARRIER_RADIUS: 300, // Bán kính kết giới: 300 mét (co lại theo yêu cầu)
  BARRIER_DPS: 10, // Sát thương: 10 HP mỗi giây khi ở ngoài kết giới

  // Thông số người chơi
  PLAYER_MAX_HP: 100,
  PLAYER_SPEED: 14.0, // Tốc độ di chuyển mét / giây
  WEREWOLF_SPEED_BOOST: 1.2, // Sói chạy nhanh hơn 20%
  PLAYER_HEIGHT: 1.8,
  PLAYER_WIDTH: 0.8,

  // Phạm vi kỹ năng (Kill, Heal, Protect) và Tầm nhìn Sói ban đêm
  ACTION_RANGE: 4.5, // 4.5 mét
  WEREWOLF_VISION_RADIUS: 5.0, // Bán kính vùng sáng 5m quanh Sói trong đêm
  DOOR_INTERACT_RANGE: 3.8, // Khoảng cách đóng/mở cửa phòng (mét)

  // Kích thước bản đồ
  MAP_SIZE: 900,
} as const;

export const ROLE_NAMES_VI: Record<string, string> = {
  WEREWOLF: 'MA SÓI',
  VILLAGER: 'DÂN LÀNG (HỌC SINH)',
  SEER: 'TIÊN TRI',
  BODYGUARD: 'BẢO VỆ',
  WITCH: 'PHÙ THỦY',
  HUNTER: 'THỢ SĂN',
  DOCTOR: 'BÁC SĨ',
  SPECTATOR: 'KHÁN GIẢ',
};

export interface SchoolRoomDef {
  id: string;
  doorId: string;
  name: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  doorSide: 'S' | 'N' | 'E' | 'W';
  doorWidth: number;
  doorX: number;
  doorZ: number;
  type: 'classroom' | 'teacher' | 'storage' | 'clinic' | 'wc' | 'lab' | 'pool';
}

export const SCHOOL_ROOMS: SchoolRoomDef[] = [
  {
    id: 'room_1a',
    doorId: 'door_1a',
    name: 'Phòng Học 1A',
    cx: -44,
    cz: -36,
    w: 18,
    d: 14,
    doorSide: 'S',
    doorWidth: 3.4,
    doorX: -44,
    doorZ: -29,
    type: 'classroom',
  },
  {
    id: 'room_1b',
    doorId: 'door_1b',
    name: 'Phòng Học 1B',
    cx: -22,
    cz: -36,
    w: 18,
    d: 14,
    doorSide: 'S',
    doorWidth: 3.4,
    doorX: -22,
    doorZ: -29,
    type: 'classroom',
  },
  {
    id: 'room_1c',
    doorId: 'door_1c',
    name: 'Phòng Học 1C',
    cx: 0,
    cz: -36,
    w: 18,
    d: 14,
    doorSide: 'S',
    doorWidth: 3.4,
    doorX: 0,
    doorZ: -29,
    type: 'classroom',
  },
  {
    id: 'room_teacher',
    doorId: 'door_teacher',
    name: 'Phòng Giáo Viên',
    cx: 22,
    cz: -36,
    w: 18,
    d: 14,
    doorSide: 'S',
    doorWidth: 3.4,
    doorX: 22,
    doorZ: -29,
    type: 'teacher',
  },
  {
    id: 'room_storage',
    doorId: 'door_storage',
    name: 'Phòng Kho Đồ',
    cx: 44,
    cz: -36,
    w: 18,
    d: 14,
    doorSide: 'S',
    doorWidth: 3.4,
    doorX: 44,
    doorZ: -29,
    type: 'storage',
  },
  {
    id: 'room_clinic',
    doorId: 'door_clinic',
    name: 'Phòng Y Tế',
    cx: -44,
    cz: -8,
    w: 16,
    d: 14,
    doorSide: 'E',
    doorWidth: 3.4,
    doorX: -36,
    doorZ: -8,
    type: 'clinic',
  },
  {
    id: 'room_wc',
    doorId: 'door_wc',
    name: 'Nhà Vệ Sinh',
    cx: -44,
    cz: 12,
    w: 16,
    d: 14,
    doorSide: 'E',
    doorWidth: 3.4,
    doorX: -36,
    doorZ: 12,
    type: 'wc',
  },
  {
    id: 'room_lab',
    doorId: 'door_lab',
    name: 'Phòng Thí Nghiệm',
    cx: 44,
    cz: -8,
    w: 16,
    d: 14,
    doorSide: 'W',
    doorWidth: 3.4,
    doorX: 36,
    doorZ: -8,
    type: 'lab',
  },
  {
    id: 'room_pool',
    doorId: 'door_pool',
    name: 'Nhà Bể Bơi',
    cx: 46,
    cz: 16,
    w: 20,
    d: 18,
    doorSide: 'W',
    doorWidth: 3.4,
    doorX: 36,
    doorZ: 16,
    type: 'pool',
  },
];

export interface WallBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Tạo danh sách các hộp va chạm tường (và cửa đang đóng) của tất cả phòng học 1 tầng
 */
export function getSchoolWallBoxes(doors: Record<string, boolean> = {}): WallBox2D[] {
  const boxes: WallBox2D[] = [];
  const halfThick = 0.35;

  for (const r of SCHOOL_ROOMS) {
    const leftX = r.cx - r.w / 2;
    const rightX = r.cx + r.w / 2;
    const northZ = r.cz - r.d / 2;
    const southZ = r.cz + r.d / 2;
    const isDoorOpen = !!doors[r.doorId];
    const halfDoor = r.doorWidth / 2;

    // 1. Tường Bắc (North: z = northZ)
    if (r.doorSide === 'N' && isDoorOpen) {
      boxes.push({ minX: leftX, maxX: r.cx - halfDoor, minZ: northZ - halfThick, maxZ: northZ + halfThick });
      boxes.push({ minX: r.cx + halfDoor, maxX: rightX, minZ: northZ - halfThick, maxZ: northZ + halfThick });
    } else {
      boxes.push({ minX: leftX, maxX: rightX, minZ: northZ - halfThick, maxZ: northZ + halfThick });
    }

    // 2. Tường Nam (South: z = southZ)
    if (r.doorSide === 'S' && isDoorOpen) {
      boxes.push({ minX: leftX, maxX: r.cx - halfDoor, minZ: southZ - halfThick, maxZ: southZ + halfThick });
      boxes.push({ minX: r.cx + halfDoor, maxX: rightX, minZ: southZ - halfThick, maxZ: southZ + halfThick });
    } else {
      boxes.push({ minX: leftX, maxX: rightX, minZ: southZ - halfThick, maxZ: southZ + halfThick });
    }

    // 3. Tường Tây (West: x = leftX)
    if (r.doorSide === 'W' && isDoorOpen) {
      boxes.push({ minX: leftX - halfThick, maxX: leftX + halfThick, minZ: northZ, maxZ: r.cz - halfDoor });
      boxes.push({ minX: leftX - halfThick, maxX: leftX + halfThick, minZ: r.cz + halfDoor, maxZ: southZ });
    } else {
      boxes.push({ minX: leftX - halfThick, maxX: leftX + halfThick, minZ: northZ, maxZ: southZ });
    }

    // 4. Tường Đông (East: x = rightX)
    if (r.doorSide === 'E' && isDoorOpen) {
      boxes.push({ minX: rightX - halfThick, maxX: rightX + halfThick, minZ: northZ, maxZ: r.cz - halfDoor });
      boxes.push({ minX: rightX - halfThick, maxX: rightX + halfThick, minZ: r.cz + halfDoor, maxZ: southZ });
    } else {
      boxes.push({ minX: rightX - halfThick, maxX: rightX + halfThick, minZ: northZ, maxZ: southZ });
    }
  }

  return boxes;
}

/**
 * Giải quyết va chạm giữa nhân vật (bán kính radius) với tường phòng học & cửa đang đóng
 */
export function resolveRoomCollision(
  x: number,
  z: number,
  doors: Record<string, boolean> = {},
  radius: number = 0.5
): { x: number; z: number } {
  let outX = x;
  let outZ = z;
  const boxes = getSchoolWallBoxes(doors);

  for (const b of boxes) {
    const closestX = Math.max(b.minX, Math.min(outX, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(outZ, b.maxZ));
    const dx = outX - closestX;
    const dz = outZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = radius - dist;
        outX += (dx / dist) * overlap;
        outZ += (dz / dist) * overlap;
      } else {
        // Tâm nằm bên trong hộp mỏng -> đẩy theo trục ngắn nhất
        const penLeft = Math.abs(outX - b.minX);
        const penRight = Math.abs(b.maxX - outX);
        const penTop = Math.abs(outZ - b.minZ);
        const penBottom = Math.abs(b.maxZ - outZ);
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);
        if (minPen === penLeft) outX = b.minX - radius;
        else if (minPen === penRight) outX = b.maxX + radius;
        else if (minPen === penTop) outZ = b.minZ - radius;
        else outZ = b.maxZ + radius;
      }
    }
  }

  return { x: outX, z: outZ };
}

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  PLAYER_JOINED: 'player_joined',
  PLAYER_MOVE: 'player_move',
  SYNC_STATE: 'sync_state',
  PLAYER_LEFT: 'player_left',
  PLAYER_DAMAGED: 'player_damaged',
  PLAYER_RESPAWN: 'player_respawn',
  
  // Phòng chơi & Bot AI
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  ROOM_DATA: 'room_data',
  ADD_BOT: 'add_bot',
  FILL_BOTS: 'fill_bots',
  CLEAR_BOTS: 'clear_bots',

  // Tương tác Cửa Phòng Học
  TOGGLE_DOOR: 'toggle_door',

  // Ma Sói Học Đường & Quản trò Events
  START_GAME: 'start_game',
  PHASE_CHANGED: 'phase_changed',
  ANNOUNCEMENT: 'announcement',
  CHAT_MESSAGE: 'chat_message',
  VOICE_DATA: 'voice_data',
  REQUEST_VOICE_TOKEN: 'request_voice_token',
  VOICE_TOKEN_READY: 'voice_token_ready',
  NIGHT_ACTION: 'night_action',
  WOLF_VOTE_UPDATE: 'wolf_vote_update',
  CAST_VOTE: 'cast_vote',
  VOTE_UPDATE: 'vote_update',
  GAME_OVER: 'game_over',
  
  // Vai trò nâng cao (Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn)
  SEER_ACTION: 'seer_action',
  SEER_RESULT: 'seer_result',
  WITCH_PROMPT: 'witch_prompt',
  WITCH_ACTION: 'witch_action',
  HUNTER_PROMPT: 'hunter_prompt',
  HUNTER_SHOOT: 'hunter_shoot',

  // Lệnh cheat đổi vai trò tức thì cho người dùng test (nhân vật "gibel")
  CHEAT_SET_ROLE: 'cheat_set_role',
} as const;
