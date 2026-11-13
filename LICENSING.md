# Code and asset licensing

Copyright (c) 2026 Beaververse contributors.

Effective with this license-change commit on `codex/community-source`, original Beaververse project code is offered under GNU Affero General Public License version 3 **only**, SPDX `AGPL-3.0-only`. The complete, unmodified standard license text is in [LICENSE](LICENSE), obtained from https://www.gnu.org/licenses/agpl-3.0.txt. No additional licensing exception or later-version permission is granted here.

This covers original code in `src/`, `server/`, `shared/`, `scripts/`, `tests/`, the original HTML/CSS/SVG source, configuration and accompanying original project documentation. Separate third-party notices take precedence for their identified material. This code-license change does not claim ownership of dependencies or third-party art.

## Earlier MIT copies

The published history through commit `0bf56041ee19f96311a98197d40b95ef68ccb46f` was offered under MIT. Those permissions are not revoked, and recipients can continue using that earlier material under MIT. Its copyright and permission notice is preserved in [LICENSES/Beaververse-MIT-through-0bf5604.txt](LICENSES/Beaververse-MIT-through-0bf5604.txt). That historical notice does not offer subsequent AGPL-only changes under MIT. Git history is preserved without rewriting.

## Third-party assets

Models, textures and other third-party art keep the licenses in [ASSET-LICENSES.md](ASSET-LICENSES.md) and the bundled author notices. Gobkit and KayKit/Kenney assets remain CC0; the older Poly by Google beaver remains CC BY 3.0. They are not relicensed to AGPL. Paid/private evaluation assets are not included in this public branch. Purchasing an asset alone does not establish permission to publish its files or derivatives.

## Dependencies and notices

The locked production dependency tree uses PlayCanvas 2.23.3 and ws 8.22.1 (MIT), with @types/webxr (MIT) and @webgpu/types (BSD-3-Clause) type packages. Their notices are preserved in [public/THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt); dependency packages retain their upstream licenses. No dependency code is being relicensed.

The 50 non-root package-lock entries declare MIT (30), Apache-2.0 (5), BSD-3-Clause (2), ISC (1), or MPL-2.0 (12). All MPL entries are Lightning CSS and its platform-specific packages, marked as development dependencies; they are build tools, not vendored application runtime source. Vite also includes bundled MIT, BSD-2-Clause, ISC and CC0 notices in its own license file. Keep all upstream notices if distributing dependencies or tooling. No incompatible application-runtime dependency or separate external project-code author was identified in this bounded review. This is not a warranty of ownership or a complete legal audit.

Repository history at the decision point contains three commits attributed to the project owner's GitHub identity, with no merged external contributions. The owner explicitly selected AGPL-3.0. Existing permissive notices are retained, and future contributors must have rights to submit their changes under the current license. No third-party asset license was changed. See GNU's [license compatibility notes](https://www.gnu.org/licenses/license-list.en.html) and Mozilla's [MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) for the upstream explanations.

## Running and distributing modified versions

AGPL section 13 requires a prominent, no-charge corresponding-source offer to remote users of a modified version. The field guide links this branch's source and includes the license; deployments and forks must point that offer to the source for the actual version served, including their modifications and required build material. Preserve required notices and satisfy the license's distribution obligations as well. Do not assume that merely linking the unchanged upstream repository covers an independently modified deployment.

Changing this branch's license does not change `main`, merge a PR, deploy the preview or establish production multiplayer readiness.
