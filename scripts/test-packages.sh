#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo_dir="$PWD"
package_test_dir="$(mktemp -d)"
trap 'rm -rf "$package_test_dir"' EXIT
npm pack --workspace @cut-and-crease/silhouette --workspace @cut-and-crease/dxf --pack-destination "$package_test_dir" --ignore-scripts
cp scripts/test-packages.mjs "$package_test_dir/test.mjs"
cd "$package_test_dir"
npm install --prefer-offline --ignore-scripts --no-audit --no-fund ./*.tgz
node test.mjs "$repo_dir/test-files/foldover-8-compartment-box.dxf"
