// Spec -> solid boxes with layer, material and element attributes. The Rhino side (rhino/generator.py) mirrors this
// function line for line; test/parity checks that both produce the same boxes.
const L = {
  walls: 'Bedroom::Architecture::Walls', ceiling: 'Bedroom::Architecture::Ceiling', openings: 'Bedroom::Architecture::Openings',
  floor: 'Bedroom::Finishes::Flooring', feature: 'Bedroom::Finishes::Feature wall',
  wardrobe: 'Bedroom::Joinery::Wardrobe', adjacent: 'Bedroom::Joinery::Adjacent units',
  furniture: 'Bedroom::Furniture', soft: 'Bedroom::Furniture::Soft furnishings', lighting: 'Bedroom::Lighting',
};
export const LAYERS = L;

const r1 = v => Math.round(v * 1000) / 1000;

export function cladDepth(spec, zone) {
  const f = spec.featureWall;
  if (zone.treatment === 'travertine') return f.travertine.thickness;
  if (zone.treatment === 'wood_panels') return f.woodPanels.thickness;
  if (zone.treatment === 'fluted') return f.fluted.thickness + f.fluted.depth;
  if (zone.treatment === 'plaster_shelf') return f.plasterNiche.thickness;
  throw new Error(`unknown treatment ${zone.treatment}`);
}

