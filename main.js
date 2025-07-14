// 使用官方模块 CDN
import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'https://unpkg.com/three@0.157.0/examples/jsm/webxr/ARButton.js';

// 基础场景、相机、渲染器
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// AR 按钮
document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

// 光照
const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
scene.add(light);

// 模型加载
let model;
const loader = new GLTFLoader();
loader.load(
  'assets/models/sky_otter/scene.gltf',
  (gltf) => {
    model = gltf.scene;
    model.scale.set(0.5, 0.5, 0.5);
  },
  undefined,
  (error) => {
    console.error('Model load error:', error);
  }
);

// 放置 reticle 命中环
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// 控制器（点击放置）
const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (reticle.visible && model) {
    const clone = model.clone();
    clone.position.setFromMatrixPosition(reticle.matrix);
    scene.add(clone);
  }
});
scene.add(controller);

// 命中测试
let hitTestSource = null;
let hitTestSourceRequested = false;

renderer.setAnimationLoop((timestamp, frame) => {
  if (frame) {
    const refSpace = renderer.xr.getReferenceSpace();
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
        const pose = hit.getPose(refSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
});
