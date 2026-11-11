// Writes a native Rhino .3dm (openNURBS via rhino3dm): millimetre units, nested layers, named materials,
// closed Brep solids, and the element id / part id / parameters on every object as Rhino user text.
// The design spec travels inside the file as document user text, so the agent can rebuild from any saved version.
import { MATERIALS } from './materials.js';
import { generate } from './generate.js';

const hex = h => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 255 });
const NIL = '00000000-0000-0000-0000-000000000000';

export function to3dm(rhino, spec, { label = 'Version 1', note = '' } = {}) {
  const { parts, derived } = generate(spec);
  const doc = new rhino.File3dm();
  doc.settings().modelUnitSystem = rhino.UnitSystem.Millimeters;
  doc.settings().modelAbsoluteTolerance = 0.01;
  doc.strings().set('design-spec', JSON.stringify(spec));
  doc.strings().set('version', label);
  if (note) doc.strings().set('note', note);

  const layerIndex = new Map();
  const ensureLayer = path => {
    if (layerIndex.has(path)) return layerIndex.get(path);
    const names = path.split('::');
    let parentId = NIL, cur = '';
    for (const nm of names) {
      cur = cur ? `${cur}::${nm}` : nm;
      if (!layerIndex.has(cur)) {
        const l = new rhino.Layer();
        l.name = nm;
        if (parentId !== NIL) l.parentLayerId = parentId;
        l.color = { r: 60, g: 66, b: 74, a: 255 };
        const idx = doc.layers().add(l);
        layerIndex.set(cur, idx);
      }
      parentId = doc.layers().findIndex(layerIndex.get(cur)).id;
    }
    return layerIndex.get(path);
  };

  const matIndex = new Map();
  const ensureMat = id => {
    if (matIndex.has(id)) return matIndex.get(id);
    const m = new rhino.Material();
    const def = MATERIALS[id];
    m.name = def.name;
    m.diffuseColor = hex(def.color);
    if (def.glass) m.transparency = 0.8;
    doc.materials().add(m);
    const idx = doc.materials().count - 1;
    matIndex.set(id, idx);
    return idx;
  };

  const params = {
    flooring: spec.flooring, wardrobe: spec.wardrobe, bed: spec.bed, bedside: spec.bedside, rug: spec.rug,
    'tall-unit': { ...spec.adjacent[0], depth: derived.adjacentDepth['tall-unit'] }, 'drawer-unit': { ...spec.adjacent[1], depth: derived.adjacentDepth['drawer-unit'] },
  };
  for (const z of spec.featureWall.zones) params[`feature-${z.id}`] = z;

  for (const p of parts) {
    const brep = rhino.Brep.createFromBoundingBox(new rhino.BoundingBox(p.min, p.max));
    const at = new rhino.ObjectAttributes();
    at.name = p.name;
    at.layerIndex = ensureLayer(p.layer);
    at.materialIndex = ensureMat(p.material);
    at.materialSource = rhino.ObjectMaterialSource.MaterialFromObject;
    at.setUserString('element', p.element);
    at.setUserString('part', p.id);
    at.setUserString('material', p.material);
    if (params[p.element]) at.setUserString('params', JSON.stringify(params[p.element]));
    doc.objects().addBrep(brep, at);
  }
  const bytes = doc.toByteArray();
  return { bytes, objects: parts.length, layers: layerIndex.size, materials: matIndex.size };
}
