import { GAME_CONFIG, Vector3D, PlayerRole, SCHOOL_ROOMS } from '@sinh-ton/shared';

export interface MinimapPlayer {
  id: string;
  name?: string;
  position: Vector3D;
  rotationY: number;
  isAlive: boolean;
  role: PlayerRole;
  isLocal: boolean;
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private elAreaName: HTMLElement;
  private lastAreaName: string = '';
  private readonly MAP_RADIUS = 85; // Bán kính hiển thị rõ nét toàn bộ các phòng học 1 tầng

  constructor() {
    this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.elAreaName = document.getElementById('minimap-area-name')!;
  }

  /**
   * Xác định tên phòng học / khu vực hiện tại dựa trên tọa độ
   */
  public detectAreaName(pos: Vector3D): string {
    const dist = Math.hypot(pos.x, pos.z);
    if (dist > GAME_CONFIG.BARRIER_RADIUS) {
      return '⚠️ NGOÀI KẾT GIỚI!';
    }

    for (const room of SCHOOL_ROOMS) {
      if (
        pos.x >= room.cx - room.w / 2 &&
        pos.x <= room.cx + room.w / 2 &&
        pos.z >= room.cz - room.d / 2 &&
        pos.z <= room.cz + room.d / 2
      ) {
        return `🏫 ${room.name}`;
      }
    }

    if (dist <= 20) {
      return '🚩 Sân Trường Trung Tâm';
    }

    return '🌳 Hành Lang & Khuôn Viên Trường';
  }

  /**
   * Cập nhật và vẽ lại Minimap mỗi frame
   */
  public update(
    localPos: Vector3D,
    localRotationY: number,
    localRole: PlayerRole,
    isNight: boolean,
    allPlayers: MinimapPlayer[],
    wolfPackTargetName?: string | null,
    doors?: Record<string, boolean>
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = width / (this.MAP_RADIUS * 2);

    this.ctx.clearRect(0, 0, width, height);

    // 1. Nền radar tròn
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, width / 2 - 2, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#7c3aed';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.clip();

    // 2. Lưới Radar
    this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.15)';
    this.ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach((rPct) => {
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, (width / 2) * rPct, 0, Math.PI * 2);
      this.ctx.stroke();
    });

    const worldToCanvas = (wx: number, wz: number) => {
      const dx = wx - localPos.x;
      const dz = wz - localPos.z;
      return {
        x: centerX + dx * scale,
        y: centerY + dz * scale,
      };
    };

    // 3. Vẽ Vòng Kết Giới
    const barrierCenterCanvas = worldToCanvas(0, 0);
    this.ctx.beginPath();
    this.ctx.arc(barrierCenterCanvas.x, barrierCenterCanvas.y, GAME_CONFIG.BARRIER_RADIUS * scale, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#c084fc';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // 4. Vẽ 9 Phòng Học 1 Tầng & Cửa Đóng/Mở
    for (const room of SCHOOL_ROOMS) {
      const rPos = worldToCanvas(room.cx, room.cz);
      const rW = room.w * scale;
      const rD = room.d * scale;

      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.2;
      this.ctx.fillRect(rPos.x - rW / 2, rPos.y - rD / 2, rW, rD);
      this.ctx.strokeRect(rPos.x - rW / 2, rPos.y - rD / 2, rW, rD);

      // Vị trí cửa phòng
      const dPos = worldToCanvas(room.doorX, room.doorZ);
      const isOpen = doors ? doors[room.doorId] !== false : true;
      this.ctx.fillStyle = isOpen ? '#22c55e' : '#ef4444';
      this.ctx.beginPath();
      this.ctx.arc(dPos.x, dPos.y, 2.4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Cột cờ trung tâm (0, 0)
    const poleCanvas = worldToCanvas(0, 0);
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.arc(poleCanvas.x, poleCanvas.y, 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Vòng bán kính tầm nhìn 5m của Sói vào ban đêm
    if (isNight && localRole === 'WEREWOLF') {
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, GAME_CONFIG.WEREWOLF_VISION_RADIUS * scale, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255, 68, 102, 0.75)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // 5. Vẽ người chơi khác
    for (const player of allPlayers) {
      if (player.isLocal || !player.isAlive) continue;

      const pDist = Math.hypot(player.position.x - localPos.x, player.position.z - localPos.z);

      if (isNight) {
        if (localRole !== 'WEREWOLF') {
          continue;
        }

        const isTeammateWolf = player.role === 'WEREWOLF';

        if (isTeammateWolf) {
          let cPos = worldToCanvas(player.position.x, player.position.z);
          const maxRadarRadius = width / 2 - 8;
          const offsetDist = Math.hypot(cPos.x - centerX, cPos.y - centerY);
          if (offsetDist > maxRadarRadius) {
            const angle = Math.atan2(cPos.y - centerY, cPos.x - centerX);
            cPos = {
              x: centerX + Math.cos(angle) * maxRadarRadius,
              y: centerY + Math.sin(angle) * maxRadarRadius,
            };
          }

          this.ctx.beginPath();
          this.ctx.arc(cPos.x, cPos.y, 5, 0, Math.PI * 2);
          this.ctx.fillStyle = '#ff1144';
          this.ctx.fill();
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();

          this.ctx.font = 'bold 9px "Chakra Petch", sans-serif';
          this.ctx.fillStyle = '#ff4466';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('🐺 Sói', cPos.x, cPos.y - 7);
          continue;
        }

        const isPackPrey = wolfPackTargetName && player.name === wolfPackTargetName;
        if (isPackPrey) {
          const cPos = worldToCanvas(player.position.x, player.position.z);
          this.ctx.beginPath();
          this.ctx.arc(cPos.x, cPos.y, 5.5, 0, Math.PI * 2);
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.fill();
          this.ctx.strokeStyle = '#ef4444';
          this.ctx.lineWidth = 1.8;
          this.ctx.stroke();
          continue;
        }

        // Nạn nhân chỉ hiện khi lọt vào bán kính tầm nhìn 5m của Sói
        if (pDist > GAME_CONFIG.WEREWOLF_VISION_RADIUS + 0.3) {
          continue;
        }
      }

      const cPos = worldToCanvas(player.position.x, player.position.z);
      this.ctx.beginPath();
      this.ctx.arc(cPos.x, cPos.y, 3.5, 0, Math.PI * 2);
      this.ctx.fillStyle = isNight ? '#ef4444' : '#94a3b8';
      this.ctx.fill();
    }

    // 6. Vẽ bản thân nhân vật chính ở tâm
    this.ctx.fillStyle = '#00ff88';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 4.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(localRotationY);
    this.ctx.fillStyle = '#55ffff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 8);
    this.ctx.lineTo(-4, -2);
    this.ctx.lineTo(4, -2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.restore();

    // 7. Cập nhật tên khu vực
    const currentArea = this.detectAreaName(localPos);
    if (this.lastAreaName !== currentArea) {
      this.lastAreaName = currentArea;
      this.elAreaName.textContent = currentArea;
    }
  }
}
