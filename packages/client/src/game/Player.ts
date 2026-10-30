import * as THREE from 'three';
import { PlayerState, PlayerRole, GAME_CONFIG } from '@sinh-ton/shared';
import { ModelManager, ModelType } from './ModelManager';

// Dùng chung Geometry tĩnh dự phòng cho nhân vật khi mô hình 3D chưa nạp xong
const SHARED_BODY_GEO = new THREE.BoxGeometry(0.8, 1.2, 0.5);
const SHARED_HEAD_GEO = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const SHARED_VISOR_GEO = new THREE.BoxGeometry(0.4, 0.15, 0.1);
const SHARED_AURA_GEO = new THREE.RingGeometry(4.82, 5.0, 48);
SHARED_AURA_GEO.rotateX(-Math.PI / 2);

export class PlayerMesh {
  public id: string;
  public name: string;
  public isLocal: boolean;
  public role: PlayerRole;
  public group: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public headMesh: THREE.Mesh;
  public visorMesh: THREE.Mesh;
  public nameSprite: THREE.Sprite;
  public hpBarSprite: THREE.Sprite;

  // Mô hình 3D thực tế (girl.glb hoặc cun.glb)
  public modelType: ModelType = 'girl';
  public characterModel: THREE.Group | null = null;
  private animTimer: number = 0;

  // Vòng hào quang quanh nhân vật Sói (Bán kính 2.2 mét - dùng MeshBasicMaterial nhẹ, không gây recompile shader)
  private wolfAuraMesh!: THREE.Mesh;

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetRotationY: number = 0;
  private currentHp: number = 100;
  private maxHp: number = 100;
  public isAlive: boolean = true;
  private lastVisSignature: string = '';

