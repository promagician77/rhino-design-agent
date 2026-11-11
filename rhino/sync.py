"""Keeps the agent and the designer's own Rhino edits from overwriting each other.
Before every agent change, the tagged objects in the file are compared with what the spec says should be there.
Pure Python (works on any object with a part id and a bounding box), so it is tested outside Rhino with rhino3dm."""


def drift(expected_parts, found, tol=0.5):
    """expected_parts: generator output. found: {part_id: (min_xyz, max_xyz)} read from the document.
    Returns moved / missing / extra part ids. Anything non-empty means a person edited the model by hand:
    the agent stops and asks whether to keep the manual edit (re-measure it into the spec) or rebuild from the spec."""
    exp = {p['id']: p for p in expected_parts}
    moved, missing = [], []
    for pid, p in exp.items():
        f = found.get(pid)
        if f is None:
            missing.append(pid)
            continue
        dev = max(max(abs(a - b) for a, b in zip(f[0], p['min'])), max(abs(a - b) for a, b in zip(f[1], p['max'])))
        if dev > tol:
            moved.append({'part': pid, 'element': p['element'], 'deviationMm': round(dev, 2)})
    extra = sorted(set(found) - set(exp))
    return {'clean': not (moved or missing or extra), 'moved': moved, 'missing': missing, 'extra': extra}
