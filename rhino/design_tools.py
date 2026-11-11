#! python3
"""Rhino 8 side of the agent. Runs inside Rhino (ScriptEditor, CPython 3) and is called by the app through the Rhino MCP
platform's script tool with one fixed line:  import design_tools; print(design_tools.dispatch_b64('<base64 json>'))
The language model never sends code. It produces typed tool calls; the app validates and checks them, the designer
approves, and only then does the app call one of the reviewed functions below with plain data.

Not executed in this demo environment (no Rhino licence here). generator.py and sync.py, which hold the logic, are
tested outside Rhino: their output matches the JavaScript model exactly on every exported .3dm (see verify_3dm.py)."""
import base64
import json
import os

import Rhino
import scriptcontext as sc
import System

from generator import generate
from sync import drift

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'materials.json')) as fh:
    MATERIALS = json.load(fh)

VIEWS = {  # camera location, target (mm, room coordinates); 'plan' is a top view
    'hero': ((4450, 380, 1500), (1500, 3300, 1350)),
    'bed': ((2400, 600, 1300), (2400, 4200, 1100)),
    'wardrobe': ((3900, 1700, 1400), (0, 1700, 1300)),
    'plan': ((2400, 2100, 12000), (2400, 2100, 0)),
}


def _layer(path):
    idx = sc.doc.Layers.FindByFullPath(path, -1)
    if idx >= 0:
        return idx
    parent, cur = System.Guid.Empty, ''
    for name in path.split('::'):
        cur = name if not cur else cur + '::' + name
        idx = sc.doc.Layers.FindByFullPath(cur, -1)
        if idx < 0:
            layer = Rhino.DocObjects.Layer()
            layer.Name = name
            layer.ParentLayerId = parent
            idx = sc.doc.Layers.Add(layer)
        parent = sc.doc.Layers[idx].Id
    return idx


def _render_material(lib_id):
    d = MATERIALS[lib_id]
    for rm in sc.doc.RenderMaterials:
        if rm.Name == d['name']:
            return rm
    m = Rhino.DocObjects.Material()
    m.Name = d['name']
    c = d['color']
    m.DiffuseColor = System.Drawing.Color.FromArgb(int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16))
    if d.get('glass'):
        m.Transparency = 0.8
    rm = Rhino.Render.RenderMaterial.CreateBasicMaterial(m, sc.doc)
    rm.Name = d['name']
    sc.doc.RenderMaterials.Add(rm)
    return rm


def _tagged():
    out = {}
    for obj in sc.doc.Objects:
        pid = obj.Attributes.GetUserString('part')
        if pid:
            out[pid] = obj
    return out


def _attributes(p, params):
    a = Rhino.DocObjects.ObjectAttributes()
    a.Name = p['name']
    a.LayerIndex = _layer(p['layer'])
    a.MaterialSource = Rhino.DocObjects.ObjectMaterialSource.MaterialFromObject
    a.RenderMaterial = _render_material(p['material'])
    a.SetUserString('element', p['element'])
    a.SetUserString('part', p['id'])
    a.SetUserString('material', p['material'])
    if p['element'] in params:
        a.SetUserString('params', json.dumps(params[p['element']]))
    return a


def _box(p):
    bb = Rhino.Geometry.BoundingBox(Rhino.Geometry.Point3d(*p['min']), Rhino.Geometry.Point3d(*p['max']))
    return Rhino.Geometry.Box(bb).ToBrep()


def _same(obj, p, tol=0.01):
    bb = obj.Geometry.GetBoundingBox(True)
    a = (bb.Min.X, bb.Min.Y, bb.Min.Z, bb.Max.X, bb.Max.Y, bb.Max.Z)
    b = tuple(p['min']) + tuple(p['max'])
    return all(abs(x - y) <= tol for x, y in zip(a, b)) and obj.Attributes.GetUserString('material') == p['material'] \
        and sc.doc.Layers[obj.Attributes.LayerIndex].FullPath == p['layer']


def check_drift(spec):
    """Compares the tagged objects in the open file with the spec before any agent change."""
    found = {}
    for pid, obj in _tagged().items():
        bb = obj.Geometry.GetBoundingBox(True)
        found[pid] = ((bb.Min.X, bb.Min.Y, bb.Min.Z), (bb.Max.X, bb.Max.Y, bb.Max.Z))
    return drift(generate(spec)['parts'], found)


