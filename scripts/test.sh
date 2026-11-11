#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
python3 -m unittest discover -s scripts -p 'test_*.py'
