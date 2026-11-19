// LIANE — les rivaux, le classement Elo, les rangs et les skins.
// Un duel : même forêt pour les deux, celui qui va le plus loin gagne.
// Tant qu'il n'y a pas de serveur, les rivaux sont simulés : chacun a son niveau, court vraiment le parcours, et laisse un fantôme.
import { Jeu, rnd, pilote, MONDES } from './jeu.js?v=8';

export const PARCOURS = [11, 23, 37, 41, 58, 64, 79, 86];   // les parcours du prototype : chaque numéro donne toujours la même forêt

// ---------- Les skins : un habillage appliqué par le code (silhouette, liseré, traînée) ----------
export const SKINS = [
  { id: 'ombre', nom: 'Ombre', seuil: 0, ink: '#04161a', rim: 'rgba(255,232,170,0.6)', trail: null },
  { id: 'braise', nom: 'Braise', seuil: 850, ink: '#1c0a05', rim: 'rgba(255,150,70,0.95)', trail: '255,140,60' },
  { id: 'givre', nom: 'Givre', seuil: 1000, ink: '#062230', rim: 'rgba(170,235,255,0.95)', trail: '150,225,255' },
  { id: 'jade', nom: 'Jade', seuil: 1150, ink: '#04241a', rim: 'rgba(140,255,190,0.9)', trail: '120,240,170' },
  { id: 'or', nom: 'Or', seuil: 1300, ink: '#2b1d05', rim: 'rgba(255,224,130,1)', trail: '255,215,110' },
  { id: 'spectre', nom: 'Spectre', seuil: 1450, ink: 'rgba(238,248,255,0.94)', rim: 'rgba(255,255,255,0.5)', trail: '235,245,255' },
];
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// ---------- Les rangs ----------
export const RANGS = [[0, 'Bronze'], [950, 'Argent'], [1100, 'Or'], [1250, 'Platine'], [1400, 'Diamant'], [1500, 'Maître']];
export function rang(elo) { let r = RANGS[0], n = null; for (const x of RANGS) { if (elo >= x[0]) r = x; else { n = x; break; } } return { nom: r[1], bas: r[0], suivant: n }; }

// ---------- Les rivaux simulés ----------
const NOMS = ['Ara', 'Toucan', 'Jaguar', 'Morpho', 'Tapir', 'Ocelot', 'Caïman', 'Colibri', 'Harpie', 'Tamarin', 'Ouistiti', 'Saki', 'Hoazin', 'Coati', 'Paca', 'Tatou', 'Margay', 'Agouti', 'Piranha', 'Boa', 'Iguane', 'Capucin', 'Atèle', 'Hurleur', 'Quetzal', 'Urubu', 'Kinkajou', 'Anaconda', 'Dendrobate', 'Kapok', 'Tayra', 'Puma', 'Ibis', 'Lamantin', 'Sapajou', 'Motmot', 'Païche', 'Cabiaï', 'Tangara', 'Uakari'];
export const RIVAUX = (() => {
  const r = rnd(2026), out = [];
  for (let i = 0; i < NOMS.length; i++) {
    const s = Math.min(1, Math.max(0, 0.36 + (r() + r() + r() - 1.5) * 0.42));        // niveau de 0 à 1, la plupart au milieu
    const elo = Math.round(720 + 1260 * s), unlocked = SKINS.filter((k) => k.seuil <= elo);
    out.push({ id: i, nom: NOMS[i], s, elo, skin: unlocked[Math.min(unlocked.length - 1, (r() * (unlocked.length + 0.6)) | 0)].id });
  }
  return out.sort((a, b) => b.elo - a.elo);
})();

