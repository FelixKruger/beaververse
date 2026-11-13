# Build Beaververse together

Beaververse is a playful woodland gathering prototype. Small, readable contributions are welcome: expressive beavers, surprising little places to explore, clearer phone controls, accessibility improvements and reliable shared presence.

## Start locally

Fork this repository, clone your fork and branch from `codex/community-source` for this iteration. Use Node 24 and the README setup commands. Start with two independent browser contexts in the same room; different tabs may share local browser state. The public Pages demo is solo and may be an earlier version.

## Find your way around

| Area | Files |
| --- | --- |
| World, lighting, props, camera and movement | `src/world.ts`, `shared/world.js` |
| Beaver rig and greetings | `src/avatar.ts` |
| Interface and phone controls | `index.html`, `src/main.ts`, `src/style.css` |
| Rooms and connection recovery | `src/network.ts`, `server/index.js`, `server/protocol.js` |
| Opt-in voice | `src/voice.ts` |
| Asset provenance | `ASSET-LICENSES.md`, `public/assets/` |

Good first contributions include a readable landmark, a small interaction using existing licensed assets, keyboard focus improvements, or a documented mobile bug fix. Discuss major architecture changes, dependencies, voice services or agent integrations in an issue first. Keep room text untrusted; no real agents or private accounts are connected today.

## Send a pull request

1. Keep the change focused. Describe the player-visible problem or idea and what changed.
2. Run `npm test` and `npm run build`. For interaction, movement, avatar or network changes, run the relevant browser scripts against your local build. See `docs/VERIFICATION.md`.
3. Include relevant screenshots and browser/device details. Distinguish phone emulation from a real phone and synthetic audio from real-microphone testing.
4. Open a PR targeting `codex/community-source` while this iteration is under review. Mention any limitation and how to reproduce the result. Maintainers decide when to merge and release.

The existing main-branch workflow publishes GitHub Pages. A source PR is not permission to change deployment settings, spend money or deploy a multiplayer server.

## Rights and privacy

The existing MIT license covers original project code. Contributions to that code are under the same license; this does not relicense third-party assets. Preserve attribution and license notices.

For every new model, texture, sound or font, include the creator, original source, exact license, redistribution permission and modifications in `ASSET-LICENSES.md`. Verify rights to redistribute the actual source file, not just to use a rendered result. Do not submit ripped, unlicensed, trial-only or uncertain-rights assets. Generated assets need verified output and redistribution rights too.

Do not commit credentials, `.env` files, chat transcripts, personal data, private reference images, account notes, generated test artifacts or research downloads. Share only screenshots you have checked for private information. Report a suspected exposed credential without reproducing its value in a public issue.

Be kind and specific in review. Treat feedback as a way to improve the shared world, and keep changes approachable for the next contributor.
