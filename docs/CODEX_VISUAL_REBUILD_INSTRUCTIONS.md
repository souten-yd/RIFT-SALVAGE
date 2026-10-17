# Codex implementation instructions — RIFT // SALVAGE visual overhaul

## Assignment

Implement the interactive graphics upgrade documented in `docs/VISUAL_REBUILD_SPEC.md` for `souten-yd/RIFT-SALVAGE`. The user-approved visual target is a portrait top-down dark mining-station battlefield with cyan PMC soldier, red trooper, hulking pink-red brute, a crawler, metal covers, holographic terminal, red containment chamber, steam, sparks, reflections, and compact cyberpunk Japanese UI. The approved reference was shared as an image in the ChatGPT development conversation. **Do not pretend the promotional image is existing in-game art.**

First deliverable: a **playable, visually finished mining vertical slice** that still supports the established full round-trip from ship -> deploy -> battle -> loot/data -> extract -> ship. A mockup or a screenshot-only demo does not satisfy the request.

## Preflight — mandatory before editing

1. Checkout current default branch. Read `index.html` **as it exists now**, particularly game logic `generate`/`move`/`shoot`/`turn`/`interact`/`extract`/`die`; renderer `makeTile`/`makeSprite`/`renderLoop`/`draw`; DOM/buttons and ``window.__RIFT_TEST__`.
2. Read `.github/workflows/pages.yml` and `.github/workflows/validate.yml`. Verify what is actually deployed, not simply documented.
3. Capture a baseline Chromium screenshot and log/functional test. Verify if Pages site is reachable before asserting availability.
4. Note any observed defect, baseline commit SHA, save-key compatibility and benchmark environment in PR description.
5. Use one feature branch targeting main; keep the scope exclusive to art/rendering, minimal HUD adjustments needed to realize reference, asset packaging and their tests.

## Allowed changes

- `index.html` rendering and CSS/HUD layout where necessary.
- New original art exports and a source/metadata manifest in `assets/v1/`, with descriptive paths and deterministic packing rules.
- Supporting art generation/export scripts (optional) and tests under `tests/`.
- `.github/workflows/pages.yml` and static verification workflow **only as necessary** to deliver newly referenced assets and run tests.
- `README.md` and graphics docs for asset provenance, controls, smoke-test, tested browsers and build/deploy instructions.

## Do NOT

- Modify authoritative combat balance, RNG, pathfinding, collision, turn advancement, detection, credits, loot, extraction/death penalties or contract rewards merely to emulate reference art.
- Break or rename persisted save key `rift-salvage-save-v1`, reset existing user saves, silently wipe a mission, or alter test hook contracts without compatibility support.
- Add fake visual AP that suggests actions have AP cost where none exists. Genuine AP mechanics are outside this visual PR.
- Convert everything to a static single screenshot, hardcode the real map to a decorative image, or hide collisions behind invisible props.
- Fetch copyrighted Quasimorph sprites, backgrounds, music or other third-party proprietary art.
- Introduce unsupported network access, log upload, a backend, login, cloud storage, active automation, Vue/React as new app defaults, or runtime code execution features.
- Build source on page load or the HTTP server. If packaging needs a build, do it reproducibly in CI and deploy output.
- Remove or bypass current touch controls, keyboard shortcuts, modal, map toggle, quality settings or error messaging.
- Claim a specific iPhone frame-rate without actual on-device measurement.

## Implementation steps — combine into ONE PR if feasible

### Step A — preserve playable baseline

Introduce a **render-only interface** to the existing gameplay state with world-to-screen camera transformation and 7-8 explicit layers (geometry / decoration / props / unit / world FX / fog / tactical overlays / DOM). Keep authoritative functions in place; avoid broad restructuring while building the vertical slice. If code splitting is necessary, ensure script order/build and `index.html` output are proven in CI.

### Step B — original art assets and reliable loader

Build original industrial floor/wall, crates/cover, hologram terminal, loot, B1 exit, A7/B2 markers, pipes and red mutant tube. Create original player and enemies with animated sprite-sheet frames. Store every runtime dependency in the repository; add a readable asset manifest (tile dimensions, frames, anchors, contract variants, animation timings, license/provenance).

Implement preload/decode/timeout/error handling and a visible failure or modest procedural fallback **only for missing art** (never change gameplay or load third-party images). Render terrain with cached chunks/atlas and deterministic variation.

### Step C — visual combat vertical slice

- Player walk idle/fire/hit/death 4-way animations and recoil, with combat sprite anchored on the map.
- Trooper shoot/hit/death; brute idle/walk/attack/hit/death; crawler idle/move/attack/hit/death.
- Directional overlays and readable cover edges. If behind cover, sprite occlusion must not obscure team/health indicators.
- High-density material detail and correct floor lights, steam, impact sparks/tracers, shallow wet reflection/highlights, color-contrasted alarm lamps, reactive terminal and extraction glow.
- Particle effects strictly cosmetic and time-bound. Keep low-cost rendering when resting on mobile.

### Step D — mobile UI

Match reference structure at actual iPhone CSS width: compact readable top HP/rift/ammo/turn strip and clear actions `移動`/`射撃`/`リロード`/`治療`/`ターン終了`; preserve `調べる` and `撤収` access; log text stays real and scrollable/readable. Safe-area padding, at least 44px touch targets, balanced information density, no inadvertent page scrolling while manipulating Canvas, no click-through overlays. HUD keeps real data; no fabricated numbers.

### Step E — production packaging and regressions

GitHub Pages deployment currently copies `index.html` **only**. If external assets are introduced, **fix deployment in the same PR** to copy exactly the static asset subtree and verify _site structure. Do not require a custom hosting backend. Add browser functional tests, fixed-seed screenshot snapshots, asset path checks, deterministic sprite frame checks, and FPS sampling harness. Keep size and memory limits documented.

### Step F — documented evidence and merge

Run CI. Capture real engine screenshots (not generated concept art): ship, mining corridor, firefight, brute, extraction, with mobile-width images. Explain side-by-side differences vs reference, missing work and real FPS measurements / explicit unverified status. Ensure PR diff includes only intended paths. After merge, check main files, published site HTTP and actual game flow. Fix a small issue in this PR before merge instead of opening a cosmetic follow-up.

## Detailed acceptance test matrix

| ID | Condition | Verification |
|---|---|---|
| UI-01 | 320, 375, 390, 430px width mobile layouts | real browser screenshots, no clipped buttons |
| UI-02 | Mobile touch tap, directional swipe, D-pad | no duplicate move/shot, no accidental zoom |
| GAME-01 | `出撃する` -> mission view | no JS exception/blank Canvas |
| GAME-02 | move/shoot/reload/heal/wait | exactly one expected logical turn per valid action |
| GAME-03 | cover/LOS/path | enemies/targets not hittable through blocking wall, ammo conserved for invalid action |
| GAME-04 | loot, goal terminal, escape | valid rewards and continuing save |
| GAME-05 | lethal damage | accurate death losses, ship flow restored |
| ART-01 | sprites animate independently of game ticks | captured states; no false damage |
| ART-02 | fog of war | unseen enemies not disclosed, previously seen layout dimmed |
| ART-03 | mining environment fits brief | A7/B2/B1, warning lights, steam, tank, wet surfaces, physical covers |
| ART-04 | HIGH/ECO both work | no game-state changes, no broken sprites |
| PERF-01 | smooth animation target | record median, p95 fps/frame time + exact test device |
| SAVE-01 | load prior `rift-salvage-save-v1` | preserved upgrades, active mission, contract selection |
| DEPLOY-01 | Pages publishes HTML AND sprites | asset paths HTTP 200, correct types; no 404 |
| CI-01 | tests pass for PR and main | no hidden external dependencies |

Do not mark unchecked hardware and deployment verification as PASS.

## Definition of done

- Code, original art assets, loader, performance settings, regression checks and deployment fixes are integrated.
- Deployed GitHub Pages version plays through at least one mining mission on Safari; if direct iPhone verification is unavailable, report it as **pending**, not passed.
- Visuals are interactive (not image overlays), with recognizably richer texture/sprite/lighting quality than v0.4 in actual screenshots.
- Existing saves and extraction economics preserved.
- No unrelated feature changes and no untracked asset dependencies.

## PR scope / follow-ups

Prefer **one comprehensive implementation PR** for the mining vertical slice and its deployment/tests. If new character art and a full renderer replacement cannot safely be reviewed/tested together, permit a second PR **only for genuinely separate work** such as remaining VESTA-6 / NEREID-3 art sets, after completing the mining vertical slice in PR 1. Do not leave critical rendering/asset-404 regressions for a follow-up PR.

When later asked to "確認して", compare precisely against these instructions, inspect actual `main` files (not PR descriptions), tests, manifest, runtime and Pages, identify both omissions and over-implementation, and provide the next minimal Codex instruction with any small fixes folded into it.
