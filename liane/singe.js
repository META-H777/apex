// LIANE — le singe : un singe-araignée (Ateles) en silhouette, posé par le mouvement.
// Rien ici ne change les règles : jeu.js dit où sont les mains, ce fichier dit comment le corps suit.
//
// Les poses viennent de vrais singes-araignées filmés, étudiés image par image (voir liane/SINGE-REEL.md, partie « Ce que montrent les films ») :
//  - Suspendu, il tient par un bras tendu ET par la queue, qui s'accroche comme un second bras. Le tronc est couché entre les deux,
//    l'arrière-train en arrière, la tête devant l'épaule. L'autre bras pend. Les jambes pendent, pliées, molles, et pédalent un peu.
//  - La queue est portée derrière lui, un peu relevée, le bout recourbé. Elle garde sa courbe et ne bouge presque pas.
//    Avant de lâcher, le bras libre part vers l'avant.
//  - Le saut : corps à l'horizontale, ventre vers le bas, les deux bras tendus devant, les jambes derrière, la queue dans le prolongement.
//  - À la saisie, la main arrive la première ; le corps, lancé, passe dessous comme un poids ; la queue vient reprendre la liane.
//  - Proportions mesurées sur les films : bras (main comprise) 1,35 fois le tronc, jambe 1 fois, queue 1,5 fois, tronc épais, petite tête ronde.
import { CFG } from './jeu.js?v=10';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const dir = (a) => [Math.sin(a), -Math.cos(a)];            // 0 = vers le bas, positif = vers l'avant, négatif = vers l'arrière
const ecart = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

export const K = 1.4;                                      // le singe est dessiné plus grand que nature, pour se lire d'un coup d'œil
const TRONC = 0.66 * K, BRAS = 0.37 * K, AVANT = 0.36 * K, MAIN = 0.2 * K, CUISSE = 0.33 * K, JAMBE = 0.32 * K, PIED = 0.17 * K, TETE = 0.108 * K;
const PRISE = AVANT + MAIN * 0.85, ALLONGE = BRAS + PRISE;  // du coude, puis de l'épaule, au creux des doigts
const QN = 17, QSEG = 0.0735 * K;                          // la queue : plus longue que le tronc et la tête réunis
// Au départ il attend perché sur une branche, la liane en main : la branche est à cette distance sous ses mains.
export const PERCHE = 1.52 * K;

