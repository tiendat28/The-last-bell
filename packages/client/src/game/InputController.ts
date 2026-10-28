import * as THREE from 'three';
import { GAME_CONFIG } from '@sinh-ton/shared';

export class InputController {
  private keys: { [key: string]: boolean } = {};
  public cameraYaw: number = 0; // Góc xoay ngang quanh nhân vật
  public cameraPitch: number = 0.35; // Góc nghiêng dọc (rad)
  public cameraDistance: number = 8; // Khoảng cách camera tới nhân vật

  private isMouseDown: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };

  // Điều khiển cảm ứng (Mobile / Tablet / iPad)
  private joystickVec = { x: 0, z: 0 };
  private joystickTouchId: number | null = null;
  private activeSceneTouches: Map<number, { x: number; y: number }> = new Map();
  private lastPinchDistance: number | null = null;
  private elJoystickZone: HTMLElement | null = null;
  private elJoystickKnob: HTMLElement | null = null;

  constructor(domElement: HTMLElement) {
    this.setupKeyboardListeners();
    this.setupMouseListeners(domElement);
    this.setupTouchControls(domElement);
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private setupMouseListeners(domElement: HTMLElement): void {
    // Kéo chuột để xoay camera
    domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isMouseDown = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      const sensitivity = 0.005;
      this.cameraYaw -= deltaX * sensitivity;
      this.cameraPitch = Math.max(0.05, Math.min(Math.PI / 2.2, this.cameraPitch + deltaY * sensitivity));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Lăn chuột để zoom in / zoom out
    domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance += e.deltaY * 0.01;
      this.cameraDistance = Math.max(3, Math.min(25, this.cameraDistance));
    }, { passive: false });

    // Tắt menu chuột phải trên canvas để thoải mái xoay góc nhìn
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Hỗ trợ Joystick ảo và Xoay camera cảm ứng trên điện thoại / máy tính bảng
   */
  private setupTouchControls(domElement: HTMLElement): void {
    // Tạo cụm Joystick ảo (ẩn trên PC, hiện trên thiết bị cảm ứng / màn hình nhỏ)
    const zone = document.createElement('div');
    zone.id = 'mobile-joystick-zone';
    zone.className = 'mobile-joystick-zone';
    const knob = document.createElement('div');
    knob.className = 'mobile-joystick-knob';
    zone.appendChild(knob);
    document.body.appendChild(zone);

    this.elJoystickZone = zone;
    this.elJoystickKnob = knob;

    const maxRadius = 42;
    const handleJoystickMove = (clientX: number, clientY: number) => {
      if (!this.elJoystickZone || !this.elJoystickKnob) return;
      const rect = this.elJoystickZone.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      this.elJoystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joystickVec.x = dx / maxRadius;
      this.joystickVec.z = -(dy / maxRadius);
    };

    const resetJoystick = () => {
      this.joystickTouchId = null;
      this.joystickVec.x = 0;
      this.joystickVec.z = 0;
      if (this.elJoystickKnob) {
        this.elJoystickKnob.style.transform = 'translate(-50%, -50%)';
      }
    };

    zone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const t = e.changedTouches[0];
        this.joystickTouchId = t.identifier;
        handleJoystickMove(t.clientX, t.clientY);
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        let handledSceneTouch = false;

        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joystickTouchId) {
            e.preventDefault();
            handleJoystickMove(t.clientX, t.clientY);
          } else if (this.activeSceneTouches.has(t.identifier)) {
            handledSceneTouch = true;
            if (this.activeSceneTouches.size === 1) {
              // 1 ngón tay trên khung cảnh: Xoay góc nhìn Camera 3D
              const prev = this.activeSceneTouches.get(t.identifier)!;
              const deltaX = t.clientX - prev.x;
              const deltaY = t.clientY - prev.y;
              const sensitivity = 0.006;
              this.cameraYaw -= deltaX * sensitivity;
              this.cameraPitch = Math.max(
                0.05,
                Math.min(Math.PI / 2.2, this.cameraPitch + deltaY * sensitivity)
              );
            }
            this.activeSceneTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
          }
        }

        // 2 ngón tay trên khung cảnh (Pinch-to-Zoom): Thu phóng khung cảnh như lăn chuột trên máy tính
        if (handledSceneTouch) {
          e.preventDefault();
          if (this.activeSceneTouches.size >= 2) {
            const pts = Array.from(this.activeSceneTouches.values());
            const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (this.lastPinchDistance !== null && currentDist > 0) {
              const deltaDist = this.lastPinchDistance - currentDist;
              const zoomSensitivity = 0.045;
              this.cameraDistance = Math.max(
                3,
                Math.min(25, this.cameraDistance + deltaDist * zoomSensitivity)
              );
            }
            this.lastPinchDistance = currentDist;
          }
        }
      },
      { passive: false }
    );

    const endTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.joystickTouchId) {
          resetJoystick();
        }
        if (this.activeSceneTouches.has(t.identifier)) {
          this.activeSceneTouches.delete(t.identifier);
        }
      }

      // Đồng bộ lại các điểm chạm còn thực sự giữ trên màn hình (tránh kẹt điểm chạm trên iOS)
      const stillActiveIds = new Set<number>();
      for (let i = 0; i < e.touches.length; i++) {
        stillActiveIds.add(e.touches[i].identifier);
      }
      if (this.joystickTouchId !== null && !stillActiveIds.has(this.joystickTouchId)) {
        resetJoystick();
      }
      for (const id of Array.from(this.activeSceneTouches.keys())) {
        if (!stillActiveIds.has(id)) {
          this.activeSceneTouches.delete(id);
        }
      }

      if (this.activeSceneTouches.size < 2) {
        this.lastPinchDistance = null;
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    // Chạm 1 ngón xoay camera hoặc Chụm/Tách 2 ngón để thu phóng (Zoom In / Zoom Out) trên vùng Canvas 3D
    domElement.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joystickTouchId) continue;
          this.activeSceneTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }

        if (this.activeSceneTouches.size >= 2) {
          const pts = Array.from(this.activeSceneTouches.values());
          this.lastPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        } else {
          this.lastPinchDistance = null;
        }
      },
      { passive: false }
    );

    // Chặn gesture mặc định của iOS Safari / iPadOS để ưu tiên thu phóng khung cảnh 3D mượt mà
    domElement.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    domElement.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    domElement.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
  }

  /**
   * Tính toán di chuyển của nhân vật dựa theo phím bấm, Joystick ảo và góc camera
   */
  public getMovement(delta: number): { velocity: THREE.Vector3; moved: boolean; desiredRotationY: number | null } {
    const move = new THREE.Vector3(0, 0, 0);

    const forward = this.keys['KeyW'] || this.keys['ArrowUp'];
    const backward = this.keys['KeyS'] || this.keys['ArrowDown'];
    const left = this.keys['KeyA'] || this.keys['ArrowLeft'];
    const right = this.keys['KeyD'] || this.keys['ArrowRight'];

    if (forward) move.z += 1;
    if (backward) move.z -= 1;
    if (left) move.x -= 1;
    if (right) move.x += 1;

    if (Math.abs(this.joystickVec.x) > 0.08 || Math.abs(this.joystickVec.z) > 0.08) {
      move.x += this.joystickVec.x;
      move.z += this.joystickVec.z;
    }

    const moved = move.lengthSq() > 0;
    let desiredRotationY: number | null = null;

    if (moved) {
      move.normalize();

      // Hướng di chuyển tương đối theo góc quay camera
      const forwardVec = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const rightVec = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));

      const worldMove = new THREE.Vector3();
      worldMove.addScaledVector(forwardVec, move.z);
      worldMove.addScaledVector(rightVec, move.x);
      worldMove.normalize();

      // Góc quay nhân vật hướng về phía đang bước đi
      desiredRotationY = Math.atan2(worldMove.x, worldMove.z);

      worldMove.multiplyScalar(GAME_CONFIG.PLAYER_SPEED * delta);
      return { velocity: worldMove, moved: true, desiredRotationY };
    }

    return { velocity: move, moved: false, desiredRotationY: null };
  }

  /**
   * Cập nhật vị trí Third-Person Camera bám chắc theo nhân vật (Không trễ, không rung giật)
   */
  public updateThirdPersonCamera(camera: THREE.PerspectiveCamera, targetPos: THREE.Vector3): void {
    const targetLookAt = new THREE.Vector3(targetPos.x, targetPos.y + 1.25, targetPos.z);

    const targetX = targetLookAt.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const targetY = targetLookAt.y + Math.sin(this.cameraPitch) * this.cameraDistance;
    const targetZ = targetLookAt.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    camera.position.set(targetX, targetY, targetZ);
    camera.lookAt(targetLookAt);
  }
}
