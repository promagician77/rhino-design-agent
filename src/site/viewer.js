// three.js preview of the same parts that go into the .3dm. Millimetres, z up.
// Raster PBR preview (environment light, sun through the window, soft shadows); final images come from Rhino Render.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MATERIALS } from '../model/materials.js';
import { textureFor } from './textures.js';
import { TEST_CAMERA } from '../recon/metrology.js';

export const VIEWS = {
  hero: { pos: TEST_CAMERA.pos, target: TEST_CAMERA.target, fov: TEST_CAMERA.fovV },
  bed: { pos: [2400, 450, 1350], target: [2400, 4200, 1050], fov: 62 },
  wardrobe: { pos: [4300, 1750, 1450], target: [0, 1850, 1300], fov: 64 },
  plan: { pos: [2400, 1700, 10500], target: [2400, 2150, 0], fov: 32 },
};

const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; };
const TINTED = /^(floor-|feature-.*-(slab|panel|flute))/;

function boxGeometry(p) {
  const sx = p.max[0] - p.min[0], sy = p.max[1] - p.min[1], sz = p.max[2] - p.min[2];
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate((p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const r = hashStr(p.id), ou = r * 7.3, ov = (r * 13.1) % 5;
  const tint = TINTED.test(p.id) ? 0.86 + 0.22 * hashStr(p.id + 'c') : 1;
  const col = new Float32Array(pos.count * 3).fill(tint);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / 1000, y = pos.getY(i) / 1000, z = pos.getZ(i) / 1000;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, y + ou, z + ov); else if (ny > 0.5) uv.setXY(i, x + ou, z + ov); else uv.setXY(i, y + ou, x + ov);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function createViewer(canvas, { interactive = true, onPick = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e4e6e2');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(60, 1.6, 20, 80000);
  camera.up.set(0, 0, 1);
  const controls = interactive ? new OrbitControls(camera, canvas) : null;
  if (controls) { controls.enableDamping = true; controls.minDistance = 600; controls.maxDistance = 16000; controls.addEventListener('change', () => render()); }

  scene.add(new THREE.HemisphereLight('#fff6ea', '#5d5246', 0.5));
  const sun = new THREE.DirectionalLight('#ffe9cf', 2.4);
  sun.position.set(9800, 1500, 5200); sun.target.position.set(2300, 2400, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 2;
  Object.assign(sun.shadow.camera, { left: -4200, right: 4200, top: 4200, bottom: -4200, near: 100, far: 20000 });
  scene.add(sun, sun.target);

  const group = new THREE.Group(); scene.add(group);
  const lamps = new THREE.Group(); scene.add(lamps);
  const mats = new Map();
  const matFor = id => {
    if (mats.has(id)) return mats.get(id);
    const d = MATERIALS[id];
    const m = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.rough ?? 0.6, metalness: d.metal ? 0.85 : 0, vertexColors: true, map: textureFor(id, d) });
    if (m.map) m.color.set('#ffffff');
    if (d.glass) { m.transparent = true; m.opacity = 0.18; m.roughness = 0.05; m.depthWrite = false; }
    if (d.emissive) { m.emissive = new THREE.Color(d.color); m.emissiveIntensity = 2.2; }
    mats.set(id, m);
    return m;
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: '#2A5DB0', transparent: true, opacity: 0.95, depthTest: false });
  let walls = [], room = null, meshes = [];

  function setModel(parts, { highlight = null, spec = null } = {}) {
    for (const c of [...group.children]) { c.geometry?.dispose(); group.remove(c); }
    lamps.clear();
    walls = []; meshes = [];
    for (const p of parts) {
      const g = boxGeometry(p);
      const mesh = new THREE.Mesh(g, matFor(p.material));
      mesh.userData.part = p;
      const glass = MATERIALS[p.material].glass;
      mesh.castShadow = !glass && p.element !== 'ceiling' && p.layer.indexOf('Lighting') < 0;
      mesh.receiveShadow = !glass;
      group.add(mesh); meshes.push(mesh);
      if (p.element === 'walls' || p.element === 'ceiling') walls.push(mesh);
      if (highlight && highlight.has(p.id)) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat); e.renderOrder = 10; group.add(e); }
      if (p.id.startsWith('pendant-') && !p.id.includes('cable')) {
        const l = new THREE.PointLight('#ffcf94', 1.1, 2600, 0);
        l.position.set((p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, p.min[2] - 30); lamps.add(l);
      }
    }
    if (spec) room = spec.room;
    render();
  }

  // Dollhouse: walls between the camera and the room are hidden when orbiting outside.
  function cull() {
    if (!room) return;
    const c = camera.position;
    for (const m of walls) {
      const p = m.userData.part;
      let hide = false;
      if (p.element === 'ceiling') hide = c.z > room.height;
      else if (p.max[0] <= 0) hide = c.x < 0; else if (p.min[0] >= room.width) hide = c.x > room.width;
      else if (p.max[1] <= 0) hide = c.y < 0; else if (p.min[1] >= room.depth) hide = c.y > room.depth;
      m.visible = !hide;
    }
  }

  function setView(name) {
    const v = VIEWS[name] || VIEWS.hero;
    camera.position.set(...v.pos); camera.fov = v.fov;
    camera.lookAt(...v.target);
    if (controls) { controls.target.set(...v.target); controls.update(); }
    camera.updateProjectionMatrix();
    render();
  }

  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    render();
  }

  let queued = false;
  function render() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; draw(); if (controls?.enableDamping && controls.update()) render(); });
  }
  function draw() { cull(); renderer.render(scene, camera); }

  function snapshot(w, h, view = 'hero') {
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    const prev = { pos: camera.position.clone(), fov: camera.fov, aspect: camera.aspect, q: camera.quaternion.clone() };
    const v = VIEWS[view]; camera.position.set(...v.pos); camera.fov = v.fov; camera.aspect = w / h; camera.lookAt(...v.target); camera.updateProjectionMatrix();
    draw();
    const url = renderer.domElement.toDataURL('image/webp', 0.86);
    camera.position.copy(prev.pos); camera.quaternion.copy(prev.q); camera.fov = prev.fov; camera.aspect = prev.aspect; camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); draw();
    return url;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  if (onPick) {
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(meshes.filter(m => m.visible), false).find(h => !MATERIALS[h.object.userData.part.material].glass);
      onPick(hit ? hit.object.userData.part : null);
    });
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  return { setModel, setView, resize, render, snapshot, renderer, camera };
}
