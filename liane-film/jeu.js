// LIANE — les règles du jeu, sans aucun affichage : lianes, balancement, vol, rattrapage, pièges, fruits, difficulté.
// Ce fichier ne dépend de rien : il peut tourner seul pour vérifier qu'une partie reste toujours jouable.

export const G = 13;                 // pesanteur (un peu adoucie, pour de beaux arcs)
export const AY = 11;                // hauteur d'accroche des lianes, dans la canopée
export const SWING = 0.82;           // amplitude entretenue du balancement, en radians
export const GRIP = 6.4;             // hauteur de prise que le singe retrouve sur la liane
export const LANES = [1.5, 0, -1.5]; // trois couloirs : gauche, centre, droite à l'écran (la caméra regarde vers +Z)
export const ROT_TIME = 1.15;        // secondes avant qu'une liane pourrie ne cède

export function rnd(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// La difficulté ne dépend que du nombre de lianes déjà passées : elle monte vite au début, puis de plus en plus lentement, sans jamais s'arrêter.
export function difficulty(n) {
  const k = (t) => 1 - Math.exp(-n / t);
  return {
    gap: 6.2 + 2.0 * k(45),                                        // écart entre deux lianes
    jitter: 0.7,                                                   // part de hasard dans l'écart
    len: 12 - 2.4 * k(60),                                           // longueur des lianes : plus courtes, il faut arriver plus haut
    reach: 1.75 - 0.4 * k(70),                                     // tolérance au rattrapage
    shift: n < 6 ? 0 : Math.min(0.6, 0.2 + (n - 6) * 0.008),       // la liane suivante change de couloir
    double: n < 12 ? 0 : Math.min(0.45, 0.14 + (n - 12) * 0.006),  // deux lianes côte à côte, dont une pourrie
    rotten: n < 22 ? 0 : Math.min(0.28, 0.08 + (n - 22) * 0.004),  // liane pourrie seule : il faut repartir aussitôt
    fruit: 0.55,
  };
}

export class Jeu {
  constructor({ seed = 1, z0 = 0, n0 = 0, onLiana = () => {}, onFruit = () => {} } = {}) {   // n0 : rang de départ de la difficulté (pour les essais)
    this.r = rnd(seed); this.onLiana = onLiana; this.onFruit = onFruit;
    this.lianas = []; this.fruits = []; this.n = n0; this.made = 0; this.nextZ = z0; this.path = 1; this.prev = null; this.lastRotten = false; this.id = 0;
    this.addRow(); while (this.nextZ < z0 + 80) this.addRow();
    const li = this.lianas[0];
    this.S = { mode: 'hang', li, R: GRIP, th: -SWING, om: 0, pos: { x: li.x, y: AY - GRIP * Math.cos(SWING), z: li.z - GRIP * Math.sin(SWING) }, vel: { x: 0, y: 0, z: 0 },
      origin: li.lane, aim: li.lane, lastZ: -1e9, z0: li.z, dist: 0, fruits: 0, count: 0, started: false, over: false, cause: '', passes: 0, wasUp: false };
    li.held = true;
  }

  // Une rangée : une liane, ou deux côte à côte dont une pourrie. Le chemin sûr ne s'écarte jamais de plus d'un couloir.
  addRow() {
    const r = this.r, d = difficulty(this.n), z = this.nextZ;
    if (this.made > 0 && r() < d.shift) this.path = clamp(this.path + (r() < 0.5 ? -1 : 1), 0, 2);
    const mk = (lane, rotten) => {
      const li = { id: this.id++, row: this.n, lane, x: LANES[lane], z, len: d.len, reach: d.reach, rotten, ang: 0, angV: 0, ph: r() * 6.28, held: false, hold: 0, drop: 0, broken: false, seed: (r() * 1e9) | 0 };
      this.lianas.push(li); this.onLiana(li); return li;
    };
    let good;
    const soloRotten = this.made > 0 && !this.lastRotten && r() < d.rotten;
    if (soloRotten) { good = mk(this.path, true); this.lastRotten = true; }
    else {
      good = mk(this.path, false); this.lastRotten = false;
      if (r() < d.double) { const side = this.path === 0 ? 1 : this.path === 2 ? 1 : (r() < 0.5 ? 0 : 2); mk(side === this.path ? this.path - 1 : side, true); }
    }
    if (this.prev && r() < d.fruit) {          // un fruit sur la trajectoire, entre la liane précédente et celle-ci
      // Il est placé sur le bel arc, celui d'un lâcher tardif : un lâcher précipité passe en dessous.
      const f = { id: this.id++, x: this.prev.x * 0.15 + good.x * 0.85, y: AY - 5.05 - r() * 0.3, z: this.prev.z + (z - this.prev.z) * (0.62 + r() * 0.07), taken: false, seed: (r() * 1e9) | 0 };
      this.fruits.push(f); this.onFruit(f);
    }
    this.prev = good; this.n++; this.made++; this.nextZ = z + d.gap + r() * d.jitter;
  }

  // Le joueur lâche la liane.
  release() {
    const S = this.S; if (S.mode !== 'hang' || S.over) return false;
    const li = S.li; li.held = false; S.lastZ = li.z; S.started = true;
    S.vel.x = 0; S.vel.y = S.R * S.om * Math.sin(S.th); S.vel.z = S.R * S.om * Math.cos(S.th); S.mode = 'fly';
    return true;
  }
  // Le joueur vise : -1 vers la gauche de l'écran, +1 vers la droite. Un couloir au plus par élan.
  steer(dir) { const S = this.S; S.aim = clamp(S.aim + dir, Math.max(0, S.origin - 1), Math.min(2, S.origin + 1)); }

  // La liane que les mains peuvent saisir à cette position, s'il y en a une.
  _grab(pos, lastZ, m = 0) {             // m : marge de prudence, pour le pilote automatique
    for (const l of this.lianas) {
      if (l.broken || l.z <= lastZ + 1) continue;
      const dz = pos.z - l.z, dy = AY - pos.y;
      if (Math.abs(dz) < l.reach - m && Math.abs(pos.x - l.x) < 0.6 - m * 0.5 && dy > 3.2 + m && dy < l.len - 0.3 - m) return l;
    }
    return null;
  }
  // Pilote automatique (pour les essais) : où mènerait un lâcher maintenant, en visant ce couloir ?
  _sim(aim) {
    const S = this.S, p = { x: S.pos.x, y: S.pos.y, z: S.pos.z }, v = { y: S.R * S.om * Math.sin(S.th), z: S.R * S.om * Math.cos(S.th) }, dt = 0.0125;
    for (let t = 0; t < 2.2; t += dt) {
      v.y -= G * dt; p.y += v.y * dt; p.z += v.z * dt; p.x += (LANES[aim] - p.x) * Math.min(1, dt * 6);
      const l = this._grab(p, S.li.z, 0.4); if (l) return l;
      if (p.y < AY - 13) return null;
    }
    return null;
  }
  autopilot() {
    const S = this.S; if (S.mode !== 'hang') return;
    if (S.om <= 0) { if (S.wasUp) { S.wasUp = false; S.passes++; } return; }
    S.wasUp = true;
    // Il attend le haut du balancement pour un bel arc, sauf si la liane est pourrie ou s'il a déjà laissé passer un élan.
    if (S.th < 0.42 && !S.li.rotten && S.passes < 1) return;
    let best = null, bestAim = S.origin;
    for (const a of [S.origin, S.origin - 1, S.origin + 1]) {
      if (a < 0 || a > 2) continue;
      const l = this._sim(a); if (l && (!best || (best.rotten && !l.rotten))) { best = l; bestAim = a; }
    }
    if (!best) return;
    // Il préfère une liane saine ; il n'accepte une pourrie que s'il n'y a pas le choix dans la rangée suivante.
    if (best.rotten && this.lianas.some((l) => l.row === best.row && !l.rotten)) return;
    S.aim = bestAim; this.release();
  }

  step(dt, auto = false) {
    const S = this.S;
    if (S.mode === 'hang') {
      const li = S.li;
      S.om += -(G / S.R) * Math.sin(S.th) * dt; S.th += S.om * dt;
      // Le singe entretient son élan, comme sur une balançoire ; un élan trop fort s'amortit.
      const E = 0.5 * S.R * S.R * S.om * S.om + G * S.R * (1 - Math.cos(S.th)), Emin = G * S.R * (1 - Math.cos(SWING));
      if (E < Emin) S.om += Math.sign(S.om || 1) * 1.1 * dt; else if (E > Emin * 1.25) S.om *= 1 - 0.9 * dt;
      // Il reprend sa prise à bonne hauteur.
      const want = Math.min(GRIP, li.len - 0.6); S.R += clamp(want - S.R, -1.3 * dt, 1.3 * dt);
      if (li.rotten) {                                        // la liane pourrie craque, s'affaisse, puis cède
        li.hold += dt; li.drop = li.hold > 0.78 ? 0.3 : li.hold > 0.42 ? 0.14 : 0;
        if (li.hold > ROT_TIME) { li.broken = true; this.release(); S.vel.y = Math.min(S.vel.y, 0); S.vel.z *= 0.45; S.cause = 'pourrie'; return; }
      }
      S.pos.x += (li.x - S.pos.x) * Math.min(1, dt * 12);
      S.pos.y = AY - li.drop - S.R * Math.cos(S.th); S.pos.z = li.z + S.R * Math.sin(S.th);
      li.ang = S.th; li.angV = S.om;
      if (auto) this.autopilot();
    } else if (S.mode === 'fly') {
      S.vel.y -= G * dt; S.pos.y += S.vel.y * dt; S.pos.z += S.vel.z * dt;
      S.pos.x += (LANES[S.aim] - S.pos.x) * Math.min(1, dt * 6);
      const l = this._grab(S.pos, S.lastZ);
      if (l) {                                                 // à portée : il l'attrape
        const dz = S.pos.z - l.z, dy = AY - S.pos.y;
        S.li = l; l.held = true; S.origin = S.aim = l.lane; S.R = clamp(Math.hypot(dz, dy), 3.4, l.len - 0.3); S.th = Math.atan2(dz, dy);
        S.om = (S.vel.z * Math.cos(S.th) + S.vel.y * Math.sin(S.th)) / S.R; S.mode = 'hang'; S.count++; S.cause = ''; S.passes = 0; S.wasUp = false;
      }
      for (const f of this.fruits) if (!f.taken && Math.hypot(f.x - S.pos.x, f.y - S.pos.y, f.z - S.pos.z) < 1.1) { f.taken = true; S.fruits++; }
      if (S.pos.y < AY - 15) { S.mode = 'fallen'; S.over = true; }
    } else {
      S.vel.y -= G * dt; if (S.pos.y > AY - 60) { S.pos.y += S.vel.y * dt; S.pos.z += S.vel.z * dt * 0.5; }
    }
    if (S.started) S.dist = Math.max(S.dist, S.pos.z - S.z0);
    while (this.nextZ < S.pos.z + 80) this.addRow();
  }

  // Oublie ce qui est loin derrière. Renvoie ce qui a été retiré, pour que l'affichage le retire aussi.
  prune() {
    const S = this.S, out = [];
    while (this.lianas.length && this.lianas[0].z < S.pos.z - 22 && this.lianas[0] !== S.li) out.push(this.lianas.shift());
    while (this.fruits.length && this.fruits[0].z < S.pos.z - 22) out.push(this.fruits.shift());
    return out;
  }
}
