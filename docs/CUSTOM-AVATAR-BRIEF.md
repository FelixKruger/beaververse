# Custom beaver production brief

The runtime uses Gobkit's CC0 rigged Beaver, an animated quadruped with idle/walk clips and an original paddle-tail greeting. This is an interim avatar. The intended woodland builder is more upright and expressive; no final custom model is accepted or bundled.

## Character goals

Create a broad, sturdy woodland builder with chestnut fur, readable muzzle and ears, expressive paws and a broad paddle tail. A simple canvas/sage work vest may help the silhouette. Keep the tail rooted at the lower spine with credible anatomy and an unobscured side/rear silhouette. Avoid logos, famous-character identity, fine hair cards, tiny text and loose props.

Evaluate the character from the actual rear three-quarter game camera at both 80-120px and 48-64px avatar height. Keep the tail, face and greeting readable on a phone.

## Technical targets

- GLB/glTF 2.0 with embedded or explicitly bundled local textures; inspect extensions before relying on engine support.
- Real skin and independent per-player skeletons; named idle/walk clips and a friendly greeting. Validate clips in PlayCanvas, not just an asset viewer.
- Target 8-15k triangles near camera, 2-4k at distance, roughly 35-55 bones and 512-1024px textures. These are budgets to measure.
- Inspect scale, orientation, bounds, tail clearance, feet, material response and clipping against the actual scene.
- Keep a licensed fallback and respect reduced-motion preferences. Test two independently animated avatars, cleanup and phone layout.

## Rights gate

Include source, creator, exact license, redistribution rights and change notices in ASSET-LICENSES.md. Commercial-use permission alone does not prove permission to redistribute a raw model. Generated outputs require verification of the actual service plan and output terms. Do not bundle uncertain-rights models or private reference images.

Before replacing the runtime avatar, show it in the actual game camera and confirm the visual direction. The asset inspector and browser checks do not establish ownership or license rights.
