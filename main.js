// ✅ 使用官方 ES 模块 CDN 引入
import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'https://unpkg.com/three@0.157.0/examples/jsm/webxr/ARButton.js';

// 创建基本场景
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

// 渲染器配置（开启透明和 WebXR 支持）
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// 添加 AR 启动按钮
document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

// 环境光照
const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
scene.add(light);

// 加载 GLTF 模型（可替换为你自己的 otter 模型）
let model;
const loader = new GLTFLoader();
loader.load(
  'assets/models/sky_otter/scene.gltf',
  (gltf) => {
    model = gltf.scene;
    model.scale.set(0.5, 0.5, 0.5); // 按需调整大小
  },
  undefined,
  (error) => {
    console.error('Error loading model:', error);
  }
);

// 添加可交互点击的 reticle（放置提示圈）
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// 添加控制器用于放置模型
const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (reticle.visible && model) {
    const placed = model.clone();
    placed.position.setFromMatrixPosition(reticle.matrix);
    scene.add(placed);
  }
});
scene.add(controller);

// hit-test 变量
let hitTestSource = null;
let hitTestSourceRequested = false;

// 渲染循环
renderer.setAnimationLoop((timestamp, frame) => {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((space) => {
        session.requestHitTestSource({ space }).then((source) => {
          hitTestSource = source;
        });
      });

      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
});
