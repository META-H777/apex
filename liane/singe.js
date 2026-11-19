// LIANE — le singe : un singe-araignée (Ateles) en silhouette, posé par le mouvement.
// Rien ici ne change les règles : jeu.js dit où sont les mains, ce fichier dit comment le corps suit.
// Les faits repris de l'animal viennent de la fiche liane/SINGE-REEL.md (Youlatos 2008, Rosenberger 2008, Byron 2017, Druelle 2019).
//
//  - Proportions : bras + avant-bras = 1,5 fois le tronc, main longue (un quart du membre), jambes un peu plus courtes que les bras,
//    queue deux fois le tronc, petite tête, arrière-train lourd (le centre de masse est près des hanches).
//  - La main est un crochet de quatre doigts, sans pouce. Le coude reste presque tendu sous la charge : 174° à la saisie, 158° au lâcher.
//  - Le corps pend sous les mains comme un poids : bras, tronc et jambes sont des pendules en chaîne, chacun en retard sur le précédent.
//  - La queue est un cinquième membre : elle saisit la liane après la main, la lâche avant la main, et tient sa courbe quand elle est libre.
//  - Le saut : corps étalé « en étoile », bras devant, une jambe devant, une derrière ; les mains arrivent les premières, le corps passe dessous.
//  - S'il s'attarde sur la liane, il s'y agrippe : les quatre membres très fléchis, le corps le long de la liane, la queue enroulée dessous.
// Ce qui n'est pas documenté chez Ateles (position des jambes pendant le balancement, rôle de la queue en vol) est repris du gibbon ou déduit.
import { CFG } from './jeu.js?v=6';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const dir = (a) => [Math.sin(a), -Math.cos(a)];            // 0 = vers le bas, positif = vers l'avant
const ecart = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

export const K = 1.3;                                      // le singe est dessiné plus grand que nature, pour se lire d'un coup d'œil
const TRONC = 0.55 * K, BRAS = 0.4 * K, AVANT = 0.425 * K, MAIN = 0.28 * K, CUISSE = 0.4 * K, JAMBE = 0.385 * K, PIED = 0.21 * K, TETE = 0.104 * K;
const PRISE = AVANT + MAIN * 0.72, ALLONGE = BRAS + PRISE;  // du coude, puis de l'épaule, au creux des doigts
const QN = 15, QSEG = 0.0735 * K;                          // la queue : deux fois le tronc
// Au départ il attend perché sur une branche, la liane en main : la branche est à cette distance sous ses mains.
export const PERCHE = ALLONGE * (1 - 0.34 * 0.55) + TRONC * 0.96 + 0.33 * K;

export function corps() {
  return { mode: null, tS: 9, tA: 9, alt: 1, bras: -0.5, brasV: 0, tronc: -0.2, troncV: 0, flex: 0.3, flexV: 0,
    cuisse: [0.9, 1], cuisseV: [0, 0], genou: [1.5, 1.6], genouV: [0, 0], h2: [0, 0.6], h2pose: 1, regard: 0.2,
    ax: 0, ay: 0, pvx: 0, pvy: 0, pv: false, bas: 0, tient: 0, qtient: 0, squash: 0, queue: null, qbx: 0, qby: 0, ox: 0, oy: 0, rx: null, ry: 0, elan: 0 };
}

// Coude ou genou : le point milieu d'un membre à deux os entre a et b ; renvoie aussi le bout réellement atteint.
function joint(ax, ay, bx, by, l1, l2, side) {
  let dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy) || 1e-4, m = Math.min(d, l1 + l2 - 1e-3); dx /= d; dy /= d;
  const a = (l1 * l1 - l2 * l2 + m * m) / (2 * m), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [ax + dx * a - dy * h * side, ay + dy * a + dx * h * side, ax + dx * m, ay + dy * m];
}