export function corps() {
  return { mode: null, tS: 9, tA: 9, alt: 1, bras: 0, brasV: 0, tronc: -0.4, troncV: 0, flex: 0.4, flexV: 0,
    cuisse: [0.9, 1.1], cuisseV: [0, 0], genou: [1.8, 1.9], genouV: [0, 0], h2: [0.2, 0.5], regard: 0, pret: 0, pas: 0, haut: -0.5,
    ax: 0, ay: 0, pvx: 0, pvy: 0, pv: false, bas: 0, qtient: 0, mains: 1, squash: 0, queue: null, qbx: 0, qby: 0, ox: 0, oy: 0, rx: null, ry: 0 };
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
  const attend = !!env.attend, gx = -B.ax, gy = -C.g - B.ay, G = Math.hypot(gx, gy);
  const aplomb = sw && !attend ? M.th + clamp(ecart(Math.atan2(gx, -gy), M.th), -0.3, 0.3) : Math.atan2(gx, -gy);
  const devant = env.devant ?? 99, monte = sw && M.om > 0, reste = env.reste ?? 0, tend = env.tend !== false;
  const approche = sw ? 0 : lisse(1 - (devant - 1.3) / 4.5) * (tend ? 1 : 0.3);    // en vol : 0 loin de la liane, 1 quand elle est à portée de bras
  const pente = sw ? 0 : clamp(Math.atan2(M.vy, Math.max(4, M.vx)), -0.7, 0.7);    // en vol : il monte (positif) ou il tombe
  const veutPret = monte && M.th > 0.1 && !attend;                                 // il remonte vers le lâcher : il se prépare à s'élancer
  // S'il s'attarde sur une liane (il repart en arrière), la seconde main et la queue viennent la tenir, et y restent jusqu'au lâcher.
  if (!sw || B.tS < 0.05) B.tard = false; else if (!attend && !M.depart && !monte && B.tS > 0.3) B.tard = true;
  const traine = !!B.tard;
  for (let i = 0; i < n; i++) {
    B.tS += h; B.tA += h; B.pas += h * (sw ? 3.2 : 5);
    B.pret += ((veutPret ? 1 : 0) - B.pret) * Math.min(1, h * (veutPret ? 13 : 9));
    // La queue reprend la liane un instant après la main, et la lâche la première.
    // La queue ne saisit la liane que s'il s'y attarde, et sans hâte. Dans une suite rapide de lianes elle reste derrière lui, en balancier :
    // la faire saisir et lâcher à chaque liane lui faisait faire un tour complet, comme une hélice.
    const veutQueue = false;                              // elle ne saisit plus la liane : Romain la veut presque immobile
    B.qtient += ((veutQueue ? 1 : 0) - B.qtient) * Math.min(1, h * (veutQueue ? 4 : 6));
    B.mains += (((attend || traine) ? 1 : 0) - B.mains) * Math.min(1, h * 9);
    // La direction de la queue, dans le monde : derrière lui, un peu relevée. Elle suit lentement, sans épouser les à-coups du tronc.
    // Elle ne bouge presque pas : un dixième de ce qu'elle faisait (demande de Romain du 20/11).
    const cQ = attend ? -0.5 : -1.85 + 0.3 * (sw ? M.th * 0.25 - 0.1 : 0.1 + 0.4 * pente);
    B.haut += ecart(cQ, B.haut) * Math.min(1, h * 3);
    // --- Le bras qui tient, de la main à l'épaule. Sur la liane il prolonge la corde, tendu. En vol il est pointé vers l'avant.
    const cBras = attend ? 0.06 : sw ? M.th : -1.34 + 0.45 * pente + 0.08 * approche;
    let acc = -(G / 0.75) * Math.sin(ecart(B.bras, aplomb)) * 1.2 + ecart(cBras, B.bras) * (sw ? 45 : 200) - B.brasV * (sw ? 8 : 24);
    B.brasV += acc * h; B.bras += B.brasV * h;
    // --- Le tronc, de l'épaule à l'arrière-train. Suspendu : couché en arrière, porté par la queue. En vol : à l'horizontale, dans le sens de la course.
    const cTronc = attend ? -0.42 : sw ? M.th - lerp(1.1, 1.0, B.pret) + 0.3 * B.mains : -1.4 + 0.5 * pente + 0.22 * approche;
    acc = -(G / 0.9) * Math.sin(ecart(B.tronc, aplomb)) * (sw ? 0.28 : 0.5) + ecart(cTronc, B.tronc) * (sw ? 60 : 160) - B.troncV * (sw ? 11 : 21) + (sw ? ecart(B.bras, M.th) * 14 : 0);
    B.troncV += acc * h; B.tronc += B.troncV * h;
    // --- Le coude : tendu sous la charge, à peine plié en fin de balancement ; plié quand il attend, perché.
    const cFlex = attend ? 0.5 : sw ? 0.015 + 0.04 * B.pret + 0.1 * B.mains : 0.03;
    B.flexV += ((cFlex - B.flex) * 140 - B.flexV * 20) * h; B.flex += B.flexV * h;
    // --- Les jambes (angle de la cuisse dans le monde). Suspendu : elles pendent, pliées, molles, et pédalent un peu.
    //     Avant le lâcher elles partent en arrière ; en vol elles traînent derrière le corps, puis reviennent dessous à l'approche.
    for (let j = 0; j < 2; j++) {
      const d = (j ? 1 : -1) * B.alt, ped = Math.sin(B.pas + j * Math.PI); let cC, cG;
      if (attend) { cC = 0.9 + d * 0.1; cG = 1.9; }
      else if (sw) { cC = lerp(0.42, -0.2, B.pret) + M.th * 0.35 + ped * 0.24 + d * 0.1; cG = lerp(1.25, 0.8, B.pret) - ped * 0.3 + d * 0.1; }
      else {
        cC = lerp(d > 0 ? -1.22 : -0.78, d > 0 ? -0.7 : -0.25, approche) + 0.45 * pente; cG = lerp(d > 0 ? 0.4 : 0.95, d > 0 ? 0.7 : 1.1, approche) + ped * 0.06;
        if (env.tremplin) { cC = 0.25 + d * 0.12; cG = 0.5; }                      // il tend les pieds vers la feuille
        if (B.squash > 0.02) { cC = lerp(cC, 0.95, B.squash); cG = lerp(cG, 2.0, B.squash); }
      }
      acc = -(G / 0.6) * Math.sin(ecart(B.cuisse[j], aplomb)) * (sw ? 0.5 : 0.3) + (cC - B.cuisse[j]) * (sw ? 48 : 95) - B.cuisseV[j] * (sw ? 9.5 : 15);
      B.cuisseV[j] += acc * h; B.cuisse[j] += B.cuisseV[j] * h;
      B.genouV[j] += ((cG - B.genou[j]) * (sw ? 70 : 120) - B.genouV[j] * (sw ? 12 : 17)) * h; B.genou[j] = clamp(B.genou[j] + B.genouV[j] * h, 0.05, 2.4);
    }
    B.squash = Math.max(0, B.squash - h * 4.5);
    // --- Le reste de la liane, sous les mains : il pend dans l'axe de la pesanteur ressentie, en retard.
    B.bas += ecart(sw ? aplomb : 0, B.bas) * Math.min(1, h * (sw ? 10 : 6));
  }
  if (env.tremplin && !sw) { B.tronc += ecart(-0.55, B.tronc) * Math.min(1, dt * 9); B.bras += ecart(-0.9, B.bras) * Math.min(1, dt * 9); }   // pour rebondir, il se redresse

  // ---------- Le squelette ----------
  const dB = dir(B.bras), dT = dir(B.tronc), lb = ALLONGE * (1 - 0.34 * clamp(B.flex, 0, 1));   // lb : distance main → épaule
  // En vol, c'est le corps qui garde sa trajectoire et les bras qui passent devant : quand l'épaule bouge par rapport aux mains,
  // on déplace les mains plutôt que le corps. Ce décalage se résorbe dès que la liane est en main : la main reste un instant où elle a saisi,
  // et c'est le corps qui la rattrape.
  const rx = dB[0] * lb, ry = dB[1] * lb;
  if (B.rx !== null && dt > 0) {
    if (!sw) { B.ox -= rx - B.rx; B.oy -= ry - B.ry; }
    const k = Math.exp(-dt * (sw ? 13 : 1.5 + 4 * approche)), fente = sw ? 0 : 0.45 * approche * approche;
    B.ox = fente + (B.ox - fente) * k; B.oy *= k;
  }
  B.rx = rx; B.ry = ry;
  const px = M.x + B.ox, py = M.y + B.oy, sx = px + rx, sy = py + ry;
  const tl = TRONC * (1 - B.squash * 0.1), hx = sx + dT[0] * tl, hy = sy + dT[1] * tl;
  const av = [Math.cos(B.tronc), Math.sin(B.tronc)];                               // le côté du ventre
  // La liane : vers l'accroche (au-dessus des mains) et vers son bout libre (dessous).
  let ux = 0, uy = 1; if (sw && env.ancre) { ux = env.ancre[0] - px; uy = env.ancre[1] - py; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d; }
  const dBas = dir(B.bas), sur = (d) => [px + dBas[0] * d, py + dBas[1] * d];
  // L'autre bras. Suspendu, il pend devant lui, puis part vers l'avant avant le lâcher. S'il s'attarde ou attend, il tient aussi la liane.
  // En vol, il est tendu devant, un peu sous le premier. Il est suivi par rapport à l'épaule, pour ne jamais sauter d'une image à l'autre.
  let c2;
  if (sw) {
    const pend = dir(0.55 + M.th * 0.4 + Math.sin(B.pas * 0.7) * 0.08), l = ALLONGE * 0.86, bH = clamp(M.th * 0.5 + 0.35, 0.2, 0.8);
    const libre = [lerp(pend[0] * l, Math.cos(bH) * ALLONGE * 0.97, lisse(B.pret)), lerp(pend[1] * l, Math.sin(bH) * ALLONGE * 0.97, lisse(B.pret))], k = lisse(B.mains);
    c2 = [lerp(libre[0], px + ux * 0.26 * K - sx, k), lerp(libre[1], py + uy * 0.26 * K - sy, k)];
  } else { const a = -0.1 + 0.45 * pente + 0.2 * approche, l = ALLONGE * (0.94 + 0.04 * approche); c2 = [Math.cos(a) * l, Math.sin(a) * l]; }   // déjà pointé vers l'avant : c'est lui qui mène
  { const k = dt > 0 ? Math.min(1, dt * (sw ? 16 : 20)) : 0; B.h2[0] += (c2[0] - B.h2[0]) * k; B.h2[1] += (c2[1] - B.h2[1]) * k; }
  const bras = [];
  for (const [gx0, gy0, cote] of [[sx + B.h2[0], sy + B.h2[1], sw ? 1 : -1], [px, py, -1]]) {
    const e = joint(sx, sy, gx0, gy0, BRAS, PRISE, cote), dx = e[2] - e[0], dy = e[3] - e[1], d = Math.hypot(dx, dy) || 1;
    bras.push([e[0], e[1], e[0] + dx / d * AVANT, e[1] + dy / d * AVANT, e[2], e[3], dx / d, dy / d]);     // coude, poignet, creux des doigts, direction de la main
  }
  // Les jambes partent du bas du ventre. Perché avant le départ, les pieds sont posés sur la branche.
  const jx = hx + av[0] * 0.05 * K - dT[0] * 0.06 * K, jy = hy + av[1] * 0.05 * K - dT[1] * 0.06 * K, legs = [];
  for (let j = 0; j < 2; j++) {
    const a = B.cuisse[j], t = dir(a); let kx = jx + t[0] * CUISSE, ky = jy + t[1] * CUISSE; const u = dir(a - B.genou[j]); let fx = kx + u[0] * JAMBE, fy = ky + u[1] * JAMBE;
    let ap = a - B.genou[j] + 1.1;                                                 // le pied : long, relâché, la pointe vers l'avant
    if (attend) { const q = joint(jx, jy, M.x + (j ? 0.24 : -0.02) * K, M.y - PERCHE, CUISSE, JAMBE, 1); kx = q[0]; ky = q[1]; fx = q[2]; fy = q[3]; ap = 1.5; }
    const p = dir(ap); legs.push([kx, ky, fx, fy, fx + p[0] * PIED, fy + p[1] * PIED]);
  }
  // La tête : ronde, portée devant l'épaule, dans le prolongement du dos. Elle reste presque fixe et regarde là où il va.
  const cRegard = sw ? 0.05 + M.th * 0.15 : clamp(pente * 0.5 - 0.1 - approche * 0.1, -0.5, 0.4);
  if (dt > 0) B.regard += (cRegard - B.regard) * Math.min(1, dt * 7);
  const tete = [sx - dT[0] * 0.15 * K + av[0] * 0.085 * K, sy - dT[1] * 0.15 * K + av[1] * 0.085 * K];
  const museau = [tete[0] + Math.cos(B.regard - 0.35) * 0.085 * K, tete[1] + Math.sin(B.regard - 0.35) * 0.085 * K];

  // ---------- La queue : un cinquième membre, épais, musclé ----------
  // Elle part du haut de l'arrière-train. Chaque maillon cherche sa place sur une courbe voulue, d'autant plus mollement qu'on va vers le bout.
  const bx = hx - av[0] * 0.07 * K, by = hy - av[1] * 0.07 * K;
  if (!B.queue) { B.queue = []; for (let i = 0; i < QN; i++) B.queue.push({ x: bx - i * QSEG * 0.6, y: by + i * QSEG * 0.3, px: bx - i * QSEG * 0.6, py: by + i * QSEG * 0.3 }); B.qbx = bx; B.qby = by; }
  const Q = B.queue, dbx = bx - B.qbx, dby = by - B.qby; B.qbx = bx; B.qby = by;
  // Libre : derrière lui, un peu relevée, en arc doux, le bout recourbé.
  const base = B.haut, tour = attend ? 0.02 : -0.03, crochet = attend ? 0.25 : -0.1;
  Q[0].x = bx; Q[0].y = by; Q[0].px = bx; Q[0].py = by;
  if (dt > 0) for (let s = 0; s < n; s++) {
    let a = base;
    for (let i = 1; i < QN; i++) {
      const q = Q[i], t = i / (QN - 1);
      // L'élan du maillon est compté par rapport au corps, sinon la queue traînerait comme un ruban dès qu'il va vite.
      const vx = (q.x - q.px - dbx / n) * 0.45 + dbx / n, vy = (q.y - q.py - dby / n) * 0.45 + dby / n;
      q.px = q.x; q.py = q.y; q.x += vx; q.y += vy - C.g * 0.02 * t * h * h;
      a += tour + (t > 0.6 ? crochet * (t - 0.6) / 0.4 * 2.1 : 0);
      const o = dir(a), p = Q[i - 1], raide = 1 - Math.exp(-h * lerp(150, 42, Math.sqrt(t)));      // presque rigide : elle garde sa courbe
      q.x += (p.x + o[0] * QSEG - q.x) * raide; q.y += (p.y + o[1] * QSEG - q.y) * raide;
    }
    for (let k = 0; k < 3; k++) for (let i = 1; i < QN; i++) { const p = Q[i - 1], q = Q[i]; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-4; q.x = p.x + dx / d * QSEG; q.y = p.y + dy / d * QSEG; }
  }
  // En prise (il s'attarde) : elle rejoint la liane sous lui et l'enlace sur une bonne longueur, bien visible sous le corps.
  let qd = Q;
  if (B.qtient > 0.02) {
    const w = lisse(B.qtient), f = 0.36, long = (QN - 1) * QSEG, d0 = lb + tl + 0.1 * K, c0 = sur(d0); qd = [];
    const ex = c0[0] - bx, ey = c0[1] - by, de = Math.hypot(ex, ey) || 1, lig = long * f, mou = Math.sqrt(Math.max(0, lig * lig - de * de)) * 0.45;   // ce qu'il reste de longueur fait un ventre
    const nx = -ey / de, ny = ex / de, sens = ny - nx * 0.5 >= 0 ? 1 : -1;                                                                // toujours du même côté : vers le haut et l'arrière
    for (let i = 0; i < QN; i++) {
      const t = i / (QN - 1), q = Q[i]; let tx, ty;
      if (t <= f) { const k = t / f, b = Math.sin(k * Math.PI); tx = bx + ex * k + nx * sens * mou * b; ty = by + ey * k + ny * sens * mou * b; }
      else { const k = (t - f) / (1 - f), c = sur(d0 + k * 0.48 * K), cote = Math.sin(k * 12.5) * 0.06 * K * (1 - 0.3 * k); tx = c[0] + Math.cos(B.bas) * cote; ty = c[1] + Math.sin(B.bas) * cote; }
      qd.push({ x: lerp(q.x, tx, w), y: lerp(q.y, ty, w) });
    }
    // La queue libre continue de vivre derrière lui pendant ce temps : quand elle lâche la liane, elle y revient d'un seul geste, sans fouetter.
    for (let i = 1; i < QN; i++) { const p = qd[i - 1], q = qd[i], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-4; q.x = p.x + dx / d * QSEG; q.y = p.y + dy / d * QSEG; }
  }
  return { px, py, sx, sy, hx, hy, jx, jy, bras, legs, tete, museau, queue: qd, av, bas: B.bas, saisi: B.tS };
}

