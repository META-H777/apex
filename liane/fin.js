// LIANE — la scène de fin de duel : le gagnant descend chercher le perdant sous les cimes, le remonte, le dépose sur sa liane,
// puis fait sa danse de victoire pendant que l'Elo se décompte au-dessus de chacun.
// Rien ici ne touche aux règles ni au résultat : la scène ne fait que montrer ce que le duel a décidé.
// Les deux singes sont posés par le même calcul que pendant la course (singe.js) : on ne fait que leur dicter où sont leurs mains.
import { corps, poseSinge, dessinerSinge, morpho } from './singe.js?v=30';
import { dessinerPeau } from './peau.js?v=30';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const ECART = 1.55, HAUT = 4, SOUS = 1.7;      // demi-distance entre les deux lianes ; hauteur de l'attache au-dessus des mains au repos ; longueur de liane sous les mains
// Le déroulé, en secondes : la plongée du gagnant, la remontée à deux, l'élan, le lâcher, la saisie du perdant, l'Elo, la danse.
export const TEMPS = { plonge: [0.15, 0.95], monte: [1.3, 2.2], lache: 2.55, saisie: 2.95, elo: 3.3, geste: 4.5 };

// ---------- Les danses de victoire ----------
// Toutes sont des chorégraphies d'origine, faites pour un singe pendu à une liane. Une danse dit, à chaque instant u de sa boucle :
// th : de combien la liane se balance ; R : de combien il monte (négatif) ou descend le long de la liane ;
// tour : il pivote sur lui-même (1 de face, 0 de profil, -1 retourné) ; rot : tout le corps tourne autour des mains (en radians ; pi : la tête en bas, les pieds au ciel).
// haut : le corps passe au-dessus des mains, il faut de la place. vig : l'instant de la boucle montré sur la vignette de la boutique.
// elo : le seuil de classement qui la donne. prix : son prix en euros (boutique en essai). Ni l'un ni l'autre : elle est à tout le monde.
export const DANSES = [
  { id: 'toupie', nom: 'La toupie', vig: 2.5, duree: 3.4, texte: 'Deux grands balancers, puis deux tours sur lui-même en grimpant.',
    pas: (u) => u < 1.6 ? { th: 0.34 * Math.sin(TAU * u / 0.8) * lisse((1.6 - u) / 0.15) }
      : u < 2.3 ? { R: -0.45 * lisse((u - 1.6) / 0.7), tour: Math.cos(TAU * 2 * lisse((u - 1.6) / 0.7)) }
      : u < 2.8 ? { R: -0.45 - 0.08 * Math.sin(TAU * (u - 2.3) / 0.25) } : { R: -0.45 * (1 - lisse((u - 2.8) / 0.6)) } },
  { id: 'metronome', nom: 'Le métronome', vig: 0.45, elo: 950, duree: 3.0, texte: 'Gauche, droite, gauche, droite : sec, en rythme, et une pirouette pour finir la mesure.',
    pas: (u) => { const s = Math.sin(TAU * u / 0.6), sec = Math.sign(s) * Math.pow(Math.abs(s), 0.62);
      return u < 2.4 ? { th: 0.3 * sec * lisse((2.4 - u) / 0.12), R: -0.14 * Math.abs(Math.sin(TAU * u / 0.6)) } : { tour: Math.cos(TAU * lisse((u - 2.4) / 0.6)), R: -0.2 * Math.sin(Math.PI * (u - 2.4) / 0.6) }; } },
  { id: 'drapeau', nom: 'Le drapeau', haut: true, vig: 1.0, elo: 1100, duree: 4.2, texte: 'Il se met à l\'horizontale, raide comme un drapeau, d\'un côté puis de l\'autre.',
    pas: (u) => { const tremble = 0.025 * Math.sin(u * 31);
      return u < 0.5 ? { rot: 1.45 * lisse(u / 0.5) } : u < 1.6 ? { rot: 1.45 + tremble } : u < 2.2 ? { rot: lerp(1.45, -1.45, lisse((u - 1.6) / 0.6)) }
        : u < 3.3 ? { rot: -1.45 + tremble } : u < 3.8 ? { rot: -1.45 * (1 - lisse((u - 3.3) / 0.5)) } : { R: -0.12 * Math.sin(TAU * (u - 3.8) / 0.4) }; } },
  { id: 'poirier', nom: 'Le poirier', haut: true, vig: 1.5, prix: 1.99, duree: 4.4, texte: 'La tête en bas, les pieds au ciel, il se dandine sur ses mains, puis finit son tour.',
    pas: (u) => u < 0.6 ? { rot: Math.PI * lisse(u / 0.6) } : u < 2.4 ? { rot: Math.PI + 0.2 * Math.sin(TAU * (u - 0.6) / 0.45), R: 0.1 * Math.abs(Math.sin(TAU * (u - 0.6) / 0.45)) }
      : u < 3.0 ? { rot: Math.PI + Math.PI * lisse((u - 2.4) / 0.6) } : u < 3.7 ? { tour: Math.cos(TAU * lisse((u - 3.0) / 0.7)) } : { th: 0.12 * Math.sin(TAU * (u - 3.7) / 0.7) } },
  { id: 'soleil', nom: 'Le grand soleil', haut: true, vig: 1.2, prix: 2.99, duree: 4.0, texte: 'Trois tours complets autour de ses mains, bras tendus, comme à la barre fixe.',
    pas: (u) => u < 0.45 ? { th: -0.26 * Math.sin(Math.PI * u / 0.45) } : u < 2.65 ? { rot: TAU * 3 * lisse((u - 0.45) / 2.2), R: 0.15 * lisse((u - 0.45) / 0.3) }
      : u < 3.4 ? { th: 0.3 * Math.sin(TAU * (u - 2.65) / 0.75) * (1 - (u - 2.65) / 0.75), R: 0.15 * (1 - lisse((u - 2.65) / 0.4)) } : { R: -0.15 * Math.sin(Math.PI * (u - 3.4) / 0.6) } },
  { id: 'tornade', nom: 'La tornade', vig: 1.35, elo: 1400, duree: 3.6, texte: 'Cinq tours sur lui-même en montant le long de la liane, le corps qui tangue, et il se laisse retomber.',
    pas: (u) => u < 2.4 ? { tour: Math.cos(TAU * 5 * lisse(u / 2.4)), R: -0.95 * Math.sin(Math.PI * lisse(u / 2.4) * 0.5), rot: 0.22 * Math.sin(TAU * u / 0.55) * lisse((2.4 - u) / 0.25), th: 0.1 * Math.sin(TAU * u / 0.5) * lisse((2.4 - u) / 0.25) }
      : u < 2.9 ? { R: -0.95 * (1 - lisse((u - 2.4) / 0.5)) + 0.2 * Math.sin(Math.PI * (u - 2.4) / 0.5) } : { th: 0.3 * Math.sin(TAU * (u - 2.9) / 0.7) * (1 - (u - 2.9) / 0.7) } },
];
export const danseDe = (id) => DANSES.find((d) => d.id === id) || DANSES[0];

