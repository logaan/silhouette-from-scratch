#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
bash scripts/test-packages.sh
python3 -m unittest discover -s scripts -p 'test_*.py'