def bake(spec, label='Design agent change'):
    """Brings the Rhino model in line with an approved spec. Only parts that differ are touched, all inside one undo
    record, so Ctrl+Z in Rhino reverts the whole agent change. Untagged objects (the designer's own) are never touched."""
    gen = generate(spec)
    d = gen['derived']
    params = {'flooring': spec['flooring'], 'wardrobe': spec['wardrobe'], 'bed': spec['bed'], 'bedside': spec['bedside'], 'rug': spec['rug']}
    for u in spec['adjacent']:
        params[u['id']] = dict(u, depth=d['adjacentDepth'][u['id']])
    for z in spec['featureWall']['zones']:
        params['feature-' + z['id']] = z
    want = {p['id']: p for p in gen['parts']}
    existing = _tagged()
    stats = {'added': 0, 'changed': 0, 'removed': 0, 'unchanged': 0}
    sn = sc.doc.BeginUndoRecord(label)
    try:
        for pid, obj in existing.items():
            if pid not in want:
                sc.doc.Objects.Delete(obj, True)
                stats['removed'] += 1
        for pid, p in want.items():
            obj = existing.get(pid)
            if obj is not None and _same(obj, p):
                stats['unchanged'] += 1
                continue
            if obj is not None:
                sc.doc.Objects.Replace(obj.Id, _box(p))
                sc.doc.Objects.ModifyAttributes(obj.Id, _attributes(p, params), True)
                stats['changed'] += 1
            else:
                sc.doc.Objects.AddBrep(_box(p), _attributes(p, params))
                stats['added'] += 1
        sc.doc.Strings.SetString('design-spec', json.dumps(spec))
    finally:
        sc.doc.EndUndoRecord(sn)
    sc.doc.Views.Redraw()
    return stats


def setup_views():
    view = sc.doc.Views.ActiveView
    vp = view.ActiveViewport
    for name, (loc, tgt) in VIEWS.items():
        if name == 'plan':
            vp.ChangeToParallelProjection(True)
        else:
            vp.ChangeToPerspectiveProjection(True, 24.0)
        vp.SetCameraLocations(Rhino.Geometry.Point3d(*tgt), Rhino.Geometry.Point3d(*loc))
        i = sc.doc.NamedViews.FindByName(name)
        if i >= 0:
            sc.doc.NamedViews.Delete(i)
        sc.doc.NamedViews.Add(name, view.ActiveViewportID)
    return sorted(VIEWS)


def capture(view='hero', path=None, width=1600, height=1000, mode='Rendered'):
    """Viewport capture for quick previews. Final images use Rhino Render (Cycles) from the same named views."""
    v = sc.doc.Views.ActiveView
    i = sc.doc.NamedViews.FindByName(view)
    if i >= 0:
        sc.doc.NamedViews.Restore(i, v.ActiveViewport, True)
    dm = Rhino.Display.DisplayModeDescription.FindByName(mode)
    if dm:
        v.ActiveViewport.DisplayMode = dm
    vc = Rhino.Display.ViewCapture()
    vc.Width, vc.Height = width, height
    vc.ScaleScreenItems = False
    vc.DrawAxes = vc.DrawGrid = vc.DrawGridAxes = False
    bmp = vc.CaptureToBitmap(v)
    path = path or os.path.join(os.path.dirname(sc.doc.Path or HERE), 'renders', view + '.png')
    if not os.path.isdir(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))
    bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png)
    return path


def save_version(label, folder=None):
    """Writes a full copy of the model as '<label>.3dm' with the spec inside; the open document keeps its own name."""
    sc.doc.Strings.SetString('version', label)
    folder = folder or os.path.join(os.path.dirname(sc.doc.Path or HERE), 'versions')
    if not os.path.isdir(folder):
        os.makedirs(folder)
    path = os.path.join(folder, ''.join(ch if ch.isalnum() or ch in ' -_' else '_' for ch in label).strip() + '.3dm')
    opts = Rhino.FileIO.FileWriteOptions()
    opts.SuppressAllInput = True
    ok = sc.doc.WriteFile(path, opts)
    return {'ok': bool(ok), 'path': path}


def restore(path):
    """Rollback: reads the spec stored inside a saved version and bakes it (one undo record)."""
    f = Rhino.FileIO.File3dm.Read(path)
    spec = json.loads(f.Strings.GetValue('design-spec'))
    return {'spec': spec, 'bake': bake(spec, 'Design agent: restore ' + os.path.basename(path))}


def read_spec():
    s = sc.doc.Strings.GetValue('design-spec')
    return json.loads(s) if s else None


ALLOWED = {'bake': bake, 'check_drift': check_drift, 'setup_views': setup_views, 'capture': capture,
           'save_version': save_version, 'restore': restore, 'read_spec': read_spec}


def dispatch(name, args):
    if name not in ALLOWED:
        return json.dumps({'error': 'not allowed: ' + str(name)})
    try:
        return json.dumps({'ok': True, 'result': ALLOWED[name](**args)})
    except Exception as e:  # report, never half-apply silently: bake runs inside one undo record
        return json.dumps({'ok': False, 'error': str(e)})


def dispatch_b64(payload):
    """The app sends {"name": ..., "args": {...}} as base64, so nothing in the arguments can break out of the script line."""
    msg = json.loads(base64.b64decode(payload).decode('utf-8'))
    return dispatch(msg['name'], msg.get('args', {}))
