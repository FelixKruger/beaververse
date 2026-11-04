# Custom beaver · production brief

**Status: base style liked, but tail anatomy rejected; previous three variants are superseded exploration. Five revised types are being explored separately. No image is currently accepted for Tripo conversion. 3D generation has not run.** The public runtime animal is a licensed prototype stand-in. It does not fulfill the custom Tripo hero-avatar request. Preserve old source images without treating them as generation-ready; no runtime customization system is implied.

## Art criteria
The selected world is Lantern Grove plus Woodland Lodge: tree settlement, timber workshops, warm lanterns, cool woodland depth. Preserve a coherent stylized character against a richer environment, without assuming maximum simplification equals good taste. Evaluate shape, mass, expression, material and camera readability together. McCloud's Big Triangle (reality, meaning/iconic representation, picture plane) is an art-direction lens, not a taste score or a request for comic styling. No claim is made to have read or encoded the full book. [Author overview](https://scottmccloud.com/2-print/1-uc/index.html).

Create an original upright woodland builder with a broad paddle tail, readable muzzle/ears, sturdy planted feet and expressive paws. The liked base style has chestnut fur, a blue work vest and small belt pouch. **Tail correction is mandatory:** centered lower-back/root attachment and physically credible paddle orientation; show an unobscured side/rear view so generation cannot interpret it as a sideways limb or detached prop. Simplify fine surface fur for the mesh. No logos, famous-character identity, detailed text, loose tools or hair cards. The character should have coherent proportions and expression, not merely “cute.”

## One-asset handoff
Prepare a single clean character reference on a neutral background, with front/side/rear views that agree. Clear A-pose with arms separated from the torso and paws from legs. Show tail attachment and ground clearance. Inspect silhouette at the actual rear three-quarter camera, at 80–120 px avatar height, and again at 48–64 px. Have the owner approve that first character before producing a set.

## Runtime budgets (targets, to measure on exported file)
- Near avatar: 8–15k rendered triangles, distant LOD: 2–4k. Count triangles, not quads or marketing “polygons.”
- One opaque material, one 1024px texture atlas, no expensive hair/transparent layers. Source texture/license must accompany exported asset.
- Small biped rig, roughly 20–40 necessary bones, with a tail joint; no unnecessary facial rig for first slice.
- Three named clips: `Idle`, `Walk`, `Wave`. Planted feet, moderate body sway, no sliding tail or intersecting vest. Use in-place locomotion.
- Runtime GLB plus source FBX if rigged; preferred uncompressed baseline first. Inspect all extensions and loader support before compression; prior manual Tripo workflows encountered meshopt import incompatibility and very high geometry.

## Verified route and missing dependency
No Tripo tool/account integration is connected to this session. The verified historical workflow was manual generation/export, then local model inspection. The available route is the owner's signed-in Tripo Studio session or an owner-provided export with rights evidence.

Before a job: confirm the account's existing plan/export entitlement, exact on-screen credit charge and authorized spend cap. No paid generation or subscription is authorized by this brief. No credentials should be pasted or stored here.

Official sources currently disagree about free-output commercial use. [Pricing](https://www.tripo3d.ai/pricing) and [commercial-rights help](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) describe free outputs as noncommercial, while [Pricing & Credits](https://www.tripo3d.ai/product-doc/getting-started/pricing-credits) says attribution-based use. [Terms §5.2](https://www.tripo3d.ai/terms) distinguish free and paid rights. Public raw-file redistribution needs rights confirmation; “downloadable” alone is insufficient. Sources checked 2026-11-04. Recheck the actual plan and terms before generating.

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
