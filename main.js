// main.js  —  Minimal WebAR demo with tap-to-place cube + tap-to-show info box
// Local modules (placed in ./libs/)
import * as THREE from './libs/three.module.js';
import { ARButton } from './libs/ARButton.js';

// ----- globals -----
let camera, scene, renderer;
let controller;
let reticle;
let cube = null;

let hitTestSource = null;
let hitTestSourceRequested = false;

let raycaster, pointer;
let infoBoxVisible = false;

// cached DOM refs (index.html must include #infoBox)
const infoBoxEl = document.getElementById('infoBox');

// ------------------------------------- init -------------------------------------
init();
function init() {

  // scene + camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();

  // light
  const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  hemi.position.set(0.5, 1, 0.25);
  scene.add(hemi);

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // AR button
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'] // request plane/hit detection
      // optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body }
    })
  );

  // controller (primary input source tap/select)
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  // reticle (placement indicator)
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.12, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // raycaster for screen-tap picking (info box)
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  window.addEventListener('pointerdown', onPointerDown, false);

  // responsive
  window.addEventListener('resize', onWindowResize, false);

  // main loop
  renderer.setAnimationLoop(render);
}

// ------------------------------------- events -------------------------------------

function onSelect() {
  // place cube at reticle first time user taps AR select
  if (!reticle.visible || cube) return;

  cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x00ffcc })
  );
  cube.name = 'Otter (placeholder cube)';
  cube.position.setFromMatrixPosition(reticle.matrix);
  scene.add(cube);
}

function onPointerDown(event) {
  // ignore if no cube yet
  if (!cube) return;

  // normalize pointer coords
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(cube, false); // test cube only

  if (hits.length > 0) {
    showInfoBox(event.clientX, event.clientY, cube);
  } else {
    hideInfoBox();
  }
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ------------------------------------- info box -------------------------------------

function showInfoBox(screenX, screenY, obj) {
  if (!infoBoxEl) return;
  infoBoxEl.style.display = 'block';
  infoBoxVisible = true;

  // position near tap (offset so finger not cover)
  const offset = 10;
  infoBoxEl.style.left = `${Math.min(screenX + offset, window.innerWidth - 300)}px`;
  infoBoxEl.style.top = `${Math.max(screenY - 80, 10)}px`;

  // dynamic content
  infoBoxEl.innerHTML = `
    <button id="closeBtn" style="float:right;border:none;background:none;font-size:16px;cursor:pointer;">×</button>
    <strong>${obj.name || 'Otter'}</strong>
    <p>This cube stands in for the otter. In the final build this will be a rigged model that can move along the River Lee path.</p>
  `;

  // wire close
  document.getElementById('closeBtn').onclick = hideInfoBox;
}

function hideInfoBox() {
  if (!infoBoxEl) return;
  infoBoxEl.style.display = 'none';
  infoBoxVisible = false;
}

// ------------------------------------- render loop -------------------------------------

function render(timestamp, frame) {

  // request hit test source once per session
  const session = renderer.xr.getSession();
  if (session && !hitTestSourceRequested) {
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

  if (frame && hitTestSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
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

  // simple forward motion (pretend "swimming")
  if (cube) {
    cube.position.z -= 0.003;
  }

  renderer.render(scene, camera);
}
