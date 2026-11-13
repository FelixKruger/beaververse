import * as pc from 'playcanvas';

export const BEAVER_ASSET = 'beaver-gobkit.glb';
export const BEAVER_SCALE = .30;

/** A separate skeleton and controller per visitor; shared animation tracks are immutable. */
export class BeaverAnimation {
  private paw: pc.GraphNode;
  private tail: pc.GraphNode;
  private tailRotation: pc.Quat;
  private rotation = new pc.Quat();
  private offset = new pc.Quat();
  private state = 'idle';
  private greeting = false;
  private layer: pc.AnimComponentLayer;

  constructor(private body: pc.Entity, resource: pc.ContainerResource) {
    body.addComponent('anim', { activate: true });
    for (const name of ['idle', 'walk']) {
      const track = resource.animations.map(asset => asset.resource as pc.AnimTrack).find(track => track.name === name);
      if (!track) throw new Error(`Beaver animation missing: ${name}`);
      body.anim!.assignAnimation(name, track);
    }
    const layer = body.anim!.baseLayer;
    if (!layer) throw new Error('Beaver animation controller missing');
    this.layer = layer;
    layer.play('idle');
    const paw = body.findByName('RightLegF');
    const tail = body.findByName('Tail');
    if (!paw || !tail) throw new Error('Beaver animation joint missing');
    this.paw = paw;
    this.tail = tail;
    this.tailRotation = tail.getLocalRotation().clone();
  }

  // Called after PlayCanvas evaluates the imported clips. No root motion or body hopping.
  update(moving: boolean, waveAge: number, reduced: boolean) {
    const next = moving ? 'walk' : 'idle';
    if (next !== this.state) {
      this.layer.transition(next, .18);
      this.state = next;
    }
    this.body.anim!.speed = moving ? 1.65 : reduced ? 0 : 1;
    this.greeting = waveAge >= 0 && waveAge < 1600;
    if (this.greeting) {
      const envelope = Math.min(1, waveAge / 180, (1600 - waveAge) / 220);
      const sway = reduced ? 0 : Math.sin(waveAge / 150) * 28;
      // This quadruped greets with its paddle; no attack clip or invented humanoid arm.
      this.offset.setFromEulerAngles(-12 * envelope, sway * envelope, 0);
      this.rotation.mul2(this.tailRotation, this.offset);
      this.tail.setLocalRotation(this.rotation);
    } else if (reduced && !moving) {
      this.tail.setLocalRotation(this.tailRotation);
    }
  }

  snapshot() {
    const q = this.paw.getLocalRotation();
    const tail = this.tail.getLocalRotation();
    return { clip: this.state, time: this.layer.activeStateCurrentTime,
      greeting: this.greeting, paw: [q.x, q.y, q.z, q.w], tail: [tail.x, tail.y, tail.z, tail.w] };
  }
}
