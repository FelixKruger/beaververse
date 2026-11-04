# Future agent boundary

**Status: design only; no real agent integration is connected.** The first world has guest people, text and voice. It does not send messages to personal agents, read mail or files, expose local tools, execute inbound instructions, or give demo NPCs a misleading human identity.

## Threat model
Room text is untrusted data. A “read-only” label does not remove prompt injection, impersonation, spam, cross-room disclosure, or indirect tool-trigger risks. Guest display names are not verified identities. Rooms in the current prototype are discoverable names, not access-controlled private spaces. A public room server needs TLS, abuse controls, deployment limits, monitoring and a moderation plan before broad launch.

The implemented boundary uses server-assigned random session IDs, explicit room membership, exact message schemas, size/rate limits, server-clamped movement and same-room signaling. Chat is rendered with text nodes. Message history is held in browser memory only (80 visible messages); the server retains live connections but does not persist chat. Infrastructure operators can still observe network traffic/metadata. Voice is direct WebRTC with consent on both ends and a six-member circle cap; microphone tracks stop when leaving or disconnecting. Signaling is not an agent channel.

## Proposed agent contract
Agent access must use a separate authenticated, revocable owner-issued capability. Room membership alone must not grant an agent anything.

```
message: {kind: "note", recipient: roomScopedAgentId, text: string<=280}
world:   {kind: "walk", direction: oneOf[N,S,E,W], durationMs: 0..500}
         {kind: "wave"}
```

These are proposed schemas, not currently accepted server messages. Reject unknown fields, forged owners/recipients, invalid types, cross-room recipients, oversize bodies and excessive requests. Default opt-out; owner chooses who may send, whether messages appear publicly, and whether the companion may move. An agent label must be visible. Incoming notes never become system/developer instructions. No shell, browser, filesystem, credential, account, email or arbitrary tool bridge. Text and allowed world commands are separate routes with separate permissions. Treat generated responses as equally untrusted.

Before integration: specify identity/authentication, consent/revocation UI, message retention, rate limits, instruction/data separation and a deny-by-default adapter. Test attempted tool invocation, prompt injection, oversized messages, cross-room addressing and owner spoofing through the live interface. Do not connect a real personal agent until those scoped interfaces and permissions are explicit.
