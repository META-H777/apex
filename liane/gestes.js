// LIANE — les gestes à deux : l'entrée avant le duel, le geste du gagnant après, et la poignée de main du fair-play.
// Demande de Romain (21/11/2026) : de la mise en scène dans le compétitif, comme les face-à-face des combats de MMA,
// avec une physique où l'on « s'y croit ». Chaque geste est écrit pour deux singes, face à face sur une branche, à D mètres l'un de l'autre :
// A fait le geste, B réagit. Chacun est écrit dans son propre repère, l'autre devant lui : les deux rôles se jouent des deux côtés de la scène.
// Inspirations (recherche du 21/11) : les face-à-face des pesées de MMA (se rapprocher front contre front, toucher les gants), les provocations
// des célébrations sportives (chut, bâillement, doigt pointé), les farces connues de tous (le rond « regarde en bas », le gâteau dans la figure).
// Rien n'est la signature d'un sportif, d'un artiste ni d'un jeu : ce sont des gestes de tout le monde.
import { compiler, NEUTRE, MAIN, OBJET, BULLE, DANSES } from './danse.js?v=33';

export const D = 1.7;                                          // la distance entre les deux singes, d'un bassin à l'autre
// La pose de base face à l'autre : de trois quarts, presque de profil, les bras le long du corps.
const FACE = { yaw: 0.3, lean: 0.1, bend: 0.05, nod: 0.06, md: [0.06, -0.88, 0.22], mg: [0.06, -0.88, 0.22], ql: 0.3, qw: 0.08 };
const longJambe = (m) => m.CUISSE + m.JAMBE;
export const hautEpaule = (m) => 0.93 * longJambe(m) + m.PIED * 0.22 + m.TRONC * 0.97;
const PIED = (f, h = 0) => [f, 0.17, h];
const CROISES = { md: [0.24, -0.32, -0.22], mg: [0.3, -0.26, -0.3] };      // bras croisés sur la poitrine
const PEND = FACE.md, POINT = [0.85, 0.12, 0.1], GARDE_D = [0.3, 0.05, 0.1], GARDE_G = [0.4, 0.12, 0.1];

// Un pas en avant (ou en arrière) de d mètres, de z0 à z0 + d : le corps avance, un pied décolle puis l'autre.
function pas(c, L, t0, dur, z0, d) {
  const f = (z) => z / L + 0.02, z1 = z0 + d;
  c.push({ t: t0, z: z0 / L, pd: PIED(f(z0)), pg: PIED(f(z0)) });
  c.push({ t: t0 + dur * 0.25, pd: PIED(f(z0 + d * 0.5), 0.07), y: -0.02 }, { t: t0 + dur * 0.5, pd: PIED(f(z1)), e: 'hit', y: -0.04 });
  c.push({ t: t0 + dur * 0.75, pg: PIED(f(z0 + d * 0.5), 0.07), y: -0.01 }, { t: t0 + dur, pg: PIED(f(z1)), z: z1 / L, y: 0, e: 'io' });
}
// Le rire : il se plie, les mains sur le ventre, et rebondit.
function rire(c, t0, t1) { c.push({ t: t0, bulle: BULLE.rire, bend: 0.3, md: [0.3, -0.45, 0.05], mg: [0.3, -0.48, 0.05], fd: 0, fg: 0 }); for (let t = t0 + 0.12, k = 0; t < t1; t += 0.14, k++) c.push({ t, y: k % 2 ? 0 : -0.045 }); c.push({ t: t1, bulle: 0, y: 0 }); }
// Il secoue la tête, de gauche à droite.
function non(c, t0, n = 3, a = 0.22) { for (let i = 0; i < n; i++) c.push({ t: t0 + i * 0.16, turn: i % 2 ? -a : a }); c.push({ t: t0 + n * 0.16, turn: 0 }); }

