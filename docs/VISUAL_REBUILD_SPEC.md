# RIFT // SALVAGE — Visual Rebuild Specification v1

Status: implementation-ready design specification (documentation only)  
Baseline: `main` at v0.4 IRON VEIL (2026-10-17)  
Target: the dark, highly detailed, vertical top-down mining-facility battle image approved by the project owner in ChatGPT. This is a **visual target, not a gameplay screenshot or reusable game tilemap**.

## 1. Objective and non-goals

Build a **real interactive iPhone Safari game** whose mining-sector combat scene approaches the reference in art direction and density, while retaining the existing playable extraction loop. Prioritize readability, consistent sprite perspective, dynamic response, and a smooth presentation over artificial screenshot similarity.

- Required: independently animated units, navigable corridors, line-of-sight and functioning cover, loot, terminal, extraction, HUD and log.
- Not acceptable: pasting a full reference screenshot under clickable hotspots; a mostly static background; enemies painted into the backdrop; placeholder squares represented as final art; unbounded GPU effects; fake frame-rate claims.
- Do not copy Quasimorph proprietary assets or source. Use original visual assets.
- Do not alter the authoritative turn, reward, save or death semantics in a visual-refactor PR. AP is shown in concept artwork but is **not currently an authoritative game mechanic**; do not fabricate an AP counter. AP mechanics, if desired, require a separate explicit gameplay specification.

## 2. Verified existing implementation

The real `main/index.html` was inspected, not only PR text.

- Single self-contained 348,638-character HTML document, CSS, JS and embedded imagery; GitHub Pages currently publishes `index.html` via `.github/workflows/pages.yml`.
- `gameCanvas` uses Canvas 2D; grid `SIZE=35`, viewport `VIEW_W=9` / `VIEW_H=11`, procedural atlas `PIX=72`.
- Logical authority: `generate`, `deploy`, `move`, `shoot`, `turn`, `reload`, `med`, `interact`, `extract`, `die`, `persist` and `lineOfSight` in `index.html`.
- Current display: `makeTile`, `makeSprite`, `getTile`, `getSprite`, `renderLoop`, `draw`, `drawActor`, `drawObj`; movement and enemy interpolation, particles and basic colored lighting already exist.
- Existing contracts: ASTRA-9 mining, VESTA-6 research, NEREID-3 derelict warship.
- Existing save key: `rift-salvage-save-v1`; old saved missions must remain loadable.
- Exposed test hooks: `window.__RIFT_TEST__` with `getState`, `deploy`, `move`, `shoot`, `turn`, `interact`, `extract`, `getFrameInfo`.
- Existing collision semantics: `s.map[y][x]` values `0`=wall, `1`=floor, `2`=blocking cover; keep this meaning.

## 3. Visual direction

### 3.1 Production art brief

