import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ModelType = 'girl' | 'cun';

export interface ModelProgressInfo {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  loadedMB: string;
  totalMB: string;
  currentFile: string;
  isComplete: boolean;
  error?: string;
}

export class ModelManager {
  private static instance: ModelManager;
  private loader: GLTFLoader;
  private loadedModels: Map<ModelType, THREE.Group> = new Map();
  private modelHeights: Map<ModelType, number> = new Map();
  private isLoaded: boolean = false;
  private onProgressCallback?: (info: ModelProgressInfo) => void;

  // Kích thước tệp chuẩn (bytes) để tính tỷ lệ tiến độ chính xác
  private fileSizes: Record<ModelType, number> = {
    girl: 48368084, // ~46.1 MB
    cun: 95225232,  // ~90.8 MB (đã tối ưu hóa dưới 100MB cho GitHub)
  };

  private bytesLoaded: Record<ModelType, number> = {
    girl: 0,
    cun: 0,
  };

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  constructor() {
    this.loader = new GLTFLoader();
  }

  public setProgressCallback(cb: (info: ModelProgressInfo) => void): void {
    this.onProgressCallback = cb;
  }

  /**
   * Tải đồng thời cả 2 tệp mô hình 3D (girl.glb và cun.glb) từ thư mục /models/
   * kèm theo báo cáo phần trăm tiến độ chi tiết.
   */
  public async loadAllModels(): Promise<void> {
    if (this.isLoaded) {
      this.emitProgress('Đã tải sẵn mô hình!', true);
      return;
    }

    try {
      this.emitProgress('Bắt đầu kết nối và tải mô hình 3D...', false);

      await Promise.all([
        this.loadSingleModel('girl', '/models/girl.glb'),
        this.loadSingleModel('cun', '/models/cun.glb'),
      ]);

      this.isLoaded = true;
      this.emitProgress('Hoàn tất tải và tối ưu mô hình 3D!', true);
      console.log('[ModelManager] Đã tải thành công toàn bộ mô hình 3D (girl.glb & cun.glb)!');
    } catch (err: any) {
      console.error('[ModelManager] Lỗi khi nạp mô hình 3D:', err);
      const errInfo: ModelProgressInfo = {
        percent: 0,
        loadedBytes: 0,
        totalBytes: this.fileSizes.girl + this.fileSizes.cun,
        loadedMB: '0.0',
        totalMB: ((this.fileSizes.girl + this.fileSizes.cun) / (1024 * 1024)).toFixed(1),
        currentFile: 'Lỗi tải mô hình!',
        isComplete: false,
        error: err?.message || 'Không thể tải file .glb',
      };
      if (this.onProgressCallback) {
        this.onProgressCallback(errInfo);
      }
      throw err;
    }
  }

  private loadSingleModel(type: ModelType, url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const rawScene = gltf.scene;

          // 1. Tính toán bounding box chuẩn xác
          const box = new THREE.Box3().setFromObject(rawScene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          // 2. Tạo wrapper pivot để chân mô hình chạm chính xác mặt đất (y = 0) và tâm X, Z nằm tại (0, 0)
          const wrapper = new THREE.Group();
          wrapper.name = `character_wrapper_${type}`;

          rawScene.position.x = -center.x;
          rawScene.position.z = -center.z;
          rawScene.position.y = -box.min.y;

          wrapper.add(rawScene);

          // 3. Tối ưu Shadow & Material
          wrapper.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((m) => {
                    m.needsUpdate = true;
                  });
                } else {
                  mesh.material.needsUpdate = true;
                }
              }
            }
          });

          this.loadedModels.set(type, wrapper);
          this.modelHeights.set(type, size.y);
          this.bytesLoaded[type] = this.fileSizes[type];
          this.emitProgress(`Đã tải xong [${type === 'girl' ? 'girl.glb' : 'cun.glb'}]!`);

          resolve(wrapper);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            this.fileSizes[type] = xhr.total;
          }
          this.bytesLoaded[type] = xhr.loaded;
          const fileName = type === 'girl' ? 'girl.glb' : 'cun.glb';
          const fileMb = (xhr.loaded / (1024 * 1024)).toFixed(1);
          const totalFileMb = (this.fileSizes[type] / (1024 * 1024)).toFixed(1);
          this.emitProgress(`Đang tải ${fileName} (${fileMb} MB / ${totalFileMb} MB)...`);
        },
        (error) => {
          console.error(`[ModelManager] Thất bại khi nạp ${url}:`, error);
          reject(error);
        }
      );
    });
  }

  private emitProgress(currentFile: string, isComplete: boolean = false): void {
    const totalBytes = this.fileSizes.girl + this.fileSizes.cun;
    const currentLoaded = Math.min(totalBytes, this.bytesLoaded.girl + this.bytesLoaded.cun);
    const percent = isComplete ? 100 : Math.min(99, Math.round((currentLoaded / totalBytes) * 100));

    const info: ModelProgressInfo = {
      percent,
      loadedBytes: currentLoaded,
      totalBytes,
      loadedMB: (currentLoaded / (1024 * 1024)).toFixed(1),
      totalMB: (totalBytes / (1024 * 1024)).toFixed(1),
      currentFile,
      isComplete,
    };

    if (this.onProgressCallback) {
      this.onProgressCallback(info);
    }
  }

  /**
   * Trả về một bản clone độc lập của mô hình 3D để gắn vào nhân vật
   */
  public getModel(type: ModelType): THREE.Group | null {
    const template = this.loadedModels.get(type);
    if (!template) return null;
    return template.clone(true);
  }

  public getModelHeight(type: ModelType): number {
    return this.modelHeights.get(type) || (type === 'cun' ? 1.47 : 1.9);
  }

  public isReady(): boolean {
    return this.isLoaded;
  }
}

