// LIANE — les danses de victoire, deuxième version (21/11/2026).
// Romain trouvait les premières « presque en 2D, sans mouvement travaillé » : le singe entier tournait comme une image.
// Ici le singe a un vrai squelette en trois dimensions : bassin, buste, tête, deux bras, deux jambes, une queue.
// Il pivote sur lui-même, ses membres passent devant et derrière son corps, ses pieds restent posés sur la branche.
// Chaque danse est écrite image clé par image clé, en temps (une danse = 8 temps à 120 battements par minute, 4 secondes),
// avec ce qui fait un mouvement vivant : l'élan avant le geste, l'appui qui encaisse la réception, les gestes qui frappent puis tiennent,
// et ce qui suit avec retard (les mains, la tête, la queue).
// Toutes les chorégraphies sont d'origine, faites pour un singe-araignée : ni reprises d'un jeu, ni d'un artiste.

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
// ---------- Un peu de géométrie : des vecteurs [x, y, z]. x vers la droite de l'écran, y vers le haut, z vers le spectateur. ----------
const ad = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sb = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], fo = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], vc = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lg = (a) => Math.hypot(a[0], a[1], a[2]), un = (a) => { const l = lg(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, mx = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
// Tourne v autour de l'axe k (unitaire) de l'angle a.
const tr = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), d = pt(k, v) * (1 - c), x = vc(k, v); return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d]; };
const HAUT = [0, 1, 0];
// o + a·ka + b·kb + c·kc, dans le repère (a, b, c)
const rep = (o, a, ka, b, kb, c, kc) => [o[0] + a[0] * ka + b[0] * kb + c[0] * kc, o[1] + a[1] * ka + b[1] * kb + c[1] * kc, o[2] + a[2] * ka + b[2] * kb + c[2] * kc];

// Un membre à deux os : de a vers la cible t, le coude (ou le genou) du côté du point pole. Rend le coude et le bout atteint.
function ik(a, t, l1, l2, pole) {
  // Près de l'extension complète, la portée est adoucie : sans cela le coude claque d'un coup quand le bras se tend.
  const d = sb(t, a), dist = lg(d) || 1e-6, n = fo(d, 1 / dist), L = l1 + l2, s0 = 0.88 * L;
  const m = clamp(dist < s0 ? dist : s0 + (L - s0) * (1 - Math.exp(-(dist - s0) / (L - s0))), Math.abs(l1 - l2) + 1e-3, L - 1e-3);
  const x = (l1 * l1 - l2 * l2 + m * m) / (2 * m), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let p = sb(pole, a); p = sb(p, fo(n, pt(p, n))); if (lg(p) < 1e-5) p = vc(n, [0, 0, 1]); p = un(p);
  return [rep(a, n, x, p, h, n, 0), ad(a, fo(n, m))];
}

// ---------- La pose : ce qu'une danse dit à chaque instant ----------
// Le bassin : x (vers sa droite), z (vers l'avant), y (vers le haut ; 0 debout), en longueurs de jambe, dans le repère des pieds.
// yaw : où il regarde (0 de profil vers la droite de l'écran, 1,57 face au spectateur). lean : penché en avant. roll : bassin basculé vers sa droite.
// salto : un tour en arrière ou en avant autour du bassin. bend, side, twist : le buste par rapport au bassin (en avant, sur le côté, en torsion).
// nod, turn, tilt : la tête (baissée, tournée, inclinée). md, mg : la main droite et la main gauche [avant, haut, dehors], en longueurs de bras, depuis l'épaule.
// cd, cg : vers où pointe le coude. pd, pg : les pieds sur la branche [avant, dehors, levé], en longueurs de jambe ; pied : leur orientation (sinon celle du corps).
// vol : 0 les pieds sont posés, 1 les jambes suivent le corps en l'air, vers ad, ag [avant, haut, dehors] depuis la hanche.
// ql, qc, qs, qw, qf : la queue (relevée, enroulée, sur le côté, l'ampleur et la fréquence de son ondulation). vib : un frisson de puissance.
export const NEUTRE = { x: 0, y: 0, z: 0, fx: 0, fz: 0, yaw: 0.8, lean: 0.12, roll: 0, salto: 0, bend: 0.06, side: 0, twist: 0, nod: 0.06, turn: 0, tilt: 0,
  md: [0.1, -0.88, 0.17], mg: [0.1, -0.88, 0.17], cd: [-0.35, -0.35, 0.85], cg: [-0.35, -0.35, 0.85], pd: [0.02, 0.17, 0], pg: [0.02, 0.17, 0],
  vol: 0, ad: [0.3, -0.6, 0.08], ag: [0.3, -0.6, 0.08], ql: 0.28, qc: 0.09, qs: 0, qw: 0.12, qf: 0.8, vib: 0,
  // Pour les gestes à deux (gestes.js) : wd, wg, une main posée en un point précis de la scène [x, y, z] en mètres (vers l'autre, vers le haut, vers nous),
  // avec kd, kg de 0 (la main suit le corps) à 1 (elle est en ce point) ; fd, fg la forme de la main ; od, og ce qu'elle tient.
  // Pas de bulles au-dessus des têtes ni d'effets de dessin animé (retour de Romain, 21/11) : tout passe par le corps.
  wd: [0, 1, 0], wg: [0, 1, 0], kd: 0, kg: 0, fd: 0, fg: 0, od: 0, og: 0 };
const META = new Set(['t', 'e', 'arc', 'stop']);
// Les canaux qui changent d'un coup, sans transition : une main est un poing ou ne l'est pas.
const SAUT = new Set(['fd', 'fg', 'od', 'og']);
const RESTE = [];             // ce qu'un geste laisserait sur le singe jusqu'à la fin de la scène (plus rien depuis la v0.22)
export const MAIN = { ouverte: 0, poing: 1, doigt: 2, rond: 3, index: 4, pouce: 5, v: 6 };
// Ce qu'une main tient. La banane passe par trois états (épluchée, croquée, il ne reste que la peau) ;
// le ruban, tenu d'une main, se tend jusqu'au boîtier du mètre tenu de l'autre.
export const OBJET = { rien: 0, banane: 1, pelee: 2, croquee: 3, peau: 4, piece: 5, metre: 6, ruban: 7, carnet: 8, crayon: 9 };

// Une danse écrite devient, pour chaque canal, une suite de clés triées. Une boucle se referme sur sa première clé
// (plus un tour entier pour les canaux de rotation qui le demandent, dans boucle).
export function compiler(def, ferme = true) {
  const T = def.temps || 0.5, D = def.duree, C = {};
  for (const k of def.cles) for (const c in k) {
    if (META.has(c)) continue;
    (C[c] = C[c] || []).push({ t: k.t * T, v: Array.isArray(k[c]) ? k[c].slice() : [k[c]], e: k.e, arc: c === 'y' ? k.arc : 0, stop: !!k.stop });
  }
  for (const c in C) {      // deux clés au même instant : la dernière écrite l'emporte
    const L = C[c].sort((a, b) => a.t - b.t).filter((k, i, T) => !(T[i + 1] && T[i + 1].t - k.t < 1e-6)), o = (def.boucle && def.boucle[c]) || 0, n0 = NEUTRE[c] ?? 0, z = Array.isArray(n0) ? n0 : [n0];
    const b0 = def.base && c in def.base ? (Array.isArray(def.base[c]) ? def.base[c] : [def.base[c]]) : z;
    // Dans un geste à deux, un canal garde sa pose de base jusqu'à un tiers de seconde avant sa première clé : sinon il y glisserait dès le début.
    if (!ferme && def.base && L[0].t > 0.36) L.unshift({ t: L[0].t - 0.3, v: b0.slice(), e: 'io', arc: 0, stop: true });
    if (L[0].t > 1e-6) L.unshift({ t: 0, v: (ferme ? z : def.base ? b0 : L[0].v).slice(), e: 'cr', arc: 0, stop: false });
    if (ferme && L[L.length - 1].t < D - 1e-6) L.push({ t: D, v: L[0].v.map((v) => v + o), e: 'cr', arc: 0, stop: false });
    // Un geste à deux revient à la pose de base à sa fin (sauf s'il demande à garder sa dernière pose : il s'est assis, il a tourné le dos).
    if (!ferme && def.base && !def.garde && !RESTE.includes(c) && L[L.length - 1].t < D - 1e-6) L.push({ t: D, v: b0.slice(), e: 'io', arc: 0, stop: false });
    C[c] = { L, o };
  }
  // Les mains gardent aussi leur distance à l'épaule : entre deux clés, la main tourne autour de l'épaule au lieu de passer au ras du corps.
  for (const c of ['md', 'mg']) if (C[c]) C[c + 'r'] = { L: C[c].L.map((k) => ({ ...k, v: [Math.hypot(...k.v)] })), o: 0 };
  // Le ralenti : lent = [de, à, vitesse], en secondes du geste écrit. Entre ces deux instants, le geste est joué plus lentement ;
  // il dure d'autant plus longtemps (D), et les deux singes d'un même geste ralentissent ensemble.
  const lent = !ferme && def.lent ? def.lent : null, Dr = lent ? D + (lent[1] - lent[0]) * (1 / lent[2] - 1) : D;
  return { D: Dr, Da: D, lent, C, ferme, def, base: def.base || null };
}
// Du temps vécu vers le temps du geste écrit.
function ecrit(l, u) { const [a, b, f] = l, b2 = a + (b - a) / f; return u <= a ? u : u < b2 ? a + (u - a) * f : u - (b2 - b); }
export const dureeReelle = (duree, lent) => lent ? duree + (lent[1] - lent[0]) * (1 / lent[2] - 1) : duree;
const COURBE = { io: lisse, hit: (k) => 1 - Math.pow(1 - k, 3), out: (k) => k * k, lin: (k) => k, step: (k) => (k < 1 ? 0 : 1),
  back: (k) => { const s = 1.7; k -= 1; return 1 + k * k * ((s + 1) * k + s); } };