- Perspective: true orthographic top-down with slight visible vertical faces of wall panels/props; no random perspective changes between assets.
- Palette: navy-black industrial base (#06101a, #121f28, #233540), distressed titanium highlights (#647783, #b4bdba), cyan navigation/terminals (#45e6e1), deep alarm red (#fc4f50), warm tungsten/fire (#ffae59), rift magenta (#b84fc2). Exact tones may be art-directed, but retain this hierarchy.
- Materials: individually readable rivets, seams, brushed steel, hazard stripes, wet patches, vents, grating, wired panels, cables, scorch/blood decals. Reflective highlights must not conceal cover/tiles.
- Environmental storytelling: giant "A7"/"B2" industrial markings, red backlit mutant containment tube, cyan holo terminal, crates, machinery clusters, steam leaks, B1 extraction gate.
- Light: cool screen illumination vs warm muzzle bursts vs red alarm strips. Preserve a distinct player's cyan silhouette and enemy's red/orange silhouettes even with bloom off.
- Field of view: unexplored black; explored but not visible dimmed; current visible area fully rendered. Explored darkness cannot disclose fresh enemy positions.
- Screens: iPhone portrait is the first-class layout; landscape is supported with resized HUD, no hidden gameplay controls.

### 3.2 Minimum original asset package (source + runtime)

Store all sources in a documented asset pipeline and exported files under `assets/v1/`. Use compact PNG or WebP (check Safari compatibility) with pixel-perfect filtering for sprites. Do not include full-screen screenshots as game layers.

| Group | Required first-slice set | Interactive property |
|---|---|---|
| Floor | 8+ connected steel plate/grate variants, hazard stripes, damage/wet decals | passable, tile-aligned |
| Walls | 8+ wall pieces including corners, cross-junctions, warning lamps, door trims | opaque and impassable |
| Props | 3+ cover crates, pipes, barrel, cyan terminal, data cache, exit gate, containment tank | geometry/click target separated |
| Player | 4 cardinal facing sets; idle, walk, shoot, hit, death sprite animations | rendered at true entity coordinates |
| Trooper | 4 facings; idle, move, fire, hit, death | aligns with guard AI |
| Crawler / Brute | idle/move/attack/hit/death, readable colored silhouette | aligns with existing kinds |
| Effects | muzzle flash, bullet tracer, impacts, sparks, drifting steam, blood hit, extraction glow | timed visually, not game-logic-driven |

Asset metadata must specify source size, sprite cell W/H, frame count, anchor at feet, orientation, animation duration, shadow attachment, and bounds. Distinguish cosmetics from wall/cover collision. A containment tank may be decorative unless mapped to a blocking cell; no invisible collision.

### 3.3 Example animation budget

Frame numbers are initial targets, not permission to ship 1-frame placeholders:

| Unit | Idle | Walk | Attack/fire | Hit | Death |
|---|---:|---:|---:|---:|---:|
| PMC | 4 | 8 | 4 | 3 | 6 |
| Trooper | 4 | 6 | 4 | 3 | 5 |
| Brute | 4 | 6 | 5 | 3 | 6 |
| Crawler | 4 | 6 | 4 | 3 | 5 |

Animation states select visuals only. A walking pose must not create extra turns. Shoot flash appears **after** validated fire input; do not apply a second damage event when the sprite reaches its impact frame.

## 4. Renderer architecture

Continue to use Canvas 2D initially, so GitHub Pages remains static and Safari support stays broad. Do not introduce WebGL or a mandatory JS framework solely to add visual quality.

Replace intermingled paint calls with named, ordered layers:

1. Cached ground and corridor geometry (dirty/chunk cache, seeded deterministic variants).
2. Static environment decals and structure faces/cover.
3. Depth-ordered props and dynamic interactables, screen-space coordinate derived from authoritative map.
4. Units / attached weapons / shadows / health bars (deterministic foot anchors).
5. World effects: projectiles, impact sparks, smoke, optional shallow wet-floor highlights and lights.
6. Current vision + remembered fog; never draw enemy intelligence through fog.
7. Tactical overlays: cyan selection tiles, movement path, shoot target, extraction icon.
8. HTML/CSS HUD, touch controls, combat log, menus.

Technical requirements:
- Use world-grid-to-screen transform in one place. Camera interpolation may use fractional coordinates, but logical tile positions stay integer.
- Texture variants must be deterministic by world seed and tile coordinate; do not use random inside every `requestAnimationFrame`.
- Load and decode assets once, with explicit ready/failure handling; show a friendly loading/fallback state instead of silent empty tiles.
- Prefer image atlases and cached chunks; avoid creating/re-coloring large canvases, `createRadialGradient` objects or new images per tile per frame.
- Resize when actual canvas dimensions change; account for `devicePixelRatio`. Keep sprite nearest-neighbor sampling; allow smooth gradients only in optional light/fog layer.
- Respect `prefers-reduced-motion`; pause animations and audio when backgrounded; no tight hidden-tab loop.
- First visual slice must be playable with Safari touch and desktop mouse/keyboard, not a cinematic replay.
- The HIGH / ECO toggle must remain functional. ECO reduces DPR/particles/bloom; never changes turn outcomes or detection.

## 5. Reference-inspired mining-sector vertical slice

Implement one **authored 35x35 combat showcase layout** (entry room, A7 left industrial zone, B2 upper processing area, reactor/containment right, B1 lower extraction) **as an optional deterministic showcase mission for QA**; do not delete procedural mission generation.

The scene must contain, in physical gameplay coordinates:
- PMC starting behind low cover; cyan selection and reachable tiles;
- One armed trooper behind blocking cover; hostile firing after player turn;
- One brute and one crawler visible at different distances;
- One reachable cyan terminal, one loot cache, a reachable B1 extraction gate;
- Visible steam outlet, warning lamps, wet/grimy floor patterns, a red containment tank; the visuals never block important tactical indicators.

Passability and visibility are generated from the *same* map data used by AI/pathfinding. Every reachable objective must remain reachable with the blockers enabled. Showcase state must never overwrite existing campaign progress without explicit user action.

## 6. UX and interaction

Keep the current actual menu, contract selection, `出撃する` action, movement, shooting, interaction, reloading, healing, extraction, log and saved game. In a polished HUD:

- Health, ammo, rift and turn values must reflect authoritative game state, with no mock/sample values in production.
- Controls must be comfortably tappable (target >=44 CSS px), readable on a 320 CSS-px wide screen, and unaffected by iPhone safe-area insets.
- Map drag/swipe vs tap must not trigger accidental shots, and input must be rejected while a blocking modal is open.
- Distinguish cover from cosmetic dressing with line-of-sight cues; a blocked shot should display feedback and must not consume ammo.
- Loading state and failures are explicit, not a nonreacting `出撃` button.
- Combat log text and timestamp source should be actual events; never paste fabricated lines from art reference.
- Do not show unsupported AP semantics simply to match a screenshot.

## 7. Performance and quality gates

Performance is an objective, **not yet a measured claim**. On a real recent iPhone in Safari aim for median >=55 fps while exploring, 60 fps when practical, with no sustained stalls >100ms during normal camera motion. Measure both HIGH and ECO in a 60-second scripted camera/animation scene; report hardware, OS, Safari build, DPR, median and p95 frame times. No claim of "60fps confirmed" without real-device data.

Initial limits (adjust after measurement): cap active visible particles ~100, compact atlas pack, avoid unconditional full-map resampling each frame, target initial assets under ~8 MB compressed with eventual budget justified in report. Reuse effect allocations or pooled particles as warranted by profiling.

Visual acceptance at CSS viewports 320x700, 375x812, 390x844, 430x932, and one landscape:
- Screenshots show actual gameplay, not generated promotional art.
- Floor/wall/props/actors are visually distinct at native mobile scale, with at least two obvious lighting colors and environmental depth.
- One screenshot each for hangar, mining traversal, trooper firefight, brute encounter and extraction, attached to PR.
- Side-by-side compare against approved image for composition/materials; record remaining gaps honestly.
- Focusable controls, no obscured critical buttons, no horizontal overflow, logs visible.

## 8. Required automated and manual tests

Retain existing GitHub Pages workflow. Add browser tests (Playwright + Chromium for CI; Safari manual smoke) with a deterministic fixture and test hook.

1. `出撃する` from ship -> playable mission and visible player, no JS errors or blank Canvas.
2. Move -> logical turn increases exactly once; animation interpolates without additional logical movement.
3. Shoot enemy in range -> one ammo consumed, one action, no duplicate damage. Out-of-range/cover shot -> zero ammo consumed.
4. Blocking cover matches `lineOfSight` and `nextStep`; objectives/caches/exit reachable across 100+ deterministic seeds.
5. Trooper, brute, crawler states and particles draw without actor disappearing behind unrelated overlays.
6. Kill, loot, interact, extract and die still produce previous economic outcomes.
7. Existing `rift-salvage-save-v1` load, suspend/reload, and continue mission. Check localStorage unavailable fallback.
8. Canvas size, DPR HIGH/ECO, tab visibility, rotation and device resize; stable input coordinate conversion.
9. Automated screenshot snapshots at fixed seed/frame time and seeded animations; compare intended changes and attach diff.
10. Content deployment: `index.html` and any `assets/v1` files are included in published `_site`, HTTP 200, correct MIME and no missing resources. Validate actual public URL when Pages enabled.

Never replace evidence with "PR merged" alone. After merge re-read `main` runtime/docs/assets/tests, run checks, and inspect live deployment to verify no stale wording, missing assets or mismatched paths.

## 9. Packaging / deployment

Static site only, no server runtime or npm install/build at request time. Existing Pages workflow currently copies only `index.html` into `_site`. When introducing external assets, **modify `.github/workflows/pages.yml` in the same implementation PR** to copy assets with the correct directory layout, and test published paths. If using a bundler locally or in CI, its deterministic *build output* must be explicitly published and tested, never assumed to exist on GitHub Pages.

Prefer incremental changes and no unrelated rewrites. Preserve accessibility and existing playable flow. Do not add server API, user accounts, online telemetry, execution/coding agents, cryptocurrency or network dependency.

## 10. Completion criteria

The visual rebuild is complete only when:
- an actual iPhone Safari session can deploy, move, shoot a trooper and brute, loot, trigger terminal and extract;
- on-screen scene clearly exhibits original high-density sprite art, visible coverage/shadows and cinematic effects in live animation rather than a still screenshot;
- regression and mobile screenshot test evidence is provided;
- existing save/logic remains compatible, no broken page deploy, and `main` plus live site are verified;
- the implementation PR explicitly separates verified details from unverified device/fps claims.

The first release should prioritize a visually finished **mining vertical slice** over three low-detail stage re-skins. Extend VESTA-6 and NEREID-3 only after the mining slice meets these gates.
