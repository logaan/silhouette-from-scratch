#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
lsof -nP -iTCP:"${PORT:-4173}" -sTCP:LISTEN
