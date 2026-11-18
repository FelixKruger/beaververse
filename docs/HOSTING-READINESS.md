# Hosted multiplayer readiness — 13 November 2026

**Status: prepared locally, not deployed and not certified production-ready.** Existing avatar/world edits are preserved. No account, subscription, permission, DNS, infrastructure setting, public endpoint or paid resource was created or changed.

## Recommendation

For the fastest controlled beta, keep the existing server and use **one always-on Render Node service**, serving the Vite build and `/room` WebSocket together over managed HTTPS/WSS. Start with the small paid instance, one region and one replica. Add TURN before promising reliable internet voice. Do not add a database merely to host ephemeral gatherings.

For a strict free-first budget or longer-term bandwidth economics, **Cloudflare Workers Static Assets + one SQLite-backed Durable Object per room** is a credible alternative. It requires a small backend port and its own acceptance tests; it is not a deployment switch for the existing Node `http`/`ws` server. Choose the platform before implementing that adapter. The frontend, assets, collision rules, message schema and most room logic can remain.

## Current architecture and evidence

- `server/index.js`: one Node HTTP/static server with `ws` upgrades at `/room`; exact Origin allowlist; all room state in memory. 96 sockets globally, 12 people per room, six voice participants. These are configured limits, not demonstrated hosting capacity.
- `server/protocol.js`: bounded exact schemas, 16KiB WebSocket frames, per-connection token buckets, room-isolated signaling. `shared/world.js` supplies server/client collision and movement rules. Server clamps speed.
- Room snapshots broadcast every 100ms. `src/main.ts` sends movement approximately every 80–100ms, including idle position updates. `src/network.ts` connects to a configured WSS endpoint or same-origin server.
- `src/voice.ts`: opt-in peer-to-peer WebRTC mesh; Google STUN only. No TURN, SFU, recording or camera. Microphone stops on leave/disconnect. Six participants imply up to five outgoing audio streams per person.
- `.github/workflows/pages.yml`: pushes to main can publish the static build to GitHub Pages. That workflow cannot run the room server. It remains unchanged; no push or dispatch occurred.
- Existing local proof covers two independent browsers, movement/chat/waves, keyboard/touch route and synthetic microphone transport. The new restart test additionally closes a real local server, checks microphone shutdown, restarts it, and verifies both browsers automatically rejoin and share movement again. This is still loopback proof, not internet/NAT/TLS evidence.

## Cost assumptions, verified public sources

Prices below are USD before tax, as checked on 13 November; account-specific eligibility and invoices are unverified.