// M : l'état du mouvement (mains en x, y ; vitesse ; angle th et élan om du balancement). B : le corps, qui garde sa mémoire d'une image à l'autre.
// env : ancre [x, y] de la liane tenue ; reste : longueur de liane sous les mains ; devant : distance à la prochaine liane ;
//       tend : le doigt est posé, il tend les bras ; attend : avant le premier geste ; tremplin : une feuille est sous lui.
export function poseSinge(M, B, dt, env = {}) {
  const sw = M.mode === 'swing', C = CFG;
  if (B.mode !== M.mode) { if (B.mode) { if (sw) { B.tS = 0; B.alt = -B.alt; } else B.tA = 0; } B.mode = M.mode; }
  const n = Math.max(1, Math.ceil(dt * 120 - 1e-6)), h = dt / n;
  // La pesanteur ressentie par le corps : la vraie, moins l'accélération des mains. Sur la liane elle tire dans l'axe de la corde ; en vol elle est nulle.
  if (dt > 0) {
    if (B.pv) { let ax = (M.vx - B.pvx) / dt, ay = (M.vy - B.pvy) / dt; const a = Math.hypot(ax, ay); if (a > 150) { ax *= 150 / a; ay *= 150 / a; } const k = Math.min(1, dt * 40); B.ax += (ax - B.ax) * k; B.ay += (ay - B.ay) * k; }
    B.pvx = M.vx; B.pvy = M.vy; B.pv = true;
  }
  const gx = -B.ax, gy = -C.g - B.ay, G = Math.hypot(gx, gy);
  // Sur la liane, cette pesanteur ne s'écarte jamais beaucoup de l'axe de la corde (la traction du singe n'est pas une poussée de fusée).
  const aplomb = sw && !env.attend ? M.th + clamp(ecart(Math.atan2(gx, -gy), M.th), -0.3, 0.3) : Math.atan2(gx, -gy);
  const devant = env.devant ?? 99, monte = sw && M.om > 0, attend = !!env.attend, reste = env.reste ?? 0, tend = env.tend !== false;
  const approche = sw ? 0 : lisse(1 - (devant - 1.3) / 5) * (tend ? 1 : 0.35);      // en vol : 0 loin de la liane, 1 quand elle est à portée de bras
  const elan = monte ? lisse((M.th + 0.35) / 0.6) : 0;                             // sur la liane : 0 avant le creux, 1 en haut de la remontée
  // S'il s'attarde (retour en arrière, attente du départ), il s'agrippe à la liane des quatre membres.
  const veutTenir = sw && reste > 2.2 && (attend || M.depart ? attend : (!monte && B.tS > 0.2) || (monte && M.th < -0.3 && B.tS > 0.7));
  // La queue saisit la liane un instant après la main, et la lâche avant elle, dès qu'il remonte vers le lâcher.
  const veutQueue = sw && !attend && reste > 1.9 && (veutTenir || (B.tS > 0.05 && !(monte && M.th > 0.22)));
  for (let i = 0; i < n; i++) {
    B.tS += h; B.tA += h;
    B.tient += ((veutTenir ? 1 : 0) - B.tient) * Math.min(1, h * (veutTenir ? 6 : 14));
    B.qtient += ((veutQueue ? 1 : 0) - B.qtient) * Math.min(1, h * (veutQueue ? 22 : 26));
    B.elan += (elan - B.elan) * Math.min(1, h * 30);
    // --- Les bras, de la main à l'épaule. Sur la liane ils prolongent la corde ; en vol ils passent devant, tendus vers la liane à venir.
    const cBras = attend ? 0.05 : sw ? M.th : lerp(-0.62 - clamp(M.vy * 0.012, -0.2, 0.22), -1.05, approche);
    let acc = -(G / 0.8) * Math.sin(ecart(B.bras, aplomb)) * 1.3 + ecart(cBras, B.bras) * (sw ? 40 : 170) - B.brasV * (sw ? 7.5 : 21);
    B.brasV += acc * h; B.bras += B.brasV * h;
    // --- Le tronc pend de l'épaule, plus lourd, donc en retard. En vol il est penché vers l'avant ; agrippé, il longe la liane.
    const cTronc = attend ? -0.12 : sw ? lerp(M.th * 0.82 + B.elan * 0.1, aplomb, B.tient) : lerp(-0.55, -0.36, approche) - clamp(M.vy * 0.014, -0.25, 0.25);
    acc = -(G / 0.8) * Math.sin(ecart(B.tronc, aplomb)) * 0.8 + ecart(B.bras, B.tronc) * (sw ? 30 : 5) + ecart(cTronc, B.tronc) * (sw ? 34 : 120) - B.troncV * (sw ? 8 : 17);
    B.troncV += acc * h; B.tronc += B.troncV * h;
    // --- Le coude : presque tendu sous la charge, il se plie de quelques degrés au fil du balancement, et franchement quand il s'agrippe.
    const cFlex = sw ? Math.max(0.012 + 0.045 * B.elan, B.tient * 0.6, attend ? 0.55 : 0) : 0.05 + 0.1 * (1 - approche);
    B.flexV += ((cFlex - B.flex) * 140 - B.flexV * 20) * h; B.flex += B.flexV * h;
    // --- Les jambes. Sur la liane : elles traînent à la descente, se lancent vers l'avant au creux et montent (c'est ainsi qu'il gagne de l'élan).
    //     En vol : étalées, l'une devant, l'autre derrière. La jambe qui mène change à chaque liane.
    for (let j = 0; j < 2; j++) {
      const d = (j ? 1 : -1) * B.alt; let cC, cG;
      if (sw) {
        if (monte) { cC = lerp(-0.4, 1.3, B.elan) + d * 0.2; cG = lerp(1.05, 0.38, B.elan) + d * 0.12; } else { cC = 0.45 + d * 0.15; cG = 0.9 + d * 0.12; }
      } else {
        const sommet = clamp(1 - Math.abs(M.vy) / 13, 0, 1);
        cC = (d > 0 ? lerp(0.95, 1.25, sommet) : lerp(-0.55, 0.1, sommet)) - approche * 0.25; cG = d > 0 ? lerp(0.85, 1.35, sommet) : lerp(0.45, 1.0, sommet);
        if (env.tremplin) { cC = 0.45 + d * 0.12; cG = 0.55; }                     // il tend les pieds vers la feuille
        if (B.squash > 0.02) { cC = lerp(cC, 1.3, B.squash); cG = lerp(cG, 2.0, B.squash); }
      }
      const abs = B.tronc + B.cuisse[j];
      acc = -(G / 0.6) * Math.sin(ecart(abs, aplomb)) * 0.3 + (cC - B.cuisse[j]) * (sw ? 190 : 150) - B.cuisseV[j] * (sw ? 21 : 18) - (sw ? B.troncV * 0.6 : 0);
      B.cuisseV[j] += acc * h; B.cuisse[j] += B.cuisseV[j] * h;
      B.genouV[j] += ((cG - B.genou[j]) * 190 - B.genouV[j] * 21) * h; B.genou[j] = clamp(B.genou[j] + B.genouV[j] * h, 0.05, 2.4);
    }
    B.squash = Math.max(0, B.squash - h * 4.5);
    // --- La seconde main rejoint la première sur la liane, puis repart la première vers la liane suivante.
    const surLiane = sw && (attend || veutTenir || (B.tS > 0.06 && !(monte && M.th > 0.14)));
    B.h2pose += ((surLiane ? 1 : 0) - B.h2pose) * Math.min(1, h * (surLiane ? 24 : 26));
    // --- Le reste de la liane, sous les mains : il pend dans l'axe de la pesanteur ressentie, en retard.
    B.bas += ecart(sw ? aplomb : 0, B.bas) * Math.min(1, h * (sw ? 10 : 6));
  }

  // ---------- Le squelette ----------
  const dB = dir(B.bras), dT = dir(B.tronc), lb = ALLONGE * (1 - 0.34 * clamp(B.flex, 0, 1));   // lb : distance main → épaule
  // En vol, c'est le corps qui garde sa trajectoire et les bras qui passent devant : quand l'épaule bouge par rapport aux mains,
  // on déplace les mains plutôt que le corps. Il se fend aussi vers la liane qui arrive. Ce décalage se résorbe dès que la liane est en main :
  // la main reste un instant où elle a saisi, et c'est le corps qui la rattrape.
  const rx = dB[0] * lb, ry = dB[1] * lb;
  if (B.rx !== null && dt > 0) {
    if (!sw) { B.ox -= rx - B.rx; B.oy -= ry - B.ry; }
    const k = Math.exp(-dt * (sw ? 13 : 1.4 + 4 * approche)), fente = sw ? 0 : 0.55 * approche * approche;
    B.ox = fente + (B.ox - fente) * k; B.oy *= k;
  }
  B.rx = rx; B.ry = ry;
  const px = M.x + B.ox, py = M.y + B.oy, sx = px + rx, sy = py + ry;
  const tl = TRONC * (1 - B.squash * 0.12), hx = sx + dT[0] * tl, hy = sy + dT[1] * tl;
  const av = [Math.cos(B.tronc), Math.sin(B.tronc)];                               // l'avant du corps (le ventre)
  // Le dos s'arrondit quand les jambes montent, se creuse quand elles traînent.
  const rond = clamp((B.cuisse[0] + B.cuisse[1]) * 0.5 - 0.45, -0.7, 1.2) * 0.07 * K;
  const mx = (sx + hx) / 2 - av[0] * rond, my = (sy + hy) / 2 - av[1] * rond;
  // La liane : vers l'accroche (au-dessus des mains) et vers son bout libre (dessous).
  let ux = 0, uy = 1; if (sw && env.ancre) { ux = env.ancre[0] - px; uy = env.ancre[1] - py; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d; }
  const dBas = dir(B.bas), sur = (d) => [px + dBas[0] * d, py + dBas[1] * d];
  // La seconde main est suivie par rapport à l'épaule, pour ne jamais sauter d'une image à l'autre.
  let c2;
  if (sw) { const k = lisse(B.h2pose), bH = clamp(M.th + 0.85, 0.6, 1.45), l = ALLONGE * 0.97; c2 = [lerp(Math.cos(bH) * l, px + ux * 0.3 * K - sx, k), lerp(Math.sin(bH) * l, py + uy * 0.3 * K - sy, k)]; }
  else { const a = Math.atan2(-ry, -rx) - 0.42 + 0.22 * approche, l = ALLONGE * (0.93 + 0.05 * approche); c2 = [Math.cos(a) * l, Math.sin(a) * l]; }
  { const k = dt > 0 ? Math.min(1, dt * (sw ? 30 : 18)) : 0; B.h2[0] += (c2[0] - B.h2[0]) * k; B.h2[1] += (c2[1] - B.h2[1]) * k; }
  const bras = [];
  for (const [gx0, gy0] of [[sx + B.h2[0], sy + B.h2[1]], [px, py]]) {
    const e = joint(sx, sy, gx0, gy0, BRAS, PRISE, -1), dx = e[2] - e[0], dy = e[3] - e[1], d = Math.hypot(dx, dy) || 1;
    bras.push([e[0], e[1], e[0] + dx / d * AVANT, e[1] + dy / d * AVANT, e[2], e[3], dx / d, dy / d]);     // coude, poignet, creux des doigts, direction de la main
  }
  // Les jambes. Agrippé, les pieds serrent la liane, genoux très pliés.
  const legs = [];
  for (let j = 0; j < 2; j++) {
    const a = B.tronc + B.cuisse[j], t = dir(a); let kx = hx + t[0] * CUISSE, ky = hy + t[1] * CUISSE; const u = dir(a - B.genou[j]); let fx = kx + u[0] * JAMBE, fy = ky + u[1] * JAMBE;
    let ap = a - B.genou[j] + 1.2;                                                 // le pied : long, la pointe vers l'avant
    if (B.tient > 0.01) {
      // Perché avant le départ : les pieds sont posés sur la branche, jambes pliées. Sinon ils serrent la liane.
      const c = attend ? [M.x + (j ? 0.3 : 0.02) * K, M.y - PERCHE] : sur(clamp(lb + tl + (j ? 0.22 : 0.42) * K, 0.6, reste - 0.3)), q = joint(hx, hy, c[0], c[1], CUISSE, JAMBE, 1), w = lisse(B.tient);
      kx = lerp(kx, q[0], w); ky = lerp(ky, q[1], w); fx = lerp(fx, q[2], w); fy = lerp(fy, q[3], w); ap = lerp(ap, attend ? 1.45 : B.bas + 0.35, w);
    }
    const p = dir(ap); legs.push([kx, ky, fx, fy, fx + p[0] * PIED, fy + p[1] * PIED]);
  }
  // La tête : petite, portée en avant des épaules. Elle reste presque fixe et regarde là où il va.
  const cRegard = sw ? clamp(0.15 + M.th * 0.3 + B.elan * 0.25, -0.25, 0.7) : clamp(Math.atan2(M.vy, Math.max(5, M.vx)) * 0.5 - approche * 0.1, -0.6, 0.6);
  if (dt > 0) B.regard += (cRegard - B.regard) * Math.min(1, dt * 8);
  const cou = [sx - dT[0] * 0.15 * K + av[0] * 0.105 * K, sy - dT[1] * 0.15 * K + av[1] * 0.105 * K];
  const tete = [cou[0] + Math.cos(B.regard) * 0.035 * K, cou[1] + Math.sin(B.regard) * 0.035 * K], museau = [tete[0] + Math.cos(B.regard - 0.3) * 0.08 * K, tete[1] + Math.sin(B.regard - 0.3) * 0.08 * K];

  // ---------- La queue : une chaîne qui a du poids et des muscles ----------
  // Elle part du bas du dos. Chaque maillon cherche sa place sur une courbe voulue, d'autant plus mollement qu'on va vers le bout.
  const bx = hx - av[0] * 0.075 * K, by = hy - av[1] * 0.075 * K;
  if (!B.queue) { B.queue = []; for (let i = 0; i < QN; i++) B.queue.push({ x: bx - i * QSEG * 0.5, y: by - i * QSEG * 0.85, px: bx - i * QSEG * 0.5, py: by - i * QSEG * 0.85 }); B.qbx = bx; B.qby = by; }
  const Q = B.queue, dbx = bx - B.qbx, dby = by - B.qby; B.qbx = bx; B.qby = by;
  // Libre et pendu : elle descend derrière lui, le bout recourbé en crochet. En vol : levée derrière lui, arquée, en balancier.
  const leve = sw ? clamp(-M.om * 0.1, -0.3, 0.4) + B.elan * 0.7 : 1.0 + clamp(M.vy * 0.03, -0.35, 0.4);
  const base = B.tronc - 0.7 - leve, tour = sw ? 0.085 : -0.05, crochet = sw ? 0.3 : 0.22;
  Q[0].x = bx; Q[0].y = by; Q[0].px = bx; Q[0].py = by;
  if (dt > 0) for (let s = 0; s < n; s++) {
    let a = base;
    for (let i = 1; i < QN; i++) {
      const q = Q[i], t = i / (QN - 1);
      // L'élan du maillon est compté par rapport au corps, sinon la queue traînerait comme un ruban dès qu'il va vite.
      const vx = (q.x - q.px - dbx / n) * 0.9 + dbx / n * (1 - 0.08 * t), vy = (q.y - q.py - dby / n) * 0.9 + dby / n * (1 - 0.08 * t);
      q.px = q.x; q.py = q.y; q.x += vx; q.y += vy - C.g * 0.2 * t * h * h;
      a += tour + (t > 0.6 ? crochet * (t - 0.6) / 0.4 * 2.1 : 0);
      const o = dir(a), p = Q[i - 1], raide = 1 - Math.exp(-h * lerp(48, 8, Math.sqrt(t)));
      q.x += (p.x + o[0] * QSEG - q.x) * raide; q.y += (p.y + o[1] * QSEG - q.y) * raide;
    }
    for (let k = 0; k < 3; k++) for (let i = 1; i < QN; i++) { const p = Q[i - 1], q = Q[i]; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-4; q.x = p.x + dx / d * QSEG; q.y = p.y + dy / d * QSEG; }
  }
  // En prise : la queue va chercher la liane sous le corps et l'enlace de son dernier tiers, face nue contre elle.
  let qd = Q;
  if (B.qtient > 0.02) {
    const w = lisse(B.qtient), long = QN * QSEG, d0 = clamp(lb + tl + lerp(0.25, 0.62, B.tient) * K, 0.8, reste - 0.45 * K), c0 = sur(d0); qd = [];
    const ex = c0[0] - bx, ey = c0[1] - by, de = Math.hypot(ex, ey) || 1, mou = Math.sqrt(Math.max(0, (long * 0.62) ** 2 - de * de)) * 0.5;       // ce qu'il reste de queue fait une boucle vers l'arrière
    for (let i = 0; i < QN; i++) {
      const t = i / (QN - 1), q = Q[i]; let tx, ty;
      if (t <= 0.62) { const k = t / 0.62, b = Math.sin(k * Math.PI); tx = bx + ex * k - av[0] * mou * b; ty = by + ey * k - av[1] * mou * b - 0.04 * b; }
      else { const k = (t - 0.62) / 0.38, c = sur(d0 + k * 0.34 * K), cote = Math.sin(k * 9.6) * 0.06 * K * (1 - 0.3 * k); tx = c[0] + Math.cos(B.bas) * cote; ty = c[1] + Math.sin(B.bas) * cote; }
      qd.push({ x: lerp(q.x, tx, w), y: lerp(q.y, ty, w) });
    }
    if (dt > 0 && w > 0.5) for (let i = 1; i < QN; i++) { Q[i].x = qd[i].x; Q[i].y = qd[i].y; Q[i].px = qd[i].x - dbx; Q[i].py = qd[i].y - dby; }   // la chaîne libre repartira de là
  }
  return { px, py, sx, sy, hx, hy, mx, my, bras, legs, tete, museau, queue: qd, av, bas: B.bas, tient: B.tient, saisi: B.tS };
}

