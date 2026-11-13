# Hosted multiplayer readiness

The included Node server supports local shared rooms. No production multiplayer service is provided by this repository. GitHub Pages serves a solo preview and cannot run the WebSocket backend.

## Existing architecture

One Node HTTP server serves dist/ and upgrades /room to WebSocket. Room state is in memory: 12 players per room, six voice participants and 96 sockets per process. Snapshots broadcast at 10Hz. Keep one replica until room routing/state is redesigned; separate replicas currently split a room.

The client retries transient disconnects with bounded backoff. A restart creates new guest identities and loses presence/positions; voice stays off after reconnecting. Guest names and room slugs are not authentication or private access controls.

## Deployment examples

The deploy/render.yaml.example file illustrates an always-on paid Node service; deploy/render-free.yaml.example illustrates a limited beta. Neither creates resources automatically. Both use one replica, explicit origin input, same-origin frontend, /health readiness and automatic deployments off. Creating a provider Blueprint still triggers an initial deployment.

Production requires a completed build, NODE_ENV=production and exact HTTPS ALLOWED_ORIGINS. Build with VITE_SAME_ORIGIN_SERVER=true; bind HOST=0.0.0.0 only in the intended hosting environment. Never put credentials in VITE_* variables. Defaults remain loopback for local development.

Render Free sleeps and has quotas; free compute does not guarantee zero cost on a billable workspace. Review current account terms, usage and pricing before deploying. [Provider limits](https://render.com/docs/free)

Cloudflare Workers Static Assets plus one Durable Object per room is another possible route. The Node transport/lifecycle needs a port; the current continuous ticker would prevent hibernation savings. No Cloudflare adapter is included. [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Before a public launch

- Define anonymous/invited access and moderation. Raw clients can spoof Origin; origin checks are not authentication. Add provider-appropriate connection/abuse controls without trusting arbitrary forwarded IP headers.
- Add TURN with server-issued short-lived credentials before promising reliable voice. Current STUN-only peer mesh can fail on restrictive networks. Keep microphone opt-in and stop capture on disconnect.
- Test actual HTTPS/WSS, foreign/missing Origin, room capacity, slow clients, reconnect/restart and real microphones across separate networks. Test Safari/iOS/Android on real devices.
- Measure hosted bandwidth, memory and latency; choose usage alerts and rollback. Local regression does not establish capacity or production readiness.
- Review log retention and privacy information. No persistent accounts, durable chat, moderation UI or real agent integrations currently exist.

The main-branch GitHub Pages workflow publishes the static demo. Coordinate release changes before merging; publishing source on a branch does not deploy multiplayer.
