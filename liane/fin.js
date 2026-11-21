// LIANE — la scène de fin de duel : le gagnant descend chercher le perdant sous les cimes, le remonte, le dépose sur sa liane,
// puis fait sa danse de victoire pendant que l'Elo se décompte au-dessus de chacun.
// Rien ici ne touche aux règles ni au résultat : la scène ne fait que montrer ce que le duel a décidé.
// Les deux singes sont posés par le même calcul que pendant la course (singe.js) : on ne fait que leur dicter où sont leurs mains.
import { corps, poseSinge, dessinerSinge, morpho } from './singe.js?v=33';
import { dessinerPeau } from './peau.js?v=33';
import { DANSES, danseDe, danseur, avancer, dessinerDanseur, dessinerBranche, dessinerOmbre, sommet, atterrir, acteur as acteur3d, jouer, libre, INTRO } from './danse.js?v=33';
import { geste, attente, D as DUO, hautEpaule, animDe, dureeGeste } from './gestes.js?v=33';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const ECART = 1.55, HAUT = 4, SOUS = 1.7;      // demi-distance entre les deux lianes ; hauteur de l'attache au-dessus des mains au repos ; longueur de liane sous les mains
// Le déroulé, en secondes : la plongée du gagnant, la remontée à deux, l'élan, le lâcher, la saisie du perdant, l'Elo, la danse.
export const TEMPS = { plonge: [0.15, 0.95], monte: [1.3, 2.2], lache: 2.55, saisie: 2.95, elo: 3.3, geste: 4.5 };

// ---------- La fin, sur la branche (danse.js, gestes.js) ----------
// À l'instant du geste, les deux lâchent leur liane et se reçoivent sur la branche du dessous, face à face (le perdant un souffle après).
// Le gagnant fait sa danse ou son geste, le perdant encaisse. À tout moment ensuite, ils peuvent se serrer la main si les deux le veulent.
export { DANSES, danseDe };
const BR = -3.8;                 // le dessus de la branche, sous les mains au repos
const acteur = (q, i, base) => ({ ...q, i, base, apres: animDe(q.danse, 'apres'), B: corps(morpho(q.corps)), M: { mode: 'swing', th: 0, om: 0, x: 0, y: 0, vx: 0, vy: 0, depart: false }, face: 1, tour: 1, rot: 0, vu: false, porte: false, corde: true, pose: null, neuf: true, R: HAUT });
// moi, lui : { corps (les mesures de l'espèce), peau (l'atlas de la tenue, ou rien), encre (la couleur de la silhouette de secours), danse (l'identifiant de sa danse) }.
export function creerScene(moi, lui, gagne) { return { t: 0, A: [acteur(moi, 0, -ECART), acteur(lui, 1, ECART)], g: gagne ? 0 : 1, haut: false, main: null, geste: false, flash: 0 }; }