// Chaque geste : (m : les mesures du singe qui joue ce rôle, x : { D, HS : la hauteur moyenne des épaules des deux }) → les clés de A et de B, en secondes.
const GESTES = {
  check: { duree: 1.9, A: (m, x) => checkCles(m, x), B: (m, x) => checkCles(m, x) },
  garde: { duree: 2.3, A: (m) => { const c = []; c.push({ t: 0.2, fd: 1, fg: 1 }, { t: 0.4, md: GARDE_D, mg: GARDE_G, yaw: 0.15, twist: -0.2, lean: 0.2, nod: 0.18, pd: PIED(-0.08), pg: PIED(0.22), y: -0.06, e: 'io' });
      for (let t = 0.6, k = 0; t < 2.0; t += 0.18, k++) c.push({ t, y: k % 2 ? -0.05 : -0.1 });
      c.push({ t: 0.82, mg: [0.98, 0.14, 0.04], e: 'hit', side: 0.05 }, { t: 0.98, mg: GARDE_G, side: 0 }, { t: 1.12, mg: [0.98, 0.14, 0.04], e: 'hit' }, { t: 1.28, mg: GARDE_G });
      c.push({ t: 1.44, md: [0.98, 0.12, -0.06], twist: 0.28, lean: 0.32, e: 'hit' }, { t: 1.66, md: GARDE_D, twist: -0.2, lean: 0.2 }, { t: 1.82, side: 0.16 }, { t: 2.0, side: 0, fd: 0, fg: 0 }); return c; },
    B: () => [{ t: 0.55, ...CROISES, lean: 0.02, nod: -0.05 }, { t: 1.9, ...CROISES, nod: 0.12 }, { t: 2.05, nod: -0.02 }] },
  face: { duree: 2.5, A: (m) => { const c = [], L = longJambe(m); pas(c, L, 0.1, 0.45, 0, 0.22); pas(c, L, 0.55, 0.45, 0.22, 0.22);
      c.push({ t: 0.6, bend: -0.15, lean: 0.25, nod: 0.18, yaw: 0.15, md: [0.0, -0.8, 0.32], mg: [0.0, -0.8, 0.32] }, { t: 1.0, vib: 0.02 }, { t: 1.45, vib: 0.02, fd: 0 });
      c.push({ t: 1.55, fd: MAIN.index, md: POINT, vib: 0, e: 'hit' }, { t: 1.95, md: POINT }, { t: 2.05, fd: 0 }); pas(c, L, 2.0, 0.45, 0.44, -0.44); return c; },
    B: (m) => { const c = [], L = longJambe(m); pas(c, L, 0.3, 0.45, 0, 0.2); c.push({ t: 0.75, lean: 0.2, nod: 0.15, yaw: 0.15, bend: -0.1, vib: 0.015 }, { t: 1.6, tilt: 0.15, vib: 0.015 }, { t: 2.0, tilt: 0, vib: 0 }); pas(c, L, 2.0, 0.45, 0.2, -0.2); return c; } },
  fleur: { duree: 2.6, A: (m, x) => { const c = [], L = longJambe(m), P = [x.D / 2 + 0.05, x.HS - 0.3, 0.16];
      c.push({ t: 0, od: OBJET.fleur, md: [-0.32, -0.55, 0.05] }, { t: 0.35, md: [-0.32, -0.55, 0.05] }); pas(c, L, 0.35, 0.4, 0, 0.2);
      c.push({ t: 0.65, md: [0.5, -0.2, 0.2] }, { t: 0.95, kd: 1, wd: P, lean: 0.35, nod: 0.25, e: 'io' }, { t: 1.25, kd: 1, wd: P, od: OBJET.fleur }, { t: 1.28, od: 0 }, { t: 1.5, kd: 0, md: PEND, lean: 0.08, nod: 0.05 }, { t: 1.75, tilt: 0.15 }, { t: 2.3, tilt: 0 });
      pas(c, L, 1.7, 0.45, 0.2, -0.2); return c; },
    B: (m, x) => { const P = [x.D / 2 - 0.1, x.HS - 0.3, 0.16]; return [{ t: 0.9, bulle: BULLE.coeur }, { t: 1.0, kd: 0 }, { t: 1.18, kd: 1, wd: P, lean: 0.18, e: 'io' }, { t: 1.28, od: OBJET.fleur }, { t: 1.32, kd: 1, wd: P },
      { t: 1.5, kd: 0, md: [0.14, 0.3, -0.08], lean: 0.02 }, { t: 1.75, nod: -0.18, md: [0.14, 0.3, -0.08] }, { t: 2.0, nod: -0.1 }, { t: 2.2, md: [0.05, 0.42, 0.18], nod: 0.05 }, { t: 2.35, od: 0, oreille: 1, bulle: 0 }, { t: 2.55, md: PEND }]; } },
  gateau: { duree: 2.8, A: (m, x) => { const c = [], L = longJambe(m), P = [x.D / 2 + 0.1, x.HS - 0.32, 0.14], T = [x.D - 0.32, x.HS + 0.1, 0.12];
      c.push({ t: 0, od: OBJET.gateau, md: [0.42, -0.25, 0.1], mg: [0.42, -0.28, -0.04] }); pas(c, L, 0.2, 0.45, 0, 0.25);
      c.push({ t: 0.9, kd: 1, kg: 1, wd: P, wg: [P[0], P[1] - 0.04, P[2] - 0.08], lean: 0.25, e: 'io' }, { t: 1.22, kd: 1, kg: 1, wd: P, wg: [P[0], P[1] - 0.04, P[2] - 0.08], stop: true });
      c.push({ t: 1.34, wd: T, wg: [T[0], T[1] - 0.03, T[2] - 0.08], lean: 0.45, e: 'hit' }, { t: 1.4, od: 0 }, { t: 1.44, kd: 1, kg: 1, wd: T, wg: [T[0], T[1] - 0.03, T[2] - 0.08] }); rire(c, 1.55, 2.3);
      c.push({ t: 1.55, kd: 0, kg: 0 }); pas(c, L, 2.25, 0.45, 0.25, -0.25); return c; },
    B: (m) => { const L = longJambe(m); return [{ t: 0.9, bulle: BULLE.oh }, { t: 1.0, bulle: 0 }, { t: 1.2, lean: 0.48, bend: 0.2, nod: 0.25, z: 0.1 / L, pd: PIED(0.02), pg: PIED(0.02) },
      { t: 1.36, creme: 0 }, { t: 1.4, creme: 1, bulle: BULLE.oh }, { t: 1.5, lean: -0.25, bend: -0.1, z: -0.05 / L, nod: -0.1, md: [0.2, 0.55, 0.6], mg: [0.2, 0.5, 0.6], e: 'hit' },
      { t: 1.95, md: [0.2, 0.3, -0.05], mg: PEND, nod: 0.1, lean: 0.05, z: 0, bulle: 0 }, { t: 2.2, md: [0.18, 0.34, 0.02] }, { t: 2.4, bulle: BULLE.colere, md: PEND }]; } },
  selfie: { duree: 2.9, A: (m, x) => { const c = [], L = longJambe(m), T = [x.D / 2 - 0.05, x.HS + 0.55, 0.45];
      pas(c, L, 0.1, 0.45, 0, 0.3); c.push({ t: 0.35, od: OBJET.tel, md: [0.35, -0.2, 0.2] }, { t: 0.8, kd: 1, wd: T, turn: 0.55, nod: -0.2, lean: 0.12, e: 'io' }, { t: 1.45, kd: 1, wd: T }, { t: 0.95, fg: MAIN.v, mg: [0.25, 0.42, 0.35] },
        { t: 1.2, flash: 0, kd: 1, wd: T }, { t: 1.25, flash: 1 }, { t: 1.5, flash: 0, e: 'lin' }, { t: 1.65, kd: 0, md: [0.35, 0.02, 0.05], nod: 0.35, turn: 0, fg: 0, mg: PEND },
        { t: 2.05, fg: MAIN.pouce, mg: [0.38, 0.12, 0.3], nod: 0.05, bulle: BULLE.coeur, e: 'hit' }, { t: 2.45, fg: 0, mg: PEND, od: OBJET.tel }, { t: 2.6, od: 0 }); pas(c, L, 2.3, 0.45, 0.3, -0.3); return c; },
    B: (m) => { const c = [], L = longJambe(m); pas(c, L, 0.4, 0.4, 0, 0.15); c.push({ t: 0.85, turn: 0.55, nod: -0.2, side: -0.12, e: 'io' }, { t: 0.95, fd: MAIN.v, md: [0.25, 0.42, 0.3] }, { t: 1.55, fd: MAIN.v, md: [0.25, 0.42, 0.3] }, { t: 1.7, fd: 0, md: PEND, turn: 0, nod: 0.1, side: 0 }); pas(c, L, 2.2, 0.4, 0.15, -0.15); return c; } },
  feinte: { duree: 2.3, A: (m, x) => { const c = [], L = longJambe(m), T = [x.D - 0.55, x.HS + 0.12, 0.1];
      c.push({ t: 0.15, fd: 1, fg: 1, md: GARDE_D, mg: GARDE_G, lean: 0.15, y: -0.05, twist: -0.15 }, { t: 0.55, twist: -0.38, md: [0.12, -0.02, 0.18], y: -0.09, stop: true },
        { t: 0.72, kd: 1, wd: T, z: 0.22 / L, pd: PIED(0.24 / L), lean: 0.32, twist: 0.38, y: -0.06, e: 'hit' }, { t: 0.95, kd: 1, wd: T, stop: true }, { t: 1.15, kd: 0, md: GARDE_D, z: 0, pd: PIED(0.02), twist: 0, lean: 0.12 });
      rire(c, 1.2, 1.85); c.push({ t: 1.35, fd: MAIN.index, md: POINT, e: 'hit' }, { t: 1.85, md: POINT, fd: MAIN.index }, { t: 2.0, fd: 0, md: PEND }); return c; },
    B: (m) => { const L = longJambe(m); return [{ t: 0.74, z: 0 }, { t: 0.77, bulle: BULLE.oh }, { t: 0.86, z: -0.18 / L, pd: PIED(-0.16 / L), y: -0.12, lean: -0.3, nod: 0.3, md: [0.32, 0.42, -0.02], mg: [0.36, 0.38, -0.08], e: 'hit' },
      { t: 1.25, z: -0.18 / L, md: [0.32, 0.42, -0.02], y: -0.1 }, { t: 1.5, z: 0, pd: PIED(0.02), y: 0, lean: 0.05, nod: 0.06, md: PEND, mg: PEND, bulle: BULLE.colere }, { t: 2.1, bulle: 0 }, ...nonCles(1.6)]; } },
  doigt: { duree: 2.4, A: () => [{ t: 0.25, yaw: 0.2, lean: -0.08, nod: -0.2 }, { t: 0.32, fd: MAIN.doigt }, { t: 0.48, md: [0.78, 0.3, 0.12], e: 'hit', stop: true },
      { t: 0.85, md: [0.86, 0.34, 0.12], e: 'hit' }, { t: 1.02, md: [0.78, 0.3, 0.12] }, { t: 1.08, fg: MAIN.doigt }, { t: 1.22, mg: [0.7, 0.4, 0.2], e: 'hit', stop: true },
      { t: 1.7, md: [0.8, 0.32, 0.12], mg: [0.72, 0.4, 0.2], nod: -0.25 }, { t: 1.95, md: PEND, mg: PEND, yaw: 0.3, lean: 0.1, nod: 0.06 }, { t: 2.0, fd: 0, fg: 0 }],
    B: () => [{ t: 0.55, bulle: BULLE.colere, lean: -0.15 }, { t: 0.7, md: [0.2, -0.3, 0.62], mg: [0.2, -0.3, 0.62], e: 'io' }, ...nonCles(0.85, 4), { t: 1.55, bulle: BULLE.quoi }, { t: 2.0, md: PEND, mg: PEND, lean: 0.1 }, { t: 2.2, bulle: 0 }] },
  rond: { duree: 2.7, A: (m, x) => { const c = [], L = longJambe(m), T = [x.D - 0.2, x.HS - 0.02, 0.12]; pas(c, L, 0.15, 0.4, 0, 0.2);
      c.push({ t: 0.5, fd: MAIN.rond, fg: MAIN.index, md: [0.32, -0.66, 0.18], mg: [0.42, -0.52, 0.04], nod: 0.04, e: 'io' }, { t: 1.05, md: [0.32, -0.66, 0.18], mg: [0.42, -0.52, 0.04] },
        { t: 1.1, fg: MAIN.poing }, { t: 1.18, kg: 1, wg: T, e: 'hit', twist: 0.2 }, { t: 1.24, kg: 1, wg: T }, { t: 1.36, kg: 0, mg: PEND, twist: 0, fd: 0 }); rire(c, 1.35, 1.95);
      c.push({ t: 1.6, fd: MAIN.index, md: POINT, e: 'hit' }, { t: 1.95, fd: 0, md: PEND }); pas(c, L, 2.1, 0.45, 0.2, -0.2); return c; },
    B: (m) => { const L = longJambe(m); return [{ t: 0.75, nod: 0.06 }, { t: 0.88, nod: 0.62, lean: 0.2, bulle: BULLE.quoi, e: 'io' }, { t: 1.15, nod: 0.6 },
      { t: 1.22, side: 0.2, lean: -0.08, nod: 0.1, z: -0.05 / L, bulle: BULLE.oh, e: 'hit' }, { t: 1.45, md: [0.12, 0.02, -0.28] }, { t: 1.75, md: [0.12, -0.02, -0.26], side: 0.1 },
      { t: 2.0, md: [0.12, 0.02, -0.28], bulle: BULLE.colere }, { t: 2.3, md: PEND, side: 0, z: 0, bulle: 0 }]; } },
  facile: { duree: 2.8, A: () => [{ t: 0.85, md: [0.05, 0.95, 0.25], mg: [0.05, 0.95, 0.25], lean: -0.12, nod: -0.35, bend: -0.1, e: 'io' }, { t: 0.55, bulle: BULLE.dort },
      { t: 1.25, md: [0.15, -0.8, 0.3], mg: [0.15, -0.8, 0.3], lean: 0.1, nod: 0.06, bend: 0.05, bulle: 0, e: 'io' }, { t: 1.45, mg: [0.42, 0.05, 0.0], nod: 0.22 }, { t: 1.55, fd: MAIN.index, md: [0.36, 0.0, -0.1] }, { t: 1.65, md: [0.36, 0.03, -0.12] }, { t: 1.75, md: [0.36, 0.0, -0.1] },
      { t: 1.9, fd: 0, md: PEND, mg: PEND }, { t: 2.1, md: [0.12, -0.35, 0.55], mg: [0.12, -0.35, 0.55], y: 0.03, tilt: 0.2, nod: 0.1, e: 'hit' }, { t: 2.45, y: 0, tilt: 0 }],
    B: () => [{ t: 1.2, ...CROISES }, { t: 2.2, ...CROISES, bulle: BULLE.colere }, { t: 2.5, bulle: 0 }] },
  chut: { duree: 2.3, A: () => [{ t: 0.2, fd: MAIN.index }, { t: 0.35, md: [0.2, 0.22, -0.1], lean: 0.14, e: 'io' }, { t: 1.0, md: [0.2, 0.22, -0.1] }, { t: 1.12, fd: 0 },
      { t: 1.3, md: [0.02, 0.3, 0.22], tilt: 0.25, lean: 0.2, e: 'io' }, { t: 1.95, md: [0.02, 0.3, 0.22], tilt: 0.25 }],
    B: () => [{ t: 0.5, turn: 0 }, { t: 0.8, turn: -0.5, ...CROISES }, { t: 1.4, bulle: BULLE.colere }, { t: 1.9, turn: -0.5, ...CROISES }, { t: 2.1, bulle: 0 }] },
  main: { duree: 2.0, A: (m, x) => mainCles(m, x), B: (m, x) => mainCles(m, x) },
  refus: { duree: 2.2, A: (m, x) => { const P = [x.D / 2 - 0.02, x.HS - 0.42, 0.13]; return [{ t: 0.55, kd: 1, wd: P, lean: 0.2, e: 'io' }, { t: 1.2, kd: 1, wd: P }, { t: 1.45, kd: 0, md: PEND, lean: 0.1 },
      { t: 1.7, md: [0.12, -0.35, 0.55], mg: [0.12, -0.35, 0.55], y: 0.03, tilt: 0.18, e: 'hit' }, { t: 2.0, md: PEND, mg: PEND, y: 0, tilt: 0 }]; },
    B: () => [{ t: 0.35, ...CROISES }, { t: 0.6, turn: -0.55, nod: -0.1, bulle: BULLE.colere }, { t: 1.9, turn: -0.55, ...CROISES }, { t: 2.1, bulle: 0 }] },
};
function nonCles(t0, n = 3) { const c = []; non(c, t0, n); return c; }
function checkCles(m, x) {
  const c = [], L = longJambe(m), P = [x.D / 2 - 0.04, x.HS - 0.48, 0.14];
  c.push({ t: 0.2, fd: MAIN.poing }, { t: 0.3, md: [0.38, -0.3, 0.25], lean: 0.14 }); pas(c, L, 0.3, 0.38, 0, 0.14);
  c.push({ t: 0.6, kd: 0 }, { t: 0.74, kd: 1, wd: P, lean: 0.24, e: 'hit', stop: true }, { t: 0.84, kd: 0.92, wd: [P[0] - 0.07, P[1] + 0.02, P[2]] }, { t: 1.08, kd: 0, md: [0.3, -0.45, 0.25] });
  c.push({ t: 1.35, nod: 0.3, fd: MAIN.poing }, { t: 1.42, fd: 0 }, { t: 1.6, nod: 0.06, md: PEND, lean: 0.1 }); pas(c, L, 1.15, 0.4, 0.14, -0.14); return c;
}
function mainCles(m, x) {
  const c = [], L = longJambe(m), P = [x.D / 2 - 0.02, x.HS - 0.42, 0.13], h = (dy) => [P[0], P[1] + dy, P[2]];
  pas(c, L, 0.1, 0.4, 0, 0.14);
  c.push({ t: 0.35, kd: 0, md: [0.4, -0.45, 0.2] }, { t: 0.62, kd: 1, wd: P, lean: 0.18, e: 'io' }, { t: 0.78, wd: h(0.05) }, { t: 0.92, wd: h(-0.04) }, { t: 1.06, wd: h(0.04) }, { t: 1.2, wd: h(0), kd: 1, stop: true }, { t: 0.8, kd: 1 },
    { t: 0.95, nod: 0.22 }, { t: 1.25, nod: 0.06 }, { t: 1.4, kd: 0, md: PEND, lean: 0.1 }); pas(c, L, 1.4, 0.4, 0.14, -0.14); return c;
}