// La valeur d'un canal à l'instant u.
function canal(X, c, u, D, ferme) {
  const { L, o } = X, n = L.length;
  if (u <= L[0].t) return L[0].v; if (u >= L[n - 1].t) return L[n - 1].v;
  let i = 0; while (i < n - 2 && L[i + 1].t <= u) i++;
  if (SAUT.has(c)) return L[i].v;
  const a = L[i], b = L[i + 1], dt = b.t - a.t, k = (u - a.t) / dt, out = [];
  // La pente en une clé : celle de ses voisines (Catmull-Rom) ; nulle si la clé est un arrêt, ou au bout d'un geste qui ne boucle pas.
  const pente = (j, comp) => {
    const q = L[j]; if (q.stop) return 0;
    let p, s; if (j > 0) p = L[j - 1]; else if (ferme) p = { t: L[n - 2].t - D, v: L[n - 2].v.map((v) => v - o) }; else return 0;
    if (j < n - 1) s = L[j + 1]; else if (ferme) s = { t: L[1].t + D, v: L[1].v.map((v) => v + o) }; else return 0;
    return (s.v[comp] - p.v[comp]) / (s.t - p.t);
  };
  for (let m = 0; m < a.v.length; m++) {
    const v0 = a.v[m], v1 = b.v[m];
    if (b.arc) { out.push(lerp(v0, v1, k) + 4 * b.arc * k * (1 - k)); continue; }
    const f = COURBE[b.e];
    if (f) { out.push(lerp(v0, v1, f(k))); continue; }
    const m0 = pente(i, m) * dt, m1 = pente(i + 1, m) * dt, k2 = k * k, k3 = k2 * k;
    out.push((2 * k3 - 3 * k2 + 1) * v0 + (k3 - 2 * k2 + k) * m0 + (-2 * k3 + 3 * k2) * v1 + (k3 - k2) * m1);
  }
  return out;
}
function poseA(P, u) {
  const r = {}; let cycle = 0;
  if (P.ferme) { cycle = Math.floor(u / P.D); u -= cycle * P.D; } else if (P.lent) u = ecrit(P.lent, u);
  const D = P.Da || P.D;
  for (const c in NEUTRE) {
    const X = P.C[c]; if (!X) { r[c] = P.base && c in P.base ? P.base[c] : NEUTRE[c]; continue; }
    const v = canal(X, c, u, D, P.ferme); r[c] = v.length > 1 ? v : v[0] + X.o * cycle;
  }
  for (const c of ['md', 'mg']) if (P.C[c + 'r']) { const l = canal(P.C[c + 'r'], c, u, D, P.ferme)[0], v = r[c], n = Math.hypot(...v) || 1; if (n < l) r[c] = v.map((x) => x * l / n); }
  r.pied = P.C.pied ? canal(P.C.pied, 'pied', u, D, P.ferme)[0] + P.C.pied.o * cycle : r.yaw;
  return r;
}

// ---------- Le squelette ----------
// m : les mesures de l'espèce (singe.js, morpho). P : la pose. tau : l'horloge, pour les ondulations.
// Rend les articulations, dans le repère de la danse : l'origine est sur la branche, entre les pieds.
function squelette(m, P, tau, avant = null) {
  const { K, TRONC, BRAS, AVANT, PRISE, CUISSE, JAMBE, PIED, TETE } = m, L = CUISSE + JAMBE, A = m.ALLONGE, H0 = 0.93 * L + PIED * 0.22;
  const roll = P.roll + P.vib * Math.sin(tau * 71), twist = P.twist + P.vib * 0.7 * Math.sin(tau * 53);
  const Ff = [Math.cos(P.pied), 0, Math.sin(P.pied)], Rf = vc(Ff, HAUT), O = [P.fx * L, 0, P.fz * L];
  const B = rep(O, Rf, P.x * L, Ff, P.z * L, HAUT, H0 + P.y * L);
  // Le bassin : tourné (yaw), penché (lean, salto), basculé (roll).
  const F0 = [Math.cos(P.yaw), 0, Math.sin(P.yaw)], R0 = vc(F0, HAUT), pitch = P.lean + P.salto;
  let Fp = tr(F0, R0, -pitch), Up = tr(HAUT, R0, -pitch), Rp = R0; Up = tr(Up, Fp, roll); Rp = tr(Rp, Fp, roll);
  // Le buste, par rapport au bassin.
  let Fc = tr(Fp, Rp, -P.bend), Uc = tr(Up, Rp, -P.bend), Rc = Rp;
  Uc = tr(Uc, Fc, P.side); Rc = tr(Rc, Fc, P.side); Fc = tr(Fc, Uc, -twist); Rc = tr(Rc, Uc, -twist);
  const S = ad(B, fo(un(ad(fo(Up, 0.45), fo(Uc, 0.55))), TRONC));
  // La tête.
  let Fh = tr(Fc, Uc, -P.turn), Rh = tr(Rc, Uc, -P.turn), Uh = Uc; Fh = tr(Fh, Rh, -P.nod); Uh = tr(Uh, Rh, -P.nod); Uh = tr(Uh, Fh, P.tilt);
  const tete = rep(S, Uc, 0.07 * K, Uh, TETE * 0.8, Fh, TETE * 0.3);
  // Les bras : l'épaule, le coude, le poignet, le creux des doigts. s : +1 le bras droit, -1 le gauche.
  const bras = {}, jambes = {};
  for (const [cote, s, h, c] of [['d', 1, P.md, P.cd], ['g', -1, P.mg, P.cg]]) {
    const ep = rep(S, Rc, s * 0.075 * K, Fc, -0.012 * K, Uc, -0.02 * K);
    // Le coude pointe vers c ; et aussi un peu là où il était à l'image d'avant : quand le bras passe dans l'axe de c, il ne saute pas de l'autre côté.
    let cible = rep(ep, Fc, h[0] * A, Uc, h[1] * A, Rc, s * h[2] * A); const vu = avant && avant.bras[cote][1], kw = clamp(s > 0 ? P.kd : P.kg, 0, 1);
    if (kw > 0) cible = mx(cible, s > 0 ? P.wd : P.wg, kw);
    const pole = ad(ad(ep, un([Fc[0] * c[0] + Uc[0] * c[1] + Rc[0] * s * c[2], Fc[1] * c[0] + Uc[1] * c[1] + Rc[1] * s * c[2], Fc[2] * c[0] + Uc[2] * c[1] + Rc[2] * s * c[2]])), vu ? fo(un(sb(vu, ep)), 0.7) : [0, 0, 0]);
    const [co, bout] = ik(ep, cible, BRAS, PRISE, pole), dm = un(sb(bout, co));
    bras[cote] = [ep, co, ad(co, fo(dm, AVANT)), bout];
  }
  // Les jambes : la hanche, le genou, la cheville, la pointe du pied.
  for (const [cote, s, p, a] of [['d', 1, P.pd, P.ad], ['g', -1, P.pg, P.ag]]) {
    const ha = rep(B, Rp, s * 0.065 * K, Up, -0.03 * K, Fp, 0);
    const sol = rep(O, Ff, p[0] * L, Rf, s * p[1] * L, HAUT, p[2] * L + PIED * 0.22), air = rep(ha, Fp, a[0] * L, Up, a[1] * L, Rp, s * a[2] * L);
    const v = clamp(P.vol, 0, 1), cheville = mx(sol, air, v), avant = un(mx(Ff, Fp, v)), cote3 = un(mx(Rf, Rp, v));
    const [ge, bout] = ik(ha, cheville, CUISSE, JAMBE, rep(ha, avant, L, cote3, s * 0.3 * L, HAUT, 0));
    // Le pied : à plat sur la branche ; pointé vers le bas quand il se lève ou qu'il est en l'air.
    const pointe = lerp(clamp(p[2] * 6, 0, 1) * 0.9, 1.0, v), dirp = un(ad(fo(avant, Math.cos(pointe)), fo(un(mx(HAUT, Up, v)), -Math.sin(pointe))));
    jambes[cote] = [ha, ge, bout, ad(bout, fo(dirp, PIED))];
  }
  // La queue : la direction voulue de chaque maillon. Elle part de l'arrière du bassin, relevée de ql, s'enroule de qc à chaque maillon, et ondule.
  const qb = rep(B, Fp, -0.075 * K, Up, 0.03 * K, Rp, 0), cible = [qb];
  if (m.QN > 1) {
    let d = tr(tr(fo(Fp, -1), Rp, -P.ql), Up, P.qs);
    for (let i = 1; i < m.QN; i++) {
      const t = i / (m.QN - 1), w = P.qw * Math.sin(TAU * P.qf * tau - i * 0.45) * (0.3 + 0.7 * t);
      d = un(tr(d, Rp, -(P.qc * (t > 0.55 ? 2.2 : 0.6) + w * 0.35)));
      cible.push(ad(cible[i - 1], fo(d, m.QSEG)));
    }
  }
  return { B, S, tete, Fc, Uc, Rc, Fh, Uh, bras, jambes, cible, Fp, Up, forme: { d: P.fd, g: P.fg }, objet: { d: P.od, g: P.og } };
}

