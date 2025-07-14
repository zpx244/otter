// 创建基本场景
const scene = new THREE.Scene();

// 创建相机（AR 模式会自动接管）
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// 添加 AR 按钮（仅在支持设备中可用）
document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

// 添加光照
const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
scene.add(light);

// 用于放置模型
let controller;
let reticle;      // 命中测试的瞄准器
let model;        // 水獭模型
let hitTestSource = null;
let hitTestSourceRequested = false;

// 加载 GLTF 模型（只加载一次）
const loader = new THREE.GLTFLoader();
loader.load('assets/models/sky_otter/scene.gltf', function (gltf) {
  model = gltf.scene;
  model.scale.set(0.5, 0.5, 0.5); // 可根据模型大小调整
}, undefined, function (error) {
  console.error('Error loading model:', error);
});

// 添加命中测试的目标环（reticle）
reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// 添加控制器（用于点击放置模型）
controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (reticle.visible && model) {
    const placed = model.clone();
    placed.position.setFromMatrixPosition(reticle.matrix);
    scene.add(placed);
  }
});
scene.add(controller);

// 渲染循环
renderer.setAnimationLoop(function (timestamp, frame) {
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