// Fait courir un rival sur un parcours et enregistre son fantôme, 30 fois par seconde, à partir de son premier lâcher.
// Plus il est fort, plus il vise l'arc doré (donc plus il va vite et distance la nuit) et plus il tient longtemps avant de manquer une liane.
const cache = new Map();
export function fantome(parcours, b, monde = MONDES[0]) {
  const key = monde.id + ':' + parcours + ':' + b.id; if (cache.has(key)) return cache.get(key);
  const jeu = new Jeu(parcours, true, monde), M = jeu.M, r = rnd(parcours * 1000 + b.id * 7 + 3), st = { gout: 0.45 + 0.55 * b.s, r }, f = [];
  const tient = (55 + 3200 * Math.pow(b.s, 2.4)) * (0.7 + 0.6 * r()) * monde.tenue;      // la distance où il finit par manquer une liane ; plus courte dans les niveaux durs
  let t = 0, n = 0;
  for (let i = 0; i < 120 * 900 && !M.mort; i++) {
    if (M.x >= tient) st.fini = true;
    pilote(jeu, st); jeu.step(1 / 120); jeu.events.length = 0;
    if (M.idle) continue;
    if (n % 4 === 0 || M.mort) f.push(M.x, M.y, M.th, M.om, M.mode === 'swing' ? 1 : 0, M.li.x, M.li.y, M.vx, M.vy);
    n++; t += 1 / 120;
  }
  const g = { rival: b, dist: Math.max(0, M.x), temps: t, cause: M.mort || 'chute', f: new Float32Array(f), n: f.length / 9 };
  cache.set(key, g); return g;
}
// L'état du fantôme à l'instant t (en secondes depuis le départ), interpolé entre deux relevés.
export function etat(g, t, out) {
  const p = Math.max(0, Math.min(g.n - 1.001, t * 30)), i = Math.floor(p), k = p - i, a = i * 9, b = a + 9, f = g.f, L = (j) => f[a + j] + (f[b + j] - f[a + j]) * k;
  out.x = L(0); out.y = L(1); out.th = L(2); out.om = L(3); out.mode = f[a + 4] > 0.5 ? 'swing' : 'fly'; out.ax = f[a + 5]; out.ay = f[a + 6]; out.vx = L(7); out.vy = L(8); out.fini = t >= g.temps;
  return out;
}

// ---------- Le profil du joueur, gardé sur l'appareil ----------
const CLE = 'liane-profil-2';
export const profil = { elo: 800, skin: 'ombre', v: 0, d: 0, record: 0, records: {}, monde: 0, acquis: ['ombre'], enCours: null };   // on démarre bas, face à des rivaux à sa portée, et on grimpe
try { Object.assign(profil, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* stockage indisponible : la partie ne sera pas gardée */ }
// Un profil abîmé ne doit jamais bloquer le jeu : on remet d'aplomb ce qui n'a pas la bonne forme.
if (!Number.isFinite(profil.elo)) profil.elo = 800; profil.elo = Math.round(profil.elo);
for (const k of ['v', 'd', 'record', 'monde']) if (!Number.isFinite(profil[k])) profil[k] = 0;
if (!profil.records || typeof profil.records !== 'object') profil.records = {};
if (!Array.isArray(profil.acquis)) profil.acquis = ['ombre'];
export function garder() { try { localStorage.setItem(CLE, JSON.stringify(profil)); } catch (e) { /* rien */ } }
// Un skin gagné reste gagné, même si l'Elo redescend ensuite.
export function acquerir() { const neufs = SKINS.filter((s) => s.seuil <= profil.elo && !profil.acquis.includes(s.id)); for (const s of neufs) profil.acquis.push(s.id); return neufs; }
export const possede = (s) => profil.acquis.includes(s.id) || s.seuil <= profil.elo;
acquerir(); if (!SKINS.some((s) => s.id === profil.skin && possede(s))) profil.skin = 'ombre';

// Le calcul Elo, tel qu'aux échecs : battre plus fort que soi rapporte plus.
export function elo(moi, lui, gagne, K = 32) { const attendu = 1 / (1 + Math.pow(10, (lui - moi) / 400)); return Math.round(K * ((gagne ? 1 : 0) - attendu)); }
// Ce que rapporte ou coûte un duel classé. Les premières victoires, tant qu'on n'a pas perdu, valent 100 points : un bon joueur trouve vite son rang.
// Ensuite K vaut 32 jusqu'au 30e duel, puis 16 : le classement bouge moins une fois le niveau trouvé.
export function gain(p, lui, gagne) { const n = p.v + p.d; if (gagne && p.d === 0 && n < 10) return 100; return elo(p.elo, lui, gagne, n < 30 ? 32 : 16); }
// Un adversaire à sa mesure : pris au hasard parmi les cinq plus proches.
export function adversaire(e, sauf) { const c = RIVAUX.filter((b) => b !== sauf).sort((a, b) => Math.abs(a.elo - e) - Math.abs(b.elo - e)).slice(0, 5); return c[(Math.random() * c.length) | 0]; }
export function classement() { return [...RIVAUX.map((b) => ({ nom: b.nom, elo: b.elo, skin: b.skin })), { nom: 'toi', elo: profil.elo, skin: profil.skin, moi: true }].sort((a, b) => b.elo - a.elo); }
