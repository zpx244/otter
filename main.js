import * as THREE from 'https://unpkg.com/three@0.166.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.166.0/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.166.0/examples/jsm/loaders/GLTFLoader.js';

let camera, scene, renderer, controller, reticle, cube;
let hitTestSource = null;
let hitTestSourceRequested = false;

const infoBoxEl = document.getElementById('infoBox');
const narrationEl = document.getElementById('narrationText');
const buttonBox = document.getElementById('extraButtons');
const audioEl = document.getElementById('narrationAudio');

const narrationText = `The first light of day breaks over rooftops. Beneath the brambles, I stir. My holt is hidden from human eyes, tucked deep in the upper Bride’s shadows. The stream here is narrow, but it smells of life — earth, leaf, dew. I slide into the water. 
Today, like every day, I must patrol, mark, and feed. The city is loud, but I know where to listen. This river is mine. For now.`;
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

  document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

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
  if (!reticle.visible || cube) return;

  cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x00ffcc })
  );
  scene.add(cube);
  cube.position.setFromMatrixPosition(reticle.matrix);

  infoBoxEl.style.display = 'block';
  narrationEl.innerHTML = '';
  buttonBox.style.display = 'none';

  playNarration();
}

function playNarration() {
  const chars = narrationText.split('');
  const duration = audioEl.duration || 30; // fallback
  const totalTime = duration * 1000;
  const delay = totalTime / chars.length;

  let index = 0;

  function revealNextChar() {
    if (index >= chars.length) {
      showButtons();
      return;
    }
    const span = document.createElement('span');
    span.className = 'char';
    span.innerHTML = chars[index] === ' ' ? '&nbsp;' : chars[index];
    narrationEl.appendChild(span);
    index++;
    setTimeout(revealNextChar, delay);
  }

  audioEl.play();
  revealNextChar();
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

  if (cube) cube.position.z -= 0.002;

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