// Dessine la silhouette. X, Y : du monde vers l'écran ; S : pixels par mètre.
export function dessinerSinge(ctx, p, col, X, Y, S) {
  const u = S * K, L = (x1, y1, x2, y2) => { ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); };
  const trait = (w, x1, y1, x2, y2) => { ctx.lineWidth = u * w; ctx.beginPath(); L(x1, y1, x2, y2); ctx.stroke(); };
  ctx.strokeStyle = ctx.fillStyle = col; ctx.lineCap = ctx.lineJoin = 'round';
  // La queue : épaisse à la base, fine au bout.
  const Q = p.queue; for (let i = 1; i < Q.length; i++) { ctx.lineWidth = u * lerp(0.1, 0.036, i / Q.length); ctx.beginPath(); L(Q[i - 1].x, Q[i - 1].y, Q[i].x, Q[i].y); ctx.stroke(); }
  // Les jambes : cuisse, jambe, puis le pied, long comme une main.
  for (const l of p.legs) { trait(0.115, p.hx, p.hy, l[0], l[1]); trait(0.078, l[0], l[1], l[2], l[3]); trait(0.054, l[2], l[3], l[4], l[5]); }
  // Le tronc : court et large. La poitrine, puis le ventre et l'arrière-train, plus lourds.
  ctx.lineWidth = u * 0.245; ctx.beginPath(); ctx.moveTo(X(p.sx), Y(p.sy)); ctx.quadraticCurveTo(X(p.mx), Y(p.my), X(p.hx), Y(p.hy)); ctx.stroke();
  const vx = lerp(p.mx, p.hx, 0.3) + p.av[0] * 0.04 * K, vy = lerp(p.my, p.hy, 0.3) + p.av[1] * 0.04 * K;
  ctx.beginPath(); ctx.arc(X(vx), Y(vy), u * 0.165, 0, TAU); ctx.moveTo(X(p.hx), Y(p.hy)); ctx.arc(X(p.hx), Y(p.hy), u * 0.135, 0, TAU); ctx.moveTo(X(p.sx), Y(p.sy)); ctx.arc(X(p.sx), Y(p.sy), u * 0.125, 0, TAU); ctx.fill();
  // Les bras : très longs et fins. La main est un long crochet de quatre doigts, sans pouce.
  for (const b of p.bras) {
    trait(0.092, p.sx, p.sy, b[0], b[1]); trait(0.07, b[0], b[1], b[2], b[3]); trait(0.05, b[2], b[3], b[4], b[5]);
    const dx = b[6], dy = b[7]; ctx.lineWidth = u * 0.046; ctx.beginPath(); ctx.moveTo(X(b[4]), Y(b[5]));
    ctx.quadraticCurveTo(X(b[4] + dx * 0.085 * K), Y(b[5] + dy * 0.085 * K), X(b[4] + dx * 0.05 * K - dy * 0.075 * K), Y(b[5] + dy * 0.05 * K + dx * 0.075 * K)); ctx.stroke();
  }
  // La tête, petite et ronde, et le museau étroit.
  ctx.beginPath(); ctx.arc(X(p.tete[0]), Y(p.tete[1]), S * TETE, 0, TAU); ctx.moveTo(X(p.museau[0]), Y(p.museau[1])); ctx.arc(X(p.museau[0]), Y(p.museau[1]), u * 0.046, 0, TAU); ctx.fill();
}
