// LIANE — la carrière du joueur, façon chess.com : l'historique de ses duels, la courbe de son Elo, ses statistiques, ses trophées,
// ses adversaires réels et sa série de jours. Tout est gardé sur l'appareil (profil, rivaux.js) tant qu'il n'y a pas de serveur.
import { profil, garder, rang, RANGS } from './rivaux.js?v=32';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const jour = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const veille = (j) => { const d = new Date(j + 'T12:00:00'); d.setDate(d.getDate() - 1); return jour(d); };

// ---------- Remettre d'aplomb ce que l'appareil a gardé ----------
if (!Array.isArray(profil.histo)) profil.histo = [];
profil.histo = profil.histo.filter((h) => h && Number.isFinite(h.t) && Number.isFinite(h.apres)).slice(-300);
if (!profil.amis || typeof profil.amis !== 'object') profil.amis = {};
if (!Number.isFinite(profil.depuis)) profil.depuis = profil.histo[0]?.t || Date.now();
if (!Number.isFinite(profil.eloMax)) profil.eloMax = Math.max(profil.elo, ...profil.histo.map((h) => h.apres));
if (!Number.isFinite(profil.serieMax)) profil.serieMax = profil.serie | 0;
if (!profil.jours || typeof profil.jours !== 'object' || typeof profil.jours.dernier !== 'string') profil.jours = { dernier: '', n: 0, max: 0 };
if (typeof profil.pays !== 'string') profil.pays = '';
if (!Array.isArray(profil.trophees)) profil.trophees = [];
garder();

// Les modes de jeu, comme les cadences aux échecs : chacun compte à part dans l'historique.
export const MODES = { enligne: 'En ligne', ami: 'Contre un ami', classe: 'Contre un rival', entrainement: 'Entraînement' };

// ---------- Après chaque duel ----------
// e : { mode, nom, elo (le sien avant le duel), singe, gagne, d (ton Elo gagné ou perdu), avant, apres, dist, lui (sa distance), monde }
// Rend les trophées que ce duel vient de débloquer.
export function noterDuel(e) {
  const h = { t: Date.now(), ...e }; profil.histo.push(h); if (profil.histo.length > 300) profil.histo.splice(0, profil.histo.length - 300);
  profil.eloMax = Math.max(profil.eloMax, profil.elo); profil.serieMax = Math.max(profil.serieMax, profil.serie | 0);
  // La série de jours : un duel par jour la fait grandir, un jour sans la remet à un.
  const J = profil.jours, auj = jour();
  if (J.dernier !== auj) { J.n = J.dernier === veille(auj) ? J.n + 1 : 1; J.dernier = auj; J.max = Math.max(J.max | 0, J.n); }
  // Les adversaires réels (en direct) : ce qu'on sait d'eux, et le score entre vous.
  if (e.mode === 'enligne' || e.mode === 'ami') {
    const cle = e.nom.toLowerCase(), a = profil.amis[cle] || { nom: e.nom, v: 0, d: 0 };
    Object.assign(a, { nom: e.nom, elo: e.eloApres ?? e.elo, singe: e.singe, vu: h.t }); if (e.gagne) a.v++; else a.d++; profil.amis[cle] = a;
  }
  const neufs = TROPHEES.filter((t) => !profil.trophees.includes(t.id) && t.ok(profil)).map((t) => t.id); profil.trophees.push(...neufs);
  garder(); return neufs.map((id) => TROPHEES.find((t) => t.id === id));
}
// La série de jours encore vivante : jouée aujourd'hui ou hier.
export function serieJours() { const J = profil.jours, auj = jour(); return J.dernier === auj || J.dernier === veille(auj) ? J.n : 0; }
export const joueAujourdhui = () => profil.jours.dernier === jour();

// ---------- Les trophées ----------
const classes = (p) => p.histo.filter((h) => h.mode !== 'entrainement');
const gagnes = (p) => p.histo.filter((h) => h.gagne);
export const TROPHEES = [
  { id: 'premier', nom: 'Premier saut', texte: 'Jouer ton premier duel.', ok: (p) => p.histo.length >= 1 },
  { id: 'victoire', nom: 'Première victoire', texte: 'Gagner un duel.', ok: (p) => gagnes(p).length >= 1 },
  { id: 'feu', nom: 'En feu', texte: 'Gagner 3 duels classés de suite.', ok: (p) => p.serieMax >= 3 },
  { id: 'inarretable', nom: 'Inarrêtable', texte: 'Gagner 10 duels classés de suite.', ok: (p) => p.serieMax >= 10 },
  { id: 'david', nom: 'David et Goliath', texte: 'Battre un adversaire qui a 200 Elo de plus que toi.', ok: (p) => classes(p).some((h) => h.gagne && h.elo - h.avant >= 200) },
  { id: 'mille', nom: 'Mille mètres', texte: 'Parcourir 1 000 m en un duel.', ok: (p) => p.histo.some((h) => h.dist >= 1000) },
  { id: 'marathon', nom: 'Marathonien', texte: 'Parcourir 3 000 m en un duel.', ok: (p) => p.histo.some((h) => h.dist >= 3000) },
  { id: 'facefa', nom: 'Face à face', texte: 'Gagner un duel en direct contre un ami.', ok: (p) => p.histo.some((h) => h.mode === 'ami' && h.gagne) },
  { id: 'monde', nom: 'Citoyen du monde', texte: 'Gagner un duel en ligne contre un joueur trouvé par le jeu.', ok: (p) => p.histo.some((h) => h.mode === 'enligne' && h.gagne) },
  { id: 'or', nom: 'Ligue Or', texte: 'Atteindre la ligue Or (1 100 Elo).', ok: (p) => p.eloMax >= 1100 },
  { id: 'diamant', nom: 'Ligue Diamant', texte: 'Atteindre la ligue Diamant (1 400 Elo).', ok: (p) => p.eloMax >= 1400 },
  { id: 'fidele', nom: 'Fidèle', texte: 'Jouer 7 jours de suite.', ok: (p) => (p.jours.max | 0) >= 7 },
];

