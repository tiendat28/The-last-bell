import * as THREE from 'three';
import { GAME_CONFIG, SCHOOL_ROOMS, SchoolRoomDef } from '@sinh-ton/shared';

interface DoorVisualState {
  pivot: THREE.Group;
  isOpen: boolean;
  currentAngle: number;
  targetAngle: number;
  baseRotationY: number;
  statusMat: THREE.MeshBasicMaterial;
}

export class Environment {
  public scene: THREE.Scene;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private centerPointLight!: THREE.PointLight;
  private wolfVisionLight!: THREE.PointLight;
  private wolfVisionDisc!: THREE.Mesh;

  private fog!: THREE.Fog;
  private currentIsNight: boolean | null = null;
  private currentIsWerewolf: boolean | null = null;

  private barrierRing!: THREE.Mesh;
  private barrierWall!: THREE.Mesh;
  private barrierParticles!: THREE.Points;

  // Hệ thống cửa các phòng học 1 tầng
  private doorVisuals: Map<string, DoorVisualState> = new Map();

  // NPC Loa Quản Trò
  private speakers: THREE.Group[] = [];
  private speakerBulbs: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.fog = new THREE.Fog(0x0d0f18, 150, 1600);
    this.scene.fog = this.fog;
    this.initLighting();
    this.initGround();
    this.initBarrier();
    this.initSchoolRooms();
    this.initCourtyard();
    this.initAnnouncerSpeakers();
  }

  /**
   * Hệ thống Ánh Sáng động (Hỗ trợ chuyển đổi Ngày / Đêm + Tầm nhìn Sói 5m)
   */
  private initLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0xdde5ff, 1.2);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334466, 0.8);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.6);
    this.sunLight.position.set(80, 120, 60);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 400;
    const shadowD = 100;
    this.sunLight.shadow.camera.left = -shadowD;
    this.sunLight.shadow.camera.right = shadowD;
    this.sunLight.shadow.camera.top = shadowD;
    this.sunLight.shadow.camera.bottom = -shadowD;
    this.sunLight.shadow.bias = -0.0002;
    this.scene.add(this.sunLight);

    this.centerPointLight = new THREE.PointLight(0xb5179e, 2, 40);
    this.centerPointLight.position.set(0, 3, 0);
    this.scene.add(this.centerPointLight);

    // Đèn tầm nhìn cá nhân (5m cho Ma Sói trong đêm tối đen - decay thấp 0.25 để sáng rõ đều trong bán kính 5m)
    this.wolfVisionLight = new THREE.PointLight(0xfff4ea, 0, 6.8, 0.25);
    this.wolfVisionLight.position.set(0, 2.2, 0);
    this.scene.add(this.wolfVisionLight);

    // Vùng chiếu sáng 5m trên mặt đất đi theo Sói trong đêm
    const discCanvas = document.createElement('canvas');
    discCanvas.width = 256;
    discCanvas.height = 256;
    const dCtx = discCanvas.getContext('2d')!;
    const grad = dCtx.createRadialGradient(128, 128, 8, 128, 128, 126);
    grad.addColorStop(0, 'rgba(255, 245, 230, 0.32)');
    grad.addColorStop(0.75, 'rgba(255, 220, 200, 0.22)');
    grad.addColorStop(0.94, 'rgba(255, 80, 90, 0.45)');
    grad.addColorStop(1.0, 'rgba(255, 40, 60, 0.0)');
    dCtx.fillStyle = grad;
    dCtx.fillRect(0, 0, 256, 256);

    const discTex = new THREE.CanvasTexture(discCanvas);
    const discGeo = new THREE.CircleGeometry(GAME_CONFIG.WEREWOLF_VISION_RADIUS, 64);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      map: discTex,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    this.wolfVisionDisc = new THREE.Mesh(discGeo, discMat);
    this.wolfVisionDisc.position.set(0, 0.05, 0);
    this.wolfVisionDisc.visible = false;
    this.scene.add(this.wolfVisionDisc);
  }

  /**
   * Cập nhật vị trí đèn tầm nhìn 5m đi theo nhân vật chính
   */
  public updateVisionLightPosition(pos: THREE.Vector3): void {
    if (this.wolfVisionLight) {
      this.wolfVisionLight.position.set(pos.x, 2.2, pos.z);
    }
    if (this.wolfVisionDisc) {
      this.wolfVisionDisc.position.set(pos.x, 0.05, pos.z);
    }
  }

  /**
   * Chuyển đổi ánh sáng giữa Ngày và Đêm:
   * - Ban đêm: Toàn bộ bản đồ tối đen hoàn toàn.
   * - Ma Sói có tầm nhìn sáng bán kính 5m đi tới đâu sáng tới đó để nhìn thấy nạn nhân.
   * - Lưu ý: Không đặt fog.far quá ngắn vì Camera góc nhìn thứ 3 cách nhân vật 8m-20m.
   */
  public setDayNightMode(isNight: boolean, isWerewolf: boolean): void {
    if (this.currentIsNight === isNight && this.currentIsWerewolf === isWerewolf) return;
    this.currentIsNight = isNight;
    this.currentIsWerewolf = isWerewolf;

    if (isNight) {
      // Toàn bộ trường học ngoài vùng 5m tối đen hoàn toàn
      this.ambientLight.intensity = 0.025;
      this.ambientLight.color.setHex(0x050711);
      this.hemiLight.intensity = 0.02;
      this.sunLight.intensity = 0.0;
      this.centerPointLight.intensity = 0.0;

      // Fog tính từ Camera (Camera cách người chơi 8m-20m nên near=60 để không che đen màn hình của người chơi)
      this.fog.color.setHex(0x020308);
      this.fog.near = 60;
      this.fog.far = 180;

      if (isWerewolf) {
        // MA SÓI: Đi đến đâu sáng rực trong bán kính 5m đến đó
        this.wolfVisionLight.intensity = 8.5;
        this.wolfVisionLight.distance = 6.8; // Chiếu sáng rõ mặt đất, tường, cửa & nạn nhân trong bán kính 5m
        this.wolfVisionLight.color.setHex(0xfff4ea);
        this.wolfVisionDisc.visible = true;
      } else {
        // HỌC SINH / DÂN LÀNG: Đứng bất động trong đêm tối, chỉ sáng mờ ngay tại chỗ đứng
        this.wolfVisionLight.intensity = 1.8;
        this.wolfVisionLight.distance = 3.2;
        this.wolfVisionLight.color.setHex(0x94a3b8);
        this.wolfVisionDisc.visible = false;
      }
    } else {
      // BAN NGÀY: Sáng rõ toàn trường
      this.ambientLight.intensity = 1.25;
      this.ambientLight.color.setHex(0xdde5ff);

      this.hemiLight.intensity = 0.8;
      this.sunLight.intensity = 1.6;
      this.centerPointLight.intensity = 2.0;
      this.wolfVisionLight.intensity = 0.0;
      this.wolfVisionDisc.visible = false;

      this.fog.color.setHex(0x0d0f18);
      this.fog.near = 150;
      this.fog.far = 1600;
    }
  }

  /**
   * Mặt đất sân trường & Vạch kẻ hành lang
   */
  private initGround(): void {
    const mapSize = GAME_CONFIG.MAP_SIZE;

    const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x181c26,
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(mapSize, 120, 0x3a0ca3, 0x1f2438);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    // Sân trung tâm lát đá
    const plazaGeo = new THREE.RingGeometry(0, 32, 64);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x222838,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
  }

  /**
   * Vòng Kết Giới Phát Sáng Tím
   */
  private initBarrier(): void {
    const radius = GAME_CONFIG.BARRIER_RADIUS;

    const ringGeo = new THREE.TorusGeometry(radius, 1.0, 8, 96);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xc77dff,
      emissive: 0x9d4edd,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.barrierRing = new THREE.Mesh(ringGeo, ringMat);
    this.barrierRing.rotation.x = Math.PI / 2;
    this.barrierRing.position.y = 0.5;
    this.scene.add(this.barrierRing);

    const wallHeight = 40;
    const wallGeo = new THREE.CylinderGeometry(radius, radius, wallHeight, 96, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x7209b7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.barrierWall = new THREE.Mesh(wallGeo, wallMat);
    this.barrierWall.position.y = wallHeight / 2;
    this.scene.add(this.barrierWall);

    const particleCount = 900;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
      const r = radius + (Math.random() - 0.5) * 4;
      const y = Math.random() * wallHeight;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xe0aaff,
      size: 1.5,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.barrierParticles = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.barrierParticles);
  }

  /**
   * Hệ thống Trường Học 1 Tầng gồm 9 Phòng chức năng, mỗi phòng có 1 cửa đóng/mở được
   */
  private initSchoolRooms(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x283147, roughness: 0.78 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b4866, roughness: 0.5 });

    for (const room of SCHOOL_ROOMS) {
      const rGroup = new THREE.Group();
      const halfW = room.w / 2;
      const halfD = room.d / 2;
      const wallH = 3.4;
      const wallT = 0.6;
      const doorW = room.doorWidth;

      // 1. Sàn phòng 1 tầng
      const floorColors: Record<SchoolRoomDef['type'], number> = {
        classroom: 0x1e2638,
        teacher: 0x272036,
        storage: 0x292524,
        clinic: 0x16303d,
        wc: 0x1e293b,
        lab: 0x1a2e2b,
        pool: 0x0c2d48,
      };
      const floorMat = new THREE.MeshStandardMaterial({
        color: floorColors[room.type] || 0x1e2638,
        roughness: 0.65,
      });
      const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(room.w, 0.16, room.d), floorMat);
      floorMesh.position.set(room.cx, 0.08, room.cz);
      floorMesh.receiveShadow = true;
      rGroup.add(floorMesh);

      // 2. Xây 4 bức tường bao quanh, chừa 1 ô cửa duy nhất ở mặt doorSide
      const addWallBox = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMat);
        mesh.position.set(cx, cy, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rGroup.add(mesh);

        // Viền đỉnh tường 1 tầng giúp dễ quan sát cấu trúc phòng từ góc nhìn trên cao
        const topTrim = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.08, 0.16, sz + 0.08), trimMat);
        topTrim.position.set(cx, cy + sy / 2 + 0.08, cz);
        rGroup.add(topTrim);
      };

      const sideSpanX = (room.w - doorW) / 2;
      const sideSpanZ = (room.d - doorW) / 2;

      // Tường Bắc (minZ)
      if (room.doorSide === 'N') {
        addWallBox(room.cx - halfW + sideSpanX / 2, wallH / 2, room.cz - halfD, sideSpanX, wallH, wallT);
        addWallBox(room.cx + halfW - sideSpanX / 2, wallH / 2, room.cz - halfD, sideSpanX, wallH, wallT);
        // Đà ngang trên cửa
        addWallBox(room.cx, wallH - 0.3, room.cz - halfD, doorW, 0.6, wallT);
      } else {
        addWallBox(room.cx, wallH / 2, room.cz - halfD, room.w, wallH, wallT);
      }

      // Tường Nam (maxZ)
      if (room.doorSide === 'S') {
        addWallBox(room.cx - halfW + sideSpanX / 2, wallH / 2, room.cz + halfD, sideSpanX, wallH, wallT);
        addWallBox(room.cx + halfW - sideSpanX / 2, wallH / 2, room.cz + halfD, sideSpanX, wallH, wallT);
        addWallBox(room.cx, wallH - 0.3, room.cz + halfD, doorW, 0.6, wallT);
      } else {
        addWallBox(room.cx, wallH / 2, room.cz + halfD, room.w, wallH, wallT);
      }

      // Tường Tây (minX)
      if (room.doorSide === 'W') {
        addWallBox(room.cx - halfW, wallH / 2, room.cz - halfD + sideSpanZ / 2, wallT, wallH, sideSpanZ);
        addWallBox(room.cx - halfW, wallH / 2, room.cz + halfD - sideSpanZ / 2, wallT, wallH, sideSpanZ);
        addWallBox(room.cx - halfW, wallH - 0.3, room.cz, wallT, 0.6, doorW);
      } else {
        addWallBox(room.cx - halfW, wallH / 2, room.cz, wallT, wallH, room.d);
      }

      // Tường Đông (maxX)
      if (room.doorSide === 'E') {
        addWallBox(room.cx + halfW, wallH / 2, room.cz - halfD + sideSpanZ / 2, wallT, wallH, sideSpanZ);
        addWallBox(room.cx + halfW, wallH / 2, room.cz + halfD - sideSpanZ / 2, wallT, wallH, sideSpanZ);
        addWallBox(room.cx + halfW, wallH - 0.3, room.cz, wallT, 0.6, doorW);
      } else {
        addWallBox(room.cx + halfW, wallH / 2, room.cz, wallT, wallH, room.d);
      }

      // 3. Tạo Cửa Phòng có bản lề xoay đóng/mở + Biển tên phòng
      this.createRoomDoorAndSign(rGroup, room, wallH);

      // 4. Trang trí nội thất bên trong từng phòng học 1 tầng
      this.populateRoomInterior(rGroup, room);

      this.scene.add(rGroup);
    }
  }

  /**
   * Tạo Cửa gỗ/thép có bản lề đóng mở + Bảng tên phòng treo trên cửa
   */
  private createRoomDoorAndSign(parent: THREE.Group, room: SchoolRoomDef, wallH: number): void {
    const doorW = room.doorWidth;
    const doorH = 2.75;
    const doorThick = 0.18;

    const pivot = new THREE.Group();
    let baseRotationY = 0;

    // Đặt trục bản lề ở mép khung cửa
    if (room.doorSide === 'S') {
      pivot.position.set(room.doorX - doorW / 2, 0, room.doorZ);
      baseRotationY = 0;
    } else if (room.doorSide === 'N') {
      pivot.position.set(room.doorX + doorW / 2, 0, room.doorZ);
      baseRotationY = Math.PI;
    } else if (room.doorSide === 'E') {
      pivot.position.set(room.doorX, 0, room.doorZ + doorW / 2);
      baseRotationY = Math.PI / 2;
    } else if (room.doorSide === 'W') {
      pivot.position.set(room.doorX, 0, room.doorZ - doorW / 2);
      baseRotationY = -Math.PI / 2;
    }

    // Cánh cửa gỗ học đường
    const doorPanelMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.55,
      metalness: 0.15,
    });
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorThick), doorPanelMat);
    doorMesh.position.set(doorW / 2, doorH / 2 + 0.05, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    pivot.add(doorMesh);

    // Ô kính nhỏ trên cánh cửa
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    });
    const glassPane = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.5, 0.75, doorThick + 0.04), glassMat);
    glassPane.position.set(doorW / 2, doorH * 0.72, 0);
    pivot.add(glassPane);

    // Tay nắm cửa kim loại vàng
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), handleMat);
    handle.position.set(doorW - 0.35, doorH * 0.48, 0.16);
    const handleBack = handle.clone();
    handleBack.position.z = -0.16;
    pivot.add(handle);
    pivot.add(handleBack);

    // Mặc định mở cửa (góc mở 86 độ)
    const openOffset = Math.PI * 0.48;
    pivot.rotation.y = baseRotationY + openOffset;
    parent.add(pivot);

    // Đèn báo trạng thái cửa (Xanh = Đang Mở, Đỏ = Đang Đóng)
    const statusMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), statusMat);
    statusLight.position.set(room.doorX, wallH + 0.35, room.doorZ);
    parent.add(statusLight);

    // Biển tên phòng treo phía trên cửa
    const signSprite = this.createRoomSignSprite(room.name);
    signSprite.position.set(room.doorX, wallH + 1.05, room.doorZ);
    parent.add(signSprite);

    this.doorVisuals.set(room.doorId, {
      pivot,
      isOpen: true,
      currentAngle: openOffset,
      targetAngle: openOffset,
      baseRotationY,
      statusMat,
    });
  }

  private createRoomSignSprite(roomName: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(roomName, 128, 33);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4.5, 1.1, 1);
    return sprite;
  }

  /**
   * Cập nhật trạng thái Đóng / Mở cửa từ Server
   */
  public updateDoors(doors?: { [doorId: string]: boolean }): void {
    if (!doors) return;
    for (const [doorId, isOpen] of Object.entries(doors)) {
      const visual = this.doorVisuals.get(doorId);
      if (visual && visual.isOpen !== isOpen) {
        visual.isOpen = isOpen;
        visual.targetAngle = isOpen ? Math.PI * 0.48 : 0;
        visual.statusMat.color.setHex(isOpen ? 0x22c55e : 0xef4444);
      }
    }
  }

  /**
   * Trang trí nội thất bên trong từng phòng học 1 tầng
   */
  private populateRoomInterior(parent: THREE.Group, room: SchoolRoomDef): void {
    const { cx, cz, type } = room;

    if (type === 'classroom') {
      const deskMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
      const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.3 });

      const board = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 0.15), boardMat);
      board.position.set(cx, 2.0, cz - room.d / 2 + 0.45);
      parent.add(board);

      for (let r = -1; r <= 0; r++) {
        for (let c = -1; c <= 1; c += 2) {
          const dx = cx + c * 3.0;
          const dz = cz + r * 3.2 + 0.8;
          const desk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 1.1), deskMat);
          desk.position.set(dx, 0.5, dz);
          desk.castShadow = true;
          parent.add(desk);

          const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), chairMat);
          chair.position.set(dx, 0.35, dz + 0.95);
          parent.add(chair);
        }
      }
    } else if (type === 'teacher') {
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.5 });
      const sofaMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.7 });
      const table = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.9, 2.2), tableMat);
      table.position.set(cx, 0.55, cz);
      table.castShadow = true;
      parent.add(table);

      const sofa = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.0, 1.4), sofaMat);
      sofa.position.set(cx, 0.6, cz - 3.6);
      parent.add(sofa);
    } else if (type === 'storage') {
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const offsets = [
        { x: -3.5, z: -2.5, h: 1.8 },
        { x: -1.2, z: -2.8, h: 2.4 },
        { x: 3.2, z: -2.2, h: 2.0 },
        { x: 2.8, z: 2.2, h: 1.5 },
      ];
      for (const o of offsets) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(2.0, o.h, 2.0), crateMat);
        crate.position.set(cx + o.x, o.h / 2 + 0.1, cz + o.z);
        crate.castShadow = true;
        parent.add(crate);
      }
    } else if (type === 'clinic') {
      const bedMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const crossMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
      for (const bx of [-3.2, 3.2]) {
        const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 4.2), bedMat);
        bed.position.set(cx + bx, 0.45, cz - 1.5);
        bed.castShadow = true;
        parent.add(bed);
      }
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 1.0), crossMat);
      cabinet.position.set(cx, 1.3, cz - room.d / 2 + 0.9);
      parent.add(cabinet);
    } else if (type === 'wc') {
      const stallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      for (const sx of [-3.5, 0, 3.5]) {
        const divider = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 3.2), stallMat);
        divider.position.set(cx + sx, 1.3, cz - 2.2);
        parent.add(divider);
      }
    } else if (type === 'lab') {
      const labMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.4 });
      for (const lx of [-3.2, 3.2]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.95, 2.0), labMat);
        bench.position.set(cx + lx, 0.55, cz);
        bench.castShadow = true;
        parent.add(bench);
      }
    } else if (type === 'pool') {
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.72,
        roughness: 0.15,
      });
      const water = new THREE.Mesh(new THREE.BoxGeometry(room.w - 3.5, 0.25, room.d - 3.5), waterMat);
      water.position.set(cx, 0.22, cz);
      parent.add(water);
    }
  }

  /**
   * Khu Vực Sân Trường & Cột Cờ Trung Tâm (0, 0)
   */
  private initCourtyard(): void {
    const poleBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.5, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    poleBase.position.set(0, 0.4, 0);
    poleBase.receiveShadow = true;
    this.scene.add(poleBase);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 14, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
    );
    pole.position.set(0, 7.4, 0);
    pole.castShadow = true;
    this.scene.add(pole);

    const planterMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });

    const planterCoords = [
      { x: 14, z: 0 },
      { x: -14, z: 0 },
      { x: 0, z: 12 },
      { x: 0, z: -12 },
    ];

    planterCoords.forEach((coord) => {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 2.4), planterMat);
      planter.position.set(coord.x, 0.4, coord.z);
      planter.castShadow = true;
      this.scene.add(planter);

      const bush = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.3, 1.8), bushMat);
      bush.position.set(coord.x, 1.15, coord.z);
      bush.castShadow = true;
      this.scene.add(bush);
    });
  }

  /**
   * NPC Loa Phát Thanh Trường Học (Quản Trò 3D)
   */
  private initAnnouncerSpeakers(): void {
    const speakerGroup = new THREE.Group();
    speakerGroup.position.set(0, 13.5, 0);

    const hornMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 12), hornMat);
      horn.rotation.z = Math.PI / 2;
      horn.rotation.y = angle;
      horn.position.set(Math.cos(angle) * 0.7, 0, Math.sin(angle) * 0.7);
      speakerGroup.add(horn);
    }

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), bulbMat);
    bulb.position.set(0, 0.8, 0);
    speakerGroup.add(bulb);
    this.speakerBulbs.push(bulb);

    this.scene.add(speakerGroup);
    this.speakers.push(speakerGroup);
  }

  /**
   * Update Render Loop (Chuyển động kết giới, nhấp nháy đèn loa & xoay đóng/mở cửa mượt mà)
   */
  public update(time: number, dt = 0.016): void {
    if (this.barrierRing) {
      this.barrierRing.rotation.z = time * 0.05;
    }

    if (this.barrierWall) {
      const mat = this.barrierWall.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.sin(time * 2.5) * 0.1;
    }

    if (this.barrierParticles) {
      this.barrierParticles.rotation.y = time * 0.03;
    }

    for (const b of this.speakerBulbs) {
      const mat = b.material as THREE.MeshBasicMaterial;
      mat.color.setHex(Math.sin(time * 5) > 0 ? 0xff2244 : 0xaa0022);
    }

    // Nội suy góc đóng/mở cửa phòng học mượt mà
    const lerpSpeed = Math.min(1, dt * 10);
    for (const visual of this.doorVisuals.values()) {
      if (Math.abs(visual.currentAngle - visual.targetAngle) > 0.005) {
        visual.currentAngle += (visual.targetAngle - visual.currentAngle) * lerpSpeed;
        visual.pivot.rotation.y = visual.baseRotationY + visual.currentAngle;
      }
    }
  }
}
