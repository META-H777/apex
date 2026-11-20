// LIANE — la scène de fin de duel : le gagnant descend chercher le perdant sous les cimes, le remonte, le dépose sur sa liane,
// puis fait son geste de victoire pendant que l'Elo se décompte au-dessus de chacun.
// Rien ici ne touche aux règles ni au résultat : la scène ne fait que montrer ce que le duel a décidé.
// Les deux singes sont posés par le même calcul que pendant la course (singe.js) : on ne fait que leur dicter où sont leurs mains.
import { corps, poseSinge, dessinerSinge, morpho } from './singe.js?v=27';
import { dessinerPeau } from './peau.js?v=27';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const ECART = 1.55, HAUT = 4, SOUS = 1.7;      // demi-distance entre les deux lianes ; hauteur de l'attache au-dessus des mains au repos ; longueur de liane sous les mains
// Le geste de victoire d'aujourd'hui est le même pour tous (« la toupie »). Les danses à gagner ou à acheter viendront s'ajouter ici, une fonction par danse.
// Le déroulé, en secondes : la plongée du gagnant, la remontée à deux, l'élan, le lâcher, la saisie du perdant, l'Elo, le geste.
export const TEMPS = { plonge: [0.15, 0.95], monte: [1.3, 2.2], lache: 2.55, saisie: 2.95, elo: 3.3, geste: 3.7 };
const BOUCLE = 3.4;                             // durée d'un geste de victoire, qui se répète

// moi, lui : { corps (les mesures de l'espèce), peau (l'atlas de la tenue, ou rien), encre (la couleur de la silhouette de secours) }.
export function creerScene(moi, lui, gagne) {
  const acteur = (q, i) => ({ ...q, i, base: i ? ECART : -ECART, B: corps(morpho(q.corps)), M: { mode: 'swing', th: 0, om: 0, x: 0, y: 0, vx: 0, vy: 0, depart: false }, face: 1, tour: 1, vu: false, porte: false, corde: true, pose: null, neuf: true, R: HAUT });
  return { t: 0, A: [acteur(moi, 0), acteur(lui, 1)], g: gagne ? 0 : 1 };
}

