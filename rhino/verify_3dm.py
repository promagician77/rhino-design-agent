"""Opens every exported .3dm with McNeel's rhino3dm (the openNURBS reader Rhino uses) and checks it independently of
the JavaScript that wrote it: units, layer tree, materials, closed solids, user text, the embedded design spec, and
whether the Python generator (the one Rhino will run) rebuilds exactly the same geometry from that spec.
Usage: python3 rhino/verify_3dm.py build/models data/verify.json"""
import json
import os
import sys

import rhino3dm

sys.path.insert(0, os.path.dirname(__file__))
from generator import generate  # noqa: E402

EXPECT = {
    'Version-1.3dm': {'wardrobe-carcass depth': 600, 'plank width': 180, 'centre treatment': 'travertine', 'tall-unit depth': 600, 'drawer-unit depth': 450},
    'Version-2.3dm': {'wardrobe-carcass depth': 700, 'plank width': 240, 'centre treatment': 'wood_panels', 'tall-unit depth': 700, 'drawer-unit depth': 550},
}


def layer_path(model, idx):
    layers = {str(l.Id): l for l in model.Layers}
    l = model.Layers[idx]
    names = [l.Name]
    while str(l.ParentLayerId) != '00000000-0000-0000-0000-000000000000':
        l = layers[str(l.ParentLayerId)]
        names.insert(0, l.Name)
    return '::'.join(names)


def verify(path):
    m = rhino3dm.File3dm.Read(path)
    name = os.path.basename(path)
    res = {'file': name, 'units': str(m.Settings.ModelUnitSystem), 'objects': len(m.Objects), 'layers': len(m.Layers), 'materials': len(m.Materials)}
    strings = dict(m.Strings[i] for i in range(len(m.Strings)))
    spec = json.loads(strings['design-spec'])
    res['version'] = strings.get('version')
    solids, closed, user_text, by_layer, parts = 0, 0, 0, {}, {}
    for o in m.Objects:
        g, a = o.Geometry, o.Attributes
        if isinstance(g, rhino3dm.Brep):
            solids += 1
            closed += 1 if g.IsSolid else 0
        if a.GetUserString('element') and a.GetUserString('part') and a.GetUserString('material'):
            user_text += 1
        lp = layer_path(m, a.LayerIndex)
        by_layer[lp] = by_layer.get(lp, 0) + 1
        bb = g.GetBoundingBox()
        parts[a.GetUserString('part')] = {'min': [bb.Min.X, bb.Min.Y, bb.Min.Z], 'max': [bb.Max.X, bb.Max.Y, bb.Max.Z],
                                          'layer': lp, 'material': m.Materials[a.MaterialIndex].Name, 'params': a.GetUserString('params')}
    res.update({'breps': solids, 'closedSolids': closed, 'withUserText': user_text, 'byLayer': by_layer})

    # Parity: rebuild from the embedded spec with the Python generator and compare every box.
    py = generate(spec)['parts']
    worst, missing = 0.0, 0
    for p in py:
        q = parts.get(p['id'])
        if not q:
            missing += 1
            continue
        for k in range(3):
            worst = max(worst, abs(q['min'][k] - p['min'][k]), abs(q['max'][k] - p['max'][k]))
        if q['layer'] != p['layer']:
            missing += 1
    res['parity'] = {'pythonParts': len(py), 'fileParts': len(parts), 'mismatched': missing + abs(len(py) - len(parts)), 'maxDeviationMm': round(worst, 6)}

    # Facts a designer would check by hand in Rhino.
    facts = {}
    c = parts.get('wardrobe-carcass')
    if c:
        facts['wardrobe-carcass depth'] = round(c['max'][0] - c['min'][0], 3)
    for u in ('tall-unit', 'drawer-unit'):
        q = parts.get(u + '-carcass')
        if q:
            facts[u + ' depth'] = round(q['max'][0] - q['min'][0], 3)
    p0 = parts.get('floor-r0-p1')
    if p0:
        facts['plank width'] = round(p0['max'][1] - p0['min'][1], 3)
        facts['floor material'] = p0['material']
    centre = [z for z in spec['featureWall']['zones'] if z['id'] == 'center'][0]
    facts['centre treatment'] = centre['treatment']
    res['facts'] = facts
    exp = EXPECT.get(name, {})
    res['expected'] = {k: {'want': v, 'got': facts.get(k), 'ok': facts.get(k) == v} for k, v in exp.items()}
    res['ok'] = (closed == res['objects'] and user_text == res['objects'] and res['parity']['mismatched'] == 0
                 and res['parity']['maxDeviationMm'] < 0.01 and all(e['ok'] for e in res['expected'].values()))
    return res


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    results = [verify(os.path.join(src, f)) for f in sorted(os.listdir(src)) if f.endswith('.3dm')]
    with open(out, 'w') as fh:
        json.dump({'reader': 'rhino3dm (Python) ' + getattr(rhino3dm, '__version__', ''), 'files': results}, fh, indent=2)
    for r in results:
        print(r['file'], 'OK' if r['ok'] else 'FAIL', r['units'], 'objects', r['objects'], 'closed', r['closedSolids'], 'userText', r['withUserText'],
              'parity', r['parity'], r['facts'])
    sys.exit(0 if all(r['ok'] for r in results) else 1)
