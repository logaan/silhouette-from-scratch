> [!WARNING]
> This software is vibe coded, untested, and used entirely at your own risk.

> [!NOTE]
> This project has no association with Silhouette, the company that makes the Cameo. It is not affiliated with, endorsed by, or supported by Silhouette.

# Silhouette — Cut & Crease

A static browser app for the **Silhouette Cameo 5 Alpha**. Import a DXF, position it on a sheet, choose a material preset, and send a job directly from Chrome over Bluetooth. Files stay in your browser; no backend is required.

- Pure red (`#FF0000`) cuts with the AutoBlade in holder 1.
- Pure blue (`#0000FF`) creases with the embossing tool in holder 2.
- All other colours are ignored.
- Supports 12 × 12″ and 12 × 24″ mats, configurable sheet sizes, and either operation order.

## Run locally

Requires Node.js 22 or newer and Chrome. Python 3 is needed only for capture-analysis utilities.

```bash
bash scripts/setup.sh
bash scripts/build.sh
bash scripts/serve.sh
```

Open [localhost:4173](http://127.0.0.1:4173) in Chrome. Bluetooth requires HTTPS or localhost; opening the HTML file directly is not supported. Rebuild and refresh after changing the app or its presets. Pass `--dry-run` to `scripts/serve.sh` to automatically connect to a simulated Cameo and run the whole wizard without hardware. The local server enables this mode only for the pages it serves; GitHub Pages builds use the real device.

## Use

1. Close Silhouette Studio and connect the Cameo in Chrome.
2. Select a material. Its default mat and sheet size are selected automatically and can be changed.
3. Import a DXF or try the included colour test or eight-compartment box. Position the drawing with the mat preview; keep active paths at least 3 mm inside the sheet edges.
4. Preview the operation sequence. Automatic optimisation joins touching paths and starts each operation group nearest the top-left corner. It chooses subsequent paths from the tool’s current endpoint, can reverse open paths, and chooses nearby entry vertices on closed shapes. Collinear moves receive a small preference, with horizontal moves favoured. Repeat passes reverse direction to avoid return trips. Uncheck it to preserve the original path order within each operation group. Cut-line joining is enabled by default when creasing first: short red sections can connect blue creases without lifting, and added creasing appears in teal. Turn this off independently if desired. Preview controls provide reset, rewind, previous operation, play/pause, next operation and fast forward; animation speed is illustrative.
5. Load the mat, check the tools and settings, acknowledge the risk, and run the job.

Click an earlier step heading, use the wizard’s Back button, or use browser Back/Forward to revisit screens. Choose **Start dry run** on Connect to explore the complete workflow without hardware. Rotation and centring are available; drawings retain their imported size. Scroll to pan the mat and pinch to zoom.

Machine Activity highlights outstanding paths and marks operations complete when the Cameo reports ready. It does not estimate exact tool position or which buffered path is moving. Activity logs include the build, job settings, send/wait timings, batch completion and polling timer mode. A worker runs the polling timer to reduce background-tab delays; browser and operating-system suspension can still interrupt progress.

**Pause sending** pauses before the next operation, or after already-sent work in the local buffer experiment. Resume requires inline confirmation and continues without replaying completed work. Use the Cameo’s physical pause button to stop movement already buffered in the machine.

## Presets

Each file in `materials/` defines a material. Each file in `material-sizes/` defines a sheet size. Edit these YAML files and rebuild to update the app. Adjusting settings in the interface does not change the preset files.

Material fields:

```yaml
id: my-paper
name: My paper
mat: 12x12
size: a4
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

Sheet-size fields:

```yaml
id: a4
name: A4
width_mm: 210
height_mm: 297
```

IDs must be unique within each folder.

## DXF support

Supports lines, polylines with bulges, circles, arcs, ellipses, and nested block inserts. Indexed, true, ByLayer, and ByBlock colours are resolved. Hidden and frozen layers are ignored.

Convert text, splines, array inserts, and 3D geometry to ordinary 2D paths before importing. Unsupported cut/crease geometry produces an error. Imports are limited to 10 MB and 200,000 vertices. Unitless files require selecting millimetres or inches when importing.

## Project scripts

All project commands are available in `scripts/`:

| Script | Purpose |
| --- | --- |
| `setup.sh` | Install application dependencies |
| `build.sh` | Build the static site in `dist/` |
| `serve.sh` | Serve the local preview |
| `buffer-lab.sh` | Start the local-only buffer experiment on port 4177; raw telemetry stays in ignored captures |
| `buffer-control.sh` | Inspect the experiment with `state`, set a batch target with `limit COUNT --bytes BYTES`, or request `pause` |
| `test.sh` | Run application and capture-parser tests |
| `analyze-capture.sh` | Extract Silhouette data from a Bluetooth capture; requires Wireshark’s `tshark` |
| `setup-capture-tools.sh` | Install Python dependencies for fixture generation |
| `create-colour-test.sh` | Generate the DXF colour-test fixture |
| `check-server.sh` | Find the local preview process |

## GitHub Pages

In the repository’s **Settings → Pages**, select **GitHub Actions** as the deployment source. After enabling Pages, pushes to `main` test, build, and publish the app. You can also run the **Static workbench** workflow manually.

The build uses relative asset paths, so repository Pages URLs are supported. You can also host `dist/` on any static HTTPS host. No API keys or secrets are required.

## License

[MIT](LICENSE).