  constructor(playerData: PlayerState, isLocal: boolean) {
    this.id = playerData.id;
    this.name = playerData.name;
    this.isLocal = isLocal;
    this.role = playerData.role;
    this.currentHp = playerData.hp;
    this.maxHp = playerData.maxHp || GAME_CONFIG.PLAYER_MAX_HP;
    this.isAlive = playerData.isAlive;

    this.group = new THREE.Group();

    // 1. Phân loại mô hình 3D: Sói dùng cun.glb, học sinh dùng girl.glb (xen kẽ cho các Bot)
    if (this.role === 'WEREWOLF') {
      this.modelType = 'cun';
    } else if (!isLocal) {
      const hash = this.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      this.modelType = hash % 2 === 0 ? 'girl' : 'cun';
    } else {
      this.modelType = 'girl';
    }

    // 2. Tạo khối hình học dự phòng (hiện khi mô hình GLTF 3D chưa tải xong)
    const colors = this.getRoleColors(this.role, this.isLocal);

    // Thân (Body)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colors.base,
      emissive: colors.emissive,
      roughness: 0.5,
      metalness: 0.2,
    });
    this.bodyMesh = new THREE.Mesh(SHARED_BODY_GEO, bodyMat);
    this.bodyMesh.position.y = 0.6;
    this.bodyMesh.castShadow = isLocal;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // Đầu (Head)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x1f2438,
      roughness: 0.5,
    });
    this.headMesh = new THREE.Mesh(SHARED_HEAD_GEO, headMat);
    this.headMesh.position.y = 1.45;
    this.headMesh.castShadow = isLocal;
    this.group.add(this.headMesh);

    // Kính nhìn / Mắt phát sáng (Visor)
    const visorMat = new THREE.MeshBasicMaterial({
      color: colors.visor,
    });
    this.visorMesh = new THREE.Mesh(SHARED_VISOR_GEO, visorMat);
    this.visorMesh.position.set(0, 1.45, 0.26);
    this.group.add(this.visorMesh);

    // 3. Nametag & Role Badge trên đầu
    this.nameSprite = this.createNameSprite(playerData.name, this.role);
    this.nameSprite.position.y = 2.25;
    this.group.add(this.nameSprite);

    // 4. Mini HP Bar 3D
    this.hpBarSprite = this.createHpBarSprite(this.currentHp, this.maxHp);
    this.hpBarSprite.position.y = 1.95;
    this.group.add(this.hpBarSprite);

    // 5. Hào quang quanh Sói (Bán kính 2 mét)
    this.initWolfAura();

    // 6. Gắn mô hình 3D thực tế nếu ModelManager đã nạp xong
    this.tryAttachModel();

    // Vị trí ban đầu
    this.group.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
    this.group.rotation.y = playerData.rotationY || 0;
    this.targetPosition.copy(this.group.position);
    this.targetRotationY = this.group.rotation.y;
  }

  /**
   * Thử nạp mô hình 3D thực tế (girl.glb hoặc cun.glb) từ ModelManager
   */
  public tryAttachModel(): boolean {
    const modelManager = ModelManager.getInstance();
    if (!modelManager.isReady()) return false;

    const cloned = modelManager.getModel(this.modelType);
    if (!cloned) return false;

    this.attachCharacterModel(cloned, this.modelType);
    return true;
  }

  /**
   * Gắn mô hình 3D vào nhân vật và ẩn các khối hình học dự phòng
   */
  public attachCharacterModel(model: THREE.Group, type: ModelType): void {
    if (this.characterModel) {
      this.group.remove(this.characterModel);
      this.characterModel = null;
    }

    this.modelType = type;
    this.characterModel = model;
    this.group.add(model);

    // Ẩn các khối hình hộp placeholder
    this.bodyMesh.visible = false;
    this.headMesh.visible = false;
    this.visorMesh.visible = false;

    // Cập nhật shadow phù hợp: người chơi chính cast shadow, remote nhận shadow
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = this.isLocal;
        mesh.receiveShadow = true;
      }
    });

    // Điều chỉnh vị trí nametag và thanh máu khớp với chiều cao mô hình
    if (type === 'girl') {
      this.nameSprite.position.y = 2.3;
      this.hpBarSprite.position.y = 2.05;
    } else {
      this.nameSprite.position.y = 1.85;
      this.hpBarSprite.position.y = 1.62;
    }

    // Đồng bộ trạng thái hồn ma nếu nhân vật đã chết
    if (!this.isAlive) {
      this.setModelGhostState(true);
    }
  }

  /**
   * Đổi loại mô hình 3D trực tiếp (Girl <-> Cún)
   */
  public switchModel(type: ModelType): void {
    this.modelType = type;
    const model = ModelManager.getInstance().getModel(type);
    if (model) {
      this.attachCharacterModel(model, type);
    }
  }

  private setModelGhostState(isGhost: boolean): void {
    if (!this.characterModel) return;
    this.characterModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (mat) {
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              m.transparent = isGhost;
              m.opacity = isGhost ? 0.35 : 1.0;
            });
          } else {
            mat.transparent = isGhost;
            mat.opacity = isGhost ? 0.35 : 1.0;
          }
        }
      }
    });
  }

  /**
   * Hiệu ứng chuyển động tự nhiên (nhấp nhô nhịp bước chân khi chạy, thở nhẹ khi đứng yên)
   */
  public updateAnimation(deltaTime: number, isMoving: boolean): void {
    if (!this.characterModel || !this.isAlive) return;
    this.animTimer += deltaTime;

    if (isMoving) {
      const bob = Math.sin(this.animTimer * 12) * 0.04;
      const tilt = Math.sin(this.animTimer * 6) * 0.02;
      this.characterModel.position.y = bob;
      this.characterModel.rotation.z = tilt;
    } else {
      const breath = Math.sin(this.animTimer * 2.5) * 0.012;
      this.characterModel.position.y = breath;
      this.characterModel.rotation.z = 0;
    }
  }

  private getRoleColors(role: PlayerRole, isLocal: boolean): { base: number; emissive: number; visor: number } {
    if (role === 'WEREWOLF') {
      return { base: 0x991b1b, emissive: 0x450a0a, visor: 0xff0033 };
    }
    if (role === 'SEER') {
      return { base: 0x6b21a8, emissive: 0x3b0764, visor: 0xc084fc };
    }
    if (role === 'BODYGUARD') {
      return { base: 0xd97706, emissive: 0x78350f, visor: 0xfbbf24 };
    }
    if (role === 'WITCH') {
      return { base: 0x065f46, emissive: 0x022c22, visor: 0x34d399 };
    }
    if (role === 'HUNTER') {
      return { base: 0x9a3412, emissive: 0x431407, visor: 0xfb923c };
    }
    if (role === 'DOCTOR') {
      return { base: 0x0284c7, emissive: 0x075985, visor: 0x38bdf8 };
    }
    // VILLAGER
    return isLocal
      ? { base: 0x00ff88, emissive: 0x004422, visor: 0x55ffff }
      : { base: 0x64748b, emissive: 0x1e293b, visor: 0xcbd5e1 };
  }

  /**
   * Hào quang quanh nhân vật Sói (Bán kính 2.2 mét)
   */
  private initWolfAura(): void {
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xff2244,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    this.wolfAuraMesh = new THREE.Mesh(SHARED_AURA_GEO, auraMat);
    this.wolfAuraMesh.position.set(0, 0.06, 0);
    this.wolfAuraMesh.visible = false;
    this.group.add(this.wolfAuraMesh);
  }

  /**
   * Cập nhật hiển thị và ánh sáng theo chu kỳ Ngày - Đêm:
   * - Ban đêm: Toàn bộ bản đồ tối đen.
   * - Ma Sói có tầm nhìn sáng bán kính 5m quanh mình: đi tới đâu nhìn thấy nạn nhân (mô hình, tên, thanh máu) trong bán kính 5m tới đó.
   * - Ngoài bán kính 5m trong đêm tối, nạn nhân hoàn toàn ẩn trong bóng đêm.
   */
  public updateNightVisibility(
    isNight: boolean,
    localPlayerRole: PlayerRole,
    distanceToLocalPlayer: number
  ): void {
    const inWolfVision = distanceToLocalPlayer <= GAME_CONFIG.WEREWOLF_VISION_RADIUS + 0.25;
    const inVillagerVision = distanceToLocalPlayer <= 2.5;
    const sig = `${isNight}_${localPlayerRole}_${this.role}_${this.isAlive}_${this.isLocal}_${inWolfVision}_${inVillagerVision}`;
    if (sig === this.lastVisSignature) return;
    this.lastVisSignature = sig;

    const bMat = this.bodyMesh.material as THREE.MeshStandardMaterial;

    if (!this.isAlive) {
      // Hồn ma
      this.wolfAuraMesh.visible = false;
      this.hpBarSprite.visible = false;
      this.group.visible = !isNight || this.isLocal || (localPlayerRole === 'WEREWOLF' && inWolfVision);
      this.nameSprite.visible = !isNight || this.isLocal || (localPlayerRole === 'WEREWOLF' && inWolfVision);
      bMat.color.setHex(0x94a3b8);
      bMat.emissive.setHex(0x000000);
      return;
    }

    if (!isNight) {
      // BAN NGÀY: Mọi người nhìn thấy nhau bình thường
      this.group.visible = true;
      this.nameSprite.visible = true;
      this.hpBarSprite.visible = true;
      this.wolfAuraMesh.visible = false;

      const colors = this.getRoleColors(this.role, this.isLocal);
      bMat.color.setHex(colors.base);
      bMat.emissive.setHex(colors.emissive);
      return;
    }

    // BAN ĐÊM (Trời tối hết)
    if (this.isLocal) {
      this.group.visible = true;
      this.nameSprite.visible = true;
      this.hpBarSprite.visible = true;
      this.wolfAuraMesh.visible = this.role === 'WEREWOLF';

      const colors = this.getRoleColors(this.role, true);
      bMat.color.setHex(colors.base);
      bMat.emissive.setHex(colors.emissive);
      return;
    }

    if (localPlayerRole === 'WEREWOLF') {
      // MA SÓI TRONG ĐÊM: Chỉ nhìn thấy nạn nhân khi vào trong bán kính 5m
      this.group.visible = inWolfVision;
      this.nameSprite.visible = inWolfVision;
      this.hpBarSprite.visible = inWolfVision;
      this.wolfAuraMesh.visible = false;

      const colors = this.getRoleColors(this.role, false);
      bMat.color.setHex(colors.base);
      bMat.emissive.setHex(colors.emissive);
      return;
    }

    // DÂN LÀNG TRONG ĐÊM: Không thấy tên người khác, chỉ thấy bóng người ở rất gần (<= 2.5m)
    this.group.visible = inVillagerVision;
    this.nameSprite.visible = false;
    this.hpBarSprite.visible = false;
    this.wolfAuraMesh.visible = false;

    const colors = this.getRoleColors(this.role, false);
    bMat.color.setHex(colors.base);
    bMat.emissive.setHex(0x000000);
  }

  private createNameSprite(name: string, role: PlayerRole): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 70;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(10, 12, 20, 0.75)';
    ctx.roundRect ? ctx.roundRect(10, 10, 236, 50, 10) : ctx.rect(10, 10, 236, 50);
    ctx.fill();

    ctx.fillStyle = this.isLocal ? '#00ff88' : '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 35);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.9, 0.52, 1);
    return sprite;
  }

  private createHpBarSprite(hp: number, maxHp: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 16;
    this.drawHpBar(canvas, hp, maxHp);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.2, 0.15, 1);
    return sprite;
  }

  private drawHpBar(canvas: HTMLCanvasElement, hp: number, maxHp: number): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#111420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pct = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = pct > 0.5 ? '#00ff88' : pct > 0.25 ? '#ffaa00' : '#ff2244';
    ctx.fillRect(2, 2, (canvas.width - 4) * pct, canvas.height - 4);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  public updateState(state: PlayerState): void {
    this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    this.targetRotationY = state.rotationY;

    if (this.role !== state.role) {
      this.role = state.role;
      this.lastVisSignature = '';
      const colors = this.getRoleColors(this.role, this.isLocal);
      (this.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(colors.base);
      (this.visorMesh.material as THREE.MeshBasicMaterial).color.setHex(colors.visor);

      // Nếu hóa Sói: tự động đổi sang mô hình cun.glb
      if (this.role === 'WEREWOLF' && this.modelType !== 'cun') {
        this.switchModel('cun');
      }
    }

    if (Math.abs(this.currentHp - state.hp) > 0.1) {
      this.currentHp = state.hp;
      const texture = this.hpBarSprite.material.map;
      if (texture && texture.image) {
        this.drawHpBar(texture.image as HTMLCanvasElement, this.currentHp, this.maxHp);
        texture.needsUpdate = true;
      }
    }

    if (this.isAlive !== state.isAlive) {
      this.isAlive = state.isAlive;
      this.lastVisSignature = '';
      const bMat = this.bodyMesh.material as THREE.MeshStandardMaterial;
      if (!this.isAlive) {
        // Hồn ma: bán trong suốt
        bMat.transparent = true;
        bMat.opacity = 0.35;
        bMat.color.setHex(0x94a3b8);
        this.wolfAuraMesh.visible = false;
        this.setModelGhostState(true);
      } else {
        bMat.transparent = false;
        bMat.opacity = 1.0;
        this.setModelGhostState(false);
      }
    }
  }

  public updateInterpolation(deltaTime: number): void {
    if (this.isLocal) return;

    // Nếu khoảng cách dịch chuyển quá xa (> 15m khi bắt đầu ván hoặc hồi sinh) thì snap ngay tránh trượt xuyên tường
    const distSq = this.group.position.distanceToSquared(this.targetPosition);
    if (distSq > 225) {
      this.group.position.copy(this.targetPosition);
      this.group.rotation.y = this.targetRotationY;
      this.updateAnimation(deltaTime, false);
      return;
    }

    const isMoving = distSq > 0.005;

    // Nội suy mượt mà, hạn chế rung giật khi bot di chuyển
    const lerpFactor = Math.min(1, deltaTime * 12);
    this.group.position.lerp(this.targetPosition, lerpFactor);

    let diff = this.targetRotationY - this.group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * lerpFactor;

    this.updateAnimation(deltaTime, isMoving);
  }

  public setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
    this.targetPosition.set(x, y, z);
  }

  public setRotationY(angle: number): void {
    this.group.rotation.y = angle;
    this.targetRotationY = angle;
  }

  public getPosition(): THREE.Vector3 {
    return this.group.position;
  }

  public getRotationY(): number {
    return this.group.rotation.y;
  }

  public destroy(): void {
    if (this.characterModel) {
      this.group.remove(this.characterModel);
      this.characterModel = null;
    }
    (this.bodyMesh.material as THREE.Material).dispose();
    (this.headMesh.material as THREE.Material).dispose();
    (this.visorMesh.material as THREE.Material).dispose();
    (this.wolfAuraMesh.material as THREE.Material).dispose();
    if (this.nameSprite.material.map) this.nameSprite.material.map.dispose();
    this.nameSprite.material.dispose();
    if (this.hpBarSprite.material.map) this.hpBarSprite.material.map.dispose();
    this.hpBarSprite.material.dispose();
  }
}
