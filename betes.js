// APEX — les bêtes : panthère et cerf avec un vrai squelette, animés par le calcul (pas de clips figés).
// La foulée est calée sur le temps de la musique ; la traque, le bond et la queue réagissent au jeu.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const TAU = Math.PI * 2;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

// Réglages d'allure par espèce.
export const PANTHER = { fSwing: 0.78, fKnee: 0.95, hSwing: 0.82, hKnee: 1.05, hindLag: 0.44, lr: 0.07, spine: 0.2, bob: 0.045, pitch: 0.06, tail: 0.22, crouch: 0.95, lookFix: -0.45 };
export const DEER = { fSwing: 0.85, fKnee: 1.25, hSwing: 0.9, hKnee: 1.2, hindLag: 0.5, lr: 0.05, spine: 0.1, bob: 0.085, pitch: 0.09, tail: 0.1, crouch: 0.8 };

export class Beast {
  constructor(gltf, { length, material, gait }) {
    this.gait = gait;
    this.root = new THREE.Group();            // position dans le monde
    this.body = new THREE.Group(); this.root.add(this.body); // tangage, écrasement, roulis
    const model = SkeletonUtils.clone(gltf.scene);
    model.updateMatrixWorld(true);
    this.bones = {};
    model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) { this.mesh = o; o.material = material(o.material); o.frustumCulled = false; }
    });
    // Pour chaque os : pose de repos, et axes « latéral » et « vertical » du modèle exprimés dans son repère.
    this.rest = {}; this.axX = {}; this.axY = {};
    for (const [n, b] of Object.entries(this.bones)) {
      const inv = b.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.rest[n] = b.quaternion.clone();
      this.axX[n] = X.clone().applyQuaternion(inv); this.axY[n] = Y.clone().applyQuaternion(inv);
    }
    this.tails = Object.keys(this.bones).filter((n) => n.startsWith('tail')).sort();
    // Mise à l'échelle : tête vers +Z, pattes au sol.
    this.mesh.geometry.computeBoundingBox();
    const box = this.mesh.geometry.boundingBox.clone().applyMatrix4(this.mesh.matrixWorld);
    const s = length / (box.max.z - box.min.z), c = box.getCenter(new THREE.Vector3());
    model.scale.setScalar(s); model.rotation.y = Math.PI;
    model.position.set(c.x * s, -box.min.y * s, c.z * s);
    this.body.add(model);
    this.height = (box.max.y - box.min.y) * s; this.length = length;
    const hip = this.bones.FL1 ? this.bones.FL1.getWorldPosition(new THREE.Vector3()).y - box.min.y : (box.max.y - box.min.y) * 0.6;
    this.leg = hip * s;
    // État des ressorts (inertie) : accroupissement, queue, écrasement à l'atterrissage.
    this.cr = 0; this.crV = 0; this.tailX = 0; this.tailXV = 0; this.tailY = 0; this.tailYV = 0; this.sq = 0; this.sqV = 0;
    this.px = 0; this.py = 0; this.wasAir = false;
  }

  rot(n, pitch, yaw = 0) {
    const b = this.bones[n]; if (!b) return;
    q1.setFromAxisAngle(this.axX[n], pitch);
    b.quaternion.copy(this.rest[n]).multiply(q1);
    if (yaw) b.quaternion.multiply(q2.setFromAxisAngle(this.axY[n], yaw));
  }

  // st : { phase (0..1 par foulée), run (0..1), crouch (0..1), air (-1 ou 0..1), look (rad), y (hauteur de saut), lean }
  update(dt, st) {
    const g = this.gait, p = st.phase * TAU;
    const K = 120, D = 16;                                   // ressort d'accroupissement : un peu d'inertie
    this.crV += ((st.crouch - this.cr) * K - this.crV * D) * dt; this.cr += this.crV * dt;
    const cr = Math.max(0, this.cr) * g.crouch;
    const air = st.air >= 0 && st.air <= 1;
    const reach = air ? Math.sin(Math.PI * st.air) : 0;      // 0 au sol, 1 au sommet du bond
    if (this.wasAir && !air) this.sqV -= 3.2;                // l'atterrissage écrase le corps
    this.wasAir = air;
    this.sqV += (-this.sq * 160 - this.sqV * 14) * dt; this.sq += this.sqV * dt;
    const run = st.run * (1 - reach) * (1 - 0.6 * Math.min(1, cr));

    // Corps : rebond de la foulée, tangage, écrasement.
    const ca = 0.9 * Math.min(1.15, cr);                       // angle de pliure des pattes en traque
    const drop = this.leg * (0.78 * (1 - Math.cos(ca)) - this.sq * 0.3);  // le corps descend exactement de ce que les pattes replient
    this.body.position.y = (st.y || 0) - drop + g.bob * this.length * run * Math.sin(p + 1.1);
    this.body.rotation.x = g.pitch * run * Math.cos(p) + (air ? -0.32 * Math.cos(Math.PI * st.air) : 0) + cr * 0.05;
    this.body.rotation.z = (st.lean || 0) * 0.5;
    this.body.rotation.y = (st.lean || 0) * 0.35;

    // Colonne : elle se cambre et s'étire avec la foulée.
    const sF = Math.sin(p), sH = Math.sin(p + TAU * g.hindLag);
    this.rot('spine1', -g.spine * run * sH + reach * 0.12 - cr * 0.1);
    this.rot('spine2', g.spine * run * sF - reach * 0.12 + cr * 0.12);
    const headUp = -(this.body.rotation.x) * 0.7 - g.spine * run * sF * 0.5 - cr * 0.28 + reach * 0.1;
    const look = (st.look || 0) + (g.lookFix || 0) * Math.min(1, st.run * 2);   // en course, elle regarde droit devant
    this.rot('neck', headUp, look);
    this.rot('head', headUp * 0.4 + cr * 0.2, look * 0.6);

    // Pattes avant : balancier + genou qui se replie pendant la phase de vol ; tendues vers l'avant pendant le bond.
    for (const [n, off] of [['FL', 0], ['FR', g.lr]]) {
      const ps = p + TAU * off, sw = Math.sin(ps), lift = Math.max(0, Math.cos(ps));
      this.rot(n + '1', run * g.fSwing * sw + reach * 1.05 - ca);
      this.rot(n + '2', run * g.fKnee * 0.45 * lift + reach * 0.15 + ca * 2);
      this.rot(n + '3', -run * g.fKnee * 1.2 * lift - reach * 0.25 - ca);
    }
    // Pattes arrière : en opposition ; elles poussent vers l'arrière pendant le bond.
    for (const [n, off] of [['HL', g.hindLag], ['HR', g.hindLag + g.lr]]) {
      const ps = p + TAU * off, sw = Math.sin(ps), lift = Math.max(0, Math.cos(ps));
      this.rot(n + '1', run * g.hSwing * sw - reach * 0.95 + ca);
      this.rot(n + '2', -run * g.hKnee * lift + reach * 0.3 - ca * 2);
      this.rot(n + '3', run * g.hKnee * 0.9 * lift - reach * 0.2 + ca);
    }

    // Queue : une onde qui la parcourt + inertie (elle traîne dans les esquives et les sauts).
    const wx = this.root.position.x, wy = this.root.position.y + (st.y || 0);
    const vx = (wx - this.px) / Math.max(dt, 1e-3), vy = (wy - this.py) / Math.max(dt, 1e-3);
    this.px = wx; this.py = wy;
    this.tailXV += ((-vx * 0.09 - this.tailX) * 70 - this.tailXV * 7) * dt; this.tailX += this.tailXV * dt;
    this.tailYV += ((vy * 0.07 - this.tailY) * 70 - this.tailYV * 7) * dt; this.tailY += this.tailYV * dt;
    const tx = THREE.MathUtils.clamp(this.tailX, -0.6, 0.6), ty = THREE.MathUtils.clamp(this.tailY, -0.5, 0.5);
    this.tails.forEach((n, i) => {
      const k = 0.6 + i * 0.35;
      this.rot(n, -0.32 * (st.run > 0.1 ? 1 : 0.2) + g.tail * Math.sin(p - i * 1.0) * (0.4 + 0.6 * st.run) + ty * k - reach * 0.12 + cr * 0.1, tx * k + 0.12 * Math.sin(p * 0.5 - i * 0.8) * st.run);
    });
  }

  // Positions actuelles (squelette appliqué) d'un échantillon de sommets, en repère monde.
  sample(n, out) {
    const pos = this.mesh.geometry.attributes.position, v = new THREE.Vector3();
    this.mesh.updateMatrixWorld(true);
    for (let i = 0; i < n; i++) {
      this.mesh.getVertexPosition(Math.floor(Math.random() * pos.count), v);
      v.applyMatrix4(this.mesh.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
    return out;
  }
}
