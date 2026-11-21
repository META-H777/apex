// LIANE — les gestes à deux : l'entrée avant le duel, le geste du gagnant après, et la poignée de main du fair-play.
// Demande de Romain (21/11/2026) : de la mise en scène dans le compétitif, comme les face-à-face des combats de MMA,
// avec une physique où l'on « s'y croit ». Chaque geste est écrit pour deux singes, face à face sur une branche, à D mètres l'un de l'autre :
// A fait le geste, B réagit. Chacun est écrit dans son propre repère, l'autre devant lui : les deux rôles se jouent des deux côtés de la scène.
// Deuxième passe (v0.22) : Romain trouvait la première « enfantine » (le selfie et son cœur). Ici, trois registres : classe, stylé, loufoque.
// Règles : aucune bulle ni effet de dessin animé ; des gestes lents et pesés, des arrêts nets ; le perdant ne surjoue jamais, il reste digne ;
// le loufoque est pince-sans-rire. Rien n'est la signature d'un sportif, d'un artiste ni d'un jeu : ce sont des gestes de tout le monde.
import { compiler, NEUTRE, MAIN, OBJET, DANSES, dureeReelle } from './danse.js?v=34';

export const D = 1.7;                                          // la distance entre les deux singes, d'un bassin à l'autre
// La pose de base face à l'autre : de trois quarts, presque de profil, les bras le long du corps.
const FACE = { yaw: 0.3, lean: 0.1, bend: 0.05, nod: 0.06, md: [0.06, -0.88, 0.22], mg: [0.06, -0.88, 0.22], ql: 0.3, qw: 0.08 };
const longJambe = (m) => m.CUISSE + m.JAMBE;
export const hautEpaule = (m) => 0.93 * longJambe(m) + m.PIED * 0.22 + m.TRONC * 0.97;
const PIED = (f, h = 0) => [f, 0.17, h];
const CROISES = { md: [0.24, -0.32, -0.22], mg: [0.3, -0.26, -0.3] };      // bras croisés sur la poitrine
const PEND = FACE.md, POINT = [0.85, 0.12, 0.1], GARDE_D = [0.3, 0.05, 0.1], GARDE_G = [0.4, 0.12, 0.1];
// De combien avancer pour qu'une main atteigne un point à X mètres devant soi : les petits singes font un pas de plus.
const approche = (m, X, k = 0.72) => Math.max(0.15, Math.min(0.9, X - k * m.ALLONGE));
// Un point de la scène vu par l'autre : son repère est retourné (l'autre est à D devant lui).
const chezLui = (x, p) => [x.D - p[0], p[1], p[2]];

// Un pas en avant (ou en arrière) de d mètres, de z0 à z0 + d : le corps avance, un pied décolle puis l'autre.
function pas(c, L, t0, dur, z0, d) {
  const f = (z) => z / L + 0.02, z1 = z0 + d;
  c.push({ t: t0, z: z0 / L, pd: PIED(f(z0)), pg: PIED(f(z0)) });
  c.push({ t: t0 + dur * 0.25, pd: PIED(f(z0 + d * 0.5), 0.06), y: -0.02 }, { t: t0 + dur * 0.5, pd: PIED(f(z1)), e: 'hit', y: -0.035 });
  c.push({ t: t0 + dur * 0.75, pg: PIED(f(z0 + d * 0.5), 0.06), y: -0.01 }, { t: t0 + dur, pg: PIED(f(z1)), z: z1 / L, y: 0, e: 'io' });
}
// Il secoue lentement la tête.
function non(c, t0, n = 3, a = 0.16, dt = 0.26) { for (let i = 0; i < n; i++) c.push({ t: t0 + i * dt, turn: i % 2 ? -a : a }); c.push({ t: t0 + n * dt, turn: 0 }); }
const nonCles = (t0, n, a, dt) => { const c = []; non(c, t0, n, a, dt); return c; };

