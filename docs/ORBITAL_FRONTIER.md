# Orbital Frontier — playable expansion

This implements the owner's new request for 3D interplanetary flight, ship modification and a homeworld-restoration endgame. It explicitly extends the earlier rendering-only scope. Baseline: main `d9be2e8`. Ground combat rules, contract rewards and the existing save key remain intact.

## Play loop

From the hangar select **宇宙へ出航**. Drag the open viewport to pitch/yaw. Set the throttle to cruise; hold boost for fast local travel. Shoot glowing asteroids, scan drift containers within 130 m, and return to the EDEN orbital dock to bank cargo, repair and modify the ship. The star chart pauses flight and opens warp routes. Landing near another world's gate or surface starts the existing ground contract. Extraction adds ship materials to available cargo capacity; the original credit rewards are unchanged.

| Destination | Engine needed | Threat | Main opportunity |
|---|---:|---:|---|
| EDEN | 0 | 0 | Safe mining, bank, refit, restoration |
| ASTRA | 0 | 1 | Alloy/crystal; mining facility |
| VESTA | 1 | 2 | Biological seeds; sealed laboratory |
| NEREID | 2 | 3 | Ancient cores; derelict warship |

Each sector has a planet, a moon, an orbital dock, a deterministic 3D resource field and risk-scaled hostile drones. There are four authored sectors, not an infinite universe. Planet approach and flight are continuous 3D; ground landing is a scene transition, not seamless atmospheric flight. The legacy quick-deploy contracts remain available for existing campaigns.

## Flight and risk

- Cruise: 35 + 13 × engine level m/s; boost: 180 + 65 × level m/s. Energy regenerates at 11/s and boost spends 23/s. Warp spends 50 energy and transitions over 2.4 s. EDEN and ASTRA never require an upgrade.
- Free yaw and pitch, perspective camera, real depth-buffered geometry. Planets enforce a surface boundary; the local navigation boundary is 6,500 m. Heading and distance markers guide the player back to targets.
- Lasers fire every 0.23 s, with a 650 m range and modest aim assistance. Asteroids have independent health; hostile drones pursue and fire. Boost evades their shots. Shields regenerate outside enemy range.
- Cargo capacity starts at 60. Cargo is only banked at the home dock. Destruction returns the ship to EDEN and loses half carried materials, retaining banked resources and all upgrades. Space damage never kills a ground clone.
- Returning to the home dock opens a new resource expedition. Resource IDs are retained during an expedition and saved to prevent collecting the same asteroid twice. Unlimited expeditions avoid a resource softlock.

## Ship modification and ending

Four modules have levels 0–3. Engine raises speed and warp access; shield raises capacity and recharge; laser raises damage; cargo adds 40 capacity per level. A next level costs alloy `12 + 18 × current level` and crystal `4 + 7 × current level`; the final upgrade also costs 8 biological seeds. Refitting requires banked materials and proximity to the home dock. Cargo pods and laser barrels change the visible ship silhouette; three paint schemes are selectable.

| Restoration | Alloy | Crystal | Seeds | Cores | Result |
|---|---:|---:|---:|---:|---|
| Atmosphere | 40 | 15 | 0 | 0 | Pollution recedes |
| Ocean | 60 | 30 | 30 | 0 | Water and continents emerge |
| Ecosystem | 90 | 45 | 60 | 18 | Green land, blue seas, EDEN restored |

The planet's actual material shader changes with restoration, and completion persists. Exploration remains playable after completion. This is an achievable three-stage ending, not a claim of a full colony simulation.

## Controls and display

Mobile: viewport drag steers; throttle slider, hold boost/fire, scan, target cycle, land and stop are separate 44 px or larger controls. Flight occupies the full viewport including landscape layouts. Menus pause simulation. Pointer cancellation, blur and backgrounding release held controls.

Desktop: A/D or left/right yaw; up/down pitch; W/S throttle; Shift boost; Space fire; F scan; E land; Escape chart. The star chart lists material costs and locked routes. Leave with 保存・母艦 to save flight position and return to the existing hangar interface.

