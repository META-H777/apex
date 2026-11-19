// LIANE — le jouet : les règles du mouvement, sans aucun dessin.
// Vue de côté, l'axe x va vers la droite, l'axe y vers le haut, en mètres.
// Tenir = s'accrocher à la liane à portée ; lâcher = s'élancer. La vitesse ne retombe jamais à zéro.

export const CFG = {
  g: 30,            // pesanteur : forte, pour des arcs nerveux
  floorY: 0,        // la cime des arbres du dessous : on y rebondit, on n'y meurt pas (c'est un jouet)
  vRef: 18.8,       // vitesse de croisière au creux du balancement, vers laquelle le singe se relance
  yRef: 4.6,        // hauteur de ce creux
  pump: 7.6,        // élan que le singe ajoute en se balançant vers l'avant
  drag: 0.006,      // frein de l'air en vol
  ahead: 2.6,       // portée pour saisir une liane devant soi
  back: 1.0,        // et un peu derrière
  vMin: 9,          // vitesse horizontale plancher en vol
  bounce: 13.6,     // rebond sur les cimes
  ceil: 9.4,        // au-dessus, le feuillage freine la montée
  depth: 5.4,       // on saisit une liane assez bas sous son accroche : c'est ce qui fait de grands arcs
  autoTh: 1.12,     // angle où il lâche tout seul si on tient trop longtemps
  autoV: 5.5,       // ou vitesse en dessous de laquelle il lâche tout seul
};