// Les attentes, en boucle : avant le duel (il sautille, prêt), le perdant (abattu), le gagnant après un geste (bras croisés, fier).
const ATTENTES = {
  attente: { duree: 2, cles: [{ t: 0, y: 0 }, { t: 0.5, y: -0.035 }, { t: 1.0, y: 0, md: [0.1, -0.86, 0.22] }, { t: 1.5, y: -0.035, mg: [0.1, -0.86, 0.22] }, { t: 0.25, nod: 0.02 }, { t: 1.25, nod: 0.1 }] },
  defait: { duree: 4, cles: [{ t: 0, lean: 0.3, bend: 0.25, nod: 0.45, y: -0.04, md: [0.12, -0.95, 0.12], mg: [0.12, -0.95, 0.12], ql: 0.1 }, { t: 1.2, bend: 0.3, y: -0.05 }, { t: 2.2, bend: 0.22, y: -0.035 },
    { t: 2.6, turn: 0.15 }, { t: 3.0, turn: -0.15 }, { t: 3.4, turn: 0 }] },
  fier: { duree: 3, cles: [{ t: 0, ...CROISES, bend: -0.1, lean: -0.05, nod: -0.12, ql: 0.5, y: 0 }, { t: 0.75, y: -0.03 }, { t: 1.5, y: 0 }, { t: 2.25, y: -0.03 }, { t: 1.5, tilt: 0.1 }] },
};
const cacheA = new Map();
export function attente(m, id) { const cle = id + ':' + m.K + ':' + m.TRONC; if (!cacheA.has(cle)) { const a = ATTENTES[id]; cacheA.set(cle, compiler({ duree: a.duree, temps: 1, cles: a.cles, base: FACE }, true)); } return cacheA.get(cle); }
// Le geste compilé pour un rôle. role : 'A' (celui qui le fait) ou 'B' (celui qui réagit). x : { D, HS }.
export function geste(id, role, m, x) { const g = GESTES[id]; return compiler({ duree: g.duree, temps: 1, cles: g[role](m, x), base: FACE }, false); }
export const dureeGeste = (id) => GESTES[id].duree;

