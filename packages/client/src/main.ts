import './style.css';
import { GameScene } from './game/GameScene';
import { NetworkManager } from './network/NetworkManager';
import { UIManager } from './ui/UIManager';
import { LiveKitVoiceManager } from './audio/LiveKitVoiceManager';

// 1. Khởi tạo UIManager & LiveKit Voice Manager
const uiManager = new UIManager();
const liveKitVoiceManager = new LiveKitVoiceManager();

// 2. Khởi tạo GameScene 3D Three.js
const container = document.getElementById('game-container')!;
const gameScene = new GameScene(container, uiManager);

// 3. Khởi tạo NetworkManager kết nối Socket.io
const networkManager = new NetworkManager({
  onSelfJoined: (self, initialState) => {
    if (initialState.roomId) {
      uiManager.setRoomId(initialState.roomId);
    }
    gameScene.setupLocalPlayer(self);
    gameScene.handleSyncState(initialState);
  },
  onPlayerJoined: (player) => {
    console.log(`[Game] Học sinh mới vào phòng: ${player.name}`);
    uiManager.addSystemChat(`${player.name} vừa bước vào trường học.`);
  },
  onSyncState: (state) => {
    if (state.roomId) {
      uiManager.setRoomId(state.roomId);
    }
    if (state.edition) {
      uiManager.setEdition(state.edition);
    }
    gameScene.handleSyncState(state);
  },
  onPlayerLeft: (playerId) => {
    gameScene.removeRemotePlayer(playerId);
  },
  onRespawn: (player) => {
    gameScene.handleRespawn(player);
  },
  onConnectionChange: (connected) => {
    uiManager.updateConnectionStatus(connected);
  },
  onAnnouncement: (msg) => {
    uiManager.showAnnouncement(msg);
  },
  onPhaseChanged: (data) => {
    console.log('[Game] Phase đổi:', data.phase, 'Thời gian:', data.timeRemaining);
  },
  onChatMessage: (msg) => {
    uiManager.addChatMessage(msg);
  },
  onVoteUpdate: (votes) => {
    console.log('[Game] Cập nhật phiếu bầu:', votes);
  },
  onGameOver: (winner) => {
    uiManager.showGameOver(winner);
  },
  onSeerResult: (result) => {
    uiManager.showSeerResult(result);
  },
  onWitchPrompt: (prompt) => {
    uiManager.showWitchPrompt(prompt);
  },
  onHunterPrompt: (prompt) => {
    uiManager.showHunterPrompt(prompt);
  },
  onWolfVoteUpdate: (data) => {
    const localPlayer = gameScene.getLocalPlayer();
    const isNight = gameScene.getCurrentPhase() === 'NIGHT';
    const role = localPlayer ? localPlayer.role : 'VILLAGER';
    uiManager.updateWolfPackVotes(data, isNight, role);
    gameScene.setWolfPackTarget(data.targetName);
  },
  onVoiceData: (data) => {
    uiManager.soundManager.playIncomingVoice(data.samples, data.sampleRate);
  },
  onVoiceTokenReady: async (data) => {
    if (data.provider === 'livekit' && data.url && data.token) {
      console.log('[LiveKit WebRTC] Nhận Voice Token, đang kết nối...');
      const success = await liveKitVoiceManager.connect(data.url, data.token);
      if (success) {
        uiManager.soundManager.enableLiveKit(liveKitVoiceManager);
        uiManager.addSystemChat('🎙️ LiveKit WebRTC Voice Chat đã kích hoạt (Chuẩn âm thanh Opus, không rè, không trễ)!');
      }
    }
  },
});

uiManager.soundManager.onVoiceSamples = (samples, sampleRate) => {
  if (!uiManager.soundManager.isLiveKitActive) {
    networkManager.sendVoiceData(samples, sampleRate);
  }
};

gameScene.setNetworkManager(networkManager);

// 4. Kết nối các hành động từ UI lên Network
uiManager.setJoinHandler((nickname: string) => {
  networkManager.connect(nickname);
});

// Tạo phòng mới (chế độ 9-13 người hoặc 14-16 người)
uiManager.setCreateRoomHandler((payload) => {
  networkManager.createRoom(payload, (res) => {
    if (res && res.roomId) {
      uiManager.setRoomId(res.roomId);
      uiManager.addSystemChat(`Đã tạo phòng [${res.roomId}]: ${payload.roomName}. Bấm nút "MỜI" ở góc phải để sao chép link gửi cho bạn bè!`);
    }
  });
});

// Vào phòng có sẵn bằng mã phòng
uiManager.setJoinRoomHandler((roomId, name) => {
  networkManager.joinRoom(roomId, name, (res) => {
    if (res && res.roomId) {
      uiManager.setRoomId(res.roomId);
      uiManager.addSystemChat(`Đã vào phòng [${res.roomId}].`);
    }
  });
});

// Điều khiển Bot AI
uiManager.setFillBotsHandler((targetCount) => {
  networkManager.fillBots(targetCount);
});

uiManager.setAddBotHandler(() => {
  networkManager.addBot();
});

uiManager.setClearBotsHandler(() => {
  networkManager.clearBots();
});

// Lệnh Cheat đổi vai trò tức thì (gibel)
uiManager.setCheatRoleHandler((role) => {
  networkManager.cheatSetRole(role);
});

uiManager.setStartGameHandler(() => {
  networkManager.startGame();
});

// Đóng / Mở cửa phòng học 1 tầng
uiManager.setToggleDoorHandler((doorId) => {
  networkManager.sendToggleDoor(doorId);
});

// Sói cắn hoặc Bảo Vệ
uiManager.setActionTriggerHandler((targetId, actionType) => {
  networkManager.sendNightAction(targetId, actionType, (res) => {
    if (actionType === 'protect' && res) {
      uiManager.showBodyguardResult(res);
    }
    if (res && res.message) {
      uiManager.addSystemChat(res.message);
    }
  });
});

// Tiên Tri Soi Người
uiManager.setSeerActionHandler((targetId) => {
  networkManager.sendSeerCheck(targetId, (res) => {
    if (res) {
      uiManager.showSeerResult(res);
      uiManager.addSystemChat(`Bạn vừa soi học sinh [${res.targetPlayerName}]: Thân phận là ${res.isWerewolf ? 'MA SÓI' : 'NGƯỜI LÀNH'}.`, 'TIÊN TRI');
    }
  });
});

// Phù Thủy Dùng Thuốc
uiManager.setWitchActionHandler((useHeal, poisonTargetId) => {
  networkManager.sendWitchAction(useHeal, poisonTargetId, (res) => {
    if (res && res.message) {
      uiManager.addSystemChat(res.message, 'PHÙ THỦY');
    }
  });
});

// Thợ Săn Nổ Súng
uiManager.setHunterShootHandler((targetId) => {
  networkManager.sendHunterShoot(targetId, (res) => {
    if (res && res.success) {
      uiManager.addSystemChat('Phát súng của bạn đã được khai hỏa!', 'THỢ SĂN');
    }
  });
});

uiManager.setVoteHandler((targetId) => {
  networkManager.sendVote(targetId);
});

uiManager.setSendChatHandler((text) => {
  networkManager.sendChatMessage(text);
});

uiManager.setRespawnHandler(() => {
  networkManager.requestRespawn();
});
