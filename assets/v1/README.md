# Original sprite asset pipeline

Sources: `source/actors.png` and `source/environment.png`, generated specifically for this project with the built-in image generation tool on 2026-10-17. No proprietary game assets were copied. The approved image was a visual reference, not a texture layer. Original output alpha is preserved. Source sheets are retained for review and reproducibility; only exported atlases are loaded by the game.

Re-export: `python3 assets/v1/export.py` (Python 3, Pillow 12.3.0 used here). The script has no network dependency. It crops the fixed 4×4 source grid, bounds/fits transparent sprites, articulates lower limbs and shoulders, applies recoil/hit/death transforms, packs frames in stable eight-column sheets and records SHA-256 hashes. These are rigged frames, not a claim of individually hand-painted animation. PNG sampling is nearest-neighbor in the renderer. All timing is cosmetic.

`manifest.json` specifies source/runtime sizes, cell dimensions, per-state frame counts/durations/loop flags, cardinal order, foot anchor, bounds and separate shadow attachment. Terrain records twelve floor cells and sixteen N/E/S/W wall masks. Prop collision comes exclusively from the game map, never sprite alpha or artwork. A tank/pipe appears only on the corresponding showcase blocking cell; terminal/cache/exit remain passable interactables. Emissive material remains readable in ECO without bloom.

Generation briefs used:

1. Transparent 4×4 sprite atlas. Rows: cyan titanium PMC with rifle, orange/red hostile trooper, massive pale pink-red cybernetic brute, red quadrupedal crawler. Columns east/south/west/north. Orthographic near-overhead dark gritty detailed pixel art; scratched armor, rivets, cables; neutral upper-left light; no floor, text, grid or background; original designs.
2. Transparent 4×4 environment atlas. Floor row: steel, grate, cyan wet steel, hazard hatch. Wall row: reinforced bulkhead, pipes, corner, red warning control bank. Prop row: titanium cover, stacked military boxes, compressor barrel, cyan holo terminal. Last row: red containment tank, gold salvage chest, lit exit gate, steam pipe. Consistent near-overhead metal perspective, navy/titanium/cyan/red/tungsten; no room screenshot or unrelated characters.

Limits: generated perspectives are slightly elevated rather than a mathematically perfect orthographic model. The pipe source includes a small static vapor shape; an additional independent timed steam layer is rendered in HIGH/ECO. Source grid boundaries and small details should be reviewed before a future higher-resolution character pass.
