import argparse
import json
import os
from pathlib import Path
import tempfile
import urllib.request

parser = argparse.ArgumentParser(description='Inspect or adjust the local buffer experiment between batches.')
parser.add_argument('action', choices=['state', 'limit', 'pause'])
parser.add_argument('count', nargs='?', type=int)
parser.add_argument('--bytes', type=int)
parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '4177')))
args = parser.parse_args()
config = json.loads((Path(tempfile.gettempdir()) / f'cameo-buffer-lab-{args.port}.json').read_text())
if args.action == 'limit' and args.count is None:
    parser.error('limit requires an operation count')
payload = None if args.action == 'state' else {'pause': True} if args.action == 'pause' else {'limit': args.count}
if payload is not None and args.bytes is not None:
    payload['byteLimit'] = args.bytes
request = urllib.request.Request(f'http://127.0.0.1:{args.port}/__buffer-lab/' + ('state' if payload is None else 'control'), data=None if payload is None else json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=10) as response:
    print(json.dumps(json.load(response), indent=2))
