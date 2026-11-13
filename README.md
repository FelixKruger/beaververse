# Beaververse

A small, playable woodland gathering place for builders. Walk as a beaver, meet around the fire, climb to a canopy workshop, wave, chat and opt into voice.

**[Open the public solo preview](https://felixkruger.github.io/beaververse/)** · [Public repository](https://github.com/FelixKruger/beaververse) · [Verification and limitations](docs/VERIFICATION.md)

**Early prototype, open for contributions.** This source iteration uses Gobkit's CC0 rigged Beaver with idle/walk animation and a paddle-tail greeting. It is a stylized quadruped interim avatar; the custom humanoid builder goal remains unfinished. The earlier model is preserved as a fallback. This is an independent experiment inspired by the AI BEAVERS builder community, with no official affiliation or endorsement. The public solo preview may show an earlier version; publishing this branch does not deploy it.

## Make something playful

Fork the repository and build a small addition: a woodland detail, clearer phone controls, an accessible interaction, or a better greeting. See [CONTRIBUTING.md](CONTRIBUTING.md) for the code map, checks and asset rules. Current project code is AGPL-3.0-only; third-party models retain their own licenses. No hosting account or paid service is needed to contribute locally.

## Run locally

Node 24 LTS is the tested baseline. To start from this published iteration:

```sh
git clone --branch codex/community-source https://github.com/FelixKruger/beaververse.git
cd beaververse
npm ci --ignore-scripts
npm run build
npm start
```

Open **http://127.0.0.1:8788**. Use two independent browser windows/contexts to meet in the same room. The server binds only to loopback by default. For development, run `npm run server` and `npm run dev` in separate terminals; Vite opens at http://127.0.0.1:5173.

WASD/arrows move, drag rotates the camera, scroll zooms, E waves. Phone browsers get a thumbstick. The timber ramp on the right climbs to the raised workshop. Names are temporary guest labels. Microphone is off until “Join voice”; “Leave voice” stops capture.

## Public preview versus multiplayer

For the current deployment assessment, cost assumptions, prepared configuration and remaining launch gates, see [Hosted multiplayer readiness](docs/HOSTING-READINESS.md). The hosted service is not deployed yet. The client now retries temporary disconnections automatically; voice stays off after reconnecting.

GitHub Pages hosts the static world in **clearly labeled solo preview mode**. It does not run this WebSocket server. Shared room/voice works with the included server, tested locally in independent Chrome contexts. Internet multiplayer requires a hosted TLS server. A public preview URL is not proof of internet multiplayer.

For a combined Node deployment: build with `VITE_SAME_ORIGIN_SERVER=true`, bind `HOST=0.0.0.0`, set `PORT` and exact comma-separated `ALLOWED_ORIGINS`, and put the service behind HTTPS. For a separate static frontend, set `VITE_ROOM_SERVER=wss://your-host/room` at build time and allow that frontend origin on the server. No secrets belong in `VITE_*`. See `.env.example`.

WebRTC uses Google's public STUN service and a six-person peer mesh; there is no TURN relay. Some networks will not connect. The browser may expose network addresses to peers; voice is opt-in. Synthetic microphone transport was tested locally, not real microphones across different networks. Broad public hosting needs abuse/moderation and operational review beyond this prototype.

## Checks

```sh
npm test
npm run build
npm run test:browser
node scripts/verify-avatar.mjs
```

Browser checks require Chrome and a running local server. They use **fake microphone devices**, never the operator's microphone. Evidence and screenshots go into ignored `artifacts/`. Mobile viewport checks verify touch/layout, not physical-phone performance.

## Design and boundaries

- [Product brief and budgets](docs/PRODUCT-BRIEF.md)
- [Custom avatar goals and asset acceptance](docs/CUSTOM-AVATAR-BRIEF.md)
- [Future agent contract and threat model](docs/AGENT-BOUNDARY.md)
- [Asset credits and redistribution licenses](ASSET-LICENSES.md)

No real agents, accounts, tool execution, personal mailboxes, camera/video, purchases or paid generation are connected. Room text is inert data. Current room names are not private access controls. The server keeps ephemeral live state; it does not persist chat.

PlayCanvas + TypeScript/Vite, WebGL2 baseline. Current original project code is licensed under [GNU AGPL version 3 only](LICENSE); see [scope, earlier MIT releases and dependency notices](LICENSING.md). Third-party assets retain their listed licenses. This change does not revoke the MIT permissions on earlier copies through commit `0bf5604`.