export function rnd(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Jeu {
  constructor(seed = 1) {
    this.r = rnd(seed); this.lianas = []; this.nextX = 0; this.id = 0; this.time = 0; this.events = [];
    while (this.nextX < 90) this.addLiana();
    const li = this.lianas[0], R = Math.min(7, li.L - 1.2);
    this.M = { mode: 'swing', li, R, th: -0.55, om: 0, x: 0, y: 0, vx: 0, vy: 0, hold: false, idle: true, want: false, air: 0, swings: 0, bounces: 0, last: null };
    li.held = true; this.place();
  }

  // Une liane : un point d'accroche dans la canopée, une longueur, et un angle de balancement quand elle est libre.
  addLiana() {
    const r = this.r, y = 12.4 + r() * 1.8, L = y - (3.4 + r() * 1.4);     // de longues lianes, qui s'arrêtent au-dessus des cimes
    this.lianas.push({ id: this.id++, x: this.nextX, y, L, a: 0, av: 0, ph: r() * 6.28, held: false, cool: 0, seed: (r() * 1e9) | 0 });
    this.nextX += 7.2 + r() * 3.4;
  }

  place() { const M = this.M, li = M.li; M.x = li.x + M.R * Math.sin(M.th); M.y = li.y - M.R * Math.cos(M.th); M.vx = M.R * M.om * Math.cos(M.th); M.vy = M.R * M.om * Math.sin(M.th); }
  energy() { const M = this.M; return 0.5 * (M.vx * M.vx + M.vy * M.vy) + CFG.g * (M.y - CFG.yRef); }

  setHold(h) {
    const M = this.M; if (h === M.hold) return; M.hold = h;
    if (!h && M.mode === 'swing') M.want = true;       // lâcher la liane
  }

  release() {
    const M = this.M, li = M.li; this.place();
    li.held = false; li.cool = 0.45; li.a = M.th; li.av = M.om * 0.35;
    M.mode = 'fly'; M.idle = false; M.want = false; M.air = 0; M.last = li;
    this.events.push({ type: 'release', x: M.x, y: M.y, v: Math.hypot(M.vx, M.vy) });
  }

  // La liane que les mains peuvent saisir : celle dont la corde passe le plus près, devant de préférence.
  reachable() {
    const M = this.M, sp = Math.hypot(M.vx, M.vy), ahead = CFG.ahead * clamp(sp / 12, 0.75, 1.25);
    let best = null, bestD = 1e9;
    for (const li of this.lianas) {
      if (li.cool > 0 || li.x < M.x - 8) continue; if (li.x > M.x + 12) break;
      if (M.y > li.y - CFG.depth || M.y < li.y - li.L - 0.6) continue;   // trop haut sous l'accroche, ou sous le bout de la liane
      const d = li.x + (li.y - M.y) * Math.tan(li.a) - M.x;              // écart horizontal avec la corde, à la hauteur des mains
      if (d < -CFG.back || d > ahead) continue;
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = li; }
    }
    return best;
  }

  grab(li) {
    const M = this.M, sp = Math.hypot(M.vx, M.vy);
    M.th = Math.atan2(M.x - li.x, li.y - M.y); M.R = clamp(Math.hypot(M.x - li.x, li.y - M.y), 2.5, li.L + 0.6);
    const vt = M.vx * Math.cos(M.th) + M.vy * Math.sin(M.th);
    M.om = Math.max(vt, 0.84 * sp, 5) / M.R;            // la vitesse se garde : elle passe dans le balancement
    M.li = li; li.held = true; M.mode = 'swing'; M.want = false; M.swings++;
    this.place(); this.events.push({ type: 'grab', x: M.x, y: M.y });
  }

  step(dt) {
    const M = this.M, C = CFG; this.time += dt;
    if (M.mode === 'swing') {
      M.om += -(C.g / M.R) * Math.sin(M.th) * dt;
      const E = this.energy(), Eref = 0.5 * C.vRef * C.vRef;
      if (M.idle) {                                      // avant le premier geste : il se balance sur place
        const Eidle = C.g * M.R * (1 - Math.cos(0.6)) + C.g * (M.li.y - M.R - C.yRef);
        if (E < Eidle) M.om += Math.sign(M.om || 1) * 2.6 / M.R * dt;
      } else if (M.om > 0 && E < Eref) M.om += C.pump / M.R * dt;        // il se relance vers l'avant
      else if (E > Eref * 1.12) M.om *= 1 - 0.5 * dt;
      M.th += M.om * dt; this.place(); M.li.a = M.th; M.li.av = M.om;
      const v = M.R * M.om;
      if (M.want && (M.om > 0 || !M.idle)) { if (M.om > 0.15 || M.th > 0.1) this.release(); }
      else if (!M.idle && (M.th > C.autoTh || (M.th > 0.25 && v < C.autoV))) this.release();   // il ne reste jamais pendu : pas de retour en arrière
    } else {
      M.air += dt;
      M.vy -= C.g * dt;
      const sp = Math.hypot(M.vx, M.vy), k = 1 - C.drag * sp * dt; M.vx *= k; M.vy *= k;
      if (M.vx < C.vMin) M.vx += (C.vMin - M.vx) * Math.min(1, 3 * dt);
      if (M.y > C.ceil && M.vy > 0) M.vy -= M.vy * Math.min(1, 9 * dt);
      M.x += M.vx * dt; M.y += M.vy * dt;
      if (M.y < C.floorY + 1.1 && M.vy < 0) {            // la cime des arbres le renvoie en l'air
        this.events.push({ type: 'bounce', x: M.x, y: C.floorY + 0.4, v: -M.vy });
        M.vy = Math.max(C.bounce, -M.vy * 0.62); M.vx = Math.max(C.vMin + 1.5, M.vx * 0.86); M.y = C.floorY + 1.1; M.bounces++;
      }
      if (M.hold) { const li = this.reachable(); if (li) this.grab(li); }
    }
    for (const li of this.lianas) {                      // les lianes libres : un souffle de vent, et le retour après un lâcher
      if (li.cool > 0) li.cool -= dt;
      if (li.held) continue;
      const rest = 0.035 * Math.sin(this.time * 0.9 + li.ph);
      li.av += ((rest - li.a) * 9 - li.av * 1.3) * dt; li.a += li.av * dt;
    }
    while (this.nextX < M.x + 90) this.addLiana();
    while (this.lianas.length > 2 && this.lianas[0].x < M.x - 45 && this.lianas[0] !== M.li) this.lianas.shift();
  }

  // Pilote automatique, pour les essais : il s'accroche quand la liane est proche et lâche en haut du balancement.
  autopilot(style = 'bon', relTh = 0.62) {
    const M = this.M;
    if (style === 'colle') { this.setHold(true); return; }                 // le doigt posé en permanence
    if (M.mode === 'swing') { if (M.idle) { if (M.om > 0 && M.th > 0.3) { this.setHold(true); this.setHold(false); } } else if (M.th > relTh || (M.th > 0.4 && M.R * M.om < 8)) this.setHold(false); }
    else if (M.air > 0.09 && M.vy < 4) this.setHold(true);
  }
}
