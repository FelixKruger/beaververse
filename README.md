# Beaververse

A small, playable woodland gathering place for builders. Walk as a beaver, meet around the fire, climb to a canopy workshop, wave, chat and opt into voice.

**Early prototype.** The tree-lodge direction is established; the current licensed animal is a temporary stand-in while a custom hero avatar is prepared. This is an independent experiment inspired by the AI BEAVERS builder community, with no official affiliation or endorsement.

## Run locally

Node 22.12+ or 24+:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:8788**. Use two independent browser windows/contexts to meet in the same room. The server binds only to loopback by default. For development, run `npm run server` and `npm run dev` in separate terminals; Vite opens at http://127.0.0.1:5173.

WASD/arrows move, drag rotates the camera, scroll zooms, E waves. Phone browsers get a thumbstick. The timber ramp on the right climbs to the raised workshop. Names are temporary guest labels. Microphone is off until “Join voice”; “Leave voice” stops capture.

## Public preview versus multiplayer

GitHub Pages hosts the static world in **clearly labeled solo preview mode**. It does not run this WebSocket server. Shared room/voice works with the included server, tested locally in independent Chrome contexts. Internet multiplayer requires a hosted TLS server. A public preview URL is not proof of internet multiplayer.

For a combined Node deployment: build with `VITE_SAME_ORIGIN_SERVER=true`, bind `HOST=0.0.0.0`, set `PORT` and exact comma-separated `ALLOWED_ORIGINS`, and put the service behind HTTPS. For a separate static frontend, set `VITE_ROOM_SERVER=wss://your-host/room` at build time and allow that frontend origin on the server. No secrets belong in `VITE_*`. See `.env.example`.

WebRTC uses Google's public STUN service and a six-person peer mesh; there is no TURN relay. Some networks will not connect. The browser may expose network addresses to peers; voice is opt-in. Synthetic microphone transport was tested locally, not real microphones across different networks. Broad public hosting needs abuse/moderation and operational review beyond this prototype.

## Checks

```sh
npm test
npm run build
npm run test:browser
```

Browser checks require Chrome and a running local server. They use **fake microphone devices**, never the operator's microphone. Evidence and screenshots go into ignored `artifacts/`. Mobile viewport checks verify touch/layout, not physical-phone performance.

## Design and boundaries

- [Product brief and budgets](docs/PRODUCT-BRIEF.md)
- [Custom avatar production brief and Tripo dependency](docs/CUSTOM-AVATAR-BRIEF.md)
- [Future agent contract and threat model](docs/AGENT-BOUNDARY.md)
- [Asset credits and redistribution licenses](ASSET-LICENSES.md)

No real agents, accounts, tool execution, personal mailboxes, camera/video, purchases or paid generation are connected. Room text is inert data. Current room names are not private access controls. The server keeps ephemeral live state; it does not persist chat.

PlayCanvas + TypeScript/Vite, WebGL2 baseline. Source code MIT; third-party assets retain their listed licenses.
