#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

SOURCE = 'https://github.com/fablabnbg/inkscape-silhouette/blob/main/Commands.md'
SETTING = {'!': 'speed', 'FX': 'force', 'TF': 'blade_depth', 'TJ': 'acceleration'}


def decode(rows):
    commands, queries, pending = [], [], bytearray()
    start = None
    for row in rows:
        data = bytes.fromhex(row['value'])
        if len(data) == 2 and data[0] == 27:
            queries.append({'frame': row['frame'], 'hex': data.hex()})
            continue
        if not pending:
            start = row['frame']
        pending.extend(data)
        while 3 in pending:
            pos = pending.index(3)
            raw = bytes(pending[:pos])
            del pending[:pos + 1]
            commands.append({'first_frame': start, 'last_frame': row['frame'],
                             'hex': raw.hex(), 'text': raw.decode('ascii', errors='backslashreplace')})
            start = row['frame'] if pending else None
    return commands, queries, pending.hex()


def binary_deltas(raw):
    mode = raw[:3]
    width, span, bias = {b'BE1': (2,224,112), b'BE2': (3,3352,1676),
                         b'BE3': (5,750964,375482)}[mode]
    data = raw[3:]
    if len(data) % width or any(b < 32 for b in data):
        raise ValueError('Invalid binary coordinate payload')
    for offset in range(0, len(data), width):
        value = sum((b-32)*224**i for i,b in enumerate(data[offset:offset+width]))
        yield value//span-bias, value%span-bias


def interpret(commands):
    settings, paths, current, unsupported = [], [], [], []
    def finish():
        if len(current) > 1:
            paths.append(current.copy())
        current.clear()
    for cmd in commands:
        s = cmd['text']
        match = re.fullmatch(r'(!|FX|TF|TJ)(\d+)(?:,(\d+))?', s)
        if match:
            settings.append({'setting': SETTING[match[1]], 'value': int(match[2]),
                             'tool': int(match[3]) if match[3] else None,
                             'frame': cmd['first_frame'], 'command': s})
        if s.startswith(('BE1', 'BE2', 'BE3')):
            try:
                deltas = list(binary_deltas(bytes.fromhex(cmd['hex'])))
                if not current:
                    raise ValueError('Binary draw without known position')
                for dy, dx in deltas:
                    current.append([current[-1][0]+dx, current[-1][1]+dy])
            except (ValueError, KeyError):
                finish()
                unsupported.append(s)
            continue
        motion = re.fullmatch(r'([MD])(-?\d+(?:,-?\d+)+)', s)
        if motion:
            values = list(map(int, motion[2].split(',')))
            if len(values) % 2:
                unsupported.append(s)
                continue

            pts = [[values[i+1], values[i]] for i in range(0, len(values), 2)]
            if motion[1] == 'M':
                finish()
                current.extend(pts[-1:])
            elif current:
                current.extend(pts)
            else:
                unsupported.append(s)
        elif s.startswith(('BE', 'BZ', 'E', 'W', '/', '&', 'SO', 'O')):

            finish()
            unsupported.append(s)
    finish()
    result = []
    for pts in paths:
        closed = pts[0] == pts[-1]
        vertices = pts[:-1] if closed else pts
        label = 'polyline'
        if closed and len(vertices) == 3:
            label = 'triangle'
        elif closed and len(vertices) == 4:
            edges = [(vertices[(i+1)%4][0]-p[0], vertices[(i+1)%4][1]-p[1]) for i,p in enumerate(vertices)]
            right = all(edges[i][0]*edges[(i+1)%4][0]+edges[i][1]*edges[(i+1)%4][1] == 0 for i in range(4))
            lengths = [x*x+y*y for x,y in edges]
            if right and min(lengths)>0:
                label = 'square' if len(set(lengths))==1 else 'rectangle'
        xs, ys = list(zip(*pts))
        result.append({'shape': label, 'closed': closed, 'points_xy_units': pts,
                       'size_mm_assuming_20_units_per_mm': [(max(xs)-min(xs))/20, (max(ys)-min(ys))/20]})
    return settings, result, unsupported


def read_rows(path, tshark):
    fields = ['frame.number', 'frame.time_epoch', 'bthci_acl.chandle', 'btatt.opcode', 'btatt.handle', 'btatt.value']
    args = [tshark, '-r', str(path), '-Y', 'btatt', '-T', 'fields']
    for field in fields:
        args += ['-e', field]
    output = subprocess.run(args, check=True, capture_output=True, text=True).stdout
    rows = []
    for line in output.splitlines():
        v = line.split('\t')
        if len(v) != 6 or not v[2] or not v[3]:
            continue
        rows.append(dict(frame=int(v[0]), time_epoch=v[1], connection=v[2],
                         opcode=int(v[3],16), attribute=v[4], value=v[5].replace(':','')))
    return rows