// Chaque geste : (m : les mesures du singe qui joue ce rôle, x : { D, HS : la hauteur moyenne des épaules des deux }) → les clés de A et de B, en secondes.
// lent : [de, à, vitesse], un ralenti au moment fort. garde : A garde sa dernière pose, et suite : la boucle qu'il prend ensuite.
const GESTES = {
  // ---------- Classe ----------
  check: { duree: 2.0, A: (m, x) => checkCles(m, x), B: (m, x) => checkCles(m, x) },
  // Le salut : la main sur le cœur, l'autre dans le dos, une révérence lente ; les yeux ne quittent jamais l'adversaire.
  salut: { duree: 3.0, A: () => [{ t: 0.3, mg: [-0.3, -0.62, 0.02], e: 'io' }, { t: 0.75, md: [0.22, -0.14, -0.2], e: 'io' }, { t: 1.0, lean: 0.1, bend: 0.05, nod: 0.06 },
      { t: 1.6, lean: 0.5, bend: 0.26, nod: -0.3, ql: 0.12, e: 'io' }, { t: 2.1, lean: 0.5, bend: 0.26, nod: -0.3, stop: true }, { t: 2.65, lean: 0.1, bend: 0.05, nod: 0.06, ql: 0.3, e: 'io' },
      { t: 2.7, md: [0.22, -0.14, -0.2], mg: [-0.3, -0.62, 0.02] }],
    B: () => [{ t: 1.45, nod: 0.06, lean: 0.1 }, { t: 1.85, nod: 0.34, lean: 0.17, e: 'io' }, { t: 2.3, nod: 0.34, stop: true }, { t: 2.7, nod: 0.06, lean: 0.1, e: 'io' }] },
  // Les bandes : il serre la bande de son poignet, frappe ses deux poings l'un contre l'autre, puis relève lentement la tête.
  bandes: { duree: 3.1, A: () => { const c = [], W = [[0.47, -0.1, -0.12], [0.52, -0.26, -0.2], [0.42, -0.33, -0.27], [0.36, -0.18, -0.2]];
      c.push({ t: 0.2, fd: MAIN.poing }, { t: 0.5, md: [0.42, -0.22, 0.02], nod: 0.4, lean: 0.18, e: 'io' });
      for (let k = 0; k < 8; k++) c.push({ t: 0.62 + k * 0.13, mg: W[k % 4] });
      c.push({ t: 1.75, mg: [0.4, -0.2, -0.05], fg: MAIN.poing }, { t: 1.86, mg: [0.3, -0.38, 0.06], e: 'hit' }, { t: 2.05, md: [0.38, -0.16, 0.06], mg: [0.38, -0.16, -0.12], e: 'io' },
        { t: 2.2, md: [0.46, -0.2, -0.07], mg: [0.46, -0.2, -0.13], vib: 0.012, e: 'hit', stop: true }, { t: 2.3, nod: 0.4 }, { t: 2.85, nod: -0.08, lean: 0.08, e: 'io', stop: true }, { t: 2.9, vib: 0 });
      return c; },
    B: () => [{ t: 0.75, ...CROISES, nod: 0.04, e: 'io' }, { t: 2.4, ...CROISES, nod: -0.06 }, { t: 2.8, ...CROISES, nod: -0.06 }] },
  // ---------- Stylé ----------
  // En garde : garde haute, il roule des épaules, un direct, un croisé, puis souffle. Lourd, pas sautillant.
  garde: { duree: 2.9, A: () => { const c = []; c.push({ t: 0.2, fd: 1, fg: 1 }, { t: 0.5, md: GARDE_D, mg: GARDE_G, yaw: 0.15, twist: -0.2, lean: 0.2, nod: 0.18, pd: PIED(-0.08), pg: PIED(0.22), y: -0.07, e: 'io' });
      for (let t = 0.82, k = 0; t < 2.4; t += 0.34, k++) c.push({ t, y: k % 2 ? -0.05 : -0.09 });
      c.push({ t: 0.75, side: 0.07 }, { t: 0.95, side: -0.06 }, { t: 1.12, side: 0 });
      c.push({ t: 1.2, mg: GARDE_G }, { t: 1.32, mg: [0.86, 0.14, 0.04], e: 'hit', stop: true }, { t: 1.46, mg: [0.86, 0.14, 0.04] }, { t: 1.66, mg: GARDE_G, e: 'io' });
      c.push({ t: 1.72, md: GARDE_D, twist: -0.2, lean: 0.2 }, { t: 1.86, md: [0.86, 0.12, -0.06], twist: 0.32, lean: 0.32, e: 'hit', stop: true }, { t: 2.02, md: [0.86, 0.12, -0.06] }, { t: 2.28, md: GARDE_D, twist: -0.2, lean: 0.2, e: 'io' });
      c.push({ t: 2.45, side: 0.06, nod: 0.26, bend: 0.12 }, { t: 2.7, side: 0, nod: 0.18, bend: 0.05 }, { t: 2.75, fd: 0, fg: 0 }); return c; },
    B: () => [{ t: 0.6, ...CROISES, lean: 0.02, nod: -0.05, e: 'io' }, { t: 2.5, ...CROISES, nod: 0.08 }, { t: 2.7, nod: -0.02 }] },
  // Front contre front : les deux avancent jusqu'à presque se toucher, et ne bougent plus.
  front: { duree: 3.2, A: (m) => frontCles(m, 0), B: (m) => frontCles(m, 0.08) },
  // Je te regarde : deux doigts vers ses propres yeux, puis vers l'adversaire.
  regard: { duree: 2.6, A: () => [{ t: 0.3, fd: MAIN.v }, { t: 0.65, md: [0.2, 0.34, -0.06], lean: 0.08, e: 'io' }, { t: 1.15, md: [0.2, 0.34, -0.06], stop: true },
      { t: 1.45, md: [0.72, 0.3, 0.08], lean: 0.16, nod: 0.08, e: 'hit', stop: true }, { t: 2.05, md: [0.7, 0.3, 0.08] }, { t: 2.35, fd: 0, md: PEND, lean: 0.1, e: 'io' }],
    B: () => [{ t: 1.5, tilt: 0, nod: 0.06 }, { t: 1.95, tilt: 0.13, nod: -0.04, e: 'io' }, { t: 2.4, tilt: 0.13, nod: -0.04 }] },
  // La feinte : le poing part, et s'arrête à un souffle du visage. Ralenti au moment où il s'arrête. L'autre ne cille pas.
  feinte: { duree: 2.5, lent: [0.62, 1.0, 0.35], A: (m, x) => { const c = [], L = longJambe(m), T = [x.D - 0.55, x.HS + 0.12, 0.1];
      c.push({ t: 0.15, fd: 1, fg: 1, md: GARDE_D, mg: GARDE_G, lean: 0.15, y: -0.05, twist: -0.15, e: 'io' }, { t: 0.5, twist: -0.38, md: [0.12, -0.02, 0.18], y: -0.09, stop: true },
        { t: 0.72, kd: 1, wd: T, z: 0.22 / L, pd: PIED(0.24 / L), lean: 0.32, twist: 0.38, y: -0.06, e: 'hit' }, { t: 1.0, kd: 1, wd: T, stop: true }, { t: 1.45, kd: 1, wd: T, stop: true },
        { t: 1.95, kd: 0, md: PEND, mg: PEND, z: 0, pd: PIED(0.02), twist: 0, lean: 0.1, y: 0, e: 'io' }, { t: 1.95, fd: 0, fg: 0 }, { t: 2.1, nod: 0.2 }, { t: 2.35, nod: 0.06 });
      return c; },
    B: () => [{ t: 1.2, nod: 0.06, tilt: 0 }, { t: 1.75, nod: -0.06, tilt: 0.05, e: 'io' }, { t: 2.3, nod: -0.06, tilt: 0.05 }] },
  // ---------- Loufoque, pince-sans-rire ----------
  // La banane : il l'épluche sans le quitter des yeux, croque deux fois, lui tend la peau ; l'autre ne la prend pas ; il la jette par-dessus son épaule.
  banane: { duree: 3.6, A: (m, x) => { const c = [], H = [0.2, 0.3, -0.1], T = [x.D / 2 + 0.05, x.HS - 0.28, 0.16];
      c.push({ t: 0.2, md: [-0.3, -0.6, 0.05], e: 'io' }, { t: 0.32, od: OBJET.banane, fd: MAIN.poing }, { t: 0.7, md: [0.38, -0.15, 0.05], e: 'io' });
      [[0.47, -0.3, -0.05], [0.42, -0.32, -0.32], [0.5, -0.32, -0.2]].forEach((bas, i) => c.push({ t: 0.85 + i * 0.3, mg: [0.4, 0.06, -0.2], e: 'io' }, { t: 0.99 + i * 0.3, mg: bas, e: 'hit' }));
      c.push({ t: 1.6, od: OBJET.pelee }, { t: 1.75, mg: PEND, e: 'io' }, { t: 1.75, md: [0.38, -0.15, 0.05] });
      c.push({ t: 1.95, md: H, e: 'io' }, { t: 2.0, nod: 0.06 }, { t: 2.07, nod: 0.16, e: 'hit' }, { t: 2.08, od: OBJET.croquee }, { t: 2.2, nod: 0.04 }, { t: 2.32, nod: 0.15, e: 'hit' }, { t: 2.33, od: OBJET.peau }, { t: 2.45, nod: 0.06 });
      c.push({ t: 2.32, md: H }, { t: 2.62, kd: 0 }, { t: 2.8, kd: 1, wd: T, lean: 0.2, e: 'io' }, { t: 3.0, kd: 1, wd: T, stop: true }, { t: 3.28, kd: 0, md: [-0.1, 0.6, 0.3], lean: 0.08, e: 'io' }, { t: 3.24, od: 0, fd: 0 }, { t: 3.5, md: [0.0, 0.1, 0.3], e: 'io' });
      return c; },
    B: () => [{ t: 2.75, nod: 0.06 }, { t: 2.92, nod: 0.36, e: 'io' }, { t: 3.05, nod: 0.36 }, { t: 3.25, nod: 0.0, e: 'io' }] },
  // Le mètre ruban : il lui prend la longueur du bras, de l'épaule au poignet, lit, note dans un carnet, et s'en va.
  metre: { duree: 3.5, A: (m, x) => { const c = [], L = longJambe(m), S = [x.D - 0.02, x.HS - 0.04, 0.24], W = [x.D - 0.1, x.HS - 0.9, 0.26], a = approche(m, x.D - 0.06, 1.05);
      c.push({ t: 0.15, mg: [-0.28, -0.6, -0.05], md: [-0.15, -0.7, 0.15], e: 'io' }, { t: 0.3, og: OBJET.metre, fg: MAIN.poing });
      pas(c, L, 0.35, 0.55, 0, a); c.push({ t: 0.6, mg: [0.3, -0.3, 0.1], md: [0.3, -0.25, 0.2] });
      c.push({ t: 1.0, kd: 1, kg: 1, wd: S, wg: [S[0] - 0.04, S[1] - 0.06, S[2] + 0.02], lean: 0.14, nod: 0.12, e: 'io' }, { t: 1.08, od: OBJET.ruban, fd: MAIN.poing });
      c.push({ t: 1.2, kg: 1, wg: [S[0] - 0.04, S[1] - 0.06, S[2] + 0.02] }, { t: 1.7, kg: 1, wg: W, lean: 0.26, bend: 0.14, nod: 0.38, e: 'io' }, { t: 2.05, kg: 1, wg: W, kd: 1, wd: S, tilt: 0.12, stop: true });
      c.push({ t: 2.2, kd: 0, kg: 0, md: [0.32, -0.2, 0.1], mg: [0.36, -0.28, -0.12], lean: 0.15, bend: 0.05, tilt: 0, e: 'io' }, { t: 2.15, od: 0 }, { t: 2.25, og: OBJET.carnet, od: OBJET.crayon });
      for (let k = 0; k < 5; k++) c.push({ t: 2.35 + k * 0.08, md: [0.36 + (k % 2) * 0.03, -0.17 - (k % 2) * 0.02, -0.04 - (k % 2) * 0.04] });
      c.push({ t: 2.3, nod: 0.38 }, { t: 2.75, nod: 0.38 }, { t: 2.85, og: 0, od: 0, fd: 0, fg: 0, md: PEND, mg: PEND, nod: 0.0, e: 'io' });
      pas(c, L, 2.85, 0.55, a, -a); return c; },
    B: () => [{ t: 1.0, nod: 0.06 }, { t: 1.7, nod: 0.32, e: 'io' }, { t: 2.1, nod: 0.32 }, { t: 2.55, nod: 0.0, tilt: 0.1, e: 'io' }, { t: 3.2, tilt: 0.1 }] },
  // Chut : le doigt sur la bouche, puis la main à l'oreille. L'autre tourne la tête.
  chut: { duree: 2.3, A: () => [{ t: 0.2, fd: MAIN.index }, { t: 0.35, md: [0.2, 0.22, -0.1], lean: 0.14, e: 'io' }, { t: 1.0, md: [0.2, 0.22, -0.1] }, { t: 1.12, fd: 0 },
      { t: 1.3, md: [0.02, 0.3, 0.22], tilt: 0.25, lean: 0.2, e: 'io' }, { t: 1.95, md: [0.02, 0.3, 0.22], tilt: 0.25 }],
    B: () => [{ t: 0.5, turn: 0 }, { t: 0.9, turn: -0.45, ...CROISES, e: 'io' }, { t: 1.9, turn: -0.45, ...CROISES }] },
  // L'épaule : il s'époussette l'épaule, et lui tourne le dos. Il reste ainsi.
  epaule: { duree: 2.7, garde: true, suite: 'dos', A: () => [{ t: 0.3, turn: 0, nod: 0.06 }, { t: 0.6, mg: [0.16, 0.1, -0.52], turn: 0.45, nod: 0.22, e: 'io' },
      { t: 0.78, mg: [0.3, -0.06, -0.24], e: 'hit' }, { t: 0.95, mg: [0.16, 0.1, -0.52], e: 'io' }, { t: 1.12, mg: [0.3, -0.06, -0.24], e: 'hit' }, { t: 1.4, mg: PEND, turn: 0, nod: 0.06, e: 'io' },
      { t: 1.45, yaw: 0.3 }, { t: 2.2, yaw: 2.35, lean: 0.04, bend: -0.08, nod: -0.1, ql: 0.55, e: 'io' }, { t: 2.3, ...CROISES }, { t: 2.7, yaw: 2.35, ...CROISES }],
    B: () => [{ t: 1.6, nod: 0.06 }, { t: 2.2, nod: 0.3, e: 'io' }, { t: 2.6, nod: 0.3 }] },
  // Le trône : il s'assoit sur la branche, jambes croisées, le menton sur le poing. Il ne se relève pas.
  trone: { duree: 2.9, garde: true, suite: 'trone', A: (m) => troneCles(m, true), B: () => [{ t: 1.4, nod: 0.06 }, { t: 2.1, nod: 0.3, e: 'io' }, { t: 2.8, nod: 0.3 }] },
  // Le pourboire : une pièce glissée dans sa main, deux petites tapes sur la joue. Sa main s'est tendue toute seule.
  pourboire: { duree: 3.3, A: (m, x) => { const c = [], L = longJambe(m), PB = [x.D / 2 - 0.12, x.HS - 0.5, 0.14], PA = chezLui(x, PB), J = [x.D - 0.27, x.HS + 0.28, 0.2], a = approche(m, x.D - 0.25);
      c.push({ t: 0.2, md: [-0.15, -0.8, 0.2], e: 'io' }, { t: 0.36, od: OBJET.piece }); pas(c, L, 0.45, 0.55, 0, a);
      c.push({ t: 0.8, md: [0.35, -0.4, 0.15] }, { t: 1.08, kd: 1, wd: [PA[0], PA[1] + 0.1, PA[2]], lean: 0.2, e: 'io' }, { t: 1.3, kd: 1, wd: PA, e: 'io', stop: true }, { t: 1.36, od: 0 }, { t: 1.48, kd: 1, wd: [PA[0], PA[1] + 0.06, PA[2]] });
      c.push({ t: 1.75, kd: 1, wd: [J[0] - 0.08, J[1], J[2] + 0.04], e: 'io' }, { t: 1.88, wd: J, e: 'hit' }, { t: 2.0, wd: [J[0] - 0.07, J[1], J[2] + 0.04] }, { t: 2.12, wd: J, e: 'hit' }, { t: 2.3, kd: 0, md: PEND, lean: 0.1, e: 'io' });
      pas(c, L, 2.4, 0.6, a, -a); return c; },
    B: (m, x) => { const PB = [x.D / 2 - 0.12, x.HS - 0.5, 0.14]; return [{ t: 0.85, kd: 0 }, { t: 1.2, kd: 1, wd: PB, nod: 0.3, e: 'io' }, { t: 1.36, od: OBJET.piece }, { t: 1.8, kd: 1, wd: PB, nod: 0.36 },
      { t: 1.9, turn: -0.06 }, { t: 2.0, turn: 0 }, { t: 2.14, turn: -0.06 }, { t: 2.3, turn: 0 }, { t: 2.55, nod: 0.02, e: 'io' }, { t: 2.65, fd: MAIN.poing, od: 0 }, { t: 2.95, kd: 0, md: PEND, e: 'io' }, { t: 3.0, fd: 0 }]; } },
  // L'arbitre : il lui prend le poignet et lève son bras à sa place, face au public… puis le lâche.
  arbitre: { duree: 3.3, lent: [1.15, 1.6, 0.55], A: (m, x) => { const c = [], L = longJambe(m), P0 = [0.22, x.HS - 0.95, 0.2], P1 = [0.18, x.HS + 0.4, 0.16], a = approche(m, x.D - 0.2);
      pas(c, L, 0.15, 0.55, 0, a); c.push({ t: 0.75, kd: 0 }, { t: 0.98, kd: 1, wd: chezLui(x, P0), lean: 0.3, bend: 0.15, e: 'io' }, { t: 1.15, kd: 1, wd: chezLui(x, P0), stop: true },
        { t: 1.6, kd: 1, wd: chezLui(x, P1), lean: 0.0, bend: -0.1, yaw: 0.85, nod: -0.05, e: 'io', stop: true }, { t: 2.25, kd: 1, wd: chezLui(x, P1), yaw: 0.85 },
        { t: 2.5, kd: 0, md: [0.4, 0.2, 0.25], e: 'io' }, { t: 2.8, md: PEND, yaw: 0.3, nod: 0.06, lean: 0.1, e: 'io' });
      pas(c, L, 2.5, 0.6, a, -a); return c; },
    B: (m, x) => { const P0 = [0.22, x.HS - 0.95, 0.2], P1 = [0.18, x.HS + 0.4, 0.16]; return [{ t: 0.98, kd: 0 }, { t: 1.15, kd: 1, wd: P0 }, { t: 1.6, kd: 1, wd: P1, side: -0.1, nod: 0.18, e: 'io', stop: true },
      { t: 2.25, kd: 1, wd: P1, nod: 0.22 }, { t: 2.3, kd: 1, wd: P1 }, { t: 2.7, kd: 0, md: PEND, side: 0, e: 'out' }, { t: 3.0, nod: 0.25 }]; } },
  // Regarde en bas : un rond du pouce et de l'index sous sa taille ; il regarde ; petite tape sur l'épaule.
  rond: { duree: 2.7, A: (m, x) => { const c = [], L = longJambe(m), T = [x.D - 0.2, x.HS - 0.02, 0.12]; pas(c, L, 0.15, 0.45, 0, 0.2);
      c.push({ t: 0.55, fd: MAIN.rond, fg: MAIN.index, md: [0.32, -0.66, 0.18], mg: [0.42, -0.52, 0.04], nod: 0.04, e: 'io' }, { t: 1.05, md: [0.32, -0.66, 0.18], mg: [0.42, -0.52, 0.04] },
        { t: 1.1, fg: MAIN.poing }, { t: 1.2, kg: 1, wg: T, e: 'hit', twist: 0.2 }, { t: 1.26, kg: 1, wg: T }, { t: 1.42, kg: 0, mg: PEND, twist: 0, fd: 0, fg: 0, e: 'io' },
        { t: 1.6, fd: MAIN.index, md: POINT, e: 'hit', stop: true }, { t: 2.05, md: POINT, nod: 0.12 }, { t: 2.2, fd: 0, md: PEND, nod: 0.06, e: 'io' }); pas(c, L, 2.1, 0.5, 0.2, -0.2); return c; },
    B: (m) => { const L = longJambe(m); return [{ t: 0.75, nod: 0.06 }, { t: 0.95, nod: 0.6, lean: 0.2, e: 'io' }, { t: 1.18, nod: 0.6 },
      { t: 1.24, side: 0.1, lean: 0.02, nod: 0.12, z: -0.03 / L, e: 'hit' }, { t: 1.6, side: 0, z: 0, nod: 0.06, e: 'io' }, ...nonCles(1.75, 3, 0.14, 0.28)]; } },
  // Le doigt : le doigt d'honneur, puis les deux. L'autre lève les mains et secoue la tête.
  doigt: { duree: 2.4, A: () => [{ t: 0.25, yaw: 0.2, lean: -0.08, nod: -0.2 }, { t: 0.32, fd: MAIN.doigt }, { t: 0.48, md: [0.78, 0.3, 0.12], e: 'hit', stop: true },
      { t: 0.85, md: [0.86, 0.34, 0.12], e: 'hit' }, { t: 1.02, md: [0.78, 0.3, 0.12] }, { t: 1.08, fg: MAIN.doigt }, { t: 1.22, mg: [0.7, 0.4, 0.2], e: 'hit', stop: true },
      { t: 1.7, md: [0.8, 0.32, 0.12], mg: [0.72, 0.4, 0.2], nod: -0.25 }, { t: 1.95, md: PEND, mg: PEND, yaw: 0.3, lean: 0.1, nod: 0.06 }, { t: 2.0, fd: 0, fg: 0 }],
    B: () => [{ t: 0.6, lean: 0.1 }, { t: 0.85, md: [0.2, -0.3, 0.55], mg: [0.2, -0.3, 0.55], lean: -0.05, e: 'io' }, ...nonCles(1.0, 3, 0.15, 0.24), { t: 2.1, md: PEND, mg: PEND, lean: 0.1, e: 'io' }] },
  // La poignée de main, et son refus.
  main: { duree: 2.0, A: (m, x) => mainCles(m, x), B: (m, x) => mainCles(m, x) },
  refus: { duree: 2.2, A: (m, x) => { const P = [x.D / 2 - 0.02, x.HS - 0.42, 0.13]; return [{ t: 0.55, kd: 1, wd: P, lean: 0.2, e: 'io' }, { t: 1.2, kd: 1, wd: P }, { t: 1.45, kd: 0, md: PEND, lean: 0.1 },
      { t: 1.7, md: [0.12, -0.35, 0.55], mg: [0.12, -0.35, 0.55], y: 0.03, tilt: 0.18, e: 'hit' }, { t: 2.0, md: PEND, mg: PEND, y: 0, tilt: 0 }]; },
    B: () => [{ t: 0.35, ...CROISES }, { t: 0.6, turn: -0.5, nod: -0.06, e: 'io' }, { t: 1.9, turn: -0.5, ...CROISES }] },
};
function checkCles(m, x) {
  const c = [], L = longJambe(m), P = [x.D / 2 - 0.04, x.HS - 0.48, 0.14];
  c.push({ t: 0.2, fd: MAIN.poing }, { t: 0.3, md: [0.38, -0.3, 0.25], lean: 0.14 }); pas(c, L, 0.3, 0.42, 0, 0.14);
  c.push({ t: 0.62, kd: 0 }, { t: 0.78, kd: 1, wd: P, lean: 0.24, e: 'hit', stop: true }, { t: 0.98, kd: 1, wd: P, stop: true }, { t: 1.2, kd: 0, md: [0.3, -0.45, 0.25], e: 'io' });
  c.push({ t: 1.35, nod: 0.06 }, { t: 1.55, nod: 0.3, e: 'io' }, { t: 1.62, fd: 0 }, { t: 1.85, nod: 0.06, md: PEND, lean: 0.1, e: 'io' }); pas(c, L, 1.25, 0.45, 0.14, -0.14); return c;
}
// Front contre front : chacun avance de ce qu'il faut pour que les têtes se rejoignent au milieu, les poings serrés, et tient.
function frontCles(m, d0) {
  const c = [], L = longJambe(m), a = 0.25;
  c.push({ t: 0.1 + d0, fd: MAIN.poing, fg: MAIN.poing });
  pas(c, L, 0.15 + d0, 0.55, 0, a * 0.5); pas(c, L, 0.7 + d0, 0.55, a * 0.5, a * 0.5);
  c.push({ t: 0.75 + d0, yaw: 0.12, lean: 0.34, bend: -0.06, nod: 0.3, md: [0.1, -0.82, 0.3], mg: [0.1, -0.82, 0.3], e: 'io' }, { t: 1.3 + d0, vib: 0.01, stop: true }, { t: 2.1, vib: 0.01, lean: 0.36, stop: true });
  pas(c, L, 2.2 + d0, 0.65, a, -a); c.push({ t: 2.55 + d0, yaw: 0.3, lean: 0.1, bend: 0.05, nod: 0.06, vib: 0, e: 'io' }, { t: 2.8 + d0, fd: 0, fg: 0 });
  return c;
}
// Assis sur la branche : le bassin posé, la jambe droite croisée sur le genou gauche, le coude sur le genou, le menton sur le poing.
function troneCles(m, entree) {
  const L = longJambe(m), H0 = 0.93 * L + m.PIED * 0.22, ys = (0.06 - H0) / L;
  const assis = { y: ys, lean: 0.12, bend: 0.14, nod: 0.08, vol: 1, ad: [0.44, -0.04, -0.16], ag: [0.34, -0.8, 0.06], md: [0.34, 0.08, -0.08], fd: MAIN.poing, mg: [0.42, -0.5, 0.0], ql: -0.2, qc: 0.22, qw: 0.05 };
  if (!entree) return [{ t: 0, ...assis }, { t: 1.5, nod: 0.12, tilt: 0.06 }, { t: 3, nod: 0.08, tilt: 0 }];
  return [{ t: 0.25, y: 0, lean: 0.1, vol: 0 }, { t: 0.55, md: [0.25, -0.75, 0.32], mg: [0.2, -0.78, 0.38], e: 'io' }, { t: 0.7, y: -0.25, lean: 0.35, bend: 0.1, vol: 0.2, e: 'io' },
    { t: 1.25, ...assis, md: [0.4, -0.3, 0.1], fd: 0, nod: 0.06, e: 'io' }, { t: 1.7, ...assis, e: 'io' }, { t: 2.3, tilt: 0.08 }, { t: 2.9, ...assis, tilt: 0 }];
}
function mainCles(m, x) {
  const c = [], L = longJambe(m), P = [x.D / 2 - 0.02, x.HS - 0.42, 0.13], h = (dy) => [P[0], P[1] + dy, P[2]];
  pas(c, L, 0.1, 0.4, 0, 0.14);
  c.push({ t: 0.35, kd: 0, md: [0.4, -0.45, 0.2] }, { t: 0.62, kd: 1, wd: P, lean: 0.18, e: 'io' }, { t: 0.78, wd: h(0.05) }, { t: 0.92, wd: h(-0.04) }, { t: 1.06, wd: h(0.04) }, { t: 1.2, wd: h(0), kd: 1, stop: true }, { t: 0.8, kd: 1 },
    { t: 0.95, nod: 0.22 }, { t: 1.25, nod: 0.06 }, { t: 1.4, kd: 0, md: PEND, lean: 0.1 }); pas(c, L, 1.4, 0.4, 0.14, -0.14); return c;
}

