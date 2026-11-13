# Verification and limits

The 13 November 2026 source-publication checkout passed 27 unit/socket tests, the TypeScript/Vite production build, the full two-browser route regression, skeletal avatar checks and an actual server-restart/reconnect browser check. Environment: Node 24.11.1, Windows and Chrome 156.0.8078.81. Browser checks reported no page errors; the route check reported no failed assets. Dependency installation reported zero known vulnerabilities at that time.

## Reproduce

Use Node 24, npm ci --ignore-scripts, npm test and npm run build. Start npm start for the browser checks below. They require installed Chrome and use isolated contexts; synthetic voice tests use fake devices rather than the operator's microphone.

Run npm run test:browser and node scripts/verify-avatar.mjs. TEST_URL can select another local test server; TEST_ARTIFACT_DIR can redirect full-route output. Reports and screenshots are written under ignored artifacts/ by default; inspect them before sharing.

The node scripts/verify-reconnect.mjs check starts and stops its own server on loopback port 8791. Ensure that port is free. It verifies that two browsers recover from a server restart, movement synchronizes again and microphone capture remains off.

## Covered behavior

- Asset loading and pinned beaver hash, rig, embedded atlas and named clips.
- Independent idle/walk controllers, paddle-tail greeting, reduced-motion idle and departure cleanup.
- Keyboard/touch arrival-to-workshop-and-return, shared movement, chat/waves and text rendering guards.
- Microphone defaults off; leave/disconnect stops capture. Synthetic WebRTC transport works locally.
- Exact protocol schemas, size/rate limits, room isolation, production configuration and graceful shutdown.

## What this does not prove

Chrome desktop and mobile viewport emulation are not real-phone, Safari, Firefox or internet/NAT evidence. Synthetic microphone packets do not establish audible quality or TURN coverage. No hosted load test, independent security audit or production launch is claimed. The large PlayCanvas bundle warning remains; measure actual target-device performance.

The avatar is a quadruped approximation, not the intended custom humanoid builder. Gait cadence is approximate and does not use foot-lock IK. The public solo preview may show an earlier version than the contribution branch.
