// Procedural material textures drawn on a canvas, so the demo needs no image files. One tile = 1 m.
import * as THREE from 'three';

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function canvas(size = 512) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; }
const shade = (hex, f) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`; };

// Wood: grain runs along the canvas height (v). Long wavy lines with darker latewood and a few knots.
function wood(base) {
  const [c, g] = canvas();
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const x0 = rnd() * 512, w = 0.6 + rnd() * 2.2, a = 0.05 + rnd() * 0.16, amp = 2 + rnd() * 6, ph = rnd() * 6;
    g.strokeStyle = rnd() > 0.5 ? `rgba(40,22,10,${a})` : `rgba(255,236,210,${a * 0.6})`;
    g.lineWidth = w; g.beginPath();
    for (let y = -10; y <= 522; y += 8) g.lineTo(x0 + Math.sin(y / 70 + ph) * amp + Math.sin(y / 23 + ph * 2) * amp * 0.25, y);
    g.stroke();
  }
  for (let k = 0; k < 2; k++) { const x = rnd() * 512, y = rnd() * 512; const r = g.createRadialGradient(x, y, 1, x, y, 10); r.addColorStop(0, 'rgba(30,15,6,.35)'); r.addColorStop(1, 'rgba(30,15,6,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(x, y, 5, 12, 0, 0, Math.PI * 2); g.fill(); }
  return c;
}

// Travertine: horizontal bedding bands, small pits and soft clouds.
function travertine(base) {
  const [c, g] = canvas();
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) { const y = rnd() * 512; g.fillStyle = `rgba(${rnd() > 0.5 ? '120,95,60' : '255,250,235'},${0.04 + rnd() * 0.07})`; g.fillRect(0, y, 512, 2 + rnd() * 10); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,70,45,${0.15 + rnd() * 0.3})`; g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 1 + rnd() * 5, 0.6 + rnd() * 1.6, 0, 0, Math.PI * 2); g.fill(); }
  return c;
}

function noise(base, amount = 0.05, specks = 2500) {
  const [c, g] = canvas(256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < specks; i++) { g.fillStyle = rnd() > 0.5 ? `rgba(0,0,0,${amount * rnd()})` : `rgba(255,255,255,${amount * rnd()})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  return c;
}

function weave(base) {
  const [c, g] = canvas(128);
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 3) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(i, 0, 1, 128); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, i, 128, 1); }
  return c;
}

const cache = new Map();
export function textureFor(id, def) {
  if (cache.has(id)) return cache.get(id);
  let c = null, repeat = 1;
  if (def.grain === 'wood') c = wood(def.color);
  else if (id.startsWith('travertine')) c = travertine(def.color);
  else if (id === 'plaster_lime' || id === 'concrete') c = noise(def.color, 0.06, 4000);
  else if (id.startsWith('fabric') || id === 'wool_rug') { c = weave(def.color); repeat = 8; }
  else if (id === 'paint_wall' || id === 'ceiling_white' || id === 'lacquer_greige') c = noise(def.color, 0.025, 1200);
  let t = null;
  if (c) {
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.repeat.set(repeat, repeat);
  }
  cache.set(id, t);
  return t;
}
export { shade };