// Les attentes, en boucle : avant le duel (prêt, il respire), le perdant (abattu), le gagnant après un geste (bras croisés, fier),
// et ce qui suit certains gestes : assis sur son trône, ou de dos.
const ATTENTES = {
  attente: { duree: 2.4, cles: [{ t: 0, y: 0 }, { t: 0.6, y: -0.025 }, { t: 1.2, y: 0, md: [0.1, -0.86, 0.22] }, { t: 1.8, y: -0.025, mg: [0.1, -0.86, 0.22] }, { t: 0.3, nod: 0.03 }, { t: 1.5, nod: 0.09 }] },
  defait: { duree: 4, cles: [{ t: 0, lean: 0.3, bend: 0.25, nod: 0.45, y: -0.04, md: [0.12, -0.95, 0.12], mg: [0.12, -0.95, 0.12], ql: 0.1 }, { t: 1.2, bend: 0.3, y: -0.05 }, { t: 2.2, bend: 0.22, y: -0.035 },
    { t: 2.6, turn: 0.15 }, { t: 3.0, turn: -0.15 }, { t: 3.4, turn: 0 }] },
  fier: { duree: 3, cles: [{ t: 0, ...CROISES, bend: -0.1, lean: -0.05, nod: -0.12, ql: 0.5, y: 0 }, { t: 0.75, y: -0.02 }, { t: 1.5, y: 0 }, { t: 2.25, y: -0.02 }, { t: 1.5, tilt: 0.08 }] },
  dos: { duree: 3, cles: [{ t: 0, ...CROISES, yaw: 2.35, lean: 0.04, bend: -0.08, nod: -0.1, ql: 0.55, y: 0 }, { t: 1.5, y: -0.015, nod: -0.06 }] },
  trone: { duree: 3, cles: (m) => troneCles(m, false) },
};
const cacheA = new Map();
export function attente(m, id) {
  const cle = id + ':' + m.K + ':' + m.TRONC;
  if (!cacheA.has(cle)) { const a = ATTENTES[id]; cacheA.set(cle, compiler({ duree: a.duree, temps: 1, cles: typeof a.cles === 'function' ? a.cles(m) : a.cles, base: FACE }, true)); }
  return cacheA.get(cle);
}
// Le geste compilé pour un rôle. role : 'A' (celui qui le fait) ou 'B' (celui qui réagit). x : { D, HS }.
export function geste(id, role, m, x) { const g = GESTES[id]; return compiler({ duree: g.duree, temps: 1, cles: g[role](m, x), base: FACE, lent: g.lent, garde: role === 'A' && g.garde }, false); }
export const dureeGeste = (id) => dureeReelle(GESTES[id].duree, GESTES[id].lent);
export const suiteDe = (id) => (GESTES[id] && GESTES[id].suite) || null;