// ---------- Un danseur : la danse en cours, ce qui suit avec retard (mains, tête, queue) ----------
// Les mains et la tête sont tenues par des ressorts : elles arrivent un rien après le corps et dépassent un peu leur but avant de s'y poser.
const RESSORTS = { md: [34, 0.62], mg: [34, 0.62], nod: [24, 0.55], turn: [24, 0.6], tilt: [24, 0.6] };
function ressort(r, c, h, w, z) { for (let i = 0; i < c.length; i++) { r.v[i] += ((c[i] - r.x[i]) * w * w - 2 * z * w * r.v[i]) * h; r.x[i] += r.v[i] * h; } }

export const INTRO = 1.35;            // le lâcher et la réception, avant la danse
// m : les mesures. id : la danse. depuis (facultatif) : la pose du singe pendu à sa liane, pour que la danse en parte sans à-coup.
// Un singe sans danse : il prend la pose donnée (un geste compilé), par exemple l'attente avant le duel.
export function acteur(m, P) { return { m, d: null, P, intro: null, t: 0, r: null, q: null, J: null, ventre: false, face: 1 }; }
// Un singe qui lâche sa liane, se reçoit sur la branche, puis prend la pose P (un geste compilé, souvent une attente qui boucle).
export function atterrir(m, depuis, P) {
  const e = acteur(m, P); e.intro = introDepuis(m, depuis);
  if (depuis.queue && depuis.queue.length === m.QN) e.q = depuis.queue.map((q) => ({ p: [q.x, q.y, 0], v: [0, 0, 0] }));
  return e;
}
export function danseur(m, id, depuis = null) {
  const d = danseDe(id), e = { m, d, P: compiler(d), intro: null, t: 0, r: null, q: null, J: null, ventre: false, face: 1 };
  if (depuis) { e.intro = introDepuis(m, depuis); if (depuis.queue && depuis.queue.length === m.QN) e.q = depuis.queue.map((q) => ({ p: [q.x, q.y, 0], v: [0, 0, 0] })); }
  return e;
}
// Un geste après l'autre : jouer() pose un nouveau geste, qui part de la pose où le singe se trouve (fondu d'un quart de seconde).
// Un geste qui ne boucle pas appelle ensuite fin(e), qui peut en jouer un autre ; sinon le singe garde sa dernière pose.
export function jouer(e, P, fin = null, fondu = 0.28) { e.P = P; e.intro = null; e.sorti = true; e.t = 0; e.fin = fin; e.depuis = e.pose ? { ...e.pose } : null; e.fondu = fondu; }
// Le singe est libre : il a fini sa réception et ne joue pas un geste à deux (il attend ou il danse, en boucle).
export const libre = (e) => (!e.intro || e.t >= INTRO) && e.P.ferme;
const ANGLES = ['yaw', 'pied', 'salto'];
function melange(a, b, k) {
  const r = {};
  for (const c in b) {
    const x = a[c], y = b[c]; if (x === undefined) { r[c] = y; continue; }
    if (Array.isArray(y)) r[c] = y.map((v, i) => lerp(x[i], v, k));
    else if (SAUT.has(c)) r[c] = k < 0.5 ? x : y;
    else if (ANGLES.includes(c)) { let d = x - y; d -= Math.round(d / TAU) * TAU; r[c] = y + d * (1 - k); }
    else r[c] = lerp(x, y, k);
  }
  return r;
}
export function avancer(e, dt) {
  dt = clamp(dt, 0, 0.1); e.t += dt;
  if (!e.reste) e.reste = {};
  if (!e.intro && !e.P.ferme && e.fin && e.t >= e.P.D) { const f = e.fin; e.fin = null; e.t -= e.P.D; if (e.pose) for (const c of RESTE) e.reste[c] = Math.max(e.reste[c] || 0, e.pose[c] || 0); f(e); }
  // u : le temps dans le geste en cours (après la réception, s'il y en a une). À la sortie de la réception, on fond la pose vers le geste.
  const u = e.intro ? e.t - INTRO : e.t;
  if (e.intro && u >= 0 && !e.sorti) { e.sorti = true; e.depuis = e.pose ? { ...e.pose } : null; e.fondu = 0.35; }
  let P = e.intro && u < 0 ? poseA(e.intro, e.t) : poseA(e.P, u);
  if (e.depuis && u >= 0 && u < e.fondu) P = melange(e.depuis, P, lisse(u / e.fondu));
  for (const c of RESTE) P[c] = Math.max(P[c] || 0, e.reste[c] || 0);
  // Les ressorts : pas fins, pour rester stables même quand l'image saute.
  if (!e.r) { e.r = {}; for (const c in RESSORTS) { const v = Array.isArray(P[c]) ? P[c].slice() : [P[c]]; e.r[c] = { x: v.slice(), v: v.map(() => 0) }; } }
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (const c in RESSORTS) { const v = Array.isArray(P[c]) ? P[c] : [P[c]], [w, z] = RESSORTS[c]; for (let i = 0; i < n; i++) ressort(e.r[c], v, h, w, z); P[c] = v.length > 1 ? e.r[c].x.slice() : e.r[c].x[0]; }
  const J = squelette(e.m, P, e.t, e.J);
  // La queue suit sa forme voulue avec d'autant plus de retard qu'on va vers le bout : c'est elle qui prolonge chaque geste.
  const Q = J.cible, N = Q.length;
  if (!e.q || e.q.length !== N) e.q = Q.map((p) => ({ p: p.slice(), v: [0, 0, 0] }));
  if (dt > 0) for (let s = 0; s < n; s++) {
    e.q[0].p = Q[0].slice();
    for (let i = 1; i < N; i++) {
      const q = e.q[i], t = i / (N - 1), w = lerp(70, 15, Math.sqrt(t)), z = 0.55;
      for (let k = 0; k < 3; k++) { q.v[k] += ((Q[i][k] - q.p[k]) * w * w - 2 * z * w * q.v[k]) * h; q.p[k] += q.v[k] * h; }
    }
    for (let i = 1; i < N; i++) { const p = e.q[i - 1].p, q = e.q[i].p, d = sb(q, p), l = lg(d) || 1e-6; e.q[i].p = ad(p, fo(d, e.m.QSEG / l)); }
  }
  J.queue = e.q.map((q) => q.p); e.J = J; e.pose = P;
  return J;
}
// Le plus haut point du danseur, en mètres au-dessus de la branche.
export const sommet = (J) => Math.max(J.tete[1] + 0.2, J.bras.d[3][1], J.bras.g[3][1]);

// ---------- Le lâcher et la réception ----------
// p : la pose du singe pendu (singe.js), dans le repère de la danse (l'origine sur la branche, sous son bassin).
function introDepuis(m, p) {
  const { K, TRONC, CUISSE, JAMBE, PIED } = m, L = CUISSE + JAMBE, A = m.ALLONGE, H0 = 0.93 * L + PIED * 0.22;
  const lean = Math.atan2(p.sx - p.hx, p.sy - p.hy), F = [Math.cos(lean), -Math.sin(lean)], U = [Math.sin(lean), Math.cos(lean)];
  const S = [p.hx + U[0] * TRONC, p.hy + U[1] * TRONC];      // l'épaule du squelette : à une longueur de tronc du bassin
  const main = (x, y, s) => [((x - S[0]) * F[0] + (y - S[1]) * F[1]) / A, ((x - S[0]) * U[0] + (y - S[1]) * U[1]) / A, s];
  const hanche = [p.hx - U[0] * 0.03 * K, p.hy - U[1] * 0.03 * K], pied = (l) => [((l[2] - hanche[0]) * F[0] + (l[3] - hanche[1]) * F[1]) / L, ((l[2] - hanche[0]) * U[0] + (l[3] - hanche[1]) * U[1]) / L, 0.06];
  const tient = p.qui === 0 ? 'md' : 'mg', libre = p.qui === 0 ? 'mg' : 'md', b0 = p.bras[p.qui], b1 = p.bras[1 - p.qui];
  const k0 = { t: 0, y: (p.hy - H0) / L, x: 0, z: p.hx / L, yaw: 0, lean, bend: 0, roll: 0, side: 0, twist: 0, nod: 0.12, turn: 0, tilt: 0, vol: 1,
    [tient]: main(b0[4], b0[5], 0.04), [libre]: main(b1[4], b1[5], 0.12), ad: pied(p.legs[1]), ag: pied(p.legs[0]), ql: 0.35, qc: 0.08, qw: 0.05 };
  const cles = [k0,
    { t: 0.16, [libre]: main(b1[4], b1[5] + 0.15, 0.3), nod: 0.0 },
    { t: 0.22, y: k0.y, z: k0.z, lean, [tient]: k0[tient], vol: 1, yaw: 0, stop: true },
    { t: 0.45, ad: [0.12, -0.92, 0.1], ag: [0.05, -0.95, 0.1], vol: 0.7, md: [0.15, 0.62, 0.55], mg: [0.15, 0.62, 0.55], ql: 0.95 },
    { t: 0.62, y: -0.3, z: 0, e: 'out', vol: 0, lean: 0.45, yaw: 0.3, md: [0.45, -0.05, 0.6], mg: [0.45, -0.05, 0.6], nod: 0.25 },
    { t: 0.82, y: -0.34, lean: 0.5, stop: true, md: [0.32, -0.5, 0.4], mg: [0.32, -0.5, 0.4] },
    { t: 1.2, y: 0, lean: 0.12, nod: 0.06, yaw: 0.8, e: 'io' },
    { t: 1.35, ...NEUTRE }];
  return compiler({ duree: INTRO, temps: 1, cles }, false);
}

