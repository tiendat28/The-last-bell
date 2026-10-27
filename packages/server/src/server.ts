import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { GAME_CONFIG, SOCKET_EVENTS } from '@sinh-ton/shared';
import { RoomManager } from './RoomManager';
import { setupSocketHandlers } from './socketHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();

app.get('/health', (_req, res) => {
  const rooms = roomManager.getAllRooms();
  res.json({
    status: 'ok',
    game: 'Sinh Ton 3D - Multi-Room & Bot AI',
    activeRooms: rooms.length,
    tickRate: GAME_CONFIG.TICK_RATE,
    barrierRadius: GAME_CONFIG.BARRIER_RADIUS,
    rooms: rooms.map((r) => r.getRoomInfo()),
  });
});

// Phục vụ sẵn bản build Frontend (packages/client/dist) nếu chạy Full-stack trên Render/Railway
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io, roomManager);

// Authoritative Game Loop cho tất cả các phòng (20 Ticks/giây)
const dt = GAME_CONFIG.TICK_INTERVAL_MS / 1000;
setInterval(() => {
  const rooms = roomManager.getAllRooms();
  for (const room of rooms) {
    if (room.getPlayerCount() === 0) continue;
    room.tick(dt);
    const gameState = room.getGameState();
    io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, gameState);
  }
}, GAME_CONFIG.TICK_INTERVAL_MS);

const PORT = Number(process.env.PORT) || GAME_CONFIG.SERVER_PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🎮 [Sinh Tồn Server] Đang chạy tại port: ${PORT}`);
  console.log(`⏱️ Tick Rate: ${GAME_CONFIG.TICK_RATE} ticks/giây (${GAME_CONFIG.TICK_INTERVAL_MS}ms)`);
  console.log(`🔮 Bán kính Kết giới: ${GAME_CONFIG.BARRIER_RADIUS}m`);
  console.log(`=================================================`);
});
