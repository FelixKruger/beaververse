# Agent boundary

**17 November 2026: a local companion API is implemented and tested with an HTTP client.** A guest can choose Your visit → Companion, create a short-lived invitation, and copy one instruction for their own HTTP-capable agent. This does not launch a model, install an agent, or guarantee compatibility with every agent platform. The agent must be able to reach the server; a loopback URL is reachable only on the host computer.

The world does not read personal mail/files, expose local tools, execute inbound code, or give companions a misleading human identity. There is no conversation bridge or AI chat service connected.

## Implemented companion permissions

- `GET /api/agents` explains the protocol. `POST /api/agents/pair` exchanges a one-use 60-second invitation for a 15-minute bearer grant. Credentials travel in request bodies/Authorization headers, never URLs; the server stores their hashes.
- Default capabilities are public same-room observation and waving. The owner may additionally grant bounded movement or garden proposals. Chat history and voice are excluded from the API.
- One labeled companion per present owner; leaving, expiry or revocation removes access and the avatar. Revocation bypasses the social-message rate limit. Slow request bodies are rechecked against current authority before an action is applied.
- Exact schemas, size limits, request budgets, room limits and collision/movement checks run outside any model. An agent cannot give itself scopes, change its owner or choose another room.
- A proposed planter/lantern remains pending until its owner accepts. A guest can place one item in an unoccupied predefined garden plot; they cannot overwrite another guest's item. Creations are temporary and disappear when their owner leaves.
- Browser clients have an exact Origin allowlist. Non-browser clients use the bearer capability; Origin is not treated as authentication. Production requires HTTPS and operational abuse/admission controls beyond this prototype.

The local tests cover single use, expiry, cross-room isolation, denied actions, owner review, occupancy, revocation under social flooding, and removal on departure. These are bounded integration checks, not a public-service security certification.

## Threat model
Room text is untrusted data. A “read-only” label does not remove prompt injection, impersonation, spam, cross-room disclosure, or indirect tool-trigger risks. Guest display names are not verified identities. Rooms in the current prototype are discoverable names, not access-controlled private spaces. A public room server needs TLS, abuse controls, deployment limits, monitoring and a moderation plan before broad launch.

The implemented boundary uses server-assigned random session IDs, explicit room membership, exact message schemas, size/rate limits, server-clamped movement and same-room signaling. Chat is rendered with text nodes. Message history is held in browser memory only (80 visible messages); the server retains live connections but does not persist chat. Infrastructure operators can still observe network traffic/metadata. Voice is direct WebRTC with consent on both ends and a six-member circle cap; microphone tracks stop when leaving or disconnecting. Signaling is not an agent channel.

## Future conversation bridge (not implemented)
Agent access must use a separate authenticated, revocable owner-issued capability. Room membership alone must not grant an agent anything.

```
message: {kind: "note", recipient: roomScopedAgentId, text: string<=280}
world:   {kind: "walk", direction: oneOf[N,S,E,W], durationMs: 0..500}
         {kind: "wave"}
```

These are proposed schemas, not currently accepted server messages. Reject unknown fields, forged owners/recipients, invalid types, cross-room recipients, oversize bodies and excessive requests. Default opt-out; owner chooses who may send, whether messages appear publicly, and whether the companion may move. An agent label must be visible. Incoming notes never become system/developer instructions. No shell, browser, filesystem, credential, account, email or arbitrary tool bridge. Text and allowed world commands are separate routes with separate permissions. Treat generated responses as equally untrusted.

Before integration: specify identity/authentication, consent/revocation UI, message retention, rate limits, instruction/data separation and a deny-by-default adapter. Test attempted tool invocation, prompt injection, oversized messages, cross-room addressing and owner spoofing through the live interface. Do not connect a real personal agent until those scoped interfaces and permissions are explicit.