// Où sont les mains de chacun à l'instant t. Le gagnant : th (angle de sa liane) et R (longueur de liane au-dessus des mains).
function gagnant(a, t) {
  const T = TEMPS; let R = HAUT, th = 0; a.tour = 1; a.rot = 0; a.vu = t > T.plonge[0];
  if (t < T.monte[0]) R = lerp(0.7, 9.8, lisse((t - T.plonge[0]) / (T.plonge[1] - T.plonge[0])));                 // il se laisse glisser jusque sous les cimes
  else if (t < T.monte[1]) { const k = (t - T.monte[0]) / (T.monte[1] - T.monte[0]); R = lerp(9.8, HAUT, 1 - Math.pow(1 - k, 2.2)); th = 0.05 * Math.sin(t * 7); }      // il remonte, le perdant pendu à son pied
  else if (t < T.lache) th = 0.3 * lisse((t - T.monte[1]) / (T.lache - T.monte[1]));                               // il prend son élan vers l'autre liane
  else th = 0.3 * Math.cos(TAU * (t - T.lache) / 1.1) * Math.exp(-(t - T.lache) * 1.6);                            // il revient, et le balancement s'éteint
  a.M.mode = 'swing'; a.th = th; a.R = R; a.x = Math.sin(th) * R; a.y = HAUT - Math.cos(th) * R; a.porte = false; a.corde = true; a.face = 1;
}
// Le perdant : pendu au pied du gagnant, puis lâché vers sa liane, qu'il saisit ; il s'y balance, se retourne, et reste là.
function perdant(a, t, g) {
  const T = TEMPS; a.vu = t >= T.monte[0] && !!g.pose; a.tour = 1; a.rot = 0;
  if (t < T.saisie) {
    // Tant qu'il est porté ou en l'air, il regarde où il va : vers sa liane, donc dos au gagnant. Son repère est retourné.
    a.face = -1; const sens = a.i ? 1 : -1, versMoi = (xs) => (xs - a.base) * sens;                 // d'un point de la scène vers son repère à lui
    const pied = g.pose ? g.pose.legs[0] : null, px = pied ? g.base + pied[4] * (g.i ? -1 : 1) : g.base, py = pied ? pied[5] : -2;
    if (t < T.lache) { a.M.mode = 'swing'; a.porte = true; a.corde = false; a.x = versMoi(px); a.y = py; a.th = 0.12 * Math.sin(t * 6.2); a.lx = a.x; a.ly = a.y; }
    else {                                       // lâché : une courbe tendue jusqu'à sa liane
      const k = (t - T.lache) / (T.saisie - T.lache); a.M.mode = 'fly'; a.porte = false; a.corde = true;
      a.x = lerp(a.lx, 0, k); a.y = lerp(a.ly, -0.1, k) + 0.75 * Math.sin(Math.PI * k) * (1 - 0.35 * k); a.th = 0; a.R = HAUT + 0.1;
    }
    return;
  }
  const u = t - T.saisie; a.M.mode = 'swing'; a.porte = false; a.corde = true; a.R = HAUT + 0.1;
  a.face = lerp(-1, 1, lisse(u / 0.32));         // il se retourne vers le gagnant
  a.th = -0.3 * Math.sin(TAU * u / 1.15) * Math.exp(-u * 1.4) + 0.035 * Math.sin(t * 1.3);
  a.x = Math.sin(a.th) * a.R; a.y = HAUT - Math.cos(a.th) * a.R;
}
// Le gagnant lâche sa liane : la danse part de sa pose exacte, ramenée dans le repère de la branche (l'origine sous son bassin).
// Il lâche sa liane : sa réception part de sa pose exacte, ramenée dans le repère de la branche. Il se reçoit à DUO / 2 du milieu, face à l'autre.
function lancerDanse(a, P) {
  const p = a.pose, ox = ECART - DUO / 2, X = (x) => x - ox, Y = (y) => y - BR, l6 = (l) => [X(l[0]), Y(l[1]), X(l[2]), Y(l[3]), X(l[4]), Y(l[5])];
  const depuis = { sx: X(p.sx), sy: Y(p.sy), hx: X(p.hx), hy: Y(p.hy), bras: p.bras.map(l6), legs: p.legs.map(l6), queue: p.queue.map((q) => ({ x: X(q.x), y: Y(q.y) })), qui: a.B.qui };
  a.ox = ox; a.d = atterrir(a.B.m, depuis, P); avancer(a.d, 0);
}
// Ce que fait chacun une fois posé : le gagnant danse (en boucle) ou attend, fier, son geste ; le perdant reste abattu.
const boucleDe = (a, gagne) => gagne ? (a.apres.type === 'danse' ? danseur(a.B.m, a.apres.id).P : attente(a.B.m, 'fier')) : attente(a.B.m, 'defait');
function retour(scn, a) { jouer(a.d, boucleDe(a, a === scn.A[scn.g]), null, 0.35); }
// Un geste à deux : qui le fait (A), qui le reçoit (B). À la fin, chacun revient à sa boucle.
function aDeux(scn, id, fait, recoit) {
  const x = { D: DUO, HS: (hautEpaule(fait.B.m) + hautEpaule(recoit.B.m)) / 2 }; scn.geste = true;
  jouer(fait.d, geste(id, 'A', fait.B.m, x), () => { retour(scn, fait); scn.geste = false; });
  jouer(recoit.d, geste(id, 'B', recoit.B.m, x), () => retour(scn, recoit));
}
// La poignée de main, voulue par les deux. refus : l'autre la refuse (seulement contre un rival simulé, qui a son caractère). qui : celui qui l'a proposée.
export function serrerMains(scn, refus = false, qui = 0) { scn.main = refus ? { refus: true, qui } : { qui }; }
export const sceneLibre = (scn) => !!(scn.A[0].d && scn.A[1].d && libre(scn.A[0].d) && libre(scn.A[1].d) && !scn.geste);
// Le corps suit les mains : même calcul que pendant la course.
function poser(q, dt) {
  const M = q.M;
  if (dt > 0 && !q.neuf) { M.vx = clamp((q.x - M.x) / dt, -30, 30); M.vy = clamp((q.y - M.y) / dt, -30, 30); M.om = clamp((q.th - M.th) / dt, -12, 12); } else { M.vx = M.vy = M.om = 0; }
  M.x = q.x; M.y = q.y; M.th = q.th; q.neuf = false;
  q.pose = poseSinge(M, q.B, dt, { ancre: q.porte ? [M.x, M.y + 3] : [0, HAUT], reste: q.porte ? 0 : SOUS, devant: M.mode === 'fly' ? Math.max(0.2, -M.x) : 99, attend: false, tend: true });
}
// Une liane : elle pend du haut de l'écran, passe par les mains, et continue un peu dessous. Claire avec un cœur foncé : sur le voile sombre, une liane noire ne se verrait pas.
function liane(ctx, q, cx, Y, Z, t) {
  const x0 = cx + q.base * Z, sens = q.i ? -1 : 1, tient = q.corde && q.vu && q.M.mode === 'swing' && !q.porte && !q.d;
  const mx = tient ? x0 + q.x * Z * sens * (q.face < 0 ? -1 : 1) : x0 + Math.sin(t * 0.9 + q.i * 2) * 0.05 * Z, my = tient ? Y(q.y) : Y(-0.2);
  const bx = mx + (mx - x0) * (SOUS / HAUT) * 0.7 + Math.sin(t * 1.7 + q.i) * 0.04 * Z * sens, by = my + SOUS * Z;
  const trace = () => { ctx.beginPath(); ctx.moveTo(x0, Y(HAUT)); ctx.lineTo(mx, my); ctx.quadraticCurveTo(lerp(mx, bx, 0.5), my + SOUS * Z * 0.55, bx, by); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(196,214,178,0.5)'; ctx.lineWidth = Math.max(2.5, Z * 0.1); trace(); ctx.strokeStyle = 'rgba(40,62,54,0.9)'; ctx.lineWidth = Math.max(1, Z * 0.045); trace();
}
// Un singe : retourné s'il regarde vers la gauche, aplati quand il pivote sur lui-même, tourné autour de ses mains quand la danse le demande.
function singe(ctx, q, cx, Y, Z, encre) {
  if (q.d) {
    const sg = q.i ? -1 : 1, Xd = (x) => cx + (q.base + sg * (q.ox + x)) * Z, Yd = (y) => Y(BR + y);
    dessinerOmbre(ctx, q.d, Xd, Yd, Z); dessinerDanseur(ctx, q.d, q.peau, q.encre || encre, Xd, Yd, Z, sg < 0); return;
  }
  if (q.d === undefined && q.cache) return;
  if (!q.vu || !q.pose) return;
  const s = (q.i ? -1 : 1) * q.face * q.tour, X = (x) => x * Z;
  ctx.save(); ctx.translate(cx + q.base * Z, 0); ctx.scale(Math.abs(s) < 0.04 ? 0.04 * (s < 0 ? -1 : 1) : s, 1);
  if (q.rot) { ctx.translate(X(q.M.x), Y(q.M.y)); ctx.rotate(q.rot); ctx.translate(-X(q.M.x), -Y(q.M.y)); }
  if (q.peau && q.peau.pret) dessinerPeau(ctx, q.pose, q.peau, X, Y, Z); else dessinerSinge(ctx, q.pose, q.encre || encre, X, Y, Z);
  ctx.restore();
}

// Avance la scène et la dessine. cadre : { cx, y0 : le point de l'écran où sont les mains au repos, entre les deux lianes ; Z : pixels par mètre ; W, H }.
export function jouerScene(ctx, scn, dt, cadre, encre) {
  const { cx, y0, Z, W, H } = cadre, t = scn.t += dt, g = scn.A[scn.g], p = scn.A[1 - scn.g], Y = (y) => y0 - y * Z;
  // Un voile sombre, plus clair au centre : la forêt reste là, les deux singes sont dans la lumière.
  const a = lisse(t / 0.45), v = ctx.createRadialGradient(cx, y0 + Z * 1.1, Z * 0.6, cx, y0 + Z * 1.1, Math.max(W, H) * 0.75);
  v.addColorStop(0, `rgba(2,16,20,${0.3 * a})`); v.addColorStop(0.5, `rgba(2,16,20,${0.72 * a})`); v.addColorStop(1, `rgba(2,14,18,${0.9 * a})`);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (!g.d) { gagnant(g, t); poser(g, dt); if (t >= TEMPS.geste) lancerDanse(g, boucleDe(g, true)); } else avancer(g.d, dt);
  if (!p.d) { perdant(p, t, g); poser(p, dt); if (t >= TEMPS.geste + 0.35) lancerDanse(p, boucleDe(p, false)); } else avancer(p.d, dt);
  // Les deux sont posés : le geste du gagnant, s'il en a un (une danse, elle, a déjà commencé à la réception).
  if (!scn.fait && sceneLibre(scn)) { scn.fait = true; if (g.apres.type === 'geste') aDeux(scn, g.apres.id, g, p); }
  // La poignée de main, dès que les deux sont libres.
  if (scn.main && !scn.main.joue && scn.fait && sceneLibre(scn)) { const m = scn.main, a = scn.A[m.qui], b = scn.A[1 - m.qui]; m.joue = true; aDeux(scn, m.refus ? 'refus' : 'main', a, b); }
  scn.haut = !!g.d && BR + sommet(g.d.J) > 0.15;            // le gagnant saute si haut qu'il passe devant son compteur d'Elo
  scn.flash = Math.max(g.d && g.d.J ? g.d.J.flash || 0 : 0, p.d && p.d.J ? p.d.J.flash || 0 : 0);
  ctx.globalAlpha = a; for (const q of scn.A) liane(ctx, q, cx, Y, Z, t);
  // La branche du dessous : elle sort de l'ombre quand le gagnant est remonté.
  { const k = lisse((t - 2.3) / 0.8); if (k > 0) dessinerBranche(ctx, (x) => cx + x * Z, (y) => Y(BR + y), Z, -W / Z, W / Z, k); }
  singe(ctx, p, cx, Y, Z, encre); singe(ctx, g, cx, Y, Z, encre);     // le perdant d'abord, le gagnant devant lui
  if (scn.flash > 0.01) { ctx.globalAlpha = 1; ctx.fillStyle = `rgba(255,255,255,${scn.flash * 0.7})`; ctx.fillRect(0, 0, W, H); }
  ctx.globalAlpha = 1;
}

// ---------- L'annonce du duel : les deux singes face à face sur une branche, chacun son entrée, comme avant un combat ----------
// moi, lui : { corps, peau, encre, entree }. Moi à gauche. Moi d'abord, puis lui : chaque téléphone montre la même chose dans son sens.
const PAUSE = [0.35, 0.25, 0.45];
export function dureeAnnonce(moi, lui) { return PAUSE[0] + dureeGeste(animDe(moi.entree, 'avant').id) + PAUSE[1] + dureeGeste(animDe(lui.entree, 'avant').id) + PAUSE[2]; }
export function creerAnnonce(moi, lui) {
  const A = [moi, lui].map((q, i) => { const m = morpho(q.corps); return { ...q, i, m, entree: animDe(q.entree, 'avant').id, d: acteur3d(m, attente(m, 'attente')) }; });
  return { t: 0, A, etape: 0, flash: 0 };
}
export function jouerAnnonce(ctx, an, dt, cadre, encre) {
  const { cx, y0, Z } = cadre, t = an.t += dt, [a, b] = an.A, x = { D: DUO, HS: (hautEpaule(a.m) + hautEpaule(b.m)) / 2 };
  const lance = (f, r) => { jouer(f.d, geste(f.entree, 'A', f.m, x), () => jouer(f.d, attente(f.m, 'attente'))); jouer(r.d, geste(f.entree, 'B', r.m, x), () => jouer(r.d, attente(r.m, 'attente'))); };
  if (an.etape === 0 && t >= PAUSE[0]) { an.etape = 1; an.t2 = t + dureeGeste(a.entree) + PAUSE[1]; lance(a, b); }
  else if (an.etape === 1 && t >= an.t2) { an.etape = 2; lance(b, a); }
  for (const q of an.A) avancer(q.d, dt);
  const Y = (y) => y0 - y * Z; dessinerBranche(ctx, (v) => cx + v * Z, Y, Z, -cx / Z - 0.5, cx / Z + 0.5);
  for (const q of [b, a]) { const sg = q.i ? -1 : 1, X = (v) => cx + sg * (-DUO / 2 + v) * Z; dessinerOmbre(ctx, q.d, X, Y, Z); dessinerDanseur(ctx, q.d, q.peau, q.encre || encre, X, Y, Z, sg < 0); }
  const fl = Math.max(a.d.J?.flash || 0, b.d.J?.flash || 0); if (fl > 0.01) { ctx.fillStyle = `rgba(255,255,255,${fl * 0.7})`; ctx.fillRect(0, 0, cadre.W || cx * 2, cadre.H || y0 * 1.2); }
}

// L'aperçu d'une animation, pour la boutique. Une danse : le singe seul sur sa branche, en boucle. Un geste : deux singes face à face,
// le joueur le fait à un partenaire, puis ils soufflent un instant et recommencent. cadre : { cx, y0 (le dessus de la branche), Z }.
export function creerApercu(q, id, t0 = 0) {
  const an = animDe(id, 'apres') && animDe(id, 'apres').id === id ? animDe(id, 'apres') : animDe(id, 'avant');
  if (an.type !== 'geste') { const d = danseur(morpho(q.corps), id); d.t = t0; return { t: t0, d, q, an }; }
  const m = morpho(q.corps), m2 = morpho(q.partenaire.corps), x = { D: DUO, HS: (hautEpaule(m) + hautEpaule(m2)) / 2 };
  const ap = { t: 0, q, an, duo: true, A: acteur3d(m, attente(m, 'attente')), B: acteur3d(m2, attente(m2, 'attente')), x, m, m2 };
  const tour = () => { jouer(ap.A, geste(id, 'A', m, x), () => { ap.A.reste = {}; jouer(ap.A, attente(m, 'attente')); }); jouer(ap.B, geste(id, 'B', m2, x), () => { ap.B.reste = {}; jouer(ap.B, attente(m2, 'attente')); }); ap.fin = dureeGeste(id) + 0.9; };
  ap.tour = tour; for (let i = 0; i < 12; i++) { avancer(ap.A, 1 / 60); avancer(ap.B, 1 / 60); } tour();
  for (let u = 0; u < t0; u += 1 / 60) { avancer(ap.A, 1 / 60); avancer(ap.B, 1 / 60); ap.t += 1 / 60; }
  return ap;
}
export function jouerApercu(ctx, ap, dt, cadre, encre) {
  const { cx, y0, Z } = cadre, Y = (y) => y0 - y * Z; ap.t += dt;
  if (!ap.duo) { const X = (x) => cx + x * Z; avancer(ap.d, dt); dessinerBranche(ctx, X, Y, Z, -cx / Z - 0.3, cx / Z + 0.3); dessinerOmbre(ctx, ap.d, X, Y, Z); dessinerDanseur(ctx, ap.d, ap.q.peau, ap.q.encre || encre, X, Y, Z); return; }
  if (ap.t >= ap.fin) { ap.t = 0; ap.tour(); }
  avancer(ap.A, dt); avancer(ap.B, dt);
  dessinerBranche(ctx, (x) => cx + x * Z, Y, Z, -cx / Z - 0.3, cx / Z + 0.3);
  const XA = (x) => cx + (-DUO / 2 + x) * Z, XB = (x) => cx + (DUO / 2 - x) * Z;
  dessinerOmbre(ctx, ap.B, XB, Y, Z); dessinerOmbre(ctx, ap.A, XA, Y, Z);
  dessinerDanseur(ctx, ap.B, ap.q.partenaire.peau, '#22313a', XB, Y, Z, true); dessinerDanseur(ctx, ap.A, ap.q.peau, ap.q.encre || encre, XA, Y, Z);
  const fl = Math.max(ap.A.J?.flash || 0, ap.B.J?.flash || 0); if (fl > 0.01) { ctx.fillStyle = `rgba(255,255,255,${fl * 0.6})`; ctx.fillRect(0, 0, cx * 2, y0 * 1.2); }
}
