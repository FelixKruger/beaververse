# Beaververse · first playable

Stages: **Frame → Build → Playtest → Publish**.

## Experience
A little beaver steps into a welcoming woodland gathering place. People can walk, wave, meet around the fire, chat, and choose to join voice. A compact, carefully composed lodge clearing is the entire first zone. The world should feel inhabited and crafted rather than like a technical primitive demo.

Independent community-world experiment inspired by AI BEAVERS' builder spirit. No official affiliation, endorsement, proprietary artwork, or logo license is implied. All characters and world assets require documented rights for public redistribution.

## Initial scope
- One small forest lodge/plaza, original recognizable beaver avatars, smooth following camera and walk animation.
- Desktop keyboard and touch controls; collision and bounded navigable terrain.
- Shared room movement and text chat over a real server; independent browser-session verification.
- Opt-in WebRTC audio, microphone off on entry, obvious mute/leave, room-only signaling. Connectivity depends on hosting and NAT; no promise of TURN coverage.
- A static public preview may run in explicitly labeled solo mode when no room server is configured. This is not internet multiplayer.
- A narrow documented future-agent interface and threat model. Real personal-agent connections are outside this slice.

## Later
Hosted persistent events, accounts/moderation, agent identities and owner-controlled messaging, narrow authenticated world commands, real cross-network voice with TURN, larger zones, optional floating face-video. Face video is explicitly future work.

## Direction and technical choice
PlayCanvas standalone + TypeScript/Vite; WebGL2 baseline. Engine choice supports the workflow but does not establish quality or phone performance. WebGPU can be tested later as progressive enhancement. **Selected direction: Lantern Grove + Woodland Lodge.** Giant-tree lodges, connected timber platforms, warm lanterns, moss/stone paths, and visible workbenches. Ground-level gathering space plus one reachable elevated treehouse deck. Borrow settlement scale and cozy builder atmosphere, without Star Wars identity or assets. The generated concept sheet is a visual target, not runtime or performance evidence.

Current primary engine sources: [engine](https://developer.playcanvas.com/user-manual/engine/), [browser baseline](https://developer.playcanvas.com/user-manual/engine/supported-browsers/), [standalone setup](https://developer.playcanvas.com/user-manual/engine/standalone/). Reviewed 2026-11-04. PlayCanvas selected over Babylon for lightweight standalone workflow; Three.js could also achieve the look. No engine makes primitive art rich automatically.

## Provisional budgets, not measured claims
Target 30 fps on a representative physical midrange phone; initial playable download under 8 MB compressed and whole zone under 25 MB. Aim at ≤150 draw calls, 200–350k visible triangles, 512–1024 textures and one 1024 directional shadow map. Prototype caps device pixel ratio on small screens. Measure actual delivered bytes and draw calls; report failures honestly. Viewport emulation is not real-device proof.

## Failable acceptance
1. Fresh browser loads actual 3D assets; entry succeeds without severe console errors.
2. Walking, camera, touch joystick and solid boundaries function; typing does not move the avatar.
3. Two independent browser contexts see each other's motion and chat; leaving removes presence.
4. Voice cannot capture before user activation; test media transport with synthetic audio separately from real microphones.
5. Protocol rejects malformed, oversized, excessive, cross-room and unauthorized messages. Incoming text never executes and is rendered as text.
6. Exact public files are reviewed; no private research/screenshots/credentials enter Git. Public repo and any launch URL are independently opened.

## Boundaries
No purchases, paid generations, subscriptions, personal-agent tools or credentials. No external account configuration beyond the explicitly authorized new public repository and available free hosting. Existing services and research stay intact.
