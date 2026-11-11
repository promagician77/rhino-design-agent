// Material library. Colors are sRGB; the same names become Rhino materials in the .3dm.
export const MATERIALS = {
  oak_natural:        { name: 'Oak natural',          color: '#b88a5c', rough: 0.55, grain: 'wood' },
  walnut_light:       { name: 'Walnut light',         color: '#9a6a44', rough: 0.5,  grain: 'wood' },
  walnut_dark:        { name: 'Walnut dark',          color: '#5b3b26', rough: 0.45, grain: 'wood' },
  smoked_oak_veneer:  { name: 'Smoked oak veneer',    color: '#7d5a40', rough: 0.4,  grain: 'wood' },
  fluted_oak:         { name: 'Fluted oak',           color: '#a77b52', rough: 0.5,  grain: 'wood' },
  travertine_classic: { name: 'Travertine classic',   color: '#d8c9ae', rough: 0.7,  grain: 'stone' },
  travertine_silver:  { name: 'Travertine silver',    color: '#cdc7bb', rough: 0.7,  grain: 'stone' },
  plaster_lime:       { name: 'Lime plaster',         color: '#e9e3d9', rough: 0.95, grain: 'plaster' },
  lacquer_greige:     { name: 'Lacquer greige',       color: '#cbc2b4', rough: 0.35 },
  paint_wall:         { name: 'Wall paint warm white', color: '#ebe8e2', rough: 0.95 },
  ceiling_white:      { name: 'Ceiling white',        color: '#f4f3f0', rough: 0.95 },
  fabric_linen:       { name: 'Linen',                color: '#e2dbcf', rough: 0.95, grain: 'fabric' },
  fabric_boucle:      { name: 'Bouclé ivory',         color: '#efe9de', rough: 1.0,  grain: 'fabric' },
  wool_rug:           { name: 'Wool rug',             color: '#b5a995', rough: 1.0,  grain: 'fabric' },
  fabric_throw:       { name: 'Wool throw, moss',     color: '#6f6c4f', rough: 1.0,  grain: 'fabric' },
  brass_brushed:      { name: 'Brushed brass',        color: '#b08d57', rough: 0.35, metal: 1 },
  glass_clear:        { name: 'Clear glass',          color: '#cfe0e6', rough: 0.05, glass: 1 },
  aluminium_dark:     { name: 'Dark aluminium',       color: '#3b3d40', rough: 0.4, metal: 1 },
  concrete:           { name: 'Concrete subfloor',    color: '#9a9994', rough: 0.9 },
  led_warm:           { name: 'LED warm 2700K',       color: '#ffd9a0', rough: 0.5, emissive: 1 },
};

// Words a person might use for each material (used by the demo's instruction reader).
export const MATERIAL_WORDS = [
  ['light walnut', 'walnut_light'], ['walnut light', 'walnut_light'], ['pale walnut', 'walnut_light'],
  ['dark walnut', 'walnut_dark'], ['walnut', 'walnut_light'],
  ['smoked oak', 'smoked_oak_veneer'], ['natural oak', 'oak_natural'], ['oak', 'oak_natural'],
  ['wood panel', 'smoked_oak_veneer'], ['wood veneer', 'smoked_oak_veneer'],
  ['silver travertine', 'travertine_silver'], ['travertine', 'travertine_classic'],
  ['plaster', 'plaster_lime'], ['paint', 'paint_wall'], ['white', 'paint_wall'], ['greige', 'lacquer_greige'], ['lacquer', 'lacquer_greige'],
  ['brass', 'brass_brushed'], ['linen', 'fabric_linen'], ['boucle', 'fabric_boucle'], ['bouclé', 'fabric_boucle'],
];

export const STOCK_PLANK_WIDTHS = [120, 150, 180, 240, 300];
