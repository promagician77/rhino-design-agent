"""Spec -> solid boxes. Python mirror of src/model/generate.js, used inside Rhino 8 (CPython 3) by design_tools.py.
Pure Python: no Rhino imports, so it is tested outside Rhino (tests/test_parity.py) against the JavaScript output."""
import math

L = {
    'walls': 'Bedroom::Architecture::Walls', 'ceiling': 'Bedroom::Architecture::Ceiling', 'openings': 'Bedroom::Architecture::Openings',
    'floor': 'Bedroom::Finishes::Flooring', 'feature': 'Bedroom::Finishes::Feature wall',
    'wardrobe': 'Bedroom::Joinery::Wardrobe', 'adjacent': 'Bedroom::Joinery::Adjacent units',
    'furniture': 'Bedroom::Furniture', 'soft': 'Bedroom::Furniture::Soft furnishings', 'lighting': 'Bedroom::Lighting',
}


def r1(v):
    # Same rounding as JavaScript Math.round(v * 1000) / 1000 (round half up).
    return math.floor(v * 1000 + 0.5) / 1000


def clad_depth(spec, zone):
    f = spec['featureWall']
    t = zone['treatment']
    if t == 'travertine':
        return f['travertine']['thickness']
    if t == 'wood_panels':
        return f['woodPanels']['thickness']
    if t == 'fluted':
        return f['fluted']['thickness'] + f['fluted']['depth']
    if t == 'plaster_shelf':
        return f['plasterNiche']['thickness']
    raise ValueError('unknown treatment ' + t)


