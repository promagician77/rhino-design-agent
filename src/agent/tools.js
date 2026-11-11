// The only actions the AI may request. In production these are OpenAI function tools (strict JSON schema);
// the model fills in arguments, this code checks them, and Rhino runs a fixed, tested function for each one.
// The model never writes or runs free-form scripts against the client's file.
import { MATERIALS } from '../model/materials.js';

const MAT = Object.keys(MATERIALS);
const n = (desc) => ({ type: ['number', 'null'], description: desc });
const e = (vals, desc) => ({ type: ['string', 'null'], enum: [...vals, null], description: desc });

export const ELEMENTS = ['wardrobe', 'tall-unit', 'drawer-unit', 'bed', 'bedside', 'rug'];
export const DIMENSIONS = ['depth', 'width', 'height', 'length'];
export const TREATMENTS = ['travertine', 'wood_panels', 'fluted', 'plaster_shelf'];

const fn = (name, description, properties) => ({
  type: 'function', name, description, strict: true,
  parameters: { type: 'object', additionalProperties: false, required: Object.keys(properties), properties },
});

export const TOOLS = [
  fn('set_flooring', 'Change the floor finish. Planks are rebuilt to the new size across the whole room.', {
    material: e(MAT, 'Material id from the library'),
    plank_width_mm: n('New plank width in mm'),
    plank_width_change: e(['wider', 'narrower'], 'Use when the person says wider or narrower without a number: next stock width'),
    plank_length_mm: n('New plank length in mm'),
  }),
  fn('set_wall_treatment', 'Change the treatment of one zone of the feature wall behind the bed.', {
    zone: { type: 'string', enum: ['left', 'center', 'right', 'all'] },
    treatment: { type: 'string', enum: TREATMENTS },
    material: e(MAT, 'Material id; null keeps the default for the treatment'),
    panel_width_mm: n('Wood panel width for wood_panels; null keeps 1200 mm'),
    keep_other_zones: { type: 'boolean', description: 'True when the person says to keep or retain the other zones' },
  }),
  fn('change_dimension', 'Change one dimension of a joinery or furniture element. Related units follow their rules.', {
    element: { type: 'string', enum: ELEMENTS },
    dimension: { type: 'string', enum: DIMENSIONS },
    delta_mm: n('Relative change in mm, negative to reduce'),
    value_mm: n('Absolute new value in mm'),
    adjust_adjacent: { type: 'boolean', description: 'Apply the adjacency rules to neighbouring units' },
  }),
  fn('set_material', 'Change the material of an element.', {
    element: { type: 'string', enum: [...ELEMENTS, 'walls'] },
    material: { type: 'string', enum: MAT },
  }),
  fn('generate_variants', 'Propose alternative designs for the feature wall, each checked and rendered.', {
    count: { type: 'integer', minimum: 1, maximum: 4 },
  }),
  fn('render_view', 'Render the current model from a named view.', { view: { type: 'string', enum: ['hero', 'bed', 'wardrobe', 'plan'] } }),
  fn('save_version', 'Save the approved model as a new version (.3dm).', { label: { type: 'string' } }),
  fn('rollback', 'Restore an earlier saved version.', { version: { type: 'string', description: 'Version label, e.g. "Version 1"' } }),
  fn('ask_clarification', 'Ask one question when the instruction is unclear or not supported.', { question: { type: 'string' } }),
];

export const SYSTEM_PROMPT = `You edit an interior model in Rhino for a non-technical designer.
Use only the tools given. One tool call per change. Use millimetres.
If an instruction is unclear, uses a material that is not in the library, or asks to delete things, call ask_clarification.
Never invent dimensions: if a number is needed and missing, ask.`;
