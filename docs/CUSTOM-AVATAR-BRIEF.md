# Custom beaver · production brief

**Public source, 18 November 2026:** the redistributable runtime uses the CC0 Gobkit Beaver: a four-legged, low-poly character with a rig, idle/walk clips and an original code-driven paddle-tail greeting. See `ASSET-LICENSES.md` and `public/assets/GOBKIT-PROVENANCE.json`. The older Poly model remains in the repository as a licensed fallback.

A separate purchased-character evaluation is private and is not part of this source package. Generated concept references and rejected experiments are also excluded. The criteria below guide a future distributable builder character; they do not claim that every candidate or the current fallback satisfies them.

## Art criteria
The selected world is Lantern Grove plus Woodland Lodge: tree settlement, timber workshops, warm lanterns, cool woodland depth. Preserve a coherent stylized character against a richer environment, without assuming maximum simplification equals good taste. Evaluate shape, mass, expression, material and camera readability together. McCloud's Big Triangle (reality, meaning/iconic representation, picture plane) is an art-direction lens, not a taste score or a request for comic styling. No claim is made to have read or encoded the full book. [Author overview](https://scottmccloud.com/2-print/1-uc/index.html).

Preserve the approved broad animal-like stance, chestnut fur, simplified sculpted forms, soft brow/muzzle, readable paws and neutral canvas/sage vest. Preserve the visible centered lower-spine tail root and upward-facing broad paddle; it must not become a sideways limb or detached prop. Simplify fine surface fur for the mesh. No logos, famous-character identity, detailed text, loose tools or hair cards. Do not narrow the body into a generic humanoid. The reference's ground clearance and tail/body orientation must survive actual rear/side views.

## One-asset handoff
Use the approved single neutral-background reference for the first trial. The requested image revision is complete; do not generate additional views unless an observed 3D failure makes them necessary. Inspect the resulting front/side/rear silhouette and tail attachment, then at the actual rear three-quarter camera at 80–120 px and 48–64 px avatar height. Keep rejected candidates separate from accepted runtime files.

## Runtime budgets (targets, to measure on exported file)
- Near avatar: 8–15k rendered triangles, distant LOD: 2–4k. Count triangles, not quads or marketing “polygons.”
- One opaque material, one 1024px texture atlas, no expensive hair/transparent layers. Source texture/license must accompany exported asset.
- Small biped rig, roughly 20–40 necessary bones, with a tail joint; no unnecessary facial rig for first slice.
- Three named clips: `Idle`, `Walk`, `Wave`. Planted feet, moderate body sway, no sliding tail or intersecting vest. Use in-place locomotion.
- Runtime GLB plus source FBX if rigged; preferred uncompressed baseline first. Inspect all extensions and loader support before compression; prior manual Tripo workflows encountered meshopt import incompatibility and very high geometry.

## Acquisition and rights

External generation or purchased art is optional; no provider account is required to build this repository. Before using a service, verify its current plan, quote, export rights and intended redistribution permissions. Rigging, animation, retries and conversion may have separate costs or terms. Do not put credentials or personal account records in the repository.

Permission to use an asset inside a game is not automatically permission to publish its raw source files. A replacement must carry source attribution, a license covering the intended public distribution, and modification notices where required. If that cannot be established, retain the redistributable fallback.

## Manual pipeline
1. Approved reference → Smart Mesh/P-series generation with target geometry.
2. Inspect proportions and silhouette before further credit-consuming steps.
3. Reduce high-poly H-series/uploads before texturing; Retopo invalidates UV/texture and is not the P-series route.
4. Texture, rig as a biped, preview clips; export GLB and FBX.
5. Inspect mesh counts, dimensions, materials, animations, extensions and embedded textures locally.
6. Import into PlayCanvas, run camera/lighting/walk/idle/wave checks, verify mobile cost, and only then replace the stand-in.

[Generation](https://www.tripo3d.ai/product-doc/model-generation/text-to-3d) · [Retopo](https://www.tripo3d.ai/product-doc/module-post-processing/retopo) · [Rigging](https://www.tripo3d.ai/product-doc/module-post-processing/rigging-animation) · [Export](https://www.tripo3d.ai/product-doc/export-and-integration/export-dcc).

## Acceptance evidence
Front/side/rear and gameplay-distance screenshots; all three clips in real browser; no inverted normals/holes, broken weights or tail clipping; measured triangle/material/texture bytes; license/plan provenance. Real-phone performance remains a separate test. Do not call a generated reference image a game-ready 3D asset.
