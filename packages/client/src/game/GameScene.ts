import * as THREE from 'three';
import {
  GAME_CONFIG,
  GAME_PHASE,
  GamePhaseType,
  GameStatePayload,
  PlayerState,
  SCHOOL_ROOMS,
  resolveRoomCollision,
} from '@sinh-ton/shared';
import { Environment } from './Environment';
import { InputController } from './InputController';
import { PlayerMesh } from './Player';
import { NetworkManager } from '../network/NetworkManager';
import { UIManager } from '../ui/UIManager';
import { Minimap } from '../ui/Minimap';

export class GameScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  private environment: Environment;
  private inputController: InputController;
  private uiManager: UIManager;
  private minimap: Minimap;
  private networkManager!: NetworkManager;

  private localPlayer: PlayerMesh | null = null;
  private remotePlayers: Map<string, PlayerMesh> = new Map();
  private myPlayerId: string = '';
  private currentPhase: GamePhaseType = GAME_PHASE.LOBBY;
  private wolfPackTargetName: string | null = null;
  private currentDoors: Record<string, boolean> = {};
  private nearestDoorId: string | null = null;

  private lastMoveSendTime: number = 0;
  private readonly MOVE_SEND_INTERVAL: number = 1000 / 30;
  private lastUiUpdateTime: number = 0;

  constructor(container: HTMLElement, uiManager: UIManager) {
    this.container = container;
    this.uiManager = uiManager;
    this.clock = new THREE.Clock();

    for (const r of SCHOOL_ROOMS) {
      this.currentDoors[r.doorId] = true;
    }

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06070a);
    this.scene.fog = new THREE.Fog(0x0d0f18, 150, 1600);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      3000
    );
    this.camera.position.set(0, 10, 15);

    // 3. Renderer (Tối ưu PixelRatio & Shadow để mượt mà 60 FPS)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. Môi trường & Điều khiển & Minimap
    this.environment = new Environment(this.scene);
    this.inputController = new InputController(this.renderer.domElement);
    this.minimap = new Minimap();

    // 5. Window resize, orientationchange (iPhone/iPad PWA) & Phím E đóng/mở cửa
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onWindowResize(), 120);
      setTimeout(() => this.onWindowResize(), 350);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onWindowResize.bind(this));
    }
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (e.code === 'KeyE') {
        this.tryToggleNearestDoor();
      }
    });

    // 6. Bắt đầu Render Loop
    this.animate();
  }

  public setNetworkManager(netManager: NetworkManager): void {
    this.networkManager = netManager;
  }

  public setupLocalPlayer(selfData: PlayerState): void {
    if (this.localPlayer) {
      this.scene.remove(this.localPlayer.group);
      this.localPlayer.destroy();
      this.localPlayer = null;
    }
    for (const [, mesh] of this.remotePlayers.entries()) {
      this.scene.remove(mesh.group);
      mesh.destroy();
    }
    this.remotePlayers.clear();

    this.myPlayerId = selfData.id;
    this.localPlayer = new PlayerMesh(selfData, true);
    this.scene.add(this.localPlayer.group);

    this.uiManager.updatePlayerInfo(selfData);
    console.log('[GameScene] Khởi tạo nhân vật chính:', selfData.name, 'Vai trò:', selfData.role);
  }

  /**
   * Cập nhật đồng bộ thế giới từ Server Tick
   */
  public handleSyncState(state: GameStatePayload): void {
    this.currentPhase = state.phase;
    this.uiManager.updateOnlineCount(state.players.length);
    this.uiManager.setPlayersCache(state.players, this.myPlayerId);
    this.uiManager.updatePhaseInfo(state.phase, state.phaseTimeRemaining, state.nightNumber);
    this.uiManager.updatePlayerList(state.players, this.myPlayerId);

    const selfState = state.players.find((p) => p.id === this.myPlayerId);
    const myRole = selfState?.role || this.localPlayer?.role || 'VILLAGER';
    const isNight = state.phase === GAME_PHASE.NIGHT;
    const isWerewolf = myRole === 'WEREWOLF';

    // Cập nhật chế độ ánh sáng Ngày / Đêm cho môi trường
    this.environment.setDayNightMode(isNight, isWerewolf);
    if (state.doors) {
      this.currentDoors = { ...state.doors };
      this.environment.updateDoors(this.currentDoors);
    }

    const activeIds = new Set<string>();

    for (const pState of state.players) {
      activeIds.add(pState.id);

      // Cập nhật nhân vật chính
      if (pState.id === this.myPlayerId) {
        if (this.localPlayer) {
          this.localPlayer.updateState(pState);
          this.localPlayer.updateNightVisibility(isNight, myRole, 0);
        }
        this.uiManager.updatePlayerInfo(pState);

        const dist = Math.hypot(pState.position.x, pState.position.z);
        this.uiManager.updateBarrierStatus(pState.isOutsideBarrier, dist);
        this.uiManager.updateCoordinates(pState.position.x, pState.position.z);
        continue;
      }

      // Cập nhật các người chơi khác
      if (!this.remotePlayers.has(pState.id)) {
        const newRemote = new PlayerMesh(pState, false);
        this.remotePlayers.set(pState.id, newRemote);
        this.scene.add(newRemote.group);
      } else {
        const remoteMesh = this.remotePlayers.get(pState.id)!;
        remoteMesh.updateState(pState);
      }
    }

    // Cập nhật hiển thị tên và quầng sáng ban đêm theo cự ly
    if (this.localPlayer) {
      const myPos = this.localPlayer.getPosition();
      for (const remote of this.remotePlayers.values()) {
        const dist = myPos.distanceTo(remote.getPosition());
        remote.updateNightVisibility(isNight, myRole, dist);
      }
    }

    // Xóa người chơi đã disconnect
    for (const [id, mesh] of this.remotePlayers.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh.group);
        mesh.destroy();
        this.remotePlayers.delete(id);
      }
    }

    // Kiểm tra tìm mục tiêu gần nhất để kích hoạt nút Kỹ năng (Kill) & Cửa phòng gần nhất
    this.checkNearbyTargetForAction();
    this.checkNearbyDoorForAction();

    // Cập nhật danh sách bầu chọn nếu đang trong phase VOTING
    if (state.phase === GAME_PHASE.DAY_VOTING) {
      this.uiManager.showVotingModal(state.players, this.myPlayerId);
    } else {
      this.uiManager.hideVotingModal();
    }
  }

  private checkNearbyDoorForAction(): void {
    if (!this.localPlayer || !this.localPlayer.isAlive) {
      this.nearestDoorId = null;
      this.uiManager.updateDoorButton(null);
      return;
    }

    const isNight = this.currentPhase === GAME_PHASE.NIGHT;
    if (isNight && this.localPlayer.role !== 'WEREWOLF') {
      this.nearestDoorId = null;
      this.uiManager.updateDoorButton(null);
      return;
    }

    const myPos = this.localPlayer.getPosition();
    let bestRoom: (typeof SCHOOL_ROOMS)[number] | null = null;
    let bestDist = Infinity;

    for (const r of SCHOOL_ROOMS) {
      const dist = Math.hypot(myPos.x - r.doorX, myPos.z - r.doorZ);
      if (dist <= GAME_CONFIG.DOOR_INTERACT_RANGE && dist < bestDist) {
        bestDist = dist;
        bestRoom = r;
      }
    }

    if (bestRoom) {
      this.nearestDoorId = bestRoom.doorId;
      const isOpen = this.currentDoors[bestRoom.doorId] !== false;
      this.uiManager.updateDoorButton({
        doorId: bestRoom.doorId,
        roomName: bestRoom.name,
        isOpen,
      });
    } else {
      this.nearestDoorId = null;
      this.uiManager.updateDoorButton(null);
    }
  }

  public tryToggleNearestDoor(): void {
    if (!this.nearestDoorId || !this.networkManager) return;
    this.networkManager.sendToggleDoor(this.nearestDoorId);
  }

  private checkNearbyTargetForAction(): void {
    if (!this.localPlayer || !this.localPlayer.isAlive) {
      this.uiManager.updateActionButton(null);
      return;
    }

    const myPos = this.localPlayer.getPosition();
    let closestTarget: PlayerMesh | null = null;
    let minDistance = Infinity;

    for (const remote of this.remotePlayers.values()) {
      if (!remote.isAlive) continue;

      const dist = myPos.distanceTo(remote.getPosition());
      if (dist < minDistance && dist <= GAME_CONFIG.ACTION_RANGE) {
        if (this.localPlayer.role === 'WEREWOLF' && remote.role === 'WEREWOLF') continue;

        minDistance = dist;
        closestTarget = remote;
      }
    }

    if (closestTarget) {
      this.uiManager.updateActionButton({
        targetId: closestTarget.id,
        distance: minDistance,
        role: this.localPlayer.role,
        phase: this.currentPhase,
      });
    } else {
      this.uiManager.updateActionButton(null);
    }
  }

  public removeRemotePlayer(playerId: string): void {
    const mesh = this.remotePlayers.get(playerId);
    if (mesh) {
      this.scene.remove(mesh.group);
      mesh.destroy();
      this.remotePlayers.delete(playerId);
    }
  }

  public handleRespawn(playerData?: PlayerState): void {
    if (this.localPlayer) {
      const bMat = this.localPlayer.bodyMesh.material as THREE.MeshStandardMaterial;
      bMat.transparent = true;
      bMat.opacity = 0.35;
      bMat.color.setHex(0x94a3b8);
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    this.environment.update(elapsedTime, delta);

    if (this.localPlayer) {
      const isNight = this.currentPhase === GAME_PHASE.NIGHT;
      const isWerewolf = this.localPlayer.role === 'WEREWOLF';
      const isSpectating = this.uiManager.getIsSpectating();

      // Bất động ban đêm cho học sinh không phải Sói
      const isFrozen = isNight && !isWerewolf && this.localPlayer.isAlive && !isSpectating;

      if (!isFrozen) {
        const movement = this.inputController.getMovement(delta);

        if (movement.moved) {
          const speedBoost = isWerewolf ? GAME_CONFIG.WEREWOLF_SPEED_BOOST : 1.0;
          movement.velocity.multiplyScalar(speedBoost);

          const currentPos = this.localPlayer.getPosition();
          currentPos.add(movement.velocity);

          const halfMap = GAME_CONFIG.MAP_SIZE / 2;
          currentPos.x = Math.max(-halfMap, Math.min(halfMap, currentPos.x));
          currentPos.z = Math.max(-halfMap, Math.min(halfMap, currentPos.z));

          // Kiểm tra va chạm với tường & cửa phòng học đang đóng (trừ khi đã chết / đang quan sát)
          if (this.localPlayer.isAlive && !isSpectating) {
            const resolved = resolveRoomCollision(currentPos.x, currentPos.z, this.currentDoors, 0.45);
            currentPos.x = resolved.x;
            currentPos.z = resolved.z;
          }

          if (movement.desiredRotationY !== null) {
            // Xoay nhân vật mượt mà, không giật khựng góc quay
            let diff = movement.desiredRotationY - this.localPlayer.getRotationY();
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.localPlayer.setRotationY(this.localPlayer.getRotationY() + diff * Math.min(1, delta * 18));
          }

          const now = performance.now();
          if (now - this.lastMoveSendTime > this.MOVE_SEND_INTERVAL) {
            this.networkManager?.sendMove(
              { x: currentPos.x, y: currentPos.y, z: currentPos.z },
              this.localPlayer.getRotationY()
            );
            this.lastMoveSendTime = now;
          }

          // Throttle cập nhật DOM HUD 100ms/lần tránh giật layout trình duyệt
          if (now - this.lastUiUpdateTime > 100) {
            this.uiManager.updateCoordinates(currentPos.x, currentPos.z);
            const dist = Math.hypot(currentPos.x, currentPos.z);
            this.uiManager.updateBarrierStatus(dist > GAME_CONFIG.BARRIER_RADIUS, dist);
            this.checkNearbyTargetForAction();
            this.checkNearbyDoorForAction();
            this.lastUiUpdateTime = now;
          }
        }
      }

      // Đèn tầm nhìn 5m luôn đi theo sát vị trí nhân vật chính
      const myPos = this.localPlayer.getPosition();
      this.environment.setDayNightMode(isNight, isWerewolf);
      this.environment.updateVisionLightPosition(myPos);
      this.localPlayer.updateNightVisibility(isNight, this.localPlayer.role, 0);

      // Cập nhật hiển thị nạn nhân trong bán kính 5m theo thời gian thực khi di chuyển
      for (const remote of this.remotePlayers.values()) {
        const dist = myPos.distanceTo(remote.getPosition());
        remote.updateNightVisibility(isNight, this.localPlayer.role, dist);
      }

      // Camera bám chắc theo nhân vật (100% không rung giật)
      this.inputController.updateThirdPersonCamera(this.camera, myPos);

      // CẬP NHẬT RADAR MINIMAP 2D
      const allPlayersMinimap = [
        {
          id: this.localPlayer.id,
          name: this.localPlayer.name,
          position: myPos,
          rotationY: this.localPlayer.getRotationY(),
          isAlive: this.localPlayer.isAlive,
          role: this.localPlayer.role,
          isLocal: true,
        },
        ...Array.from(this.remotePlayers.values()).map((p) => ({
          id: p.id,
          name: p.name,
          position: p.getPosition(),
          rotationY: p.getRotationY(),
          isAlive: p.isAlive,
          role: p.role,
          isLocal: false,
        })),
      ];

      this.minimap.update(
        myPos,
        this.localPlayer.getRotationY(),
        this.localPlayer.role,
        isNight,
        allPlayersMinimap,
        this.wolfPackTargetName,
        this.currentDoors
      );
    }

    for (const remote of this.remotePlayers.values()) {
      remote.updateInterpolation(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  public setWolfPackTarget(targetName: string | null): void {
    this.wolfPackTargetName = targetName;
  }

  public getLocalPlayerId(): string {
    return this.myPlayerId;
  }

  public getLocalPlayer(): PlayerMesh | null {
    return this.localPlayer;
  }

  public getCurrentPhase(): GamePhaseType {
    return this.currentPhase;
  }
}