export function generate(spec) {
  const parts = [];
  const add = (id, element, layer, material, min, max, name) => {
    if (max[0] - min[0] <= 0 || max[1] - min[1] <= 0 || max[2] - min[2] <= 0) return;
    parts.push({ id, element, layer, material, name: name || id, min: min.map(r1), max: max.map(r1) });
  };
  const { width: W, depth: D, height: H, wall: t } = spec.room;
  const fl = spec.flooring;
  const z0 = -fl.thickness;

  // Walls with door and window openings.
  const d = spec.openings.door, w = spec.openings.window;
  add('wall-south-a', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [-t, -t, z0], [d.x, 0, H]);
  add('wall-south-b', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [d.x + d.width, -t, z0], [W + t, 0, H]);
  add('wall-south-head', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [d.x, -t, d.height], [d.x + d.width, 0, H]);
  add('wall-north', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [-t, D, z0], [W + t, D + t, H]);
  add('wall-west', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [-t, 0, z0], [0, D, H]);
  add('wall-east-a', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [W, 0, z0], [W + t, w.y, H]);
  add('wall-east-b', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [W, w.y + w.width, z0], [W + t, D, H]);
  add('wall-east-sill', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [W, w.y, z0], [W + t, w.y + w.width, w.sill]);
  add('wall-east-head', 'walls', L.walls, (spec.room.wallMaterial || 'paint_wall'), [W, w.y, w.head], [W + t, w.y + w.width, H]);
  add('ceiling', 'ceiling', L.ceiling, 'ceiling_white', [0, 0, H], [W, D, H + 20]);
  add('door-leaf', 'door', L.openings, 'lacquer_greige', [d.x + 5, -t / 2 - 20, 0], [d.x + d.width - 5, -t / 2 + 20, d.height - 5], 'Door leaf');
  add('window-glass', 'window', L.openings, 'glass_clear', [W + t / 2 - 4, w.y + 50, w.sill + 50], [W + t / 2 + 4, w.y + w.width - 50, w.head - 50], 'Window glass');
  for (const [k, mn, mx] of [
    ['window-frame-b', [W + t / 2 - 30, w.y, w.sill], [W + t / 2 + 30, w.y + w.width, w.sill + 50]],
    ['window-frame-t', [W + t / 2 - 30, w.y, w.head - 50], [W + t / 2 + 30, w.y + w.width, w.head]],
    ['window-frame-s', [W + t / 2 - 30, w.y, w.sill + 50], [W + t / 2 + 30, w.y + 50, w.head - 50]],
    ['window-frame-n', [W + t / 2 - 30, w.y + w.width - 50, w.sill + 50], [W + t / 2 + 30, w.y + w.width, w.head - 50]],
  ]) add(k, 'window', L.openings, 'aluminium_dark', mn, mx, 'Window frame');
  add('curtain-s', 'curtains', L.soft, 'fabric_linen', [W - 90, w.y - 240, 40], [W - 30, w.y + 20, H - 60], 'Curtain');
  add('curtain-n', 'curtains', L.soft, 'fabric_linen', [W - 90, w.y + w.width - 20, 40], [W - 30, w.y + w.width + 240, H - 60], 'Curtain');

  // Flooring: staggered planks, cut at the walls.
  const pw = fl.plankWidth, pl = fl.plankLength;
  for (let r = 0, y = 0; y < D - 1e-9; r++, y += pw) {
    const y1 = Math.min(D, y + pw);
    const off = ((r % fl.stagger) * pl) / fl.stagger;
    for (let i = 0, x = -off; x < W - 1e-9; i++, x += pl) {
      add(`floor-r${r}-p${i}`, 'flooring', L.floor, fl.material, [Math.max(0, x), y, z0], [Math.min(W, x + pl), y1, 0], 'Floor plank');
    }
  }

  // Feature wall zones on the north wall.
  const f = spec.featureWall;
  let x0 = 0;
  const depthOf = {};
  for (const z of f.zones) {
    const x1 = x0 + z.width;
    const dz = cladDepth(spec, z);
    depthOf[z.id] = dz;
    const el = `feature-${z.id}`;
    const nm = `Feature wall ${z.id}`;
    if (z.treatment === 'travertine') {
      const s = f.travertine, j = s.joint / 2;
      for (let c = 0, xs = x0; xs < x1 - 1e-9; c++, xs += s.slabWidth) for (let k = 0, zs = 0; zs < H - 1e-9; k++, zs += s.slabHeight) {
        add(`${el}-slab-${c}-${k}`, el, L.feature, z.material, [xs + j, D - s.thickness, zs + j], [Math.min(x1, xs + s.slabWidth) - j, D, Math.min(H, zs + s.slabHeight) - j], `${nm} travertine slab`);
      }
    } else if (z.treatment === 'wood_panels') {
      const p = f.woodPanels;
      const n = Math.max(1, Math.ceil(z.width / p.panelWidth - 1e-9));
      const each = z.width / n;
      for (let i = 0; i < n; i++) add(`${el}-panel-${i}`, el, L.feature, z.material, [x0 + i * each + p.gap / 2, D - p.thickness, 0], [x0 + (i + 1) * each - p.gap / 2, D, H], `${nm} wood panel`);
    } else if (z.treatment === 'fluted') {
      const p = f.fluted;
      add(`${el}-board`, el, L.feature, z.material, [x0, D - p.thickness, 0], [x1, D, H], `${nm} backing board`);
      const n = Math.floor(z.width / p.fluteWidth);
      const lead = (z.width - n * p.fluteWidth) / 2;
      for (let i = 0; i < n; i++) {
        const xs = x0 + lead + i * p.fluteWidth + p.fluteWidth * 0.2;
        add(`${el}-flute-${i}`, el, L.feature, z.material, [xs, D - p.thickness - p.depth, 0], [xs + p.fluteWidth * 0.6, D - p.thickness, H], `${nm} flute`);
      }
    } else if (z.treatment === 'plaster_shelf') {
      const p = f.plasterNiche;
      add(`${el}-plaster`, el, L.feature, z.material, [x0, D - p.thickness, 0], [x1, D, H], `${nm} plaster`);
      const sx = x0 + (z.width - p.nicheWidth) / 2;
      add(`${el}-shelf`, el, L.feature, 'walnut_dark', [sx, D - p.thickness - 250, p.nicheBottom + p.nicheHeight], [sx + p.nicheWidth, D - p.thickness, p.nicheBottom + p.nicheHeight + 40], `${nm} floating shelf`);
      add(`${el}-led`, el, L.lighting, 'led_warm', [sx + 20, D - p.thickness - 60, p.nicheBottom + p.nicheHeight - 8], [sx + p.nicheWidth - 20, D - p.thickness - 40, p.nicheBottom + p.nicheHeight], 'LED strip');
    }
    x0 = x1;
  }

  // Bed centred on the centre zone, headboard against the cladding.
  const b = spec.bed;
  const centre = f.zones.find(z => z.id === 'center');
  const cx = f.zones.slice(0, f.zones.indexOf(centre)).reduce((s, z) => s + z.width, 0) + centre.width / 2;
  const hbY1 = D - depthOf.center;
  const hbY0 = hbY1 - b.headboardDepth;
  const bx0 = cx - b.width / 2, bx1 = cx + b.width / 2;
  const by0 = hbY0 - b.length;
  add('bed-headboard', 'bed', L.furniture, b.headboardMaterial, [bx0 - 50, hbY0, 0], [bx1 + 50, hbY1, b.headboardHeight], 'Bed headboard');
  add('bed-base', 'bed', L.furniture, b.material, [bx0, by0, 0], [bx1, hbY0, b.height], 'Bed base');
  add('bed-mattress', 'bed', L.soft, 'fabric_linen', [bx0 + 40, by0 + 40, b.height], [bx1 - 40, hbY0 - 10, b.height + b.mattress], 'Mattress');
  add('bed-pillow-l', 'bed', L.soft, 'fabric_boucle', [bx0 + 120, hbY0 - 420, b.height + b.mattress], [cx - 40, hbY0 - 60, b.height + b.mattress + 160], 'Pillow');
  add('bed-pillow-r', 'bed', L.soft, 'fabric_boucle', [cx + 40, hbY0 - 420, b.height + b.mattress], [bx1 - 120, hbY0 - 60, b.height + b.mattress + 160], 'Pillow');
  add('bed-throw', 'bed', L.soft, 'fabric_throw', [bx0 + 20, by0 + 20, b.height + b.mattress], [bx1 - 20, by0 + 620, b.height + b.mattress + 30], 'Throw');
  const s = spec.bedside;
  const tables = [[bx0 - s.gapToBed - s.width, bx0 - s.gapToBed], [bx1 + s.gapToBed, bx1 + s.gapToBed + s.width]];
  tables.forEach(([a, c], i) => {
    add(`bedside-${i}`, 'bedside', L.furniture, s.material, [a, hbY0 - s.depth, 0], [c, hbY0, s.height], 'Bedside table');
    const p = spec.pendants, mx = (a + c) / 2, my = hbY0 - s.depth / 2;
    add(`pendant-${i}`, 'pendants', L.lighting, p.material, [mx - p.size / 2, my - p.size / 2, H - p.drop - p.size], [mx + p.size / 2, my + p.size / 2, H - p.drop], 'Pendant shade');
    add(`pendant-cable-${i}`, 'pendants', L.lighting, 'aluminium_dark', [mx - 4, my - 4, H - p.drop], [mx + 4, my + 4, H], 'Pendant cable');
  });
  const rg = spec.rug;
  add('rug', 'rug', L.soft, rg.material, [cx - rg.width / 2, Math.max(0, hbY0 - 600 - rg.length), 0], [cx + rg.width / 2, hbY0 - 600, rg.thickness], 'Rug');

  // Wardrobe on the west wall, adjacent units derive their depth from it.
  const wd = spec.wardrobe;
  const front = wd.depth + wd.doorThickness;
  const wy0 = wd.y, wy1 = wd.y + wd.width;
  add('wardrobe-carcass', 'wardrobe', L.wardrobe, wd.material, [0, wy0, 0], [wd.depth, wy1, wd.height], 'Wardrobe carcass');
  const dw = wd.width / wd.doors;
  for (let i = 0; i < wd.doors; i++) {
    add(`wardrobe-door-${i}`, 'wardrobe', L.wardrobe, wd.material, [wd.depth, wy0 + i * dw + 1.5, 20], [front, wy0 + (i + 1) * dw - 1.5, wd.height - 20], 'Wardrobe door');
    const hy = i % 2 === 0 ? wy0 + (i + 1) * dw - 70 : wy0 + i * dw + 54;
    add(`wardrobe-handle-${i}`, 'wardrobe', L.wardrobe, wd.handleMaterial, [front, hy, 850], [front + 25, hy + 16, 1450], 'Wardrobe handle');
  }
  add('wardrobe-bulkhead', 'wardrobe', L.wardrobe, 'paint_wall', [0, wy0, wd.height], [front, wy1, H], 'Bulkhead');
  const derivedAdjacent = {};
  for (const u of spec.adjacent) {
    const depth = u.rule === 'flush-front' ? wd.depth : u.rule === 'front-offset' ? wd.depth - u.offset : u.depth;
    derivedAdjacent[u.id] = depth;
    const ya = u.side === 'north' ? wy1 : wy0 - u.width, yb = u.side === 'north' ? wy1 + u.width : wy0;
    const el = u.id;
    add(`${el}-carcass`, el, L.adjacent, u.material, [0, ya, 0], [depth, yb, u.height], u.name);
    if (u.height > 2000) {
      add(`${el}-door`, el, L.adjacent, u.material, [depth, ya + 1.5, 20], [depth + wd.doorThickness, yb - 1.5, u.height - 20], `${u.name} door`);
      add(`${el}-bulkhead`, el, L.adjacent, 'paint_wall', [0, ya, u.height], [depth + wd.doorThickness, yb, H], 'Bulkhead');
    } else {
      for (let k = 0; k < 3; k++) add(`${el}-drawer-${k}`, el, L.adjacent, u.material, [depth, ya + 1.5, 20 + k * (u.height - 20) / 3 + 1.5], [depth + wd.doorThickness, yb - 1.5, 20 + (k + 1) * (u.height - 20) / 3 - 1.5], `${u.name} drawer front`);
    }
  }

  const derived = { bed: { x0: bx0, x1: bx1, y0: by0, y1: hbY0 }, wardrobeFront: front, adjacentDepth: derivedAdjacent, claddingDepth: depthOf, bedCentreX: cx };
  return { parts, derived };
}
