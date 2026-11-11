#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PORT="${PORT:-4177}"
bash scripts/build.sh
bash scripts/serve.sh --buffer-lab "$@"