Ground stage view now defaults to 9×11 visible cells. The top-right 表示 button cycles 大 / 特大 (7×9) / 広域 (11×13). At 390×844 CSS pixels, cells measure 41.33 / 52.44 / 33.82 px; before the layout changes they were approximately 29.38 px. Enlarging the view changes neither detection radius nor combat outcomes.

## Implementation and saves

`space.js` now uses **Three.js r180 / WebGL 2** for its Scene, PerspectiveCamera, independent Mesh objects, lighting and GPU resources. The owner's follow-up explicitly requested this engine migration. The pinned MIT-licensed modules are vendored under `vendor/three/` with license and SHA-256 metadata; no runtime CDN requests or page-load build are needed. The ground game still uses Canvas 2D. Three.js is initialized only on entering flight; unavailable WebGL 2 produces a visible error while ground play remains accessible.

The player is a multipart ship with swept armor, cockpit, intake grilles, running lights, cargo pods and guns. PBR metal materials use directional and hemisphere lighting. Steering drives damped body banking and independently articulated engine nozzles. Gimbal collars, eight nozzle petals per engine, additive blue exhaust shells, bright cores and boost shock diamonds share the nozzle transform. Small reaction jets respond to maneuvering/braking. These are cosmetic rig values, never saved or consumed by authoritative flight, combat, reward or RNG logic. Reduced-motion mode removes body banking and exhaust pulsation while retaining control feedback. Menus and hidden tabs pause the rig with the simulation.

`RiftCampaign` is a narrow bridge for persistence and ground deployment. Orbital progress is an optional `space` field under `rift-salvage-save-v1`; old saves are merged without resetting active missions or credits. The showcase continues to use isolated session storage. Autosave runs every 3 s of flight, plus transactional actions, exit and backgrounding. No cloud saves or telemetry.

Static packaging explicitly includes `space.js`; deployment tests compare its hash and MIME along with HTML and all six atlases. Original 3D mesh geometry and procedural shaders are authored for this project. The references inform the exploration/upgrade/travel loop only; no No Man's Sky or Galaxy on Fire art or code is copied. Reference: [No Man's Sky — Orbital](https://www.nomanssky.com/orbital-update/) and [Galaxy on Fire 2 official manual](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/212010/manuals/Manual_GoF2FullHD_STEAM_ENG.pdf).

## Verification and honest limits

`npm test` includes the existing 22 ground checks, three theme/visibility checks, a ground extraction playthrough and `tests/orbit.cjs`. Orbital tests exercise fresh-start mining, warp gates and energy, boost, pitch/yaw, reload persistence, exact upgrade costs, all restoration stages, actual enemy combat/death, five touch layouts, ground landing, extraction materials and zoom invariance. Expensive endgame states use clearly labeled loaded-save fixtures; these are not represented as an entire organically earned campaign playthrough.

Evidence: `tests/evidence/orbit.json`, `orbit-flight.webp`, `orbit-astra.webp`, `orbit-refit.webp`, `orbit-eden.webp`, `larger-ground.webp`. Screenshots come from the running engine. Tests use Chromium touch emulation; physical iPhone Safari performance and operation remain unverified. No iPhone FPS claim is made. WebGL loss is reported and requires reload; ground play remains available.

The Three.js follow-up starts from main `e84b9e0`. `tests/orbit-visual.cjs` adds eight checks: actual Three.js r180 drawing, no idle rig mutation of campaign state, steering articulation/banking, return to neutral, boost/braking response, menu pause, reduced motion and bounded geometry allocation without shader errors. It records `three-visual.json` and idle/turn/boost screenshots. `python3 tests/review-images.py --orbit-only` exports review WebPs and `thrusters.gif`, a cropped sequence of actual rendered frames (not an FPS measurement or a generated concept animation). Existing orbital and ground regressions still run in `npm test`.

This first playable expansion does not implement trading factions, fleets, seamless surface flight, multiplayer or a simulated planetary economy. The four sectors and resource costs provide the requested complete flight → salvage → refit → danger → restoration progression, with balancing left open to actual play feedback.
