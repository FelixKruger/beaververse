import * as pc from 'playcanvas';
import { SPAWN, stepPosition, heightAt } from '../shared/world.js';
import type { Player } from './network';
import { BEAVER_ASSET, BEAVER_SCALE, BeaverAnimation } from './avatar';

const colors: Record<string, string> = { moss: '#96bb80', amber: '#dfad58', sky: '#8fbfc9', berry: '#d39da2' };
type Avatar = { root: pc.Entity; body: pc.Entity; label: HTMLDivElement; target: Player; animation: BeaverAnimation };
const col = (hex: string) => new pc.Color().fromString(hex);

export class Clearing {
  app: pc.Application;
  camera: pc.Entity;
  avatars = new Map<string, Avatar>();
  me = 'local';
  position = { ...SPAWN, yaw: 180 };
  entered = false;
  keys = new Set<string>();
  stick = { x: 0, y: 0 };
  assets = new Map<string, pc.Asset>();
  private forestMaterials = new Map<pc.Material, pc.StandardMaterial>();
  private angle = -.35;
  private distance = 19;
  private target = new pc.Vec3(1.8, 1.2, 0);
  private elapsed = 0;
  private flames: pc.Entity[] = [];
  private fireflies: pc.Entity[] = [];
  private water: pc.StandardMaterial;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  onMove?: (x: number, z: number, yaw: number) => void;
  constructor(private canvas: HTMLCanvasElement) {
    this.app = new pc.Application(canvas, { graphicsDeviceOptions: { alpha: false, antialias: true, powerPreference: 'high-performance' }, devtools: false });
    const small = innerWidth < 700;
    this.app.graphicsDevice.maxPixelRatio = Math.min(devicePixelRatio, small ? 1.25 : 1.75);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight = col('#a4b3bf').mulScalar(.43);
    this.app.scene.fog.type = pc.FOG_LINEAR;
    this.app.scene.fog.color = col('#455d51');
    this.app.scene.fog.start = 24;
    this.app.scene.fog.end = 72;
    this.camera = new pc.Entity('Following camera');
    this.camera.addComponent('camera', { clearColor: col('#455d51'), fov: small ? 54 : 46, nearClip: .2, farClip: 120, toneMapping: pc.TONEMAP_ACES });
    this.app.root.addChild(this.camera);
    const sun = new pc.Entity('Late afternoon sun');
    sun.addComponent('light', { type: 'directional', color: col('#ffdbab'), intensity: 1.1, castShadows: true, shadowDistance: 45, shadowResolution: 1024, shadowBias: .25, normalOffsetBias: .04, shadowType: pc.SHADOW_PCF3_32F });
    sun.setEulerAngles(48, -34, 0); this.app.root.addChild(sun);
    const rim = new pc.Entity('Sky fill'); rim.addComponent('light', { type: 'directional', color: col('#a5c3cf'), intensity: .4 }); rim.setEulerAngles(55, 145, 0); this.app.root.addChild(rim);
    this.water = this.material('Creek', '#46776e'); this.water.metalness = .08; this.water.gloss = .3; this.water.update();
    this.inputs();
    window.addEventListener('resize', () => { this.app.resizeCanvas(); this.camera.camera!.fov = innerWidth < 700 ? 54 : 46; });
    this.app.on('update', dt => this.update(Math.min(dt, .05)));
    this.app.start();
  }
  private material(name: string, hex: string, emission = 0) {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse = col(hex); m.gloss = .12;
    if (emission) { m.emissive = col(hex); m.emissiveIntensity = emission; }
    m.update(); return m;
  }
  private primitive(name: string, type: 'box' | 'cone' | 'cylinder' | 'sphere', x: number, y: number, z: number, sx: number, sy: number, sz: number, material: pc.StandardMaterial, parent = this.app.root) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: true, receiveShadows: true }); e.setLocalPosition(x, y, z); e.setLocalScale(sx, sy, sz); parent.addChild(e); return e;
  }
  async load() {
    await Promise.all([BEAVER_ASSET, 'building_lumbermill_green.gltf', 'building_home_B_green.gltf', 'rock_largeA.glb', 'campfire_stones.glb', 'campfire_logs.glb', ...['Tree_3_A_Color1','Tree_3_C_Color1','Tree_2_A_Color1','Bush_3_C_Color1','Grass_2_A_Color1','Rock_1_A_Color1'].map(s => `forest/${s}.gltf`)].map(name => new Promise<void>((resolve, reject) => {
      this.app.assets.loadFromUrl(`${import.meta.env.BASE_URL}assets/${name}`, 'container', (error, asset) => { if (error || !asset) reject(new Error(`Asset failed: ${name}`)); else { this.assets.set(name, asset); resolve(); } });
    })));
    this.build();
    this.createAvatar({ id: 'local', name: 'You', color: 'moss', ...this.position, voice: false, wave: 0 });
  }
  private model(file: string, x: number, y: number, z: number, scale: number, yaw = 0, parent = this.app.root) {
    const e = (this.assets.get(file)!.resource as pc.ContainerResource).instantiateRenderEntity() as pc.Entity;
    if (file.startsWith('forest/')) for (const render of e.findComponents('render') as pc.RenderComponent[]) for (const mesh of render.meshInstances) {
      const original = mesh.material; if (!original) continue;
      let material = this.forestMaterials.get(original);
      if (!material) { material = (original as pc.StandardMaterial).clone(); material.diffuse.set(.57, .64, .48); material.gloss = material.glossInvert ? .9 : .1; material.update(); this.forestMaterials.set(original, material); }
      mesh.material = material;
    }
    e.setLocalPosition(x, y, z); e.setLocalScale(scale, scale, scale); e.setLocalEulerAngles(0, yaw, 0); parent.addChild(e); return e;
  }
  private terrain() {
    const positions: number[] = [], normals: number[] = [], vertexColors: number[] = [], indices: number[] = [];
    const rings = 20, sides = 96;
    for (let ring = 0; ring <= rings; ring++) for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2, r = ring / rings * 60;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const h = r < 17 ? -.06 : (Math.sin(x * .13) * Math.cos(z * .18) * 2.5 + Math.sin(x * .33 + z * .17) * 1.1) * Math.min((r - 17) / 12, 1) - .06;
      positions.push(x, h, z); normals.push(0, 1, 0);
      const variation = .035 * Math.sin(x * .7 + z * .42) + .025 * Math.cos(x * 1.1 - z * .25);
      vertexColors.push(.085 + variation * .5, .15 + variation * .6, .08 + variation * .4, 1);
      if (ring < rings && i < sides) { const p = ring * (sides + 1) + i; indices.push(p, p + sides + 1, p + 1, p + 1, p + sides + 1, p + sides + 2); }
    }
    const mesh = new pc.Mesh(this.app.graphicsDevice); mesh.setPositions(positions); mesh.setNormals(normals); mesh.setColors(vertexColors); mesh.setIndices(indices); mesh.update();
    const mat = this.material('Living moss ground', '#ffffff'); mat.diffuseVertexColor = true; mat.cull = pc.CULLFACE_NONE; mat.update();
    const ground = new pc.Entity('Sculpted forest floor'); ground.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, mat)], castShadows: false }); this.app.root.addChild(ground);
  }
  private build() {
    this.terrain();
    let seed = 42;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const earth = this.material('Warm path', '#756749'), stone = this.material('Worn sandstone', '#a5a28b'), wood = this.material('Chestnut timber', '#695039'), endgrain = this.material('End grain', '#b6a077');
    const gold = this.material('Lantern glass', '#ffd18a', 1.9), iron = this.material('Forged iron', '#38443b');
    const grass = this.material('Sunlit grasses', '#889644');
    const group = this.app.batcher!.addGroup('Static clearing', false, 100);
    const staticRoots: pc.Entity[] = [];
    const stash = (e: pc.Entity) => { staticRoots.push(e); return e; };
    // Broad earth apron, stepping stones and layered irregular edges ground the buildings.
    stash(this.primitive('Gathering apron', 'cylinder', 0, -.055, -.4, 12.6, .08, 13.7, earth));
    for (let i = 0; i < 35; i++) {
      const z = 12 - i * .52, x = Math.sin(z * .35) * .6;
      for (let j = -1; j <= 1; j++) { const rock = stash(this.model('forest/Rock_1_A_Color1.gltf', x + j * .85 + random() * .2, .02, z + random() * .16, 1, random() * 360)); rock.setLocalScale(1.15 + random() * .25, .14, 1.05 + random() * .2); }
    }
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2; const stonePiece = stash(this.model('rock_largeA.glb', Math.sin(a) * (5.9 + random() * .4), .01, Math.cos(a) * 6.2 - .5, 1.1, random() * 360)); stonePiece.setLocalScale(1.1, .5, .9);
    }
    // The smaller ground workshop supports the reachable canopy house as the destination.
    // Its measured footprint is also used by the shared lodge collider.
    const lodge = this.model('building_lumbermill_green.gltf', 0, .02, -9.1, 4, 0); stash(lodge);
    // Timber approach and railing give the workshop a readable meeting threshold.
    for (let x = -3.5; x <= 3.5; x += .46) stash(this.primitive('Porch plank', 'box', x, .1, -5.2, .42, .16, 2.1, wood));
    for (const x of [-3.55, 3.55]) {
      for (const z of [-6, -4.25]) stash(this.primitive('Porch post', 'box', x, .7, z, .17, 1.4, .17, wood));
      stash(this.primitive('Porch handrail', 'box', x, 1.2, -5.1, .18, .16, 1.9, wood));
    }
    this.model('campfire_stones.glb', 0, .16, .8, 3.5);
    this.model('campfire_logs.glb', 0, .19, .8, 3.4, 25);
    const flame = this.material('Fire amber', '#ffab3b', 2.2), heart = this.material('Fire heart', '#ffe29c', 3);
    for (let i = 0; i < 5; i++) { const e = this.primitive('Flame', 'cone', Math.sin(i * 4) * .23, .55, .8 + Math.cos(i * 3) * .23, .3, .8, .3, i % 2 ? flame : heart); e.render!.castShadows = false; this.flames.push(e); }
    const firelight = new pc.Entity('Hearth light'); firelight.addComponent('light', { type: 'omni', color: col('#ffb356'), range: 6, intensity: 2.3, castShadows: false }); firelight.setPosition(0, 1.1, .8); this.app.root.addChild(firelight);
    for (const x of [-3.5, 3.5]) {
      const bench = stash(this.primitive('Gathering bench', 'box', x, .47, .8, 2.15, .22, .63, wood)); bench.setEulerAngles(0, 0, -1);
      for (const offset of [-.76, .76]) stash(this.primitive('Bench leg', 'box', x + offset, .2, .8, .16, .45, .5, wood));
      stash(this.primitive('Bench grain', 'box', x, .59, .8, 2.05, .015, .06, endgrain));
    }
    const lantern = (x: number, z: number) => {
      stash(this.primitive('Lantern pole', 'cylinder', x, 1.3, z, .12, 2.6, .12, wood));
      stash(this.primitive('Lantern crossarm', 'box', x + .2, 2.58, z, .55, .12, .12, wood));
      stash(this.primitive('Lantern body', 'box', x + .4, 2.24, z, .28, .42, .28, gold));
      stash(this.primitive('Lantern cap', 'cone', x + .4, 2.52, z, .48, .2, .48, iron));
      stash(this.primitive('Lantern base', 'box', x + .4, 1.99, z, .36, .09, .36, iron));
    };
    for (const [x, z] of [[-4.8, -3], [4.7, -3], [-3.3, 7], [3.4, 7], [7.8, 1], [-7.8, 1]]) lantern(x, z);
    // Reachable canopy workshop: heightAt() owns the same ramp and deck surface.
    for (let z = -7.8; z < 0; z += .4) stash(this.primitive('Canopy deck plank', 'box', 9, 3.1, z, 8, .2, .36, wood));
    for (const x of [5.1, 12.9]) for (let z = -7.7; z <= -.2; z += 1.5) {
      stash(this.primitive('Deck baluster', 'box', x, 3.7, z, .14, 1.2, .14, wood));
    }
    for (const x of [5.1, 12.9]) stash(this.primitive('Canopy handrail', 'box', x, 4.25, -4, .17, .14, 8, endgrain));
    for (const x of [5.1, 12.9]) for (const z of [-7.7, -.2]) stash(this.primitive('Timber support', 'cylinder', x, 1.5, z, .33, 3.2, .33, wood));
    for (let i = 0; i < 30; i++) {
      const z = 8.85 - i * .3, h = (9 - z) / 9 * 3.2;
      const plank = stash(this.primitive('Climbing walkway', 'box', 6, h - .08, z, 2, .16, .32, wood)); plank.setEulerAngles(19.57, 0, 0);
      if (i % 5 === 0) for (const x of [5.04, 6.96]) stash(this.primitive('Walkway post', 'box', x, h + .5, z, .13, 1.15, .13, wood));
    }
    for (const x of [5.04, 6.96]) { const rail = stash(this.primitive('Climbing handrail', 'box', x, 2.65, 4.5, .14, .14, 9.56, endgrain)); rail.setEulerAngles(19.57, 0, 0); }
    stash(this.model('building_home_B_green.gltf', 10.2, 3.2, -5.8, 3.65, 0));
    // Turn the large crown behind the house; its near-deck trunk has a shared collider.
    stash(this.model('forest/Tree_3_C_Color1.gltf', 13.5, -.05, -8.8, 2.15, 180));
    stash(this.model('forest/Tree_2_A_Color1.gltf', -11, 0, -14, 3, 10));
    stash(this.model('forest/Tree_2_A_Color1.gltf', 4, 0, -17, 3.2, 50));
    // A visible making table and wood stock distinguish this from a generic forest.
    for (const [x, y, z] of [[-4.7, 0, -4], [11.4, 3.2, -1.5]]) {
      stash(this.primitive('Builder workbench', 'box', x, y + .85, z, 2.2, .17, .9, endgrain));
      for (const dx of [-.85, .85]) for (const dz of [-.3, .3]) stash(this.primitive('Workbench leg', 'box', x + dx, y + .4, z + dz, .15, .85, .15, wood));
      stash(this.primitive('Tool handle', 'box', x - .4, y + 1, z, .55, .1, .1, wood));
      stash(this.primitive('Mallet head', 'box', x - .15, y + 1, z, .18, .2, .35, iron));
      for (let i = 0; i < 3; i++) stash(this.primitive('Wood for making', 'box', x + .5, y + 1.01 + i * .08, z, .55, .07, .6, wood));
      const l = stash(this.primitive('Workbench lantern', 'box', x - .8, y + 1.18, z + .2, .2, .35, .2, gold)); l.render!.castShadows = false;
    }
    // Warm lights on a hanging cable lead the eye toward the raised workshop.
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = -4.5 + t * 15, y = 5.3 - Math.sin(t * Math.PI) * 1.45, z = -2.6 - t * .8;
      stash(this.primitive('Hanging lantern', 'sphere', x, y, z, .16, .22, .16, gold));
      if (i < 12) { const nextT = (i + 1) / 12, ny = 5.3 - Math.sin(nextT * Math.PI) * 1.45; const cable = stash(this.primitive('Lantern cable', 'box', x + .625, (y + ny) / 2 + .2, z - .034, 1.28, .025, .025, iron)); cable.setEulerAngles(0, 3, Math.atan2(ny - y, 1.25) * 180 / Math.PI); }
    }
    // Small stream, bridge, lilies and stones make the clearing a place, not a floor plane.
    for (let i = 0; i < 24; i++) {
      const z = -23 + i * 2.1, x = -12 + Math.sin(z * .12) * 1.4;
      const w = stash(this.primitive('Stream reach', 'cylinder', x, -.025, z, 4.1, .025, 3.1, this.water)); w.render!.castShadows = false;
      for (const side of [-1, 1]) stash(this.model('rock_largeA.glb', x + side * (1.9 + random() * .3), .03, z, 1.25 + random(), random() * 360));
    }
    for (let i = 0; i < 15; i++) stash(this.primitive('Bridge plank', 'box', -14.3 + i * .33, .2 + Math.sin(i / 14 * Math.PI) * .25, 5, .3, .15, 1.7, wood));
    for (const x of [-14.4, -12, -9.6]) for (const z of [4.1, 5.9]) stash(this.primitive('Bridge post', 'box', x, .65, z, .16, 1.3, .16, wood));
    for (const z of [4.1, 5.9]) stash(this.primitive('Bridge rail', 'box', -12, 1.18, z, 4.9, .12, .13, wood));
    for (let i = 0; i < 90; i++) {
      const a = random() * Math.PI * 2, r = 18 + random() * 32;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (z > 9 && Math.abs(x) < 13) continue;
      const tree = i % 3 ? 'forest/Tree_3_A_Color1.gltf' : 'forest/Tree_2_A_Color1.gltf';
      stash(this.model(tree, x, -.3, z, 1.5 + random() * 1.9, random() * 360));
    }
    // Side framing leaves the arrival and climb visible; moved trunks sit outside the walking circle.
    for (const [x, z, s] of [[-7.7, -6, 2.5], [-17, -4, 1.6], [17, -5, 1.8]]) stash(this.model('forest/Tree_3_A_Color1.gltf', x, 0, z, s, 30));
    for (let i = 0; i < 45; i++) {
      const a = random() * Math.PI * 2, r = 7.5 + random() * 9;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (Math.abs(x) < 2 || x < -9 && x > -14) continue;
      if (x > -1 && x < 7.5 && z > 8.8 && z < 11.8 || x > 4.5 && x < 13.5 && z > -8.5 && z < 9.8) continue;
      if (i % 3 === 0) stash(this.model('rock_largeA.glb', x, 0, z, .9 + random(), random() * 360));
      stash(this.model('forest/Grass_2_A_Color1.gltf', x, .01, z, .6 + random() * .5, random() * 360));
      if (i % 3 === 0) stash(this.model('forest/Bush_3_C_Color1.gltf', x + .5, .01, z, .7 + random() * .6, random() * 360));
    }
    for (let i = 0; i < 14; i++) { const a = random() * Math.PI * 2; const e = this.primitive('Firefly', 'sphere', Math.sin(a) * 9, 1.3 + random() * 2, Math.cos(a) * 8, .045, .045, .045, gold); e.render!.castShadows = false; this.fireflies.push(e); }
    // Batch static authored meshes and details by material to keep draw overhead down.
    for (const root of staticRoots) for (const r of root.findComponents('render') as pc.RenderComponent[]) r.batchGroupId = group.id;
    this.app.batcher!.generate([group.id]);
  }
  createAvatar(player: Player) {
    const root = new pc.Entity(player.id); this.app.root.addChild(root);
    const body = this.model(BEAVER_ASSET, 0, .016, 0, BEAVER_SCALE, 0, root);
    const animation = new BeaverAnimation(body, this.assets.get(BEAVER_ASSET)!.resource as pc.ContainerResource);
    const trail = this.material('Trail ' + player.color, colors[player.color] || colors.moss);
    // An original scarf makes the reused animal silhouette readable across visitors.
    const scarf = this.primitive('Trail scarf', 'box', 0, .51, .31, .68, .12, .30, trail, root); scarf.setEulerAngles(0, 0, -8);
    const tail = this.primitive('Scarf ribbon', 'box', .30, .40, .42, .13, .32, .10, trail, root); tail.setEulerAngles(0, 0, -18);
    const label = document.createElement('div'); label.className = 'name-tag'; label.textContent = player.name; document.querySelector('#labels')!.append(label);
    const avatar = { root, body, label, target: player, animation };
    root.setPosition(player.x, 0, player.z); this.avatars.set(player.id, avatar); return avatar;
  }
  enter(name: string, color: string) {
    this.entered = true; this.remove(this.me); this.me = 'local'; this.position = { ...SPAWN, yaw: 180 };
    this.createAvatar({ id: this.me, name, color, ...this.position, voice: false, wave: 0 }); this.canvas.focus();
  }
  identify(id: string) {
    const a = this.avatars.get(this.me)!; this.avatars.delete(this.me); this.me = id; a.target.id = id; this.avatars.set(id, a);
  }
  sync(players: Player[]) {
    for (const id of this.avatars.keys()) if (id !== this.me && !players.some(p => p.id === id)) this.remove(id);
    for (const p of players) {
      const avatar = this.avatars.get(p.id) || this.createAvatar(p); avatar.target = p;
      if (p.id === this.me && Math.hypot(p.x - this.position.x, p.z - this.position.z) > 1.2) Object.assign(this.position, { x: p.x, z: p.z });
    }
  }
  wave() { const a = this.avatars.get(this.me); if (a) a.target.wave = Date.now(); }
  private remove(id: string) { const a = this.avatars.get(id); a?.root.destroy(); a?.label.remove(); this.avatars.delete(id); }
  private inputs() {
    const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '') || !!document.querySelector('dialog[open]');
    window.addEventListener('keydown', e => { if (!typing() && this.entered) { this.keys.add(e.code); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); } });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.stick = { x: 0, y: 0 }; });
    window.addEventListener('focusin', () => { if (typing()) this.keys.clear(); });
    let drag: { id: number; x: number } | undefined;
    this.canvas.addEventListener('pointerdown', e => { if (!this.entered) return; drag = { id: e.pointerId, x: e.clientX }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => { if (drag?.id === e.pointerId) { this.angle -= (e.clientX - drag.x) * .006; drag.x = e.clientX; } });
    const release = () => { drag = undefined; }; this.canvas.addEventListener('pointerup', release); this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.distance = pc.math.clamp(this.distance + e.deltaY * .015, 10, 27); }, { passive: false });
    const joy = document.querySelector<HTMLDivElement>('#joystick')!, handle = document.querySelector<HTMLDivElement>('#stick')!;
    const move = (e: PointerEvent) => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.x - r.width / 2) / 38, y = (e.clientY - r.y - r.height / 2) / 38; const n = Math.max(1, Math.hypot(x, y)); x /= n; y /= n; this.stick = { x, y }; handle.style.transform = `translate(${x * 32}px,${y * 32}px)`; };
    let joyPointer = -1;
    joy.addEventListener('pointerdown', e => { joyPointer = e.pointerId; joy.setPointerCapture(e.pointerId); move(e); });
    joy.addEventListener('pointermove', e => { if (joyPointer === e.pointerId) move(e); });
    const stop = () => { joyPointer = -1; this.stick = { x: 0, y: 0 }; handle.style.transform = ''; };
    joy.addEventListener('pointerup', stop); joy.addEventListener('pointercancel', stop);
  }
  private update(dt: number) {
    this.elapsed += dt;
    let moving = false;
    if (this.entered && !document.querySelector('dialog[open]')) {
      let x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.stick.x;
      let y = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.stick.y;
      const mag = Math.max(1, Math.hypot(x, y)); x /= mag; y /= mag;
      if (Math.hypot(x, y) > .05) {
        const dx = x * Math.cos(this.angle) + y * Math.sin(this.angle), dz = -x * Math.sin(this.angle) + y * Math.cos(this.angle);
        Object.assign(this.position, stepPosition(this.position, dx * dt * 4.3, dz * dt * 4.3)); this.position.yaw = Math.atan2(dx, dz) * 180 / Math.PI; moving = true;
      }
      this.onMove?.(this.position.x, this.position.z, this.position.yaw);
    }
    const now = Date.now();
    for (const [id, a] of this.avatars) {
      const mine = id === this.me, t = mine ? this.position : a.target;
      const p = a.root.getPosition(); const isMoving = mine ? moving : Math.hypot(p.x - t.x, p.z - t.z) > .05;
      const nextX = pc.math.lerp(p.x, t.x, 1 - Math.exp(-dt * 14)), nextZ = pc.math.lerp(p.z, t.z, 1 - Math.exp(-dt * 14));
      a.root.setPosition(nextX, heightAt(nextX, nextZ), nextZ);
      const yaw = a.root.getEulerAngles().y; a.root.setEulerAngles(0, pc.math.lerpAngle(yaw, t.yaw, 1 - Math.exp(-dt * 12)), 0);
      const wave = now - a.target.wave < 1600;
      a.animation.update(isMoving, now - a.target.wave, this.reduced);
      const screen = this.camera.camera!.worldToScreen(new pc.Vec3(p.x, p.y + 1.9, p.z));
      a.label.style.transform = `translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`;
      a.label.style.display = this.entered && screen.z > 0 ? '' : 'none';
      a.label.classList.toggle('me', mine);
      a.label.textContent = `${wave ? '✦ ' : ''}${a.target.name}${mine ? ' · you' : ''}${a.target.voice ? ' · voice' : ''}`;
    }
    const desired = this.entered ? new pc.Vec3(this.position.x + 1.8, 1 + heightAt(this.position.x, this.position.z), this.position.z - 2.2) : new pc.Vec3(1.8, 1.2, 0);
    this.target.lerp(this.target, desired, 1 - Math.exp(-dt * 3));
    this.camera.setPosition(this.target.x + Math.sin(this.angle) * this.distance, this.target.y + this.distance * .48, this.target.z + Math.cos(this.angle) * this.distance);
    this.camera.lookAt(this.target);
    if (!this.reduced) {
      for (let i = 0; i < this.flames.length; i++) this.flames[i].setLocalScale(.24 + Math.sin(this.elapsed * 5 + i) * .05, .65 + Math.sin(this.elapsed * 7 + i * 3) * .18, .25);
      for (let i = 0; i < this.fireflies.length; i++) { const e = this.fireflies[i], p = e.getPosition(); e.setPosition(p.x + Math.sin(this.elapsed * .5 + i) * dt * .13, 1.6 + Math.sin(this.elapsed * .7 + i * 1.8) * .7, p.z + Math.cos(this.elapsed * .6 + i) * dt * .13); }
    }
  }
  snapshot() { return { position: { ...this.position, y: heightAt(this.position.x, this.position.z) }, avatarAsset: BEAVER_ASSET, players: [...this.avatars.values()].map(a => ({ ...a.target, rendered: { x: a.root.getPosition().x, z: a.root.getPosition().z }, animation: a.animation.snapshot() })), fps: this.app.stats.fps, drawCalls: this.app.stats.drawCallCount, submittedPrimitives: this.app.stats.primitiveCount ?? null, renderer: this.app.graphicsDevice.deviceType, canvas: { width: this.canvas.width, height: this.canvas.height }, loadedAssets: this.assets.size }; }
}
