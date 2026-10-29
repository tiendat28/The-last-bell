import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GameManager } from './GameManager';
import { createLiveKitToken } from './livekit';
import {
  SOCKET_EVENTS,
  PlayerMovePayload,
  ChatMessage,
  NightActionPayload,
  VotePayload,
  WitchActionPayload,
  HunterShootPayload,
  RoomCreatePayload,
  PlayerRole
} from '@sinh-ton/shared';

// Bảng tên hiển thị vai trò kèm icon trực quan
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  WEREWOLF: 'MA SÓI 🐺',
  SEER: 'TIÊN TRI 🔮',
  BODYGUARD: 'BẢO VỆ 🛡️',
  WITCH: 'PHÙ THỦY 🧙',
  DOCTOR: 'BÁC SĨ 🩺',
  HUNTER: 'THỢ SĂN 💥',
  VILLAGER: 'DÂN LÀNG 👤',
};

export function setupSocketHandlers(io: Server, roomManager: RoomManager) {
  // Gắn helper liên kết GameManager với Socket.io Room
  function bindGameManagerEvents(gm: GameManager) {
    if ((gm as any)._eventsBound) return;
    (gm as any)._eventsBound = true;

    gm.onAnnouncement = (msg) => {
      io.to(gm.roomId).emit(SOCKET_EVENTS.ANNOUNCEMENT, msg);
    };

    gm.onPhaseChange = (phase, timeRemaining) => {
      io.to(gm.roomId).emit(SOCKET_EVENTS.PHASE_CHANGED, { phase, timeRemaining });
      if (phase === 'NIGHT') {
        const wolfStatus = gm.getWerewolfVoteStatus();
        for (const p of gm.getGameState().players) {
          if (p.role === 'WEREWOLF') {
            io.to(p.id).emit(SOCKET_EVENTS.WOLF_VOTE_UPDATE, wolfStatus);
          }
        }
      }
    };

    gm.onGameOver = (winner) => {
      io.to(gm.roomId).emit(SOCKET_EVENTS.GAME_OVER, { winner });
    };

    gm.onWitchPrompt = (witchId, payload) => {
      io.to(witchId).emit(SOCKET_EVENTS.WITCH_PROMPT, payload);
    };

    gm.onHunterPrompt = (hunterId, payload) => {
      io.to(hunterId).emit(SOCKET_EVENTS.HUNTER_PROMPT, payload);
    };

    gm.onWolfVoteUpdate = (status) => {
      for (const p of gm.getGameState().players) {
        if (p.role === 'WEREWOLF') {
          io.to(p.id).emit(SOCKET_EVENTS.WOLF_VOTE_UPDATE, status);
        }
      }
    };
  }

  // Gắn event cho phòng sảnh chính
  const defaultRoom = roomManager.getRoom('SANH-CHINH');
  if (defaultRoom) bindGameManagerEvents(defaultRoom);

  io.on(SOCKET_EVENTS.CONNECT, (socket: Socket) => {
    console.log(`[Socket] Kết nối mới: ${socket.id}`);

    // Hàm tiện ích lấy phòng hiện tại của socket
    const getCurrentRoom = (): GameManager | undefined => {
      return roomManager.getRoomByPlayerId(socket.id);
    };

    // Hàm tiện ích rời toàn bộ phòng cũ trên Socket.IO (Ngăn chặn xung đột nhận 2 SYNC_STATE từ 2 phòng)
    const leaveAllGameRooms = () => {
      const prev = roomManager.removePlayer(socket.id);
      if (prev.roomId) {
        socket.leave(prev.roomId);
        socket.to(prev.roomId).emit(SOCKET_EVENTS.PLAYER_LEFT, { playerId: socket.id });
      }
      for (const r of socket.rooms) {
        if (r !== socket.id) {
          socket.leave(r);
        }
      }
    };

    // Helper gia nhập phòng chơi & đồng bộ trạng thái, tự động cấp token LiveKit WebRTC
    const enterRoom = async (
      gm: GameManager,
      playerName?: string,
      callback?: (res: any) => void
    ) => {
      leaveAllGameRooms();
      bindGameManagerEvents(gm);

      const player = gm.addPlayer(socket.id, playerName);
      roomManager.registerPlayerToRoom(socket.id, gm.roomId);
      socket.join(gm.roomId);

      if (callback) {
        callback({
          success: true,
          roomId: gm.roomId,
          self: player,
          state: gm.getGameState(),
        });
      }

      socket.emit(SOCKET_EVENTS.PLAYER_JOINED, {
        self: player,
        state: gm.getGameState(),
      });
      socket.to(gm.roomId).emit(SOCKET_EVENTS.PLAYER_JOINED, { player });
      io.to(gm.roomId).emit(SOCKET_EVENTS.SYNC_STATE, gm.getGameState());

      // Cung cấp token LiveKit nếu đã cấu hình
      createLiveKitToken(gm.roomId, socket.id, player.name).then((lkRes) => {
        if (lkRes) {
          socket.emit(SOCKET_EVENTS.VOICE_TOKEN_READY, {
            provider: 'livekit',
            url: lkRes.url,
            token: lkRes.token,
            roomId: gm.roomId,
          });
        }
      });

      return player;
    };

    // 1. Tạo phòng mới
    socket.on(SOCKET_EVENTS.CREATE_ROOM, async (payload: RoomCreatePayload, callback?: (res: any) => void) => {
      const gm = roomManager.createRoom(payload, undefined, socket.id);
      if (payload.enableBots) {
        gm.fillBotsToTarget(gm.targetCount);
      }
      await enterRoom(gm, payload.name, callback);
    });

    // 2. Tham gia phòng
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: { roomId: string; name: string }, callback?: (res: any) => void) => {
      const gm = roomManager.getRoom(payload.roomId) || roomManager.getRoom('SANH-CHINH');
      if (!gm) {
        if (callback) callback({ success: false, message: 'Không tìm thấy phòng!' });
        return;
      }
      await enterRoom(gm, payload.name, callback);
    });

    // 3. Kết nối mặc định (chỉ chạy khi không phải kết nối qua CreateRoom / JoinRoom)
    const skipAutoJoin = socket.handshake.query.skipAutoJoin === 'true';
    if (!skipAutoJoin) {
      const initialName = socket.handshake.query.name as string | undefined;
      const initialRoomId = (socket.handshake.query.roomId as string) || 'SANH-CHINH';
      const gm = roomManager.getRoom(initialRoomId) || roomManager.getRoom('SANH-CHINH');
      if (gm) {
        enterRoom(gm, initialName);
      }
    }

    // 4. Bắt đầu trận đấu
    socket.on(SOCKET_EVENTS.START_GAME, () => {
      const room = getCurrentRoom();
      if (!room) return;
      const started = room.startGame();
      if (started) {
        io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
      }
    });

    // 5. Thêm Bot AI vào phòng
    socket.on(SOCKET_EVENTS.FILL_BOTS, (payload: { targetCount: number }) => {
      const room = getCurrentRoom();
      if (!room) return;
      room.fillBotsToTarget(payload.targetCount || room.targetCount);
      io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
    });

    socket.on(SOCKET_EVENTS.ADD_BOT, () => {
      const room = getCurrentRoom();
      if (!room) return;
      room.addBot();
      io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
    });

    socket.on(SOCKET_EVENTS.CLEAR_BOTS, () => {
      const room = getCurrentRoom();
      if (!room) return;
      room.clearBots();
      io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
    });

    // 6. Cập nhật di chuyển
    socket.on(SOCKET_EVENTS.PLAYER_MOVE, (payload: PlayerMovePayload) => {
      const room = getCurrentRoom();
      if (room && payload && payload.position) {
        room.updatePlayerMove(socket.id, payload);
      }
    });

    // 7. Hành động ban đêm
    socket.on(SOCKET_EVENTS.NIGHT_ACTION, (payload: NightActionPayload, callback?: (res: any) => void) => {
      const room = getCurrentRoom();
      if (!room) return;
      let result = { success: false, message: 'Hành động không xác định!' };

      if (payload.actionType === 'kill' || payload.actionType === 'classic_wolf_vote') {
        result = room.handleWerewolfKill(socket.id, payload.targetPlayerId || null);
        // Gửi cập nhật trạng thái đồng thuận bầy Sói cho tất cả Ma Sói trong phòng
        const wolfStatus = room.getWerewolfVoteStatus();
        for (const p of room.getGameState().players) {
          if (p.role === 'WEREWOLF') {
            io.to(p.id).emit(SOCKET_EVENTS.WOLF_VOTE_UPDATE, wolfStatus);
          }
        }
      } else if (payload.actionType === 'protect') {
        result = room.handleBodyguardProtect(socket.id, payload.targetPlayerId || null);
      }
      if (callback) callback(result);
    });

    // Tiên Tri
    socket.on(SOCKET_EVENTS.SEER_ACTION, (payload: { targetPlayerId: string }, callback?: (res: any) => void) => {
      const room = getCurrentRoom();
      if (!room) return;
      const seerResult = room.handleSeerCheck(socket.id, payload.targetPlayerId);
      if (callback) callback(seerResult);
      if (seerResult) {
        socket.emit(SOCKET_EVENTS.SEER_RESULT, seerResult);
      }
    });

    // Phù Thủy
    socket.on(SOCKET_EVENTS.WITCH_ACTION, (payload: WitchActionPayload, callback?: (res: any) => void) => {
      const room = getCurrentRoom();
      if (!room) return;
      const result = room.handleWitchAction(socket.id, payload);
      if (callback) callback(result);
    });

    // Thợ Săn
    socket.on(SOCKET_EVENTS.HUNTER_SHOOT, (payload: HunterShootPayload, callback?: (res: any) => void) => {
      const room = getCurrentRoom();
      if (!room) return;
      const success = room.handleHunterShoot(socket.id, payload.targetPlayerId);
      if (callback) callback({ success });
      if (success) {
        io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
      }
    });

    // Bỏ phiếu
    socket.on(SOCKET_EVENTS.CAST_VOTE, (payload: VotePayload) => {
      const room = getCurrentRoom();
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player || !player.isAlive) {
        socket.emit(SOCKET_EVENTS.ANNOUNCEMENT, {
          id: `vote_err_${Date.now()}`,
          title: 'THÔNG BÁO',
          content: 'Bạn đã bị loại khỏi trận đấu, không thể tham gia bỏ phiếu!',
          type: 'warning',
          timestamp: Date.now(),
        });
        return;
      }
      room.castVote(socket.id, payload.votedPlayerId);
      io.to(room.roomId).emit(SOCKET_EVENTS.VOTE_UPDATE, room.getGameState().votes);
      io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
    });

    // Đóng / Mở cửa phòng học
    socket.on(SOCKET_EVENTS.TOGGLE_DOOR, (payload: { doorId: string }, callback?: (res: any) => void) => {
      const room = getCurrentRoom();
      if (!room || !payload?.doorId) return;
      const result = room.toggleDoor(socket.id, payload.doorId);
      if (callback) callback(result);
      if (result.success) {
        io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
      }
    });

    // Lệnh Cheat Đổi Vai Trò Trực Tiếp (Dành cho Tester / nhân vật "gibel")
    socket.on(SOCKET_EVENTS.CHEAT_SET_ROLE, (data: { role: any }) => {
      const room = getCurrentRoom();
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player) return;

      room.forceSetPlayerRole(player.id, data.role);
      const displayName = ROLE_DISPLAY_NAMES[data.role] || data.role;

      io.to(room.roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
        id: `cheat_${Date.now()}`,
        senderId: 'system',
        senderName: '⚡ HỆ THỐNG CHEAT',
        text: `Học sinh [${player.name}] đã kích hoạt lệnh chuyển chức năng thành: ${displayName}!`,
        timestamp: Date.now(),
        isSystem: true,
      });

      io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
    });

    // Chat
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data: { text: string }) => {
      const room = getCurrentRoom();
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player) return;

      const trimmedText = data.text ? data.text.trim() : '';
      if (!trimmedText) return;

      // Xử lý các câu lệnh chat đổi chức năng: /role <vai_tro> hoặc /gibel <vai_tro>
      if (trimmedText.startsWith('/') || trimmedText.toLowerCase().startsWith('gibel')) {
        const lower = trimmedText.toLowerCase();
        let targetRole: any = null;
        if (lower.includes('soi') || lower.includes('wolf')) targetRole = 'WEREWOLF';
        else if (lower.includes('tientri') || lower.includes('seer') || lower.includes('tri')) targetRole = 'SEER';
        else if (lower.includes('baove') || lower.includes('bodyguard') || lower.includes('ve')) targetRole = 'BODYGUARD';
        else if (lower.includes('phuthuy') || lower.includes('witch') || lower.includes('thuy')) targetRole = 'WITCH';
        else if (lower.includes('bacsi') || lower.includes('doctor')) targetRole = 'DOCTOR';
        else if (lower.includes('thosan') || lower.includes('hunter') || lower.includes('san')) targetRole = 'HUNTER';
        else if (lower.includes('dan') || lower.includes('villager')) targetRole = 'VILLAGER';

        if (targetRole) {
          room.forceSetPlayerRole(player.id, targetRole);
          const displayName = ROLE_DISPLAY_NAMES[targetRole] || targetRole;

          io.to(room.roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
            id: `cheat_${Date.now()}`,
            senderId: 'system',
            senderName: '⚡ HỆ THỐNG CHEAT',
            text: `Học sinh [${player.name}] đã dùng lệnh chuyển chức năng thành: ${displayName}!`,
            timestamp: Date.now(),
            isSystem: true,
          });

          io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, room.getGameState());
          return;
        }
      }

      const currentPhase = room.getGameState().phase;

      // QUY TẮC LOA MIC & TRÒ CHUYỆN:
      // 1. Người đã chết: Không được nói/nhắn vào hệ thống chung, chỉ nhắn riêng trong nhóm những người đã chết với nhau
      if (!player.isAlive) {
        const deadChatMsg: ChatMessage = {
          id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId: player.id,
          senderName: player.name,
          text: trimmedText,
          timestamp: Date.now(),
          isDead: true,
          role: player.role,
        };
        for (const [id, s] of io.sockets.sockets.entries()) {
          if (roomManager.getRoomByPlayerId(id)?.roomId !== room.roomId) continue;
          const recipient = room.getPlayer(id);
          if (recipient && !recipient.isAlive) {
            s.emit(SOCKET_EVENTS.CHAT_MESSAGE, deadChatMsg);
          }
        }
        return;
      }

      // 2. Khi đêm đến: Chỉ Ma Sói còn sống được bật Loa & Mic để trao đổi với nhau; người chơi khác bị tắt Loa & Mic
      if (currentPhase === 'NIGHT') {
        if (player.role !== 'WEREWOLF') {
          socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
            id: `mute_night_${Date.now()}`,
            senderId: 'system',
            senderName: 'HỆ THỐNG',
            text: '🔇 Ban đêm Loa & Mic của bạn đã bị tắt! Chỉ Ma Sói mới có thể trao đổi với nhau trong đêm.',
            timestamp: Date.now(),
            isSystem: true,
          });
          return;
        }

        const wolfChatMsg: ChatMessage = {
          id: `wolf_chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId: player.id,
          senderName: player.name,
          text: trimmedText,
          timestamp: Date.now(),
          isWolfChat: true,
          role: player.role,
        };
        for (const [id, s] of io.sockets.sockets.entries()) {
          if (roomManager.getRoomByPlayerId(id)?.roomId !== room.roomId) continue;
          const recipient = room.getPlayer(id);
          if (recipient && recipient.isAlive && recipient.role === 'WEREWOLF') {
            s.emit(SOCKET_EVENTS.CHAT_MESSAGE, wolfChatMsg);
          }
        }
        return;
      }

      // 3. Ban ngày / Sảnh chờ: Tất cả người chơi còn sống được bật Loa & Mic để thảo luận chung (người chết vẫn nghe/xem được)
      const chatMsg: ChatMessage = {
        id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: player.id,
        senderName: player.name,
        text: trimmedText,
        timestamp: Date.now(),
        isDead: false,
        role: player.role,
      };
      io.to(room.roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, chatMsg);
    });

    // Truyền giọng nói (Voice Mic / Loa thời gian thực theo quy tắc Ngày / Đêm / Sống / Chết)
    socket.on(SOCKET_EVENTS.VOICE_DATA, (data: { samples: number[]; sampleRate: number }) => {
      const room = getCurrentRoom();
      if (!room || !data || !Array.isArray(data.samples)) return;
      const player = room.getPlayer(socket.id);
      // Người đã chết chỉ nghe được, không được nói vào hệ thống chung
      if (!player || !player.isAlive) return;

      const currentPhase = room.getGameState().phase;
      if (currentPhase === 'NIGHT') {
        // Ban đêm: Chỉ Sói được bật Mic & Loa để trao đổi với nhau, người chơi khác bị tắt Loa & Mic
        if (player.role !== 'WEREWOLF') return;
        for (const [id, s] of io.sockets.sockets.entries()) {
          if (id === socket.id) continue;
          if (roomManager.getRoomByPlayerId(id)?.roomId !== room.roomId) continue;
          const recipient = room.getPlayer(id);
          if (recipient && recipient.isAlive && recipient.role === 'WEREWOLF') {
            s.emit(SOCKET_EVENTS.VOICE_DATA, {
              senderId: player.id,
              senderName: player.name,
              samples: data.samples,
              sampleRate: data.sampleRate || 16000,
              isWolfChannel: true,
            });
          }
        }
      } else {
        // Ban ngày: Loa & Mic tất cả người chơi được bật để thảo luận (người chết vẫn nghe được)
        socket.to(room.roomId).emit(SOCKET_EVENTS.VOICE_DATA, {
          senderId: player.id,
          senderName: player.name,
          samples: data.samples,
          sampleRate: data.sampleRate || 16000,
          isWolfChannel: false,
        });
      }
    });

    // Yêu cầu cấp LiveKit Voice Token chủ động từ client
    socket.on(SOCKET_EVENTS.REQUEST_VOICE_TOKEN, async () => {
      const room = getCurrentRoom();
      if (!room) return;
      const player = room.getPlayer(socket.id);
      const name = player ? player.name : socket.id;
      const lkRes = await createLiveKitToken(room.roomId, socket.id, name);
      if (lkRes) {
        socket.emit(SOCKET_EVENTS.VOICE_TOKEN_READY, {
          provider: 'livekit',
          url: lkRes.url,
          token: lkRes.token,
          roomId: room.roomId,
        });
      } else {
        socket.emit(SOCKET_EVENTS.VOICE_TOKEN_READY, {
          provider: 'fallback_webaudio',
        });
      }
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason: string) => {
      console.log(`[Socket] Ngắt kết nối: ${socket.id} (lý do: ${reason})`);
      const { roomId } = roomManager.removePlayer(socket.id);
      if (roomId) {
        io.to(roomId).emit(SOCKET_EVENTS.PLAYER_LEFT, { playerId: socket.id });
      }
    });
  });
}
