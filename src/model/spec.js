// The design as data. Every Rhino object is generated from this spec, so an instruction changes a number here
// and the geometry is rebuilt, instead of anyone pushing faces around. Units: millimetres. x = east, y = north, z = up.
// Room: a fictional master bedroom used for this proof of concept.

export const INITIAL_SPEC = {
  project: 'Master bedroom, fictional villa',
  units: 'mm',
  room: { width: 4800, depth: 4200, height: 2900, wall: 120, wallMaterial: 'paint_wall' },
  openings: {
    door: { wall: 'south', x: 3500, width: 900, height: 2100 },
    window: { wall: 'east', y: 1300, width: 1800, sill: 600, head: 2500 },
  },
  flooring: { material: 'oak_natural', plankWidth: 180, plankLength: 1200, thickness: 15, stagger: 3 },
  featureWall: {
    wall: 'north',
    zones: [
      { id: 'left', width: 1200, treatment: 'travertine', material: 'travertine_classic' },
      { id: 'center', width: 2400, treatment: 'travertine', material: 'travertine_classic' },
      { id: 'right', width: 1200, treatment: 'travertine', material: 'travertine_classic' },
    ],
    travertine: { slabWidth: 600, slabHeight: 1200, thickness: 20, joint: 3 },
    woodPanels: { panelWidth: 1200, thickness: 18, gap: 6 },
    fluted: { fluteWidth: 40, depth: 12, thickness: 18 },
    plasterNiche: { thickness: 25, nicheWidth: 1800, nicheHeight: 300, nicheBottom: 1150, nicheDepth: 120 },
  },
  wardrobe: { y: 500, width: 2400, depth: 600, height: 2700, doors: 4, doorThickness: 20, material: 'lacquer_greige', handleMaterial: 'brass_brushed' },
  adjacent: [
    { id: 'tall-unit', name: 'Tall linen cabinet', side: 'north', width: 600, depth: 600, height: 2700, rule: 'flush-front', material: 'lacquer_greige' },
    { id: 'drawer-unit', name: 'Drawer unit', side: 'south', width: 450, depth: 450, height: 800, rule: 'front-offset', offset: 150, material: 'walnut_dark' },
  ],
  bed: { width: 1900, length: 2150, height: 320, mattress: 250, headboardHeight: 1150, headboardDepth: 80, material: 'fabric_linen', headboardMaterial: 'fabric_boucle' },
  bedside: { width: 500, depth: 400, height: 550, gapToBed: 60, material: 'walnut_dark' },
  rug: { width: 2600, length: 3000, thickness: 12, material: 'wool_rug' },
  pendants: { size: 220, drop: 900, material: 'brass_brushed' },
  rules: { minWalkway: 700, wardrobeDepth: [450, 800], plankWidth: [90, 400] },
};

export const clone = o => JSON.parse(JSON.stringify(o));