// ---------- Le catalogue : ce que montre la boutique ----------
// quand : avant (l'entrée, pendant l'annonce du duel), apres (le gagnant, à la fin). type : geste (à deux) ou danse (seul).
// elo : le rang qui le donne ; prix : en euros (boutique en essai). Ni l'un ni l'autre : offert. grossier : masqué si le joueur le demande.
// ancien : l'animation de la v0.21 qu'il remplace (ce qui était à soi le reste, et un adversaire resté sur l'ancienne version voit la nouvelle).
// Prix et rangs : des propositions de Claude, à confirmer par Romain et PA.
export const ANIMS = [
  { id: 'check', nom: 'Le check', type: 'geste', quand: ['avant'], vig: 0.95, texte: 'Les poings qui se touchent, un signe de tête. Le respect avant le combat.' },
  { id: 'salut', nom: 'Le salut', type: 'geste', quand: ['avant', 'apres'], vig: 1.9, texte: 'La main sur le cœur, une révérence lente. Les yeux ne quittent jamais l\'adversaire.' },
  { id: 'garde', nom: 'En garde', type: 'geste', quand: ['avant'], vig: 1.9, elo: 950, texte: 'Garde haute, il roule des épaules, envoie un direct et un croisé dans le vide, puis souffle.' },
  { id: 'front', ancien: 'face', nom: 'Front contre front', type: 'geste', quand: ['avant'], vig: 1.7, elo: 1100, texte: 'Les deux s\'avancent jusqu\'à presque se toucher le front. Personne ne bouge.' },
  { id: 'regard', nom: 'Je te regarde', type: 'geste', quand: ['avant', 'apres'], vig: 1.6, elo: 1250, texte: 'Deux doigts vers ses propres yeux, puis vers l\'adversaire.' },
  { id: 'feinte', nom: 'La feinte', type: 'geste', quand: ['avant', 'apres'], vig: 1.5, elo: 1250, texte: 'Le poing part et s\'arrête à un souffle de son visage. Il ne cille pas.' },
  { id: 'bandes', nom: 'Les bandes', type: 'geste', quand: ['avant'], vig: 2.3, elo: 1400, texte: 'Il serre la bande de son poignet, frappe ses poings l\'un contre l\'autre, puis relève lentement la tête.' },
  { id: 'banane', ancien: 'gateau', nom: 'La banane', type: 'geste', quand: ['avant', 'apres'], vig: 2.95, prix: 1.99, texte: 'Il épluche une banane sans le quitter des yeux, croque, et lui tend la peau.' },
  { id: 'metre', ancien: 'selfie', nom: 'Le mètre ruban', type: 'geste', quand: ['avant', 'apres'], vig: 1.8, prix: 1.99, texte: 'Il lui prend la longueur du bras au mètre ruban, note le chiffre dans un carnet, et s\'en va.' },
  { id: 'chut', nom: 'Chut', type: 'geste', quand: ['apres'], vig: 0.9, texte: 'Le doigt sur la bouche, puis la main à l\'oreille. Plus personne ne parle.' },
  { id: 'epaule', ancien: 'facile', nom: 'L\'épaule', type: 'geste', quand: ['apres'], vig: 2.5, elo: 950, texte: 'Il s\'époussette l\'épaule, et lui tourne le dos.' },
  { id: 'pourboire', ancien: 'fleur', nom: 'Le pourboire', type: 'geste', quand: ['apres'], vig: 1.4, prix: 0.99, texte: 'Une pièce glissée dans sa main, deux petites tapes sur la joue.' },
  { id: 'arbitre', nom: 'L\'arbitre', type: 'geste', quand: ['apres'], vig: 2.1, prix: 0.99, texte: 'Il lui prend le poignet et lève son bras à sa place, face au public. Puis il le lâche.' },
  { id: 'trone', nom: 'Le trône', type: 'geste', quand: ['apres'], vig: 2.6, prix: 2.99, texte: 'Il s\'assoit sur la branche, jambes croisées, le menton sur le poing. Il ne se relève pas.' },
  { id: 'rond', nom: 'Regarde en bas', type: 'geste', quand: ['apres'], vig: 1.0, prix: 1.99, texte: 'Un rond du pouce et de l\'index, caché sous sa taille. L\'autre regarde : tape sur l\'épaule.' },
  { id: 'doigt', nom: 'Le doigt', type: 'geste', quand: ['apres'], vig: 1.3, prix: 0.99, grossier: true, texte: 'Le doigt d\'honneur, puis les deux. Réservé aux mauvais gagnants.' },
  ...DANSES.map((d) => ({ ...d, type: 'danse', quand: ['apres'] })),
];
export const animDe = (id, quand = 'apres') => ANIMS.find((a) => (a.id === id || a.ancien === id) && a.quand.includes(quand)) || ANIMS.find((a) => a.quand.includes(quand) && !a.elo && !a.prix);
export { FACE, NEUTRE };
