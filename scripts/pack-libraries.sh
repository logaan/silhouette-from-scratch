#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts
npm pack --workspace @cut-and-crease/silhouette --workspace @cut-and-crease/dxf --pack-destination artifacts --ignore-scripts