const acteur = (q, i, base) => ({ ...q, i, base, danse: danseDe(q.danse), B: corps(morpho(q.corps)), M: { mode: 'swing', th: 0, om: 0, x: 0, y: 0, vx: 0, vy: 0, depart: false }, face: 1, tour: 1, rot: 0, vu: false, porte: false, corde: true, pose: null, neuf: true, R: HAUT });
// moi, lui : { corps (les mesures de l'espèce), peau (l'atlas de la tenue, ou rien), encre (la couleur de la silhouette de secours), danse (l'identifiant de sa danse) }.
export function creerScene(moi, lui, gagne) { return { t: 0, A: [acteur(moi, 0, -ECART), acteur(lui, 1, ECART)], g: gagne ? 0 : 1, haut: false }; }

// Où sont les mains de chacun à l'instant t. Le gagnant : th (angle de sa liane) et R (longueur de liane au-dessus des mains).
function gagnant(a, t) {
  const T = TEMPS; let R = HAUT, th = 0; a.tour = 1; a.rot = 0; a.vu = t > T.plonge[0];
  if (t < T.monte[0]) R = lerp(0.7, 9.8, lisse((t - T.plonge[0]) / (T.plonge[1] - T.plonge[0])));                 // il se laisse glisser jusque sous les cimes
  else if (t < T.monte[1]) { const k = (t - T.monte[0]) / (T.monte[1] - T.monte[0]); R = lerp(9.8, HAUT, 1 - Math.pow(1 - k, 2.2)); th = 0.05 * Math.sin(t * 7); }      // il remonte, le perdant pendu à son pied
  else if (t < T.lache) th = 0.3 * lisse((t - T.monte[1]) / (T.lache - T.monte[1]));                               // il prend son élan vers l'autre liane
  else th = 0.3 * Math.cos(TAU * (t - T.lache) / 1.1) * Math.exp(-(t - T.lache) * 1.6);                            // il revient, et le balancement s'éteint
  if (t >= T.geste) {                           // sa danse de victoire, en boucle
    const d = a.danse, p = d.pas((t - T.geste) % d.duree), entre = lisse((t - T.geste) / 0.35);
    th += (p.th || 0) * entre; R += (p.R || 0) * entre; a.tour = lerp(1, p.tour ?? 1, entre); a.rot = (p.rot || 0) * entre;
  }
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
// Le corps suit les mains : même calcul que pendant la course.
function poser(q, dt) {
  const M = q.M;
  if (dt > 0 && !q.neuf) { M.vx = clamp((q.x - M.x) / dt, -30, 30); M.vy = clamp((q.y - M.y) / dt, -30, 30); M.om = clamp((q.th - M.th) / dt, -12, 12); } else { M.vx = M.vy = M.om = 0; }
  M.x = q.x; M.y = q.y; M.th = q.th; q.neuf = false;
  q.pose = poseSinge(M, q.B, dt, { ancre: q.porte ? [M.x, M.y + 3] : [0, HAUT], reste: q.porte ? 0 : SOUS, devant: M.mode === 'fly' ? Math.max(0.2, -M.x) : 99, attend: false, tend: true });
}
// Une liane : elle pend du haut de l'écran, passe par les mains, et continue un peu dessous. Claire avec un cœur foncé : sur le voile sombre, une liane noire ne se verrait pas.
function liane(ctx, q, cx, Y, Z, t) {
  const x0 = cx + q.base * Z, sens = q.i ? -1 : 1, tient = q.corde && q.vu && q.M.mode === 'swing' && !q.porte;
  const mx = tient ? x0 + q.x * sens * (q.face < 0 ? -1 : 1) : x0 + Math.sin(t * 0.9 + q.i * 2) * 0.05 * Z, my = tient ? Y(q.y) : Y(-0.2);
  const bx = mx + (mx - x0) * (SOUS / HAUT) * 0.7 + Math.sin(t * 1.7 + q.i) * 0.04 * Z * sens, by = my + SOUS * Z;
  const trace = () => { ctx.beginPath(); ctx.moveTo(x0, Y(HAUT)); ctx.lineTo(mx, my); ctx.quadraticCurveTo(lerp(mx, bx, 0.5), my + SOUS * Z * 0.55, bx, by); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(196,214,178,0.5)'; ctx.lineWidth = Math.max(2.5, Z * 0.1); trace(); ctx.strokeStyle = 'rgba(40,62,54,0.9)'; ctx.lineWidth = Math.max(1, Z * 0.045); trace();
}
// Un singe : retourné s'il regarde vers la gauche, aplati quand il pivote sur lui-même, tourné autour de ses mains quand la danse le demande.
function singe(ctx, q, cx, Y, Z, encre) {
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
  gagnant(g, t); perdant(p, t, g); poser(g, dt); poser(p, dt);
  scn.haut = Math.abs(Math.sin(g.rot / 2)) > 0.3;          // le gagnant a le corps au-dessus de ses mains : il passe devant son compteur d'Elo
  ctx.globalAlpha = a; for (const q of scn.A) liane(ctx, q, cx, Y, Z, t);
  singe(ctx, p, cx, Y, Z, encre); singe(ctx, g, cx, Y, Z, encre);     // le perdant d'abord, le gagnant devant lui
  ctx.globalAlpha = 1;
}

// L'aperçu d'une danse, pour la boutique : un singe seul sur sa liane, qui la danse en boucle. cadre : { cx, y0, Z }.
export function creerApercu(q, id) { const a = acteur({ ...q, danse: id }, 0, 0); a.vu = true; return { t: 0, a }; }
export function jouerApercu(ctx, ap, dt, cadre, encre) {
  const { cx, y0, Z } = cadre, a = ap.a, Y = (y) => y0 - y * Z; ap.t += dt;
  gagnant(a, TEMPS.geste + ap.t); poser(a, dt); liane(ctx, a, cx, Y, Z, ap.t); singe(ctx, a, cx, Y, Z, encre);
}
