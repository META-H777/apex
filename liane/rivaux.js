// LIANE — les rivaux, le classement Elo, les rangs et les skins.
// Tant qu'il n'y a pas de serveur, les rivaux sont simulés : chacun a son niveau, court vraiment le parcours, et laisse un fantôme.
import { Jeu, rnd } from './jeu.js?v=2';

export const FIN = 330;            // longueur d'une course, en mètres
export const PARCOURS = [11, 23, 37, 41, 58, 64, 79, 86];   // les parcours du prototype : chaque numéro donne toujours la même forêt

// ---------- Les skins : un habillage appliqué par le code (silhouette, liseré, traînée) ----------
export const SKINS = [
  { id: 'ombre', nom: 'Ombre', seuil: 0, ink: '#04161a', rim: 'rgba(255,232,170,0.6)', trail: null },
  { id: 'braise', nom: 'Braise', seuil: 1080, ink: '#1c0a05', rim: 'rgba(255,150,70,0.95)', trail: '255,140,60' },
  { id: 'givre', nom: 'Givre', seuil: 1180, ink: '#062230', rim: 'rgba(170,235,255,0.95)', trail: '150,225,255' },
  { id: 'jade', nom: 'Jade', seuil: 1300, ink: '#04241a', rim: 'rgba(140,255,190,0.9)', trail: '120,240,170' },
  { id: 'or', nom: 'Or', seuil: 1450, ink: '#2b1d05', rim: 'rgba(255,224,130,1)', trail: '255,215,110' },
  { id: 'spectre', nom: 'Spectre', seuil: 1600, ink: 'rgba(238,248,255,0.94)', rim: 'rgba(255,255,255,0.5)', trail: '235,245,255' },
];
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// ---------- Les rangs ----------
export const RANGS = [[0, 'Bronze'], [1100, 'Argent'], [1250, 'Or'], [1400, 'Platine'], [1550, 'Diamant'], [1700, 'Maître']];
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

// La façon de jouer d'un rival : plus il est fort, plus il lâche tôt et juste, et moins il reste pendu.
function piloter(jeu, b, st) {
  const M = jeu.M;
  if (M.mode === 'swing') {
    if (M.idle) { if (M.om > 0 && M.th > 0.3) { jeu.setHold(true); jeu.setHold(false); } return; }
    if (st.cible === undefined) st.cible = st.r() < 0.55 * (1 - b.s) * (1 - b.s) ? 9 : 0.95 - 0.5 * b.s + (st.r() - 0.5) * 0.5 * (1 - b.s);
    if (st.cible < 9 && (M.th > st.cible || (M.th > 0.4 && M.R * M.om < 8))) { jeu.setHold(false); st.cible = undefined; }
  } else { st.cible = undefined; if (M.air > 0.09 + 0.2 * (1 - b.s) && M.vy < 4) jeu.setHold(true); }
}

// Fait courir un rival sur un parcours et enregistre son fantôme, 30 fois par seconde, à partir de son premier lâcher.
const cache = new Map();
export function fantome(parcours, b) {
  const key = parcours + ':' + b.id; if (cache.has(key)) return cache.get(key);
  const jeu = new Jeu(parcours), M = jeu.M, st = { r: rnd(parcours * 1000 + b.id * 7 + 3) }, f = [];
  let t = 0, n = 0, temps = 90;
  for (let i = 0; i < 120 * 100; i++) {
    piloter(jeu, b, st); const x0 = M.x; jeu.step(1 / 120); jeu.events.length = 0;
    if (M.idle) continue;
    if (n % 4 === 0) f.push(M.x, M.y, M.th, M.om, M.mode === 'swing' ? 1 : 0, M.li.x, M.li.y, M.vx, M.vy);
    n++; t += 1 / 120;
    if (M.x >= FIN) { temps = t - (1 / 120) * (M.x - FIN) / Math.max(1e-3, M.x - x0); break; }
  }
  const g = { rival: b, temps, f: new Float32Array(f), n: f.length / 9 };
  cache.set(key, g); return g;
}
// L'état du fantôme à l'instant t (en secondes depuis le départ), interpolé entre deux relevés.
export function etat(g, t, out) {
  const p = Math.max(0, Math.min(g.n - 1.001, t * 30)), i = Math.floor(p), k = p - i, a = i * 9, b = a + 9, f = g.f, L = (j) => f[a + j] + (f[b + j] - f[a + j]) * k;
  out.x = L(0); out.y = L(1); out.th = L(2); out.om = L(3); out.mode = f[a + 4] > 0.5 ? 'swing' : 'fly'; out.ax = f[a + 5]; out.ay = f[a + 6]; out.vx = L(7); out.vy = L(8); out.fini = t >= g.temps;
  return out;
}
// L'instant où le fantôme passe à la distance x : sert aux écarts affichés en course.
export function tempsA(g, x) { let lo = 0, hi = g.n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (g.f[m * 9] < x) lo = m + 1; else hi = m; } return lo / 30; }

// ---------- Le profil du joueur, gardé sur l'appareil ----------
const CLE = 'liane-profil-1';
export const profil = { elo: 1000, skin: 'ombre', v: 0, d: 0, record: {} };
try { Object.assign(profil, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* stockage indisponible : la partie ne sera pas gardée */ }
export function garder() { try { localStorage.setItem(CLE, JSON.stringify(profil)); } catch (e) { /* rien */ } }

// Le calcul Elo, tel qu'aux échecs : battre plus fort que soi rapporte plus.
export function elo(moi, lui, gagne, K = 32) { const attendu = 1 / (1 + Math.pow(10, (lui - moi) / 400)); return Math.round(K * ((gagne ? 1 : 0) - attendu)); }
// Un adversaire à sa mesure : pris au hasard parmi les cinq plus proches.
export function adversaire(e, sauf) { const c = RIVAUX.filter((b) => b !== sauf).sort((a, b) => Math.abs(a.elo - e) - Math.abs(b.elo - e)).slice(0, 5); return c[(Math.random() * c.length) | 0]; }
export function classement() { return [...RIVAUX.map((b) => ({ nom: b.nom, elo: b.elo, skin: b.skin })), { nom: 'toi', elo: profil.elo, skin: profil.skin, moi: true }].sort((a, b) => b.elo - a.elo); }
