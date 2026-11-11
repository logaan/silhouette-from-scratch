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

Open [localhost:4173](http://127.0.0.1:4173) in Chrome. Bluetooth requires HTTPS or localhost; opening the HTML file directly is not supported. Rebuild and refresh after changing the app or its presets.

## Use

1. Import a DXF or try the included test drawing.
2. Choose the mat, sheet size, and material preset.
3. Drag the drawing or enter its position in millimetres. Rotation and centring are available; the drawing retains its imported size. Scroll to pan the mat and pinch to zoom.
4. Adjust the settings for this job and choose cut-first or crease-first. Keep drawing paths at least 3 mm inside the sheet edges.
5. Close Silhouette Studio, load the mat, install the tools, and click **Connect Cameo**.
6. Review the job and click **Run job**.

**Stop sending** prevents further transmission but does not stop movement already buffered in the machine. Use the Cameo’s physical pause button to stop that movement.

## Presets

Each file in `materials/` defines a material. Each file in `material-sizes/` defines a sheet size. Edit these YAML files and rebuild to update the app. Adjusting settings in the interface does not change the preset files.

Material fields:

```yaml
id: my-paper
name: My paper
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

Material presets can also include `notes` and `source`. IDs must be unique within each folder.

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