// ---------- Le catalogue : ce que montre la boutique ----------
// quand : avant (l'entrée, pendant l'annonce du duel), apres (le gagnant, à la fin). type : geste (à deux) ou danse (seul).
// elo : le rang qui le donne ; prix : en euros (boutique en essai). Ni l'un ni l'autre : offert. grossier : masqué si le joueur le demande.
// Prix et rangs : des propositions de Claude, à confirmer par Romain et PA.
export const ANIMS = [
  { id: 'check', nom: 'Le check', type: 'geste', quand: ['avant'], vig: 0.75, texte: 'Les deux poings qui se touchent, et un signe de tête : le respect avant le combat.' },
  { id: 'garde', nom: 'En garde', type: 'geste', quand: ['avant'], vig: 1.46, elo: 950, texte: 'Garde de combattant, il sautille et envoie deux directs et un crochet dans le vide.' },
  { id: 'face', nom: 'Le face-à-face', type: 'geste', quand: ['avant'], vig: 1.3, elo: 1100, texte: 'Il avance jusqu\'à son nez, le regarde dans les yeux, puis le pointe du doigt.' },
  { id: 'feinte', nom: 'La feinte', type: 'geste', quand: ['avant', 'apres'], vig: 0.9, elo: 1250, texte: 'Un coup de poing qui s\'arrête net devant son visage. L\'autre sursaute, lui rit.' },
  { id: 'fleur', nom: 'La fleur', type: 'geste', quand: ['avant', 'apres'], vig: 1.25, prix: 0.99, texte: 'Il sort une fleur de son dos et la lui offre. L\'autre la respire, puis la glisse à son oreille.' },
  { id: 'gateau', nom: 'Le gâteau', type: 'geste', quand: ['avant', 'apres'], vig: 1.38, prix: 1.99, texte: 'Il lui tend un gâteau. L\'autre se penche pour souffler la bougie… et le prend en pleine figure.' },
  { id: 'selfie', nom: 'Le selfie', type: 'geste', quand: ['avant', 'apres'], vig: 1.25, prix: 1.99, texte: 'Il se colle à son adversaire, lève son téléphone : photo souvenir, et pouce levé.' },
  { id: 'chut', nom: 'Chut', type: 'geste', quand: ['apres'], vig: 0.7, texte: 'Le doigt sur la bouche, puis la main à l\'oreille : « j\'entends plus rien ».' },
  { id: 'facile', nom: 'Trop facile', type: 'geste', quand: ['apres'], vig: 0.7, elo: 950, texte: 'Il bâille, regarde sa montre, hausse les épaules.' },
  { id: 'rond', nom: 'Regarde en bas', type: 'geste', quand: ['apres'], vig: 1.0, prix: 1.99, texte: 'Il cache un rond du pouce et de l\'index sous sa taille. L\'autre regarde : petite tape sur l\'épaule.' },
  { id: 'doigt', nom: 'Le doigt', type: 'geste', quand: ['apres'], vig: 1.3, prix: 0.99, grossier: true, texte: 'Le doigt d\'honneur, puis les deux. Réservé aux mauvais gagnants.' },
  ...DANSES.map((d) => ({ ...d, type: 'danse', quand: ['apres'] })),
];
export const animDe = (id, quand = 'apres') => ANIMS.find((a) => (a.id === id || a.ancien === id) && a.quand.includes(quand)) || ANIMS.find((a) => a.quand.includes(quand) && !a.elo && !a.prix);
export { FACE, NEUTRE };