def summarize_jobs(commands):
    groups, current = [], []
    for cmd in commands:
        if re.fullmatch(r'TG\d+', cmd['text']) and current:
            groups.append(current)
            current = []
        current.append(cmd)
        if cmd['text'] == 'H':
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    jobs = []
    for group in groups:
        history, paths, unsupported = interpret(group)
        if not paths:
            continue

        signatures = [json.dumps(p['points_xy_units']) for p in paths]
        period = len(paths)
        for n in range(1, len(paths)+1):
            if len(paths) % n == 0 and signatures == signatures[:n]*(len(paths)//n):
                period = n
                break
        final = {}
        for item in history:
            final.setdefault(str(item['tool']), {})[item['setting']] = item['value']
        sections, section, tool = [], [], None
        for command in group:
            select = re.fullmatch(r'J([12])', command['text'])
            if select:
                if section:
                    sections.append((tool, section))
                section, tool = [], int(select[1])
            section.append(command)
        if section:
            sections.append((tool, section))
        operations = []
        for tool, section in sections:
            sh, sp, su = interpret(section)
            if sp:
                counts = {}
                for path in sp:
                    key = json.dumps(path['points_xy_units'])
                    counts[key] = counts.get(key, 0)+1
                operations.append({'tool': tool, 'settings_history': sh, 'paths': sp,
                    'exact_path_repetition_counts': list(counts.values()),
                    'unsupported_geometry_commands': su})
        jobs.append({'number': len(jobs)+1,
            'first_frame': group[0]['first_frame'], 'last_frame': group[-1]['last_frame'],
            'start_marker_seen': any(re.fullmatch(r'TG\d+', c['text']) for c in group),
            'end_marker_seen': group[-1]['text'] == 'H',
            'operations': operations, 'settings_by_tool': final, 'settings_history': history,
            'observed_passes': len(paths)//period if not unsupported and len(operations) <= 1 else None,
            'pass_basis': 'exact repetition of ordered absolute paths, not an explicit passes setting',
            'unique_pass_paths': paths[:period], 'all_paths': paths,
            'unsupported_geometry_commands': unsupported})
    return jobs


def device_responses(rows):
    result = []
    for row in rows:
        if row['opcode'] not in (0x1b, 0x1d) or not row['value']:
            continue
        raw = bytes.fromhex(row['value'])
        text = raw.rstrip(b'\x03 ').decode('ascii', errors='replace')
        if re.fullmatch(r'(?:CAMEO|Silhouette|PORTRAIT|Curio)[ -~]*', text, re.I):
            result.append({'frame': row['frame'], 'attribute': row['attribute'], 'text': text})
    return result


def extract(rows):
    groups = {}
    for row in rows:
        if row['opcode'] in (0x12, 0x52) and row['value']:
            groups.setdefault((row['connection'], row['attribute']), []).append(row)
    candidates = []
    for (connection, attribute), writes in groups.items():
        commands, queries, trailing = decode(writes)
        settings, paths, unsupported = interpret(commands)

        kinds = {s['setting'] for s in settings}
        if len(kinds) < 2 and not (paths and kinds):
            continue
        related = [r for r in rows if r['connection']==connection]
        identities = device_responses(related)
        candidates.append({'connection_handle': connection, 'write_attribute': attribute,
            'identification': 'device self-identification captured' if identities else 'heuristic GPGL candidate; device identity unverified',
            'device_responses': identities, 'jobs': summarize_jobs(commands),
            'writes': writes, 'commands': commands, 'queries': queries,
            'settings_history': settings, 'paths': paths,
            'unparsed_trailing_hex': trailing, 'unsupported_geometry_commands': unsupported,
            'related_att_packets': related})
    return candidates


def svg(paths):
    pts = [p for path in paths for p in path['points_xy_units']]
    if not pts:
        return None
    xs, ys = zip(*pts)
    x, y = min(xs)-20, min(ys)-20
    w, h = max(xs)-x+20, max(ys)-y+20
    content = ''.join('<polyline points="'+' '.join(f'{a},{b}' for a,b in path['points_xy_units'])+'"/>' for path in paths)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" width="600" height="600"><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white"/><g fill="none" stroke="#146b83" stroke-width="2">{content}</g></svg>\n'


def main():
    parser = argparse.ArgumentParser(description='Extract likely Silhouette Bluetooth data from a capture.')
    parser.add_argument('capture', type=Path)
    parser.add_argument('--output', type=Path, required=True, help='New output directory (must not exist)')
    parser.add_argument('--tshark', default=shutil.which('tshark') or '/Applications/Wireshark.app/Contents/MacOS/tshark')
    args = parser.parse_args()
    try:
        original = args.capture.read_bytes()
        rows = read_rows(args.capture, args.tshark)
        candidates = extract(rows)
        report = {'capture': str(args.capture), 'sha256': hashlib.sha256(original).hexdigest(),
            'mapping_reference': SOURCE,
            'limitations': ['Identification is heuristic unless a device self-identification response is present.',
                'BLE ATT writes/commands only; USB and Classic Bluetooth are unsupported.',
                'Connection-handle reuse is not separated: use short single-connection captures.',
                'Missing setup, packet loss, unsupported commands or transforms can make geometry incomplete.',
                'Coordinates assume 20 units/mm and wire order y,x. Settings are inferred protocol values.',
                'Pass counts describe exact repeated paths; they do not prove a UI setting or successful physical cuts.'],
            'candidates': candidates}
        args.output.mkdir(parents=True, exist_ok=False)
        (args.output/'report.json').write_text(json.dumps(report, indent=2)+'\n')
        for i,candidate in enumerate(candidates,1):
            (args.output/f'commands-{i}.txt').write_text('\n'.join(f"{c['first_frame']}-{c['last_frame']}\t{c['text']}" for c in candidate['commands'])+'\n')
            drawing = svg(candidate['paths'])
            if drawing:
                (args.output/f'paths-{i}.svg').write_text(drawing)
            for job in candidate['jobs']:
                drawing = svg(job['unique_pass_paths'])
                if drawing:
                    (args.output/f"paths-{i}-job-{job['number']}.svg").write_text(drawing)
        print(f'{len(candidates)} candidate stream(s); report: {args.output / "report.json"}')
        for c in candidates:
            for job in c['jobs']:
                print(f"Job {job['number']}: {job['settings_by_tool']}; observed passes={job['observed_passes']}")
            print('Settings:', ', '.join(f"{s['setting']}={s['value']}" for s in c['settings_history']))
            print('Paths:', ', '.join(p['shape'] for p in c['paths']))
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f'Error: {exc}', file=sys.stderr)
        if isinstance(exc, subprocess.CalledProcessError):
            print(exc.stderr, file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
