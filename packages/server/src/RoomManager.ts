import { GameManager } from './GameManager';
import { RoomModeType, ROOM_MODES, RoomCreatePayload } from '@sinh-ton/shared';

export class RoomManager {
  private rooms: Map<string, GameManager> = new Map();
  private playerRoomMap: Map<string, string> = new Map();

  constructor() {
    // Tạo sẵn phòng mặc định
    this.createRoom({
      name: 'Host',
      roomName: 'Sảnh Trường Học Chính',
      mode: ROOM_MODES.STANDARD_9_13,
      targetCount: 10,
      enableBots: false,
    }, 'SANH-CHINH');
  }

  public createRoom(payload: RoomCreatePayload, customRoomId?: string, hostSocketId: string = ''): GameManager {
    const roomId = customRoomId || `ROOM-${Math.floor(1000 + Math.random() * 9000)}`;
    const gm = new GameManager(roomId, payload.roomName || `Phòng #${roomId}`, hostSocketId);
    gm.mode = payload.mode || ROOM_MODES.STANDARD_9_13;
    gm.targetCount = payload.targetCount || 10;
    gm.isBotMode = payload.enableBots || false;

    this.rooms.set(roomId, gm);
    console.log(`[RoomManager] Tạo phòng mới: ${roomId} (${gm.roomName}), Chế độ: ${gm.mode}, Mục tiêu: ${gm.targetCount} người`);
    return gm;
  }

  public getRoom(roomId: string): GameManager | undefined {
    return this.rooms.get(roomId);
  }

  public getRoomByPlayerId(socketId: string): GameManager | undefined {
    const roomId = this.playerRoomMap.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  public registerPlayerToRoom(socketId: string, roomId: string): void {
    this.playerRoomMap.set(socketId, roomId);
  }

  public removePlayer(socketId: string): { roomId?: string; gm?: GameManager } {
    const roomId = this.playerRoomMap.get(socketId);
    if (!roomId) return {};

    this.playerRoomMap.delete(socketId);
    const gm = this.rooms.get(roomId);
    if (gm) {
      gm.removePlayer(socketId);
      // Nếu phòng không còn ai và không phải sảnh chính thì có thể dọn dẹp
      if (gm.getPlayerCount() === 0 && roomId !== 'SANH-CHINH') {
        this.rooms.delete(roomId);
        console.log(`[RoomManager] Đã đóng phòng rỗng: ${roomId}`);
      }
    }
    return { roomId, gm };
  }

  public getAllRooms(): GameManager[] {
    return Array.from(this.rooms.values());
  }
}
