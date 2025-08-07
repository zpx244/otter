import * as THREE from './libs/three.module.js';
import { ARButton } from './libs/ARButton.js';
import { GLTFLoader } from './libs/GLTFLoader.js'; // 新增：本地模块

let camera, scene, renderer, controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

// 新增：模型与动画
let otter = null;
let mixer = null;
const clock = new THREE.Clock();

const infoBoxEl = document.getElementById('infoBox');
const narrationEl = document.getElementById('narrationText');
const buttonBox = document.getElementById('extraButtons');
const audioEl = document.getElementById('narrationAudio');

const narrationText = `The first light of day breaks over rooftops. Beneath the brambles, I stir. My holt is hidden from human eyes, tucked deep in the upper Bride’s shadows. The stream here is narrow, but it smells of life—earth, leaf, dew. I slide into the water. Today, like every day, I must patrol, mark, and feed. The city is loud, but I know where to listen. This river is mine. For now.`;

// 预加载音频元数据，避免 duration 为 0
let audioReady = false;
audioEl.addEventListener('loadedmetadata', () => {
  audioReady = true;
});

init();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
  );

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.12, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(render);
}

function onSelect() {
  if (!reticle.visible || otter) return;

  // 加载 GLB 模型替代方块
  const loader = new GLTFLoader();
  loader.load(
    './assets/models/otter.glb',
    (gltf) => {
      otter = gltf.scene;
      otter.position.setFromMatrixPosition(reticle.matrix);
      // 按需调整体型
      otter.scale.set(0.2, 0.2, 0.2);
      // 让水獭头部朝向摄像机的前方（可按需要调整朝向）
      otter.rotation.y = 0;
      scene.add(otter);

      // 动画
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(otter);
        const action = mixer.clipAction(gltf.animations[0]); // 先播第一个
        action.play();
      }

      infoBoxEl.style.display = 'block';
      narrationEl.innerHTML = '';
      buttonBox.style.display = 'none';
      playNarration();
    },
    undefined,
    (err) => {
      console.error('GLB load error:', err);
    }
  );
}

function playNarration() {
  // 确保有音频长度
  const startTyping = () => {
    const chars = narrationText.split('');
    // 若还拿不到 duration，则使用回退时长（30s）
    const duration = audioEl.duration && !isNaN(audioEl.duration) ? audioEl.duration : 30;
    const totalTime = duration * 1000;
    const delay = totalTime / chars.length;

    // 音频结束时再显示按钮
    audioEl.onended = () => {
      showButtons();
    };

    let index = 0;
    function revealNextChar() {
      if (index >= chars.length) return;
      const span = document.createElement('span');
      span.className = 'char';
      span.innerHTML = chars[index] === ' ' ? '&nbsp;' : chars[index];
      narrationEl.appendChild(span);
      index++;
      setTimeout(revealNextChar, delay);
    }

    audioEl.play().catch(err => {
      // iOS 如需用户手势触发播放，这里可能报错；你已用 tap 触发了 onSelect，一般可播放
      console.warn('Autoplay blocked or error:', err);
    });
    revealNextChar();
  };

  if (audioReady || (audioEl.duration && !isNaN(audioEl.duration))) {
    startTyping();
  } else {
    // 等待元数据
    audioEl.addEventListener('loadedmetadata', startTyping, { once: true });
    // 兜底：如果 metadata 一直没来，2秒后也开始
    setTimeout(() => {
      if (!audioReady) startTyping();
    }, 2000);
  }
}

function showButtons() {
  buttonBox.innerHTML = `
    <button onclick="showPopup('holt')">What’s a Holt?</button>
    <button onclick="showPopup('fact')">Did You Know?</button>
  `;
  buttonBox.style.display = 'block';
}

function render(timestamp, frame) {
  const session = renderer.xr.getSession();
  if (session && !hitTestSourceRequested) {
    session.requestReferenceSpace('viewer').then(refSpace => {
      session.requestHitTestSource({ space: refSpace }).then(source => {
        hitTestSource = source;
      });
    });
    session.addEventListener('end', () => {
      hitTestSource = null;
      hitTestSourceRequested = false;
    });
    hitTestSourceRequested = true;
  }

  if (frame && hitTestSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitTestSource);
    if (hits.length > 0) {
      const pose = hits[0].getPose(referenceSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
    } else {
      reticle.visible = false;
    }
  }

  // 更新动画
  if (mixer) {
    const delta = clock.getDelta();
    mixer.update(delta);
  }

  // 简单前进模拟“游动/行进”（按需保留/删除）
  if (otter) {
    otter.position.z -= 0.002;
  }

  renderer.render(scene, camera);
}

// Popup
window.showPopup = function(type) {
  const popup = document.getElementById('popupOverlay');
  const content = document.getElementById('popupText');

  if (type === 'holt') {
    content.innerHTML = `
      <strong>What’s a Holt?</strong>
      <p>A holt is an otter’s home—usually a tunnel or hidden space among roots, rocks, or even urban pipes.</p>
      <p><em>In cities, otters often adapt abandoned drains!</em></p>
      <img src="./assets/images/holt_diagram.png" alt="Holt Diagram" style="width:100%;margin-top:10px;border-radius:6px;">
    `;
  } else if (type === 'fact') {
    content.innerHTML = `
      <strong>Did You Know?</strong>
      <p>Urban otters in Cork have been spotted as far upstream as Blackpool, using storm drains as travel routes.</p>
      <a href="https://www.ucc.ie/en/" target="_blank">View UCC tracking data</a>
    `;
  }

  popup.style.display = 'flex';
};

document.getElementById('popupClose').onclick = () => {
  document.getElementById('popupOverlay').style.display = 'none';
};
