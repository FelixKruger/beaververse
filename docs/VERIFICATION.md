# Public source candidate · 2026-11-18

The `codex/playable-world-update` release snapshot was built and exercised separately from the active development checkout. It retains the CC0 Gobkit avatar and individually licensed scenery; private purchased-character assets and research are excluded. Branch publication does not deploy the preview or establish internet multiplayer readiness.

- `npm test`: **37 passed**, no failures or skips.
- `npm run build`: PASS. TypeScript and production bundling passed; the existing large-bundle warning remains (approximately 2.04 MB JavaScript / 526 kB gzip).
- `scripts/verify-browser.mjs`: PASS against a separate loopback production server. Two contexts verified movement, inert chat, waves, synthetic WebRTC audio, microphone default-off/stop, presence cleanup and complete keyboard/touch arrival-to-canopy-and-return routes.
- `scripts/verify-community.mjs`: PASS for voluntary save/export, private-note separation and deletion, garden placement, real HTTP companion pairing, denied ungranted actions, owner-reviewed proposals and revocation.
- `scripts/verify-workshop.mjs`: PASS for actual bench approach, editable drafts, preserved existing drafts, explicit-only send/save, focus handoff and phone-width layout.
- `scripts/verify-sprint.mjs`: PASS. Measured walk/run/released speeds were approximately 4.25 / 5.47 / 4.25 world units per second; typing and blur guards passed.
- `scripts/verify-return-visit.mjs`: PASS for deliberate saved-note continuation, unchanged unfinished drafts, inert text, deletion, expiry and separate-browser privacy.
- An isolated non-local-hostname fixture served these exact local build files in solo mode: 17 runtime assets loaded, the source offer pointed to this update branch, AGPL and asset notices were served, and voice stayed off without a room connection. No private asset requests occurred.

These checks used isolated headless Chrome 157 on Windows and a 390 x 844 touch viewport. No personal microphone, physical phone, human usefulness/retention test or cross-network voice test was performed. This is source-candidate verification, not a production security certification. Reproduce browser scripts with `TEST_URL` and `TEST_ARTIFACT_DIR` set to your running local server and ignored evidence directory.

# Historical local avatar iteration · 2026-11-13

The local production build now loads Gobkit Beaver (CC0), with skeletal idle/walk playback and an original paddle-tail greeting. This is a quadruped approximation, not the custom humanoid builder. Public deployment is unchanged.

- `npm run build`: PASS (TypeScript + Vite); existing large-bundle warning remains, main JavaScript 2,022.74 kB / 519.83 kB gzip.
- `npm test`: **24 passed**, none failed or skipped, including pinned asset/rig/clip validation. Initial sandbox-only run could not connect to localhost; the completed run used authorized loopback access.
- `TEST_ARTIFACT_DIR=artifacts/2026-11-13-avatar/route npm run test:browser`: PASS. Two independent Chrome contexts, keyboard/touch arrival-to-workshop-and-return, peer movement/wave, chat guards, default-off/stopped microphone and synthetic WebRTC transport. Zero browser errors or failed assets.
- `node scripts/verify-avatar.mjs`: PASS. Imported idle timeline and walk joint movement; independent per-player controllers; peer sees walking and tail greeting; stop returns to idle; reduced-motion idle pauses; mobile greeting/recovery and layout; departure cleanup. Screenshots and JSON receipt in `artifacts/2026-11-13-avatar/`.
- Actual model views and desktop/mobile screenshots were visually inspected. Character retains a projecting paddle and readable beaver face. A forepaw experiment was discarded because the short limb tucked into the muzzle; final greeting uses the paddle.

Chrome 156.0.8078.81, Windows, 1440×900 desktop and 390×844 mobile emulation. Full-route snapshot: 52 fps / 71 draws desktop, 53 fps / 63 draws mobile emulation. These are host snapshots, not device benchmarks. No physical phone or human-feel test. Gait cadence is approximate, without foot-lock IK. Existing art-detail and humanoid-avatar goals remain open. Detailed local receipt: `artifacts/2026-11-13-avatar/HANDOFF.md`.

# Historical first playable verification · 2026-11-04

## Verified locally
`npm run build` passed TypeScript checking and the Vite production build. `npm test` passed **8 tests**. `npm run test:browser` passed on the production build served by the included Node server.

Environment: Windows, isolated headless **Chrome 156.0.8078.81**, **1440×900** desktop viewport; separate context at **390×844**, device scale 1 with touch/mobile emulation. No physical phone, real-user playtest, Safari or Firefox test was performed.

- Fresh entry and all 12 model containers loaded; zero failed model/texture requests or serious console errors.
- Two independent browser contexts saw each other's identities, walking, waves and text messages.
- Malicious-looking message text stayed literal text; typing did not move an avatar.
- Normal keyboard input climbed to the canopy deck at **y=3.2** and returned to ground. Shared movement tests cover 80/100/300ms packet-sized steps, solid edges and bench tunneling.
- Microphone was off before opt-in. Two synthetic microphone devices established an actual WebRTC connection; receiving-side stats recorded incoming audio packets/bytes. This proves local media transport, not audible quality, real microphones, internet NAT traversal or TURN coverage.
- Leaving voice stopped capture. Regression tests verified that delayed microphone permission cannot activate capture after disconnect/leave.
- Closing a browser removed its presence. Touch input moved the avatar; the narrow viewport had no horizontal overflow.
- Real WebSocket tests rejected malformed/hostile JSON, unknown schemas, excessive traffic, oversized frames, disallowed origins and cross-room signaling. Voice required both peers' consent. Independent review findings were fixed and rechecked.

## Performance observations and limits
Final run snapshots: **60 fps / 71 draw calls** in the desktop context, **54 fps / 61 draw calls** in the mobile-emulated context. Other desktop runs ranged down to 36 fps under concurrent activity. These are snapshots on this host, **not device benchmarks or phone guarantees**. Submitted-primitive counting is unavailable in the release engine build; the visible-triangle target is not validated.

Whole production directory: **2,463,394 bytes** raw, **710,896 bytes** independently gzipped estimate across 29 files. This is a local estimate, not measured cold network load time. Vite warns that the main engine/application bundle is large (about 2.02 MB minified / 519 kB gzip); it remains within the initial download budget. No blanket performance claim.

## Publication boundaries
Public repository: [FelixKruger/beaververse](https://github.com/FelixKruger/beaververse), verified readable without authentication with `private: false`. [Live preview](https://felixkruger.github.io/beaververse/) rendered in fresh desktop and mobile-emulated contexts. All **24 asset responses** passed status/body checks, with zero console errors. The served JavaScript SHA-256 matched the local production build. Solo movement worked; voice remained unavailable without a room connection and did not capture.

GitHub Pages is a static **solo preview**. It does not run the Node room server. Internet multiplayer needs a separately deployed TLS service and exact allowed origins. STUN is configured; TURN is not. The guest-room server is a prototype, not a production moderation/account system.

Future personal-agent messages/world commands are documentation only. Face video remains future scope. The current licensed beaver is a temporary unrigged stand-in; bespoke avatar/animation and richer art are unfinished. Generated references are local and are not proof of runtime quality.

## Reproducible evidence
Local scripts write ignored `artifacts/browser-verification.json`, `entry-desktop.png`, `two-player-desktop.png`, `canopy-deck.png`, `entry-mobile.png` and `world-mobile.png`. These contain synthetic visitor names. Run the included browser verifier against a running local server. It always uses fake microphone devices.
