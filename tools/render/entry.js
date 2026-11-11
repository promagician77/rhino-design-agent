import { createViewer } from '../../src/site/viewer.js';
import { generate } from '../../src/model/generate.js';
const canvas = document.querySelector('canvas');
const v = createViewer(canvas, { interactive: false });
window.renderSpec = (spec, view, w, h) => { v.setModel(generate(spec).parts, { spec }); return v.snapshot(w, h, view); };
window.ready = true;