// Où sont les mains de chacun à l'instant t. Le gagnant : th (angle de sa liane) et R (longueur de liane au-dessus des mains).
function gagnant(a, t) {
  const T = TEMPS; let R = HAUT, th = 0; a.tour = 1; a.vu = t > T.plonge[0];
  if (t < T.monte[0]) R = lerp(0.7, 9.8, lisse((t - T.plonge[0]) / (T.plonge[1] - T.plonge[0])));                 // il se laisse glisser jusque sous les cimes
  else if (t < T.monte[1]) { const k = (t - T.monte[0]) / (T.monte[1] - T.monte[0]); R = lerp(9.8, HAUT, 1 - Math.pow(1 - k, 2.2)); th = 0.05 * Math.sin(t * 7); }      // il remonte, le perdant pendu à son pied
  else if (t < T.lache) th = 0.3 * lisse((t - T.monte[1]) / (T.lache - T.monte[1]));                               // il prend son élan vers l'autre liane
  else th = 0.3 * Math.cos(TAU * (t - T.lache) / 1.1) * Math.exp(-(t - T.lache) * 1.6);                            // il revient, et le balancement s'éteint
  if (t >= T.geste) {                           // le geste de victoire : deux grands balancers, il grimpe en tournant sur lui-même, deux rebonds, il redescend
    const u = (t - T.geste) % BOUCLE, entre = lisse((t - T.geste) / 0.3);
    if (u < 1.6) th += 0.34 * Math.sin(TAU * u / 0.8) * entre * lisse((1.6 - u) / 0.15);
    else if (u < 2.3) { const k = (u - 1.6) / 0.7; R -= 0.45 * lisse(k); a.tour = Math.cos(TAU * 2 * lisse(k)); }       // deux tours sur lui-même en grimpant
    else if (u < 2.8) R -= 0.45 + 0.08 * Math.sin(TAU * (u - 2.3) / 0.25);
    else R -= 0.45 * (1 - lisse((u - 2.8) / 0.6));
  }
  a.M.mode = 'swing'; a.th = th; a.R = R; a.x = Math.sin(th) * R; a.y = HAUT - Math.cos(th) * R; a.porte = false; a.corde = true; a.face = 1;
}
// Le perdant : pendu au pied du gagnant, puis lâché vers sa liane, qu'il saisit ; il s'y balance, se retourne, et reste là.
function perdant(a, t, g) {
  const T = TEMPS; a.vu = t >= T.monte[0] && !!g.pose; a.tour = 1;
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

// Avance la scène et la dessine. cadre : { cx, y0 : le point de l'écran où sont les mains au repos, entre les deux lianes ; Z : pixels par mètre ; W, H }.
export function jouerScene(ctx, scn, dt, cadre, encre) {
  const { cx, y0, Z, W, H } = cadre, t = scn.t += dt, g = scn.A[scn.g], p = scn.A[1 - scn.g], Y = (y) => y0 - y * Z;
  // Un voile sombre, plus clair au centre : la forêt reste là, les deux singes sont dans la lumière.
  const a = lisse(t / 0.45), v = ctx.createRadialGradient(cx, y0 + Z * 1.1, Z * 0.6, cx, y0 + Z * 1.1, Math.max(W, H) * 0.75);
  v.addColorStop(0, `rgba(2,16,20,${0.3 * a})`); v.addColorStop(0.5, `rgba(2,16,20,${0.72 * a})`); v.addColorStop(1, `rgba(2,14,18,${0.9 * a})`);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  gagnant(g, t); perdant(p, t, g);
  for (const q of [g, p]) {
    const M = q.M;
    if (dt > 0 && !q.neuf) { M.vx = clamp((q.x - M.x) / dt, -30, 30); M.vy = clamp((q.y - M.y) / dt, -30, 30); M.om = clamp((q.th - M.th) / dt, -12, 12); } else { M.vx = M.vy = M.om = 0; }
    M.x = q.x; M.y = q.y; M.th = q.th; q.neuf = false;
    q.pose = poseSinge(M, q.B, dt, { ancre: q.porte ? [M.x, M.y + 3] : [0, HAUT], reste: q.porte ? 0 : SOUS, devant: q.M.mode === 'fly' ? Math.max(0.2, -M.x) : 99, attend: false, tend: true });
  }
  ctx.globalAlpha = a; ctx.lineCap = 'round';
  // Les deux lianes : elles pendent du haut de l'écran, passent par les mains, et continuent un peu dessous.
  for (const q of scn.A) {
    const x0 = cx + q.base * Z, sens = q.i ? -1 : 1, tient = q.corde && q.vu && q.M.mode === 'swing' && !q.porte;
    const mx = tient ? x0 + q.x * sens * (q.face < 0 ? -1 : 1) : x0 + Math.sin(t * 0.9 + q.i * 2) * 0.05 * Z, my = tient ? Y(q.y) : Y(-0.2);
    const bx = mx + (mx - x0) * (SOUS / HAUT) * 0.7 + Math.sin(t * 1.7 + q.i) * 0.04 * Z * sens, by = my + SOUS * Z;
    // Sur le voile sombre, une liane noire ne se verrait pas : elle est claire, avec un cœur plus foncé.
    const trace = () => { ctx.beginPath(); ctx.moveTo(x0, Y(HAUT)); ctx.lineTo(mx, my); ctx.quadraticCurveTo(lerp(mx, bx, 0.5), my + SOUS * Z * 0.55, bx, by); ctx.stroke(); };
    ctx.strokeStyle = 'rgba(196,214,178,0.5)'; ctx.lineWidth = Math.max(2.5, Z * 0.1); trace(); ctx.strokeStyle = 'rgba(40,62,54,0.9)'; ctx.lineWidth = Math.max(1, Z * 0.045); trace();
  }
  // Les singes : le perdant d'abord, le gagnant devant lui.
  for (const q of [p, g]) {
    if (!q.vu || !q.pose) continue;
    const s = (q.i ? -1 : 1) * q.face * q.tour, X = (x) => x * Z;
    ctx.save(); ctx.translate(cx + q.base * Z, 0); ctx.scale(Math.abs(s) < 0.04 ? 0.04 * (s < 0 ? -1 : 1) : s, 1);
    if (q.peau && q.peau.pret) dessinerPeau(ctx, q.pose, q.peau, X, Y, Z); else dessinerSinge(ctx, q.pose, q.encre || encre, X, Y, Z);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