// ---------- Dessiner ----------
// X(x, z), Y(y) : du repère de la danse vers l'écran. Z : pixels par mètre. peau : la tenue (peau.js), ou rien : la silhouette, de la couleur encre.
const NIV = 4;
function morceau(ctx, jeu, f, x1, y1, x2, y2, sw, miroir) {
  const pl = Math.hypot(f.bx - f.ax, f.by - f.ay), sl = Math.max(Math.hypot(x2 - x1, y2 - y1) / pl, sw * 0.35);
  const n = clamp(Math.floor(Math.log2(1 / Math.max(sw, 1e-3))), 0, NIV - 1), q = 1 << n;
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1)); ctx.scale(sl, sw * (miroir ? -1 : 1)); ctx.rotate(-Math.atan2(f.by - f.ay, f.bx - f.ax));
  ctx.drawImage(jeu[n], f.x / q, f.y / q, f.w / q, f.h / q, -f.ax, -f.ay, f.w, f.h); ctx.restore();
}
export function dessinerDanseur(ctx, e, peau, encre, X, Y, Z, mir = false) {
  const J = e.J; if (!J) return; const m = e.m, K = m.K, P = (p) => [X(p[0], p[2]), Y(p[1])];
  const habille = peau && peau.pret, f = habille && peau.f, A = habille && peau.allure, zc = (J.B[2] + J.S[2]) / 2;
  // Plus un membre est loin derrière le corps, plus il est dans l'ombre.
  const clair = (z) => clamp((z - zc) / 0.12 + 0.6, 0, 1);
  // long : la longueur, dans le monde, de l'os qui donne l'échelle de la pièce (ref : la pièce de cet os, sinon elle-même).
  const piece = (nom, a, b, long, large, miroir, z, ref = nom) => {
    const [x1, y1] = P(a), [x2, y2] = P(b);
    if (!habille) { ctx.lineWidth = large; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return; }
    const fi = f[nom], fr = f[ref], sw = long * Z / Math.hypot(fr.bx - fr.ax, fr.by - fr.ay), k = clair(z), ga = ctx.globalAlpha;
    if (k > 0.02) morceau(ctx, peau.clair, fi, x1, y1, x2, y2, sw, miroir);
    if (k < 0.98) { ctx.globalAlpha = ga * (1 - k); morceau(ctx, peau.sombre, fi, x1, y1, x2, y2, sw, miroir); ctx.globalAlpha = ga; }
  };
  const u = Z * K, a0 = ctx.globalAlpha; ctx.strokeStyle = ctx.fillStyle = encre; ctx.lineCap = ctx.lineJoin = 'round';
  const items = [];
  // La queue.
  if (J.queue.length > 1) items.push({ z: (J.queue[1][2] + J.queue[Math.min(4, J.queue.length - 1)][2]) / 2 - 0.02, f: () => queue(ctx, J.queue.map(P), peau, u, m, encre) });
  // Les jambes.
  for (const c of ['d', 'g']) {
    const [h, g, ch, po] = J.jambes[c];
    items.push({ z: (h[2] + g[2] + ch[2]) / 3, f: () => {
      const z = (h[2] + g[2] + ch[2]) / 3; piece('jambe', g, ch, m.JAMBE, u * 0.08, false, z); piece('pied', ch, po, m.JAMBE, u * 0.055, false, z, 'jambe'); piece('cuisse', h, g, m.CUISSE, u * 0.125, false, z);
    } });
  }
  // Le tronc : le ventre doré du côté où il regarde.
  items.push({ z: zc, f: () => {
    const [x1, y1] = P(J.S), [x2, y2] = P(J.B), [bx, by] = P(ad(J.S, fo(J.Fc, 0.3))), vx = bx - x1, vy = by - y1, dx = x2 - x1, dy = y2 - y1;
    const c = -dy * vx + dx * -vy, l = Math.hypot(vx, vy) * Math.hypot(dx, dy) + 1e-6; if (Math.abs(c / l) > 0.25) e.ventre = c < 0;
    if (!habille) { ctx.lineWidth = u * 0.26; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.beginPath(); ctx.arc(lerp(x1, x2, 0.62), lerp(y1, y2, 0.62), u * 0.15, 0, TAU); ctx.fill(); return; }
    const fi = f.tronc, sw = m.TRONC * Z / Math.hypot(fi.bx - fi.ax, fi.by - fi.ay); morceau(ctx, peau.clair, fi, x1, y1, x2, y2, sw * A.tronc, e.ventre);
  } });
  // La tête : de profil, tournée du côté où regarde son museau.
  items.push({ z: J.tete[2] + 0.03, f: () => {
    const [x, y] = P(J.tete), [ux, uy] = P(ad(J.tete, fo(J.Uh, 0.1))), [fx] = P(ad(J.tete, fo(J.Fh, 0.1))), vx = ux - x, vy = uy - y, l = Math.hypot(vx, vy) || 1;
    if (Math.abs(fx - x) > 0.25 * l) e.face = fx > x ? 1 : -1;
    const ax = e.face > 0 ? -vy / l : vy / l, ay = e.face > 0 ? vx / l : -vx / l;
    if (!habille) { ctx.beginPath(); ctx.arc(x, y, Z * m.TETE, 0, TAU); ctx.moveTo(x + ax * u * 0.09, y + ay * u * 0.09); ctx.arc(x + ax * u * 0.09, y + ay * u * 0.09 + u * 0.02, u * 0.052, 0, TAU); ctx.fill(); return; }
    const fi = f.tete, s = A.tete * K * Z / (fi.w * 0.8); morceau(ctx, peau.clair, fi, x, y, x + ax, y + ay, s, e.face < 0);
  } });
  // Les bras : l'avant-bras, le bras, la main.
  for (const c of ['d', 'g']) {
    const [ep, co, po, bo] = J.bras[c];
    items.push({ z: (ep[2] + co[2] + bo[2]) / 3, f: () => {
      const z = (ep[2] + co[2] + bo[2]) / 3; piece('avant', co, po, m.AVANT, u * 0.076, false, z); piece('bras', ep, co, m.BRAS, u * 0.1, false, z);
      const fm = J.forme[c] | 0, ob = J.objet[c] | 0;
      if (!fm) piece('main', po, bo, m.AVANT, u * 0.056, !mir, z, 'avant'); else main(ctx, P(po), P(bo), fm, Z, m, peau);
      if (ob) objet(ctx, P(po), P(bo), ob, Z);
    } });
  }
  // Le ruban du mètre, tendu d'une main au boîtier tenu dans l'autre.
  for (const [r, b] of [['d', 'g'], ['g', 'd']]) if ((J.objet[r] | 0) === OBJET.ruban && (J.objet[b] | 0) === OBJET.metre) {
    const p1 = J.bras[r][3], p2 = J.bras[b][3];
    items.push({ z: (p1[2] + p2[2]) / 2 + 0.01, f: () => { const [x1, y1] = P(p1), [x2, y2] = P(p2); ctx.save(); ctx.lineCap = 'butt'; ctx.strokeStyle = '#e9c23a'; ctx.lineWidth = Math.max(1.5, Z * 0.022); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,30,10,0.55)'; ctx.lineWidth = Math.max(0.6, Z * 0.006); ctx.setLineDash([Z * 0.006, Z * 0.05]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); } });
  }
  items.sort((a, b) => a.z - b.z); for (const it of items) { it.f(); ctx.globalAlpha = a0; }
}
// ---------- Les mains en gestes : dessinées d'un trait, de la couleur des mains du singe ----------
// po : le poignet, bo : le creux des doigts, à l'écran. Le haut de la main est le côté opposé à la pesanteur.
const PEAU_MAIN = '#241a15', LISERE = 'rgba(255,240,220,0.28)';
function main(ctx, po, bo, fm, Z, m, peau) {
  let ux = bo[0] - po[0], uy = bo[1] - po[1]; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  // n : la perpendiculaire tournée vers le haut de l'écran ; c'est là que pointent le doigt d'honneur et le pouce levé.
  let nx = -uy, ny = ux; if (ny > 0) { nx = -nx; ny = -ny; }
  const H = Z * m.MAIN * 1.1, cx = po[0] + ux * H * 0.42, cy = po[1] + uy * H * 0.42, r = H * 0.34;
  const doigt = (dx, dy, long, large) => { ctx.lineWidth = large; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * long, cy + dy * long); ctx.stroke(); };
  ctx.save(); ctx.fillStyle = ctx.strokeStyle = PEAU_MAIN; ctx.lineCap = 'round';
  ctx.lineWidth = H * 0.2; ctx.beginPath(); ctx.moveTo(po[0], po[1]); ctx.lineTo(cx, cy); ctx.stroke();                 // le dos de la main
  const fx = nx * 0.85 + ux * 0.35, fy = ny * 0.85 + uy * 0.35, fl = Math.hypot(fx, fy);
  if (fm === MAIN.doigt) doigt(fx / fl, fy / fl, H * 1.15, H * 0.2);
  else if (fm === MAIN.index) doigt(ux, uy, H * 1.2, H * 0.17);
  else if (fm === MAIN.pouce) doigt(fx / fl, fy / fl, H * 0.8, H * 0.2);
  else if (fm === MAIN.v) { doigt(fx / fl * 0.9 + ux * 0.4, fy / fl * 0.9 + uy * 0.4, H * 1.0, H * 0.16); doigt(fx / fl * 0.9 - ux * 0.25, fy / fl * 0.9 - uy * 0.25, H * 1.0, H * 0.16); }
  if (fm === MAIN.rond) {                                     // le rond du pouce et de l'index, les trois autres doigts écartés
    const ox = cx + ux * H * 0.55, oy = cy + uy * H * 0.55; ctx.lineWidth = H * 0.15; ctx.beginPath(); ctx.arc(ox, oy, H * 0.3, 0, TAU); ctx.stroke();
    for (const a of [0.5, 0.85, 1.2]) { const dx = Math.cos(a) * nx + Math.sin(a) * ux * 0.4, dy = Math.cos(a) * ny + Math.sin(a) * uy * 0.4, dl = Math.hypot(dx, dy); doigt(dx / dl, dy / dl, H * 0.9, H * 0.13); }
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();                                                                    // le poing
  ctx.strokeStyle = LISERE; ctx.lineWidth = Math.max(1, H * 0.05); ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, Math.atan2(ny, nx) - 1, Math.atan2(ny, nx) + 1); ctx.stroke();
  ctx.restore();
}
// Ce qu'il tient dans la main, dessiné à l'échelle du monde (Z pixels par mètre), dans le sens de la main.
function objet(ctx, po, bo, ob, Z) {
  let ux = bo[0] - po[0], uy = bo[1] - po[1]; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  const x = bo[0] - ux * l * 0.3, y = bo[1] - uy * l * 0.3; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // n : la perpendiculaire à la main tournée vers le haut de l'écran. La banane se tient debout dans le poing.
  let nx = -uy, ny = ux; if (ny > 0) { nx = -nx; ny = -ny; }
  const haut = (k, d = 0) => [x + nx * Z * k + ux * Z * d, y + ny * Z * k + uy * Z * d];
  if (ob >= OBJET.banane && ob <= OBJET.peau) {
    const long = ob === OBJET.banane ? 0.2 : ob === OBJET.pelee ? 0.17 : ob === OBJET.croquee ? 0.09 : 0;
    if (long) {           // le fruit (ou ce qu'il en reste), légèrement courbé
      const [x1, y1] = haut(long, 0.035), [xc, yc] = haut(long * 0.55, -0.01);
      ctx.strokeStyle = ob === OBJET.banane ? '#e8bd2c' : '#f1e3b2'; ctx.lineWidth = Z * (ob === OBJET.banane ? 0.05 : 0.04);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(xc, yc, x1, y1); ctx.stroke();
      if (ob === OBJET.banane) { ctx.strokeStyle = '#4a3214'; ctx.lineWidth = Z * 0.02; const [x2, y2] = haut(long + 0.02, 0.04); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      else if (ob === OBJET.croquee) { ctx.fillStyle = '#e7d39a'; ctx.beginPath(); ctx.arc(x1, y1, Z * 0.02, 0, Math.PI * 2); ctx.fill(); }
    }
    if (ob !== OBJET.banane) {          // les trois lanières de la peau, qui retombent autour de la main
      ctx.strokeStyle = '#d9ab25'; ctx.lineWidth = Z * 0.026;
      for (const s of [-1, 0.15, 1]) { const [x0, y0] = haut(0.05, s * 0.012), [xc, yc] = haut(0.1, s * 0.05), [x2, y2] = haut(-0.02, s * 0.085); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(xc, yc, x2, y2); ctx.stroke(); }
      ctx.strokeStyle = '#4a3214'; ctx.lineWidth = Z * 0.014; const [xa, ya] = haut(-0.02, 0), [xb, yb] = haut(-0.05, 0); ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    }
  } else if (ob === OBJET.piece) {
    const [cx, cy] = haut(0.035); ctx.fillStyle = '#d9a531'; ctx.beginPath(); ctx.arc(cx, cy, Z * 0.034, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = Math.max(1, Z * 0.008); ctx.beginPath(); ctx.arc(cx, cy, Z * 0.024, 0, Math.PI * 2); ctx.stroke();
  } else if (ob === OBJET.metre) {
    const w = Z * 0.1; ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = '#e9c23a'; ctx.beginPath(); ctx.roundRect(-w * 0.5, -w * 0.5, w, w, w * 0.22); ctx.fill();
    ctx.fillStyle = '#1d1a16'; ctx.beginPath(); ctx.roundRect(-w * 0.5, w * 0.12, w, w * 0.38, [0, 0, w * 0.22, w * 0.22]); ctx.fill();
    ctx.fillStyle = '#1d1a16'; ctx.beginPath(); ctx.arc(0, -w * 0.1, w * 0.14, 0, Math.PI * 2); ctx.fill();
  } else if (ob === OBJET.carnet) {
    const w = Z * 0.1, h = Z * 0.14; ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
    ctx.fillStyle = '#efe6d0'; ctx.fillRect(-w / 2 + Z * 0.006, -h - Z * 0.004, w, h); ctx.fillStyle = '#26211c'; ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = '#9b7b3d'; ctx.fillRect(-w / 2 + w * 0.72, -h, w * 0.08, h);
  } else if (ob === OBJET.crayon) {
    const [x1, y1] = [x + ux * Z * 0.09, y + uy * Z * 0.09], [x0, y0] = [x - ux * Z * 0.05, y - uy * Z * 0.05];
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Z * 0.016; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#c8a24a'; ctx.lineWidth = Z * 0.014; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x + ux * Z * 0.07, y + uy * Z * 0.07); ctx.stroke();
  }
  ctx.restore();
}
// La queue : un trait effilé de la couleur du pelage, puis l'image coupée en tranches le long de la chaîne (comme dans peau.js).
function queue(ctx, Q, peau, u, m, encre) {
  const n = Q.length - 1;
  if (!peau || !peau.pret) { for (let i = 1; i <= n; i++) { ctx.lineWidth = u * lerp(0.105, 0.045, i / n); ctx.beginPath(); ctx.moveTo(Q[i - 1][0], Q[i - 1][1]); ctx.lineTo(Q[i][0], Q[i][1]); ctx.stroke(); } return; }
  const f = peau.f, A = peau.allure, C = peau.clair; if (!f.queue) return; const fq = f.queue, lq = fq.bx - fq.ax, tr0 = lq / n;
  ctx.strokeStyle = peau.poil;
  for (let i = 1; i <= n; i++) { ctx.lineWidth = u * (A.trait[0] + (A.trait[1] - A.trait[0]) * (i - 0.5) / n); ctx.beginPath(); ctx.moveTo(Q[i - 1][0], Q[i - 1][1]); ctx.lineTo(Q[i][0], Q[i][1]); ctx.stroke(); }
  if (Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]) < 4) return;
  for (let i = n - 1; i >= 0; i--) {
    const j = i + 1, [x1, y1] = Q[i], [x2, y2] = Q[j], s = Math.max(Math.hypot(x2 - x1, y2 - y1), 0.5) / tr0, sw = m.QSEG * u / m.K / tr0;
    const g = i ? tr0 * 0.35 : fq.ax, d = j < n ? tr0 * 0.35 : fq.w - fq.bx, x0 = fq.ax + i * tr0 - g, w = tr0 + g + d;
    const mm = clamp(Math.floor(Math.log2(1 / Math.max(sw, 1e-3))), 0, NIV - 1), q = 1 << mm;
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1)); ctx.scale(s, sw * A.queue);
    ctx.drawImage(C[mm], (fq.x + x0) / q, fq.y / q, w / q, fq.h / q, -g, -fq.ay, w, fq.h); ctx.restore();
  }
}
// La branche où il danse, et l'ombre de ses pieds. x0, x1 : de où à où, en mètres ; la branche a son dessus à y = 0.
export function dessinerBranche(ctx, X, Y, Z, x0, x1, a = 1) {
  const ep = 0.26, y = Y(0), n = 24; ctx.save(); ctx.globalAlpha *= a;
  const bord = (s) => { const pts = []; for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); pts.push([X(x, 0), y + (s + 0.035 * Math.sin(x * 1.3) + 0.02 * Math.sin(x * 3.1)) * Z]); } return pts; };
  const dessus = bord(0), dessous = bord(ep).reverse(), g = ctx.createLinearGradient(0, y, 0, y + ep * Z);
  g.addColorStop(0, '#5b6a3c'); g.addColorStop(0.18, '#3e3a24'); g.addColorStop(1, '#17150e');
  ctx.fillStyle = g; ctx.beginPath(); for (const [i, p] of [...dessus, ...dessous].entries()) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(170,200,120,0.35)'; ctx.lineWidth = Math.max(1, Z * 0.025); ctx.beginPath(); dessus.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.restore();
}
export function dessinerOmbre(ctx, e, X, Y, Z) {
  const J = e.J; if (!J) return; const a = J.jambes.d[2], b = J.jambes.g[2], h = Math.max(0, Math.min(a[1], b[1]) - e.m.PIED * 0.22);
  const k = clamp(1 - h / 1.2, 0.25, 1), cx = X((a[0] + b[0]) / 2, 0), r = Z * (0.55 + Math.abs(a[0] - b[0]) * 0.5) * k;
  const g = ctx.createRadialGradient(cx, Y(0), 0, cx, Y(0), r); g.addColorStop(0, `rgba(0,0,0,${0.45 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.fillStyle = g; ctx.translate(cx, Y(0)); ctx.scale(1, 0.22); ctx.translate(-cx, -Y(0)); ctx.beginPath(); ctx.arc(cx, Y(0), r, 0, TAU); ctx.fill(); ctx.restore();
}

// ---------- Les danses ----------
const PEND = [0.1, -0.88, 0.17], V = [0.06, 0.84, 0.5], POI = [0.36, -0.3, -0.18], HANCHE = [-0.04, -0.6, 0.3], COUDE_DEHORS = [-0.15, -0.05, 1];
const roue = (ph) => [0.14 + 0.32 * Math.max(0, -Math.sin(ph)), Math.cos(ph) * 0.93, Math.sin(ph) * 0.88];
function balance() {
  const c = [];
  for (let i = 0; i < 8; i++) { c.push({ t: i, y: 0.0, e: 'io' }); c.push({ t: i + 0.5, y: -0.075, e: 'hit' }); }
  for (let i = 0; i < 4; i++) { c.push({ t: i, nod: 0.0 }); c.push({ t: i + 0.5, nod: 0.2, e: 'hit' }); }
  for (let i = 4; i < 8; i++) { c.push({ t: i, nod: -0.22 }); c.push({ t: i + 0.5, nod: -0.08, e: 'hit' }); }
  c.push({ t: 1, x: 0.06, roll: -0.1, side: 0.08, twist: -0.18 }, { t: 2, x: 0, roll: 0, side: 0, twist: 0 }, { t: 3, x: -0.06, roll: 0.1, side: -0.08, twist: 0.18 },
    { t: 4, x: 0, roll: 0, side: 0, twist: 0 }, { t: 5, x: 0.06, roll: -0.1, side: 0.08 }, { t: 6, x: 0, roll: 0, side: 0 }, { t: 7, x: -0.06, roll: 0.1, side: -0.08 });
  c.push({ t: 1, md: [0.4, -0.78, 0.08], mg: [-0.2, -0.85, 0.22] }, { t: 2, md: PEND, mg: PEND }, { t: 3, md: [-0.2, -0.85, 0.22], mg: [0.4, -0.78, 0.08] }, { t: 3.75, md: [0.1, -0.5, 0.4], mg: [0.1, -0.5, 0.4] });
  for (const t of [4.5, 5.5, 6.5]) c.push({ t, md: V, mg: V });
  for (const t of [5, 6, 7]) c.push({ t, md: [0.22, 0.86, -0.08], mg: [0.22, 0.86, -0.08], e: 'hit', stop: true });
  c.push({ t: 7.5, md: [0.3, 0.05, 0.55], mg: [0.3, 0.05, 0.55] });
  c.push({ t: 0, yaw: 0.8, qw: 0.32, qf: 1 }, { t: 2, yaw: 1.0 }, { t: 4, yaw: 0.72 }, { t: 6, yaw: 1.0 });
  return c;
}
function tambour() {
  const c = [], PRET = [0.24, -0.16, 0.42];
  c.push({ t: 0.25, lean: -0.05, nod: -0.22, bend: -0.06, md: PRET, mg: PRET });
  for (const [t, cote] of [[0.5, 'md'], [0.75, 'mg'], [1.5, 'md'], [1.75, 'mg'], [2.5, 'md'], [2.75, 'mg']]) {
    c.push({ t, [cote]: POI, e: 'hit', stop: true, bend: -0.16, y: -0.035 }); c.push({ t: t + 0.42, [cote]: PRET }); c.push({ t: t + 0.2, bend: -0.05, y: 0 });
  }
  c.push({ t: 2.9, nod: -0.25, tilt: 0.12 }, { t: 1.4, tilt: -0.1 });
  c.push({ t: 3.4, y: -0.22, lean: 0.38, bend: 0.15, md: [-0.38, -0.78, 0.25], mg: [-0.38, -0.78, 0.25], nod: 0.15, tilt: 0, ql: 0.25, e: 'io' });
  c.push({ t: 4, y: -0.26, lean: 0.42, stop: true });
  c.push({ t: 4.4, y: 0.02, e: 'out', lean: 0.12, vol: 0 }, { t: 4.12, md: [0.55, -0.6, 0.25], mg: [0.55, -0.6, 0.25] }, { t: 4.45, md: [0.6, 0.4, 0.3], mg: [0.6, 0.4, 0.3] });
  c.push({ t: 4.65, vol: 1, ad: [0.36, -0.5, 0.12], ag: [0.36, -0.5, 0.12], e: 'io' });
  c.push({ t: 4.9, md: V, mg: V, lean: -0.06, bend: -0.16, nod: -0.32, ql: 1.0, stop: true });
  c.push({ t: 5.35, vol: 1, md: V, mg: V, ad: [0.36, -0.5, 0.12], ag: [0.36, -0.5, 0.12] }, { t: 5.55, ad: [0.12, -0.9, 0.12], ag: [0.12, -0.9, 0.12] });
  c.push({ t: 5.75, y: -0.2, arc: 0.62, vol: 0, lean: 0.32, md: [0.32, 0.12, 0.62], mg: [0.32, 0.12, 0.62], nod: 0.18, bend: 0.05 });
  c.push({ t: 6.0, y: -0.24, stop: true }, { t: 6.5, y: 0, lean: 0.0, md: HANCHE, mg: HANCHE, cd: COUDE_DEHORS, cg: COUDE_DEHORS, nod: 0, ql: 0.45 });
  c.push({ t: 7.0, nod: 0.28, e: 'hit' }, { t: 7.25, nod: -0.12 }, { t: 7.5, nod: 0.24, e: 'hit' }, { t: 7.75, nod: 0, md: HANCHE, mg: HANCHE, cd: COUDE_DEHORS, cg: COUDE_DEHORS });
  c.push({ t: 0, yaw: 0.8 }, { t: 3, yaw: 0.95 }, { t: 6.5, yaw: 1.0 });
  return c;
}
function moulin() {
  const c = [];
  // Le pas chassé, et le bras du côté du pas qui fait un grand moulinet par temps.
  const tourBras = (t0, cote) => { for (let k = 1; k <= 4; k++) c.push({ t: t0 + k * 0.5, [cote]: roue(Math.PI + k * Math.PI / 2) }); };
  tourBras(0, 'md'); tourBras(2, 'mg');
  c.push({ t: 2, mg: PEND }, { t: 1, mg: [0.25, -0.6, 0.1] }, { t: 3, md: [0.25, -0.6, 0.1] }, { t: 4, mg: PEND });
  c.push({ t: 0.25, pd: [0.02, 0.27, 0.12] }, { t: 0.5, pd: [0.02, 0.36, 0], e: 'hit' }, { t: 3.0, pd: [0.02, 0.36, 0] }, { t: 3.25, pd: [0.02, 0.27, 0.12] }, { t: 3.5, pd: [0.02, 0.17, 0], e: 'hit' });
  c.push({ t: 1.0, pg: [0.02, 0.17, 0] }, { t: 1.25, pg: [0.02, 0.08, 0.12] }, { t: 1.5, pg: [0.02, -0.01, 0], e: 'hit' }, { t: 2.0, pg: [0.02, -0.01, 0] }, { t: 2.25, pg: [0.02, 0.08, 0.12] }, { t: 2.5, pg: [0.02, 0.17, 0], e: 'hit' });
  c.push({ t: 0.5, x: 0.1, roll: -0.08 }, { t: 1.5, x: 0.185, roll: 0.06 }, { t: 2.5, x: 0.095, roll: 0.08 }, { t: 3.5, x: 0, roll: -0.04 }, { t: 4, x: 0, roll: 0 });
  for (let i = 0; i < 4; i++) { c.push({ t: i + 0.5, y: -0.06, e: 'hit' }); c.push({ t: i + 1, y: 0 }); }
  // L'élan, la pirouette bras serrés, puis les bras grands ouverts et le doigt pointé vers l'adversaire.
  c.push({ t: 4.25, twist: -0.6, y: -0.12, md: [0.1, 0.1, 0.9], mg: [0.42, -0.1, -0.28], yaw: 0.8, stop: true });
  c.push({ t: 4.6, twist: 0.2 }, { t: 4.75, md: [0.3, -0.08, -0.12], mg: [0.3, -0.08, -0.12], y: 0.05 }, { t: 5.4, md: [0.3, -0.08, -0.12], mg: [0.3, -0.08, -0.12], y: 0.05 });
  c.push({ t: 5.75, yaw: 0.8 + TAU, e: 'io', twist: 0, y: -0.1 }, { t: 5.9, md: [0.1, 0.25, 0.95], mg: [0.1, 0.25, 0.95], stop: true }, { t: 6.1, y: 0 });
  c.push({ t: 6.5, md: [0.92, 0.28, 0.3], mg: HANCHE, cg: COUDE_DEHORS, lean: -0.08, tilt: 0.15, nod: -0.1, stop: true });
  c.push({ t: 7, nod: 0.1 }, { t: 7.5, md: [0.92, 0.28, 0.22], mg: HANCHE, cg: COUDE_DEHORS, nod: -0.05, tilt: 0.12 });
  c.push({ t: 0, yaw: 0.8 }, { t: 2, yaw: 0.95 }, { t: 6.5, yaw: 0.8 + TAU - 0.4 }, { t: 7.5, yaw: 0.8 + TAU - 0.35 });
  return c;
}
function vague() {
  const c = [], T = [0.02, 0.06, 0.97], H = [0.02, 0.4, 0.88];
  c.push({ t: 0.5, md: T, mg: T, yaw: 1.15 });
  // L'ondulation passe d'une main à l'autre : la main se lève, l'épaule, l'autre épaule, l'autre main.
  for (const [t0, a, b, sg] of [[1, 'mg', 'md', 1], [2, 'md', 'mg', -1], [3, 'mg', 'md', 1]]) {
    c.push({ t: t0, [a]: H, [b]: T }, { t: t0 + 0.25, [a]: T, side: 0.13 * sg, tilt: 0.12 * sg }, { t: t0 + 0.5, side: -0.13 * sg, tilt: -0.12 * sg }, { t: t0 + 0.75, [b]: H, side: 0, tilt: 0 }, { t: t0 + 1, [b]: T });
  }
  c.push({ t: 4, md: T, mg: T, side: 0, tilt: 0 });
  // Le corps ondule de haut en bas, deux fois.
  for (const t0 of [4, 6]) {
    c.push({ t: t0 + 0.5, bend: 0.38, nod: 0.22, z: 0.0, y: 0, md: [0.42, -0.12, 0.25], mg: [0.42, -0.12, 0.25] });
    c.push({ t: t0 + 1, bend: -0.24, z: 0.12, lean: -0.04, nod: -0.1, md: [0.22, -0.45, 0.3], mg: [0.22, -0.45, 0.3] });
    c.push({ t: t0 + 1.5, y: -0.14, z: 0.06, bend: 0.06, lean: 0.12, md: [0.3, -0.62, 0.26], mg: [0.3, -0.62, 0.26] });
    c.push({ t: t0 + 2, y: 0, z: 0, bend: 0.06, nod: 0.06 });
  }
  c.push({ t: 0, yaw: 0.8 }, { t: 3.5, yaw: 1.15 }, { t: 5, yaw: 0.65 }, { t: 7, yaw: 0.75 });
  return c;
}
function salto() {
  const c = [];
  // Les épaules qui frétillent.
  for (let i = 0; i < 8; i++) c.push({ t: 0.25 + i * 0.22, twist: i % 2 ? -0.2 : 0.2, roll: i % 2 ? 0.05 : -0.05, e: 'hit' });
  c.push({ t: 0.25, bend: 0.2, md: [0.3, -0.35, 0.25], mg: [0.3, -0.35, 0.25], y: -0.05 }, { t: 2.0, twist: 0, roll: 0, bend: 0.12, y: -0.05 });
  // L'élan, le salto arrière groupé, la réception.
  c.push({ t: 2.3, y: -0.25, lean: 0.4, md: [-0.4, -0.75, 0.2], mg: [-0.4, -0.75, 0.2], nod: 0.1, e: 'io' }, { t: 2.45, y: -0.27, stop: true });
  c.push({ t: 2.5, md: [0.6, -0.62, 0.2], mg: [0.6, -0.62, 0.2] });
  c.push({ t: 2.75, y: 0.02, e: 'out', lean: 0.1, salto: 0, vol: 0, stop: true }, { t: 2.82, md: [0.45, 0.82, 0.25], mg: [0.45, 0.82, 0.25] });
  c.push({ t: 3.05, vol: 1, ad: [0.45, -0.32, 0.1], ag: [0.45, -0.32, 0.1], md: [0.5, -0.45, 0.15], mg: [0.5, -0.45, 0.15], e: 'io' });
  c.push({ t: 3.85, vol: 1, ad: [0.45, -0.32, 0.1], ag: [0.45, -0.32, 0.1], md: [0.5, -0.45, 0.15], mg: [0.5, -0.45, 0.15] }, { t: 4.05, ad: [0.1, -0.92, 0.1], ag: [0.1, -0.92, 0.1] });
  c.push({ t: 4.25, salto: -TAU, e: 'io', y: -0.22, arc: 0.82, vol: 0, lean: 0.35, md: [0.25, 0.3, 0.8], mg: [0.25, 0.3, 0.8] });
  c.push({ t: 4.5, y: -0.26, stop: true }, { t: 4.9, y: 0, lean: 0.05 });
  // La pose du costaud : les deux biceps, le torse bombé, et il hoche la tête.
  const F1 = [0.02, 0.5, 0.48], F2 = [0.0, 0.58, 0.42], CF = [0, -0.5, 1];
  c.push({ t: 5.25, md: F1, mg: F1, cd: CF, cg: CF, bend: -0.12, lean: -0.06, nod: -0.1, yaw: 1.2, stop: true });
  c.push({ t: 5.75, md: F2, mg: F2, y: -0.03 }, { t: 6.25, md: F1, mg: F1, y: 0 }, { t: 6.75, md: F2, mg: F2, y: -0.03, cd: CF, cg: CF }, { t: 7.25, md: F1, mg: F1, y: 0 });
  c.push({ t: 6, nod: 0.18 }, { t: 6.5, nod: -0.1 }, { t: 7, nod: 0.18 }, { t: 7.5, nod: 0, md: [0.2, -0.6, 0.3], mg: [0.2, -0.6, 0.3], bend: 0.06, lean: 0.12 });
  c.push({ t: 0, yaw: 0.8 }, { t: 2.0, yaw: 0.9 }, { t: 2.75, yaw: 0.6 }, { t: 4.25, yaw: 0.6 }, { t: 7.25, yaw: 1.15 });
  return c;
}
function roi() {
  const c = [];
  // Il se déploie : bras grands ouverts qui montent, torse bombé, tête en arrière, et la puissance qui le fait frémir.
  c.push({ t: 0.75, md: [0.05, -0.55, 0.8], mg: [0.05, -0.55, 0.8], y: -0.05, pd: [0.02, 0.25, 0], pg: [0.02, 0.25, 0] });
  c.push({ t: 2, md: [0, 0.86, 0.48], mg: [0, 0.86, 0.48], bend: -0.18, nod: -0.35, ql: 1.1, y: 0.03, yaw: 1.0, vib: 0.035, e: 'io' }, { t: 2.4, vib: 0.035, md: [0, 0.86, 0.48], mg: [0, 0.86, 0.48] });
  // L'élan, le saut avec un tour complet, et la réception un genou plié, le poing sur la branche.
  c.push({ t: 2.65, md: [0.1, -0.1, 0.95], mg: [0.1, -0.1, 0.95] });
  c.push({ t: 2.9, y: -0.3, lean: 0.45, bend: 0.1, md: [-0.4, -0.75, 0.25], mg: [-0.4, -0.75, 0.25], vib: 0, nod: 0.15, ql: 0.3, e: 'io' });
  c.push({ t: 3.05, md: [0.6, -0.6, 0.25], mg: [0.6, -0.6, 0.25] }, { t: 3.38, md: [0.4, 0.6, 0.3], mg: [0.4, 0.6, 0.3] });
  c.push({ t: 3.3, y: 0.0, e: 'out', yaw: 1.0, lean: 0.1, vol: 0, stop: true, pd: [0.02, 0.25, 0], pg: [0.02, 0.25, 0] });
  c.push({ t: 3.6, vol: 1, ad: [0.38, -0.45, 0.1], ag: [0.38, -0.45, 0.1], md: [0.32, -0.1, -0.1], mg: [0.32, -0.1, -0.1], e: 'io' });
  c.push({ t: 4.45, vol: 1, ad: [0.38, -0.45, 0.1], ag: [0.38, -0.45, 0.1], md: [0.32, -0.1, -0.1], mg: [0.32, -0.1, -0.1], pd: [0.18, 0.3, 0], pg: [-0.14, 0.3, 0] });
  c.push({ t: 4.8, yaw: 1.0 + TAU, e: 'io', y: -0.36, arc: 0.95, vol: 0, lean: 0.62, md: [0.55, -0.95, 0.02], mg: [-0.45, 0.25, 0.62], nod: -0.45, ql: 0.85 });
  c.push({ t: 5.05, y: -0.4, lean: 0.66, stop: true }, { t: 5.7, y: -0.37, lean: 0.62, md: [0.55, -0.95, 0.02], mg: [-0.45, 0.25, 0.62], pd: [0.18, 0.3, 0], pg: [-0.14, 0.3, 0], nod: -0.45 });
  // Il se relève, revient sur ses appuis, se frappe le torse, et rugit.
  c.push({ t: 6.5, pd: [0.12, 0.25, 0.1] }, { t: 7, y: 0, lean: 0.1, md: PEND, mg: PEND, nod: 0, pd: [0.02, 0.2, 0], pg: [0.02, 0.2, 0], ql: 0.28, e: 'io' });
  for (const [t, cote] of [[7.5, 'md'], [7.75, 'mg'], [8, 'md'], [8.25, 'mg']]) { c.push({ t, [cote]: POI, e: 'hit', stop: true, bend: -0.12 }); c.push({ t: t + 0.12, bend: -0.04 }); }
  c.push({ t: 8.4, md: [0.2, -0.2, 0.4], mg: [0.2, -0.2, 0.4] });
  c.push({ t: 8.75, md: [0.15, -0.35, 0.85], mg: [0.15, -0.35, 0.85], nod: -0.45, bend: -0.2, ql: 1.2, qw: 0.4, vib: 0.03, e: 'hit' }, { t: 9.75, md: [0.15, -0.35, 0.85], mg: [0.15, -0.35, 0.85], nod: -0.42, vib: 0.03, qw: 0.4 });
  c.push({ t: 10.25, md: [0.9, 0.3, 0.2], mg: HANCHE, cg: COUDE_DEHORS, nod: -0.05, tilt: 0.12, bend: 0, vib: 0, ql: 0.35, qw: 0.15, stop: true });
  c.push({ t: 11, nod: 0.2 }, { t: 11.5, nod: -0.05, md: [0.9, 0.3, 0.2], mg: HANCHE, cg: COUDE_DEHORS });
  c.push({ t: 0, yaw: 0.8 }, { t: 7, yaw: 1.0 + TAU }, { t: 9.75, yaw: 1.0 + TAU }, { t: 10.25, yaw: 0.45 + TAU }, { t: 11.5, yaw: 0.5 + TAU });
  return c;
}

// Le shuffle : le « running man » des battles, un genou qui monte pendant que l'autre pied glisse en arrière, les bras qui pompent.
function shuffle() {
  const c = [], HAUT = (f) => [f, 0.15, 0.24], SOL = (f) => [f, 0.17, 0], DERR = [-0.17, 0.17, 0.03];
  for (let i = 0; i < 8; i++) {
    const lev = i % 2 ? 'pg' : 'pd', glis = i % 2 ? 'pd' : 'pg', b1 = i % 2 ? 'md' : 'mg', b2 = i % 2 ? 'mg' : 'md';
    c.push({ t: i, [lev]: HAUT(0.12), y: -0.01, [b1]: [0.42, -0.52, 0.2], [b2]: [-0.25, -0.76, 0.22] });
    c.push({ t: i + 0.5, [lev]: SOL(0.07), [glis]: DERR, y: -0.085, e: 'hit' });
    c.push({ t: i + 0.25, nod: 0.16 }, { t: i + 0.75, nod: 0.02 });
  }
  c.push({ t: 0, yaw: 0.8, lean: 0.18 }, { t: 4, yaw: 1.25 }, { t: 6, yaw: 0.7 }, { t: 0, qw: 0.3, qf: 2 });
  return c;
}
// Le toprock : l'entrée debout d'un danseur de breakdance. Pied croisé devant, bras croisés, puis tout s'ouvre ; un coup de pied, et la pose finale.
function toprock() {
  const c = [], OUV = [0.05, -0.15, 0.9], CROIX_D = [0.36, -0.24, -0.3], CROIX_G = [0.36, -0.2, -0.28];
  for (const [t, pied, sg] of [[0, 'pd', 1], [1, 'pg', -1], [4, 'pd', 1], [5, 'pg', -1]]) {
    c.push({ t: t + 0.5, [pied]: [0.13, -0.06, 0], md: CROIX_D, mg: CROIX_G, twist: 0.3 * sg, y: -0.06, bend: 0.12, e: 'hit' });
    c.push({ t: t + 1, [pied]: [0.02, 0.2, 0], md: OUV, mg: OUV, twist: 0, y: 0, bend: -0.1 });
  }
  for (const [t, pied] of [[2, 'pd'], [3, 'pg']]) { c.push({ t: t + 0.4, [pied]: [0.36, 0.12, 0.2], lean: -0.12, md: [-0.2, -0.6, 0.4], mg: [-0.2, -0.6, 0.4], e: 'hit' }, { t: t + 0.85, [pied]: [0.02, 0.2, 0], lean: 0.08, md: OUV, mg: OUV }); }
  c.push({ t: 6.5, md: [0.24, -0.32, -0.22], mg: [0.3, -0.26, -0.3], lean: -0.05, nod: -0.15, pd: [0.02, 0.25, 0], pg: [0.02, 0.25, 0], e: 'hit', stop: true }, { t: 7, y: -0.04 }, { t: 7.25, y: 0 }, { t: 7.5, nod: -0.12, md: [0.24, -0.32, -0.22], mg: [0.3, -0.26, -0.3] });
  c.push({ t: 0, yaw: 0.9 }, { t: 2, yaw: 0.6 }, { t: 4, yaw: 1.1 }, { t: 6.5, yaw: 0.95 });
  return c;
}

// Ce que dit la boutique de chaque danse. vig : l'instant montré sur la vignette. elo : le rang qui la donne. prix : en euros (boutique en essai).
// ancien : l'identifiant de la danse qu'elle remplace (v0.18), pour que les achats et les choix déjà faits restent valables.
export const DANSES = [
  { id: 'balance', ancien: 'toupie', nom: 'Le balancé', vig: 2.6, duree: 4, cles: balance(), boucle: {},
    texte: 'Il rebondit sur ses genoux, les hanches qui roulent, les bras qui ballottent, puis frappe dans ses mains au-dessus de sa tête.' },
  { id: 'tambour', ancien: 'metronome', nom: 'Le tambour', vig: 2.48, elo: 950, duree: 4, cles: tambour(), boucle: {},
    texte: 'Il se martèle le torse à deux poings, prend son élan, bondit bras au ciel et se pose, les poings sur les hanches.' },
  { id: 'moulin', ancien: 'drapeau', nom: 'Le moulin', vig: 3.45, elo: 1100, duree: 4, cles: moulin(), boucle: { yaw: TAU },
    texte: 'Pas chassés et grands moulinets des bras, une pirouette bras serrés, et il pointe son adversaire du doigt.' },
  { id: 'vague', ancien: 'poirier', nom: 'La vague', vig: 0.85, prix: 1.99, duree: 4, cles: vague(), boucle: {},
    texte: 'Une onde lui traverse les bras d\'une main à l\'autre, puis tout le corps, du torse jusqu\'aux genoux.' },
  { id: 'salto', ancien: 'soleil', nom: 'Le salto', vig: 1.78, prix: 2.99, duree: 4, cles: salto(), boucle: { salto: -TAU },
    texte: 'Les épaules qui frétillent, un salto arrière groupé, et la pose du costaud : les deux biceps et un hochement de tête.' },
  { id: 'roi', ancien: 'tornade', nom: 'Le roi de la jungle', vig: 2.7, elo: 1400, duree: 6, cles: roi(), boucle: { yaw: TAU },
    texte: 'Il se déploie en frémissant, bondit en faisant un tour complet, se reçoit le poing sur la branche, se frappe le torse et rugit.' },
  { id: 'shuffle', nom: 'Le shuffle', vig: 1.0, prix: 1.99, duree: 4, cles: shuffle(), boucle: {},
    texte: 'Le pas des battles : un genou qui monte, l\'autre pied qui glisse en arrière, en rythme, les bras qui pompent.' },
  { id: 'toprock', nom: 'Le toprock', vig: 0.25, elo: 1250, duree: 4, cles: toprock(), boucle: {},
    texte: 'L\'entrée d\'un danseur de breakdance : pieds croisés, bras qui s\'ouvrent, coups de pied, et la pose bras croisés.' },
];
export const danseDe = (id) => DANSES.find((d) => d.id === id || d.ancien === id) || DANSES[0];
