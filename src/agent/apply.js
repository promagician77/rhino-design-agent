// Applies one validated tool call to a copy of the spec. Pure: no geometry, no Rhino. Geometry is rebuilt afterwards.
import { clone } from '../model/spec.js';
import { MATERIALS, STOCK_PLANK_WIDTHS } from '../model/materials.js';

const DEFAULT_MAT = { travertine: 'travertine_classic', wood_panels: 'smoked_oak_veneer', fluted: 'fluted_oak', plaster_shelf: 'plaster_lime' };
export const TREATMENT_NAME = { travertine: 'travertine', wood_panels: 'large-format wood panels', fluted: 'fluted oak', plaster_shelf: 'lime plaster with a floating shelf' };
const matName = id => MATERIALS[id]?.name || id;

function dimTarget(spec, element, dimension) {
  const map = {
    wardrobe: { depth: ['wardrobe', 'depth'], width: ['wardrobe', 'width'], height: ['wardrobe', 'height'] },
    bed: { width: ['bed', 'width'], length: ['bed', 'length'], height: ['bed', 'height'] },
    bedside: { width: ['bedside', 'width'], depth: ['bedside', 'depth'], height: ['bedside', 'height'] },
    rug: { width: ['rug', 'width'], length: ['rug', 'length'] },
  };
  if (element === 'tall-unit' || element === 'drawer-unit') {
    const u = spec.adjacent.find(a => a.id === element);
    if (dimension === 'depth') return { error: `${u.name.toLowerCase()} depth follows the wardrobe (${u.rule === 'flush-front' ? 'flush fronts' : `front set back ${u.offset} mm`}); change the wardrobe depth instead` };
    if (dimension === 'width' || dimension === 'height') return { obj: u, key: dimension, label: `${u.name.toLowerCase()} ${dimension}` };
  }
  const t = map[element]?.[dimension];
  if (!t) return { error: `${element} has no ${dimension} I can change` };
  return { obj: spec[t[0]], key: t[1], label: `${element === 'bedside' ? 'bedside table' : element} ${dimension}` };
}

export function applyCall(spec0, call) {
  const spec = clone(spec0);
  const a = call.arguments;
  const changes = [];
  const set = (obj, key, to, label) => { if (obj[key] !== to) { changes.push({ what: label, from: obj[key], to }); obj[key] = to; } };

  switch (call.name) {
    case 'set_flooring': {
      const f = spec.flooring;
      if (a.material) {
        if (!MATERIALS[a.material] || MATERIALS[a.material].grain !== 'wood') return { error: `${matName(a.material)} is not a wood flooring in the library` };
        set(f, 'material', a.material, 'flooring material');
      }
      let w = a.plank_width_mm;
      if (w == null && a.plank_width_change) {
        const i = STOCK_PLANK_WIDTHS.indexOf(f.plankWidth);
        const next = a.plank_width_change === 'wider' ? STOCK_PLANK_WIDTHS.find(x => x > f.plankWidth) : [...STOCK_PLANK_WIDTHS].reverse().find(x => x < f.plankWidth);
        if (next == null) return { error: `no stock plank ${a.plank_width_change} than ${f.plankWidth} mm` };
        w = next; void i;
      }
      if (w != null) set(f, 'plankWidth', w, 'plank width (mm)');
      if (a.plank_length_mm != null) set(f, 'plankLength', a.plank_length_mm, 'plank length (mm)');
      break;
    }
    case 'set_wall_treatment': {
      const zones = a.zone === 'all' ? spec.featureWall.zones : spec.featureWall.zones.filter(z => z.id === a.zone);
      if (!zones.length) return { error: `no ${a.zone} zone on the feature wall` };
      const mat = a.material || DEFAULT_MAT[a.treatment];
      for (const z of zones) {
        set(z, 'treatment', a.treatment, `${z.id} zone treatment`);
        set(z, 'material', mat, `${z.id} zone material`);
      }
      if (a.panel_width_mm != null) set(spec.featureWall.woodPanels, 'panelWidth', a.panel_width_mm, 'wood panel width (mm)');
      break;
    }
    case 'change_dimension': {
      const t = dimTarget(spec, a.element, a.dimension);
      if (t.error) return { error: t.error };
      const from = t.obj[t.key];
      const to = a.value_mm != null ? a.value_mm : from + (a.delta_mm || 0);
      if (a.value_mm == null && !a.delta_mm) return { error: 'no amount given' };
      set(t.obj, t.key, Math.round(to * 10) / 10, `${t.label} (mm)`);
      break;
    }
    case 'set_material': {
      if (!MATERIALS[a.material]) return { error: `${a.material} is not in the material library` };
      if (a.element === 'walls') {
        if (!['paint_wall', 'plaster_lime'].includes(a.material)) return { error: 'walls can be painted or finished in lime plaster' };
        set(spec.room, 'wallMaterial', a.material, 'walls material');
        break;
      }
      const target = { wardrobe: spec.wardrobe, bed: spec.bed, bedside: spec.bedside, rug: spec.rug }[a.element] || spec.adjacent.find(u => u.id === a.element);
      if (!target) return { error: `I can't change the material of ${a.element}` };
      set(target, 'material', a.material, `${a.element} material`);
      break;
    }
    default:
      return { error: `${call.name} does not change the model` };
  }
  return { spec, changes };
}

export const describeChange = c => typeof c.from === 'number'
  ? `${c.what}: ${c.from} → ${c.to}`
  : `${c.what}: ${matName(c.from) === c.from ? TREATMENT_NAME[c.from] || c.from : matName(c.from)} → ${matName(c.to) === c.to ? TREATMENT_NAME[c.to] || c.to : matName(c.to)}`;
