# First playable verification · 2026-11-04

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
