# Silhouette — Cut & Crease

A static browser workbench for the **Silhouette Cameo 5 Alpha**, using Chrome Web Bluetooth. Import a DXF, position it on a sheet, choose material settings, and prepare a cut/crease job. Files and generated commands remain in the browser. No server backend, account, cloud storage, or capture replay.

**Status:** offline parser, compiler, transport mocks, and browser workflows are tested. First live hardware test is pending. No job has been sent by this application yet. Generated paths use straightforward GPGL M/D movements; cut compensation and physical positioning still need comparison against Studio.

## Start locally

Requires Node.js 22 or newer (Python is only used by the separate capture tools).

```sh
npm ci
npm test
npm run build
npm run dev
```

Open **http://127.0.0.1:4173** in Chrome. Use localhost or HTTPS: opening `index.html` directly is not supported. Click **Try the colour test drawing** for an offline example. Run `npm run build` after changes; reload the page to see them.

## Workflow

1. Import a DXF. Only pure **#FF0000** is cut and pure **#0000FF** is creased. All other colours are ignored. Ignored paths can be shown in grey but are never emitted to the machine.
2. Choose a **12 × 12″** or **12 × 24″** mat, then a material size. The sheet must fit the mat. Sheet origin is the top-left grid origin.
3. Drag the drawing or enter its left/top coordinates in millimetres. Rotation, scale and centring are available. Arrow keys move a focused mat design by 1 mm (Shift: 10 mm).
4. Choose a material preset. Adjust force, speed, blade depth and passes for this job if needed. Presets are not modified by UI edits. Choose crease-first or cut-first.
5. **Review job** shows operations, tools, settings and excluded geometry. Download the report for offline inspection. There is no replay/import-command feature.
6. For an attended hardware test, close Silhouette Studio, load the mat, and install the AutoBlade in holder 1 and embossing tool in holder 2. Click **Connect Cameo** and select the device in Chrome. macOS may request Bluetooth permission for Chrome.
7. Confirm the setup in the review and click **Run job**. Progress reports each path/pass. Completion requires ready replies from the device, not just successful Bluetooth writes.

**Stop sending** stops further transmission; it cannot undo movements already buffered in the machine. Use the machine's physical pause control to stop buffered movement. Failed or disconnected jobs never resume automatically. Save the activity log for diagnosis.

## Versioned presets

- `materials/`: one YAML file per material/preset. Required fields: unique `id`, `name`, `cut` and `crease`. Optional `notes`, `source`.
- `material-sizes/`: one YAML file per sheet size. Required fields: unique `id`, `name`, `width_mm`, `height_mm`.
- The build validates YAML and creates `dist/config.json`; the browser needs no YAML backend.

Material example:

```yaml
id: my-paper
name: My paper
notes: Describe the paper and the provenance of these settings.
cut:
  tool: 1
  force: 20
  speed: 11
  depth: 2
  passes: 1
crease:
  tool: 2
  force: 33
  speed: 5
  passes: 2
```

Size example:

```yaml
id: a4
name: A4
width_mm: 210
height_mm: 297
```

The included presets reflect the user's recorded experiments. They are not universal recommendations for other paper or tools. Material sizes include A4, A3 and 300 × 300 mm.

## GitHub Pages

The site works under a repository subpath; all asset references are relative. No API keys or environment secrets are required.

1. Push this repository to GitHub.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Run **Static workbench** in Actions, or push to `main`. The included workflow runs tests, builds and publishes `dist/`.
4. Open the HTTPS Pages URL in Chrome and grant that origin access to the cutter when prompted.

Alternatively, upload the contents of `dist/` to any static HTTPS host. A local preview was prepared; nothing has been published to GitHub or another host.

## DXF support and limits

Supported: LINE, LWPOLYLINE/POLYLINE (including bulges), CIRCLE, ARC, ELLIPSE, and nested block INSERT transformations. Curves are sampled to approximately 0.025 mm before 0.05 mm command quantization. File units support mm, cm, metres, inches and feet, with an explicit mm/inches override for unitless files.

True colour takes precedence over indexed colour. ByLayer and ByBlock colours are resolved. Hidden/frozen layers are ignored. Unsupported selected-colour entities fail import rather than silently disappear. Convert text, splines, array inserts and 3D geometry to ordinary 2D paths first. The import limit is 10 MB / 200,000 vertices.

The current tool mapping is deliberately fixed: red → AutoBlade/holder 1, blue → embossing tool/holder 2. Registration marks, print-and-cut, rotary tools, drag-knife software compensation and automatic material sensing are not implemented. The drawing must leave 3 mm inside each sheet edge. Placement is not yet physically calibrated against Studio on this device.

## Architecture and tests

- `web/geometry.js`: DXF import, exact colour policy, units and positioning.
- `web/job.js`: validates bounds/settings and generates new GPGL jobs.
- `web/bluetooth.js`: GATT handshake, device identity check, acknowledged 20-byte writes, isolated query responses, readiness polling and stop/error handling.
- `web/app.js`: browser-only workbench.
- `tests/`: Node tests for import, compiler and mocked Bluetooth behavior.
- `scripts/build.mjs`: static bundle and YAML config validation.

Bluetooth identity must report `CAMEO 5 ALPHA`. The transport checks readiness before sending and between paths/tool phases. It does not retry uncertain writes or automatically reconnect a partly sent job. Real transport timing, tool selection and cutting quality remain to be validated in the first attended test.

## Capture analysis (development only)

Original captures stay under ignored `captures/`. Keep them unchanged and preserve SHA-256 hashes. The three traces established the Alpha identity/firmware 1.04, text and binary movement formats, per-tool settings, operation order, repeated passes and reconnect sequences. See `docs/capture.md` and local inspection notes.

```sh
python3 scripts/extract_silhouette.py 'captures/First Trace - One test cut.pklg' --output captures/new-analysis
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Requires Wireshark `tshark`. Outputs JSON evidence, frame-labelled commands and SVG previews. Detection is heuristic BLE ATT analysis, including BE1/BE2/BE3 binary movements. It does not cover USB/Classic Bluetooth or separate reused connection handles; reconnect-only streams need manual inspection. Replay was explicitly dropped from scope.

## Protocol references

- [Reverse-engineered GPGL commands](https://github.com/fablabnbg/inkscape-silhouette/blob/main/Commands.md)
- [Coordinate and device behavior reference](https://github.com/fablabnbg/inkscape-silhouette/blob/main/silhouette/Graphtec.py)
- [Binary movement format](https://github.com/fablabnbg/inkscape-silhouette/blob/main/silhouette/beutil.py)
- [BLE service/handshake reference](https://github.com/fablabnbg/inkscape-silhouette/blob/main/silhouette/BLETransport.py)
- [Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)

The JavaScript implementation is local project code based on captured evidence and documented protocol facts. DXF parsing uses MIT-licensed `dxf-parser`; its license is included in the static build. Dependency versions are locked in `package-lock.json`.