// Dessine la silhouette. X, Y : du monde vers l'écran ; S : pixels par mètre.
export function dessinerSinge(ctx, p, col, X, Y, S) {
  const u = S * K, L = (x1, y1, x2, y2) => { ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); };
  const trait = (w, x1, y1, x2, y2) => { ctx.lineWidth = u * w; ctx.beginPath(); L(x1, y1, x2, y2); ctx.stroke(); };
  ctx.strokeStyle = ctx.fillStyle = col; ctx.lineCap = ctx.lineJoin = 'round';
  // La queue : aussi épaisse qu'un bras à la base, plus fine vers le bout.
  const Q = p.queue; for (let i = 1; i < Q.length; i++) { ctx.lineWidth = u * lerp(0.105, 0.045, i / Q.length); ctx.beginPath(); L(Q[i - 1].x, Q[i - 1].y, Q[i].x, Q[i].y); ctx.stroke(); }
  // Les jambes : cuisse forte, jambe fine, long pied.
  for (const l of p.legs) { trait(0.125, p.jx, p.jy, l[0], l[1]); trait(0.08, l[0], l[1], l[2], l[3]); trait(0.055, l[2], l[3], l[4], l[5]); }
  // Le tronc : un tonneau allongé, le ventre rond, l'arrière-train lourd.
  const mx = (p.sx + p.hx) / 2 + p.av[0] * 0.035 * K, my = (p.sy + p.hy) / 2 + p.av[1] * 0.035 * K;
  ctx.lineWidth = u * 0.26; ctx.beginPath(); ctx.moveTo(X(p.sx), Y(p.sy)); ctx.quadraticCurveTo(X(mx), Y(my), X(p.hx), Y(p.hy)); ctx.stroke();
  const vx = lerp(mx, p.hx, 0.35) + p.av[0] * 0.045 * K, vy = lerp(my, p.hy, 0.35) + p.av[1] * 0.045 * K;
  ctx.beginPath(); ctx.arc(X(vx), Y(vy), u * 0.16, 0, TAU); ctx.moveTo(X(p.hx), Y(p.hy)); ctx.arc(X(p.hx), Y(p.hy), u * 0.14, 0, TAU); ctx.moveTo(X(p.sx), Y(p.sy)); ctx.arc(X(p.sx), Y(p.sy), u * 0.13, 0, TAU); ctx.fill();
  // Les bras : longs, droits. La main est un crochet de quatre doigts, sans pouce.
  for (const b of p.bras) {
    trait(0.1, p.sx, p.sy, b[0], b[1]); trait(0.076, b[0], b[1], b[2], b[3]); trait(0.056, b[2], b[3], b[4], b[5]);
    const dx = b[6], dy = b[7]; ctx.lineWidth = u * 0.048; ctx.beginPath(); ctx.moveTo(X(b[4]), Y(b[5]));
    ctx.quadraticCurveTo(X(b[4] + dx * 0.07 * K), Y(b[5] + dy * 0.07 * K), X(b[4] + dx * 0.04 * K - dy * 0.06 * K), Y(b[5] + dy * 0.04 * K + dx * 0.06 * K)); ctx.stroke();
  }
  // La tête, ronde, et le museau.
  ctx.beginPath(); ctx.arc(X(p.tete[0]), Y(p.tete[1]), S * TETE, 0, TAU); ctx.moveTo(X(p.museau[0]), Y(p.museau[1])); ctx.arc(X(p.museau[0]), Y(p.museau[1]), u * 0.052, 0, TAU); ctx.fill();
}