def generate(spec):
    parts = []

    def add(pid, element, layer, material, mn, mx, name=None):
        if mx[0] - mn[0] <= 0 or mx[1] - mn[1] <= 0 or mx[2] - mn[2] <= 0:
            return
        parts.append({'id': pid, 'element': element, 'layer': layer, 'material': material, 'name': name or pid,
                      'min': [r1(v) for v in mn], 'max': [r1(v) for v in mx]})

    room = spec['room']
    W, D, H, t = room['width'], room['depth'], room['height'], room['wall']
    fl = spec['flooring']
    z0 = -fl['thickness']
    d, w = spec['openings']['door'], spec['openings']['window']

    add('wall-south-a', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [-t, -t, z0], [d['x'], 0, H])
    add('wall-south-b', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [d['x'] + d['width'], -t, z0], [W + t, 0, H])
    add('wall-south-head', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [d['x'], -t, d['height']], [d['x'] + d['width'], 0, H])
    add('wall-north', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [-t, D, z0], [W + t, D + t, H])
    add('wall-west', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [-t, 0, z0], [0, D, H])
    add('wall-east-a', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [W, 0, z0], [W + t, w['y'], H])
    add('wall-east-b', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [W, w['y'] + w['width'], z0], [W + t, D, H])
    add('wall-east-sill', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [W, w['y'], z0], [W + t, w['y'] + w['width'], w['sill']])
    add('wall-east-head', 'walls', L['walls'], room.get('wallMaterial', 'paint_wall'), [W, w['y'], w['head']], [W + t, w['y'] + w['width'], H])
    add('ceiling', 'ceiling', L['ceiling'], 'ceiling_white', [0, 0, H], [W, D, H + 20])
    add('door-leaf', 'door', L['openings'], 'lacquer_greige', [d['x'] + 5, -t / 2 - 20, 0], [d['x'] + d['width'] - 5, -t / 2 + 20, d['height'] - 5], 'Door leaf')
    add('window-glass', 'window', L['openings'], 'glass_clear', [W + t / 2 - 4, w['y'] + 50, w['sill'] + 50], [W + t / 2 + 4, w['y'] + w['width'] - 50, w['head'] - 50], 'Window glass')
    for k, mn, mx in [
        ('window-frame-b', [W + t / 2 - 30, w['y'], w['sill']], [W + t / 2 + 30, w['y'] + w['width'], w['sill'] + 50]),
        ('window-frame-t', [W + t / 2 - 30, w['y'], w['head'] - 50], [W + t / 2 + 30, w['y'] + w['width'], w['head']]),
        ('window-frame-s', [W + t / 2 - 30, w['y'], w['sill'] + 50], [W + t / 2 + 30, w['y'] + 50, w['head'] - 50]),
        ('window-frame-n', [W + t / 2 - 30, w['y'] + w['width'] - 50, w['sill'] + 50], [W + t / 2 + 30, w['y'] + w['width'], w['head'] - 50]),
    ]:
        add(k, 'window', L['openings'], 'aluminium_dark', mn, mx, 'Window frame')
    add('curtain-s', 'curtains', L['soft'], 'fabric_linen', [W - 90, w['y'] - 240, 40], [W - 30, w['y'] + 20, H - 60], 'Curtain')
    add('curtain-n', 'curtains', L['soft'], 'fabric_linen', [W - 90, w['y'] + w['width'] - 20, 40], [W - 30, w['y'] + w['width'] + 240, H - 60], 'Curtain')

    pw, pl = fl['plankWidth'], fl['plankLength']
    r, y = 0, 0.0
    while y < D - 1e-9:
        y1 = min(D, y + pw)
        off = ((r % fl['stagger']) * pl) / fl['stagger']
        i, x = 0, -off
        while x < W - 1e-9:
            add('floor-r%d-p%d' % (r, i), 'flooring', L['floor'], fl['material'], [max(0, x), y, z0], [min(W, x + pl), y1, 0], 'Floor plank')
            i += 1
            x += pl
        r += 1
        y += pw

    f = spec['featureWall']
    x0 = 0
    depth_of = {}
    for z in f['zones']:
        x1 = x0 + z['width']
        dz = clad_depth(spec, z)
        depth_of[z['id']] = dz
        el = 'feature-' + z['id']
        nm = 'Feature wall ' + z['id']
        if z['treatment'] == 'travertine':
            s = f['travertine']
            j = s['joint'] / 2
            c, xs = 0, x0
            while xs < x1 - 1e-9:
                k, zs = 0, 0
                while zs < H - 1e-9:
                    add('%s-slab-%d-%d' % (el, c, k), el, L['feature'], z['material'], [xs + j, D - s['thickness'], zs + j],
                        [min(x1, xs + s['slabWidth']) - j, D, min(H, zs + s['slabHeight']) - j], nm + ' travertine slab')
                    k += 1
                    zs += s['slabHeight']
                c += 1
                xs += s['slabWidth']
        elif z['treatment'] == 'wood_panels':
            p = f['woodPanels']
            n = max(1, math.ceil(z['width'] / p['panelWidth'] - 1e-9))
            each = z['width'] / n
            for i in range(n):
                add('%s-panel-%d' % (el, i), el, L['feature'], z['material'], [x0 + i * each + p['gap'] / 2, D - p['thickness'], 0], [x0 + (i + 1) * each - p['gap'] / 2, D, H], nm + ' wood panel')
        elif z['treatment'] == 'fluted':
            p = f['fluted']
            add(el + '-board', el, L['feature'], z['material'], [x0, D - p['thickness'], 0], [x1, D, H], nm + ' backing board')
            n = int(math.floor(z['width'] / p['fluteWidth']))
            lead = (z['width'] - n * p['fluteWidth']) / 2
            for i in range(n):
                xs = x0 + lead + i * p['fluteWidth'] + p['fluteWidth'] * 0.2
                add('%s-flute-%d' % (el, i), el, L['feature'], z['material'], [xs, D - p['thickness'] - p['depth'], 0], [xs + p['fluteWidth'] * 0.6, D - p['thickness'], H], nm + ' flute')
        elif z['treatment'] == 'plaster_shelf':
            p = f['plasterNiche']
            add(el + '-plaster', el, L['feature'], z['material'], [x0, D - p['thickness'], 0], [x1, D, H], nm + ' plaster')
            sx = x0 + (z['width'] - p['nicheWidth']) / 2
            add(el + '-shelf', el, L['feature'], 'walnut_dark', [sx, D - p['thickness'] - 250, p['nicheBottom'] + p['nicheHeight']], [sx + p['nicheWidth'], D - p['thickness'], p['nicheBottom'] + p['nicheHeight'] + 40], nm + ' floating shelf')
            add(el + '-led', el, L['lighting'], 'led_warm', [sx + 20, D - p['thickness'] - 60, p['nicheBottom'] + p['nicheHeight'] - 8], [sx + p['nicheWidth'] - 20, D - p['thickness'] - 40, p['nicheBottom'] + p['nicheHeight']], 'LED strip')
        x0 = x1

    b = spec['bed']
    zones = f['zones']
    ci = [i for i, z in enumerate(zones) if z['id'] == 'center'][0]
    cx = sum(z['width'] for z in zones[:ci]) + zones[ci]['width'] / 2
    hb_y1 = D - depth_of['center']
    hb_y0 = hb_y1 - b['headboardDepth']
    bx0, bx1 = cx - b['width'] / 2, cx + b['width'] / 2
    by0 = hb_y0 - b['length']
    add('bed-headboard', 'bed', L['furniture'], b['headboardMaterial'], [bx0 - 50, hb_y0, 0], [bx1 + 50, hb_y1, b['headboardHeight']], 'Bed headboard')
    add('bed-base', 'bed', L['furniture'], b['material'], [bx0, by0, 0], [bx1, hb_y0, b['height']], 'Bed base')
    add('bed-mattress', 'bed', L['soft'], 'fabric_linen', [bx0 + 40, by0 + 40, b['height']], [bx1 - 40, hb_y0 - 10, b['height'] + b['mattress']], 'Mattress')
    add('bed-pillow-l', 'bed', L['soft'], 'fabric_boucle', [bx0 + 120, hb_y0 - 420, b['height'] + b['mattress']], [cx - 40, hb_y0 - 60, b['height'] + b['mattress'] + 160], 'Pillow')
    add('bed-pillow-r', 'bed', L['soft'], 'fabric_boucle', [cx + 40, hb_y0 - 420, b['height'] + b['mattress']], [bx1 - 120, hb_y0 - 60, b['height'] + b['mattress'] + 160], 'Pillow')
    add('bed-throw', 'bed', L['soft'], 'fabric_throw', [bx0 + 20, by0 + 20, b['height'] + b['mattress']], [bx1 - 20, by0 + 620, b['height'] + b['mattress'] + 30], 'Throw')
    s = spec['bedside']
    tables = [(bx0 - s['gapToBed'] - s['width'], bx0 - s['gapToBed']), (bx1 + s['gapToBed'], bx1 + s['gapToBed'] + s['width'])]
    for i, (a, c) in enumerate(tables):
        add('bedside-%d' % i, 'bedside', L['furniture'], s['material'], [a, hb_y0 - s['depth'], 0], [c, hb_y0, s['height']], 'Bedside table')
        p = spec['pendants']
        mx, my = (a + c) / 2, hb_y0 - s['depth'] / 2
        add('pendant-%d' % i, 'pendants', L['lighting'], p['material'], [mx - p['size'] / 2, my - p['size'] / 2, H - p['drop'] - p['size']], [mx + p['size'] / 2, my + p['size'] / 2, H - p['drop']], 'Pendant shade')
        add('pendant-cable-%d' % i, 'pendants', L['lighting'], 'aluminium_dark', [mx - 4, my - 4, H - p['drop']], [mx + 4, my + 4, H], 'Pendant cable')
    rg = spec['rug']
    add('rug', 'rug', L['soft'], rg['material'], [cx - rg['width'] / 2, max(0, hb_y0 - 600 - rg['length']), 0], [cx + rg['width'] / 2, hb_y0 - 600, rg['thickness']], 'Rug')

    wd = spec['wardrobe']
    front = wd['depth'] + wd['doorThickness']
    wy0, wy1 = wd['y'], wd['y'] + wd['width']
    add('wardrobe-carcass', 'wardrobe', L['wardrobe'], wd['material'], [0, wy0, 0], [wd['depth'], wy1, wd['height']], 'Wardrobe carcass')
    dw = wd['width'] / wd['doors']
    for i in range(wd['doors']):
        add('wardrobe-door-%d' % i, 'wardrobe', L['wardrobe'], wd['material'], [wd['depth'], wy0 + i * dw + 1.5, 20], [front, wy0 + (i + 1) * dw - 1.5, wd['height'] - 20], 'Wardrobe door')
        hy = wy0 + (i + 1) * dw - 70 if i % 2 == 0 else wy0 + i * dw + 54
        add('wardrobe-handle-%d' % i, 'wardrobe', L['wardrobe'], wd['handleMaterial'], [front, hy, 850], [front + 25, hy + 16, 1450], 'Wardrobe handle')
    add('wardrobe-bulkhead', 'wardrobe', L['wardrobe'], 'paint_wall', [0, wy0, wd['height']], [front, wy1, H], 'Bulkhead')
    derived_adjacent = {}
    for u in spec['adjacent']:
        if u['rule'] == 'flush-front':
            depth = wd['depth']
        elif u['rule'] == 'front-offset':
            depth = wd['depth'] - u['offset']
        else:
            depth = u['depth']
        derived_adjacent[u['id']] = depth
        ya, yb = (wy1, wy1 + u['width']) if u['side'] == 'north' else (wy0 - u['width'], wy0)
        el = u['id']
        add(el + '-carcass', el, L['adjacent'], u['material'], [0, ya, 0], [depth, yb, u['height']], u['name'])
        if u['height'] > 2000:
            add(el + '-door', el, L['adjacent'], u['material'], [depth, ya + 1.5, 20], [depth + wd['doorThickness'], yb - 1.5, u['height'] - 20], u['name'] + ' door')
            add(el + '-bulkhead', el, L['adjacent'], 'paint_wall', [0, ya, u['height']], [depth + wd['doorThickness'], yb, H], 'Bulkhead')
        else:
            for k in range(3):
                add('%s-drawer-%d' % (el, k), el, L['adjacent'], u['material'], [depth, ya + 1.5, 20 + k * (u['height'] - 20) / 3 + 1.5],
                    [depth + wd['doorThickness'], yb - 1.5, 20 + (k + 1) * (u['height'] - 20) / 3 - 1.5], u['name'] + ' drawer front')

    derived = {'bed': {'x0': bx0, 'x1': bx1, 'y0': by0, 'y1': hb_y0}, 'wardrobeFront': front, 'adjacentDepth': derived_adjacent,
               'claddingDepth': depth_of, 'bedCentreX': cx}
    return {'parts': parts, 'derived': derived}
