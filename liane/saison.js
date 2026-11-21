// LIANE — les saisons (idée de PA, 20/11/2026) : une saison dure un mois du calendrier.
// À la fin, chacun reçoit les récompenses de la ligue la plus haute qu'il a atteinte pendant la saison, puis les Elo se resserrent et tout le monde repart en course.
// Tant qu'il n'y a pas de serveur, la saison suit la date du téléphone et les récompenses sont données sur l'appareil : c'est un prototype.
// Les récompenses d'aujourd'hui sont faites par le code (médailles, traînées). Les tenues de saison viendront s'y ajouter.
import { profil, garder, rang, RANGS, SKINS, oublierEcarts } from './rivaux.js?v=34';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// Deux couleurs par mois : celle de la traînée, et sa compagne pour le dégradé.
const TEINTES = [['170,225,255', '240,248,255'], ['255,170,200', '255,225,235'], ['150,235,170', '235,255,190'], ['255,190,220', '190,235,255'], ['120,235,150', '255,240,150'], ['255,225,120', '255,170,90'],
  ['90,220,235', '255,235,150'], ['255,150,90', '255,220,120'], ['235,190,110', '160,220,150'], ['255,140,60', '190,110,255'], ['255,170,80', '210,90,70'], ['150,210,255', '255,255,255']];
const COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DEPART = 800, RESSERRE = 0.5;            // en fin de saison, chaque Elo revient à mi-chemin du départ
const de = (m) => (/^[aoô]/i.test(m) ? 'd\'' : 'de ') + m;
const maj = (m) => m[0].toUpperCase() + m.slice(1);

export const idSaison = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
export function infoSaison(id) {
  // jours : les jours pleins qui restent après aujourd'hui (0 le dernier jour du mois).
  const [a, m] = id.split('-').map(Number), n = new Date(), dernier = new Date(a, m, 0).getDate(), jours = n.getFullYear() === a && n.getMonth() + 1 === m ? dernier - n.getDate() : 0;
  return { id, an: a, mois: MOIS[m - 1], nom: 'Saison ' + de(MOIS[m - 1]), court: COURTS[m - 1] + ' ' + a, jours, suivante: MOIS[m % 12] };
}
// Les trois traînées d'une saison : une couleur (dès Argent), un dégradé (dès Or), le dégradé avec des étincelles (dès Diamant).
export function traineesDe(id) {
  const m = +id.split('-')[1], [c1, c2] = TEINTES[m - 1], nom = maj(MOIS[m - 1]);
  return [{ id: 's' + id + '-1', nom, saison: id, palier: 1, seuil: Infinity, ink: '#04161a', rim: `rgba(${c1},0.95)`, trail: c1 },
    { id: 's' + id + '-2', nom: nom + ' duo', saison: id, palier: 2, seuil: Infinity, ink: '#04161a', rim: `rgba(${c2},0.95)`, trail: c1, trail2: c2 },
    { id: 's' + id + '-3', nom: nom + ' éclat', saison: id, palier: 4, seuil: Infinity, ink: '#04161a', rim: 'rgba(255,255,255,0.95)', trail: c1, trail2: c2, eclat: true }];
}
// Ce que donne chaque ligue : sa médaille, et les traînées de la saison à partir d'Argent. Une ligue donne aussi tout ce que donnent celles du dessous.
export function recompenses(id) { const T = traineesDe(id); return RANGS.map(([, nom], i) => ({ i, nom, medaille: 'Médaille ' + nom, trainee: T.find((t) => t.palier === i) || null })); }
const connues = new Set();
function declarer(id) { if (connues.has(id)) return; connues.add(id); for (const t of traineesDe(id)) if (!SKINS.some((s) => s.id === t.id)) SKINS.push(t); }

// Le bilan d'une saison : la ligue la plus haute atteinte, ce qu'elle donne, et l'Elo de la reprise.
export function bilan(s = profil.saison, elo = profil.elo) {
  const r = rang(s.haut).i;
  return { saison: infoSaison(s.id), rang: r, haut: s.haut, trainees: traineesDe(s.id).filter((t) => t.palier <= r), avant: elo, apres: Math.round(DEPART + (elo - DEPART) * RESSERRE) };
}
// À l'ouverture du jeu. Si le mois a changé : la saison passée est close, ses récompenses sont données, les Elo se resserrent. Rend alors son bilan, à montrer au joueur.
export function ouvrirSaison() {
  const id = idSaison(); if (!Array.isArray(profil.palmares)) profil.palmares = [];
  profil.palmares = profil.palmares.filter((p) => p && typeof p.id === 'string' && /^\d{4}-\d{2}$/.test(p.id) && Number.isFinite(p.rang));
  const s = profil.saison; let b = null;
  if (!s || typeof s.id !== 'string' || !/^\d{4}-\d{2}$/.test(s.id) || !Number.isFinite(s.haut)) profil.saison = { id, haut: profil.elo };
  else if (s.id < id) {
    b = bilan(s); profil.palmares.push({ id: s.id, rang: b.rang, haut: s.haut });
    for (const t of b.trainees) if (!profil.acquis.includes(t.id)) profil.acquis.push(t.id);
    profil.elo = b.apres; oublierEcarts(); profil.saison = { id, haut: profil.elo };
  } else if (s.id > id) profil.saison = { id, haut: profil.elo };          // l'horloge du téléphone a reculé : on repart de la date d'aujourd'hui, sans rien donner
  profil.saison.haut = Math.max(profil.saison.haut, profil.elo);
  declarer(id); for (const p of profil.palmares) declarer(p.id);
  garder(); return b;
}
// Après un duel classé : le meilleur Elo de la saison. Rend la récompense que ce duel vient d'assurer, s'il y en a une.
export function noterSaison() {
  const s = profil.saison; if (!s) return null; const avant = rang(s.haut).i; s.haut = Math.max(s.haut, profil.elo); const apres = rang(s.haut).i;
  return apres > avant ? recompenses(s.id)[apres] : null;
}