// ---------- Les statistiques ----------
export function stats() {
  // Les totaux viennent des compteurs du profil (ils existent depuis la v0.1) ; l'historique détaillé, lui, commence à la v0.20.
  const v = profil.v | 0, n = v + (profil.d | 0), D = profil.histo.filter((h) => h.mode === 'enligne' || h.mode === 'ami');
  const dists = profil.histo.map((h) => h.dist).filter(Number.isFinite);
  return { n, v, d: n - v, pc: n ? Math.round(v / n * 100) : null, direct: { n: D.length, v: D.filter((h) => h.gagne).length },
    moyenne: dists.length ? Math.round(dists.reduce((a, b) => a + b, 0) / dists.length) : null, record: profil.record || 0,
    provisoire: Math.max(0, 10 - (profil.v + profil.d)) };
}

// ---------- La courbe de l'Elo ----------
// periode : 7 ou 30 (jours), ou 0 pour tout. Rend un dessin SVG, avec les paliers des ligues en pointillés.
export function courbe(periode = 30, w = 340, h = 150) {
  const depuis = periode ? Date.now() - periode * 864e5 : 0, H = profil.histo.filter((x) => x.mode !== 'entrainement');
  if (!H.length) return `<div class="vide" style="background:none">Ta courbe se tracera dès ton premier duel classé.</div>`;
  const avant = H.filter((x) => x.t < depuis).pop(), pts = H.filter((x) => x.t >= depuis).map((x) => [x.t, x.apres]);
  pts.unshift([avant ? depuis : (H[0]?.t ?? Date.now()) - 1, avant ? avant.apres : (H[0]?.avant ?? profil.elo)]);
  if (pts.length < 2) pts.push([Date.now(), profil.elo]);
  const ys = pts.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), marge = Math.max(30, (hi - lo) * 0.15), y0 = lo - marge, y1 = hi + marge;
  // L'axe du temps suit les duels, pas le calendrier : une semaine sans jouer ne laisse pas un trou dans la courbe.
  const X = (i) => 8 + (w - 16) * i / (pts.length - 1), Y = (v) => 10 + (h - 30) * (1 - (v - y0) / (y1 - y0));
  const ligne = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
  const paliers = RANGS.filter(([b]) => b > y0 && b < y1).map(([b, nom]) => `<line x1="0" x2="${w}" y1="${Y(b).toFixed(1)}" y2="${Y(b).toFixed(1)}" stroke="rgba(255,246,220,.16)" stroke-dasharray="3 5"/><text x="${w - 4}" y="${(Y(b) - 4).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,246,220,.42)">${nom} ${b}</text>`).join('');
  const dernier = pts[pts.length - 1], monte = dernier[1] >= pts[0][1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" aria-label="ton Elo au fil des duels">
<defs><linearGradient id="cElo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,217,138,.32)"/><stop offset="1" stop-color="rgba(255,217,138,0)"/></linearGradient></defs>
${paliers}<path d="${ligne} L${X(pts.length - 1).toFixed(1)} ${h - 20} L${X(0).toFixed(1)} ${h - 20} Z" fill="url(#cElo)"/>
<path d="${ligne}" fill="none" stroke="var(--or)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
<circle cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(dernier[1]).toFixed(1)}" r="4" fill="var(--or)"/>
<text x="8" y="${h - 4}" font-size="10" fill="rgba(255,246,220,.42)">${pts.length - 1} duel${pts.length > 2 ? 's' : ''}${periode ? ' · ' + periode + ' jours' : ''}</text>
<text x="${w - 8}" y="${h - 4}" font-size="10" text-anchor="end" fill="${monte ? 'var(--vert)' : 'var(--rouge)'}">${monte ? '+' : '−'}${Math.abs(dernier[1] - pts[0][1])}</text></svg>`;
}

// ---------- Les dates, à la française ----------
export function quand(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'à l\'instant'; if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min'; if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  const j = Math.round(s / 86400); if (j === 1) return 'hier'; if (j < 7) return 'il y a ' + j + ' jours';
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
export const membreDepuis = () => new Date(profil.depuis).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

// Les pays proposés pour le drapeau du profil (le joueur le choisit ; rien n'est deviné).
export const PAYS = [['', 'Aucun'], ['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['CA', 'Canada'], ['LU', 'Luxembourg'], ['MA', 'Maroc'], ['DZ', 'Algérie'], ['TN', 'Tunisie'], ['SN', 'Sénégal'], ['CI', 'Côte d\'Ivoire'], ['ES', 'Espagne'], ['IT', 'Italie'], ['DE', 'Allemagne'], ['GB', 'Royaume-Uni'], ['US', 'États-Unis'], ['BR', 'Brésil'], ['PT', 'Portugal']];
export const drapeau = (c) => c && /^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map((x) => 0x1F1E6 + x.charCodeAt(0) - 65)) : '';
export { rang, clamp };