| Route | Public pricing facts | Practical reading |
| --- | --- | --- |
| Render paid Node | $7/month for `0.5c-512mb`; Hobby workspace $0 plus compute, 5GB outbound included then $0.15/GB | Least code change; budget for traffic, not just compute. [Official pricing](https://render.com/pricing.md) |
| Render free | Sleeps after 15 minutes without inbound traffic, roughly one-minute wake; provider explicitly discourages production use | Suitable for disposable staging, not the production recommendation. [Official limits](https://render.com/docs/free) |
| Cloudflare Workers + DO | Static asset requests free/unlimited; paid Workers starts at $5/month plus usage. DO free: 100k requests/day and 13k GB-s/day. Paid DO: 1M requests and 400k GB-s/month included, then $0.15/M requests and $12.50/M GB-s | Potentially $0 for small usage, but quotas must be measured; not an unlimited free server. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| Cloudflare TURN | First 1,000GB/month shared SFU/TURN allowance, then $0.05/GB egress | Likely little initial audio cost within allowance, but requires account/key setup and abuse protection. [Official pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) |
| Railway alternative | Hobby $5 minimum with $5 usage included; usage above it billed | Viable Node option, not a $5 total-cost guarantee. [Official pricing](https://railway.com/pricing) |

Measured payload illustration from current JSON shape: a 12-person snapshot is about 2,104 bytes. At 10Hz to 12 recipients, this is **0.908928GB per full-room hour**, excluding framing/TLS, chat, asset requests and voice. Ten such hours/month means about 9.09GB of snapshots; using Render's published allowance/rate gives roughly $7.61 compute+snapshot egress before those exclusions, tax or optional domain. This is an estimate, not a load test or quote. Idle snapshot suppression, delta updates and asset compression/caching could materially reduce traffic after correctness tests.

Cloudflare's incoming WebSocket messages have a 20:1 billing ratio; outgoing messages are uncharged. Continuous `setInterval`/`setTimeout` prevents hibernation. Therefore copying the 100ms ticker unchanged sacrifices idle savings. Prefer state-change broadcasts/coalescing and restore session data from socket attachments; do not write every movement to SQLite. [DO billing](https://developers.cloudflare.com/durable-objects/platform/pricing/) · [Hibernation rules](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Safe preparatory changes completed

- Added `server/config.js`: production refuses missing, wildcard, credential-bearing, non-HTTPS or path-bearing origins; validates port. Development stays loopback by default. These are application code checks; no live settings were changed.
- Updated `server/index.js`: production refuses missing frontend build; readiness returns 503 when unavailable/draining and avoids exposing room counts; bounded graceful shutdown sends restart code 1012, rejects new upgrades and terminates lingering connections after five seconds. HTTP method restrictions, defensive static-stream error handling and framing/referrer/permissions headers are included.
- Updated `src/network.ts` and `src/main.ts`: capped exponential reconnect backoff with jitter, stale-socket guard, cancellation on explicit leave, no retry loop after policy/size rejection. Voice remains off after a new guest session. Position/identity are not persisted through a server restart.
- Added `deploy/render.yaml.example`: reviewable native Node recipe, one replica, explicit origin input, same-origin frontend, readiness path, automatic deploys off. It is an example outside the default Blueprint filename. **Creating a Blueprint still performs an initial deployment** and is not authorized yet.
- Updated `.env.example` and added targeted unit/socket/restart browser tests. Dependencies and GitHub Pages workflow unchanged.

## Launch risks and required gates

| Priority | Concrete failure mode | Before inviting the public |
| --- | --- | --- |
| 1 | An unauthenticated client spoofs Origin, opens many sockets or repeatedly rejoins and exhausts the 96-slot server | Decide invite-only beta vs anonymous public. Origin is CSWSH protection, not identity/authentication. Add provider-appropriate connection/IP limits and short-lived room admission tokens where needed; do not trust arbitrary forwarded IP headers. Add moderator kick/ban/report/mute controls for a public community. |
| 2 | Two people can see each other but voice fails behind restrictive NAT/firewalls | Configure TURN with server-minted short-lived credentials for authorized room members; never put long-lived keys in `VITE_*` or repository files. Rate-limit issuance, limit TTL and monitor billing. Test forced relay, Wi-Fi/cellular, reconnect and explicit mic consent. [Credential design](https://developers.cloudflare.com/realtime/turn/generate-credentials/) |
| 3 | A second Node replica splits one room across separate in-memory maps | Keep one Node replica, or port to one Durable Object per room. Larger-scale capacity needs measured latency/memory/bandwidth and room routing. |
| 4 | Redeploy/restart loses presence and positions, or deployed frontend speaks a different protocol | Reconnect now recovers guest sessions, but does not restore position or history. Accept ephemeral state for beta; define protocol versioning/maintenance behavior before rolling multi-version deployments. Save an exact release revision and rollback artifact. |
| 5 | Public traffic or leaked relay credentials creates a larger bill | Choose budget, usage alerts and provider-supported spend controls. Measure actual bytes and socket counts; free-tier exhaustion can become an outage. Do not promise a universal hard dollar cap. |
| 6 | Local green tests conceal internet TLS/region/browser/load failures | Test on the actual chosen service: HTTPS/WSS, malicious/missing Origin, 12-user room and 13th rejection, network changes, slow readers, restart, Safari/iOS/Android, and real microphones across networks. Add external health alerts and an accountable operator. |

Other limits: guest names are spoofable; room slugs are discoverable and are not private access controls; there is no durable chat history, user account system or moderation UI. Existing protection is useful but does not resist distributed abuse. Dependency audit reports no known production advisories as checked, which is not an application security audit. Provider logs/retention and a brief privacy notice need review before public use.

## Concrete next steps and user decisions

1. **Choose launch scope and hosting:** recommended small controlled beta on one Render paid instance for minimal changes; choose the Cloudflare port instead if $0-first/low bandwidth cost matters more than minimizing implementation work. Confirm intended concurrent users, region and whether ephemeral guest sessions are acceptable.
2. **Confirm budget and provider/account authority:** owner chooses/creates the hosting account, accepts terms and approves any billing. Approve a specific provider/plan, audience and deployment; none has been configured. Domain is optional; provider subdomain avoids purchase. Decide TURN provider/account access separately.
3. Complete room admission/moderation policy and TURN credential path, then exercise hosted staging on the chosen platform. For Cloudflare, port the transport/lifecycle, route room selection before WebSocket upgrade, and rerun isolation, hibernation/restoration and quota tests. Do not rewrite the visual world.
4. Review exact dirty changes into a release commit without losing earlier work. Coordinate the existing main-branch Pages auto-publish workflow before any push. Configure the approved origin/health/alerts and release one instance only after approval.
5. Run cross-network acceptance and monitored small-group trial; broaden the audience only once voice, abuse response, capacity, cost and rollback checks pass.

**Exact remaining blockers:** no chosen/authorized hosting account, budget, audience, region or final origin; no deployed Node service or Cloudflare adapter; no TURN credentials/integration; no public-admission/moderation decision; no internet test evidence, operational alerts or measured hosted capacity. No automatic approval rejection is pending. The blockers are unmade scope/provider decisions and unfinished launch gates, not a failing local build.

## Verification and files

- `npm run build`: PASS; existing large-engine-bundle warning remains.
- `npm test`: 27 PASS. Following a shutdown-deadline correction, targeted deployment/network checks passed again.
- `node scripts/verify-reconnect.mjs`: PASS, two actual browser contexts; synthetic mic stops on shutdown, new sessions rejoin, movement synchronizes, microphone stays off.
- Full production-build browser regression on isolated loopback port 8789: PASS, zero browser errors/failed assets, keyboard/touch full route, two-player chat/wave and synthetic WebRTC.
- `npm audit --omit=dev --json`: zero reported production vulnerabilities.
- `git diff --check`: PASS. No dependency updates or external deployment actions.

Added in this hosting-preparation stage: `server/config.js`, `tests/deployment.test.js`, `tests/network.test.js`, `scripts/verify-reconnect.mjs`, `deploy/render.yaml.example`, this document. Modified: `server/index.js`, `src/network.ts`, `src/main.ts`, `tests/server.test.js`, `.env.example`, and README's hosting pointer. Earlier avatar/scene changes remain intact. Evidence: `artifacts/2026-11-13-hosting/reconnect-verification.json` and `artifacts/2026-11-13-hosting/route/browser-verification.json`.
