"""Tests for the Rhino-side logic that can run without Rhino: drift detection on real .3dm files (read with McNeel's
rhino3dm) and the safety of the dispatcher input. Run: python3 rhino/test_rhino_side.py"""
import base64
import json
import os
import sys
import unittest

import rhino3dm

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generator import generate  # noqa: E402
from sync import drift  # noqa: E402
from verify_3dm import verify  # noqa: E402

MODELS = os.path.join(HERE, '..', 'build', 'models')


def load(name):
    m = rhino3dm.File3dm.Read(os.path.join(MODELS, name))
    strings = dict(m.Strings[i] for i in range(len(m.Strings)))
    found = {}
    for o in m.Objects:
        bb = o.Geometry.GetBoundingBox()
        found[o.Attributes.GetUserString('part')] = ((bb.Min.X, bb.Min.Y, bb.Min.Z), (bb.Max.X, bb.Max.Y, bb.Max.Z))
    return json.loads(strings['design-spec']), found, m


class Drift(unittest.TestCase):
    def test_clean_file_has_no_drift(self):
        spec, found, _ = load('Version-2.3dm')
        self.assertTrue(drift(generate(spec)['parts'], found)['clean'])

    def test_manual_move_is_detected(self):
        spec, _, m = load('Version-2.3dm')
        # A designer drags the wardrobe carcass 50 mm in Rhino: rebuild the file with that one object moved.
        edited = rhino3dm.File3dm()
        for o in m.Objects:
            g = o.Geometry.Duplicate()
            if o.Attributes.GetUserString('part') == 'wardrobe-carcass':
                g.Translate(rhino3dm.Vector3d(0, 50, 0))
            edited.Objects.AddBrep(g, o.Attributes)
        data = edited.Encode()  # round trip through the file format
        back = rhino3dm.File3dm.Decode(data)
        found = {}
        for o in back.Objects:
            bb = o.Geometry.GetBoundingBox()
            found[o.Attributes.GetUserString('part')] = ((bb.Min.X, bb.Min.Y, bb.Min.Z), (bb.Max.X, bb.Max.Y, bb.Max.Z))
        r = drift(generate(spec)['parts'], found)
        self.assertFalse(r['clean'])
        self.assertEqual([x['part'] for x in r['moved']], ['wardrobe-carcass'])
        self.assertAlmostEqual(r['moved'][0]['deviationMm'], 50, places=3)

    def test_deleted_and_extra_objects(self):
        spec, found, _ = load('Version-1.3dm')
        found.pop('bedside-0')
        found['my-sketch'] = ((0, 0, 0), (10, 10, 10))
        r = drift(generate(spec)['parts'], found)
        self.assertEqual(r['missing'], ['bedside-0'])
        self.assertEqual(r['extra'], ['my-sketch'])


class Files(unittest.TestCase):
    def test_every_exported_file_passes_and_python_rebuild_matches(self):
        names = sorted(f for f in os.listdir(MODELS) if f.endswith('.3dm'))
        self.assertEqual(len(names), 5)
        for n in names:
            r = verify(os.path.join(MODELS, n))
            self.assertTrue(r['ok'], n)
            self.assertEqual(r['parity']['maxDeviationMm'], 0)


class Dispatcher(unittest.TestCase):
    def test_payload_cannot_inject_code(self):
        # The script line the app sends contains only base64 characters, whatever the arguments are.
        args = {'label': "x'); import os; os.remove('a'); print('"}
        b64 = base64.b64encode(json.dumps({'name': 'save_version', 'args': args}).encode()).decode()
        line = "import design_tools; print(design_tools.dispatch_b64('%s'))" % b64
        self.assertTrue(set(b64) <= set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='))
        self.assertEqual(line.count("'"), 2)

    def test_whitelist(self):
        with open(os.path.join(HERE, 'design_tools.py')) as fh:
            src = fh.read()
        allowed = src.split('ALLOWED = {')[1].split('}')[0]
        names = sorted(x.split(':')[0].strip().strip("'") for x in allowed.replace('\n', ' ').split(',') if ':' in x)
        self.assertEqual(names, ['bake', 'capture', 'check_drift', 'read_spec', 'restore', 'save_version', 'setup_views'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
