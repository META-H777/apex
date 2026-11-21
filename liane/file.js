// LIANE — la recherche d'un adversaire en ligne, façon chess.com : on appuie sur Jouer, le jeu trouve un vrai joueur de ton niveau.
// Sans serveur, la file d'attente est une salle sur les relais publics (reseau.js) : chacun y dit « je cherche » chaque seconde, avec son Elo.
// Deux joueurs d'Elo assez proches se trouvent : le plus petit identifiant propose une partie (un code), l'autre accepte,
// puis le duel en direct habituel prend le relais avec ce code. L'écart d'Elo accepté s'élargit à mesure qu'on attend.
import { salle, nouveauCode } from './reseau.js?v=34';

const SUJET = 'liane-duel/1/file';
export const ecartAccepte = (s) => s >= 20 ? Infinity : 150 + 25 * s;     // en points d'Elo, après s secondes d'attente

// moi : { nom, elo, singe, v (version des messages) }. trouve(code, hote, lui) : un adversaire a dit oui. etat({ relais, vus, attente }) : pour l'écran d'attente.
export function chercher(moi, trouve, etat = () => {}) {
  const t0 = performance.now() / 1000, autres = new Map(); let fini = false, offre = null, tic = 0;
  const attente = () => performance.now() / 1000 - t0;
  const S = salle(SUJET, (m) => {
    if (fini || m.de === S.de || m.v !== moi.v) return; const now = performance.now() / 1000;
    if (m.k === 'cherche' && Number.isFinite(m.elo)) { autres.set(m.de, { de: m.de, nom: String(m.nom || '').slice(0, 12), elo: m.elo, attente: +m.s || 0, vu: now }); return; }
    if (m.pour !== S.de || typeof m.code !== 'string' || !/^[A-Z]{4}$/.test(m.code)) return;
    // On me propose une partie : j'accepte si je ne suis pas déjà en train d'en proposer une.
    if (m.k === 'propose' && !offre) { S.envoyer({ k: 'accepte', v: moi.v, pour: m.de, code: m.code }); finir(); trouve(m.code, false, autres.get(m.de) || { nom: '', elo: 0 }); }
    else if (m.k === 'accepte' && offre && offre.avec === m.de && offre.code === m.code) { finir(); trouve(m.code, true, autres.get(m.de) || { nom: '', elo: 0 }); }
  }, () => etat(info()));
  const info = () => ({ relais: S.ouverts, vus: [...autres.values()].filter((a) => performance.now() / 1000 - a.vu < 3).length, attente: attente() });
  function finir() { if (fini) return; fini = true; clearInterval(tic); setTimeout(() => S.fermer(), 1500); }      // on laisse partir les derniers messages
  tic = setInterval(() => {
    if (fini) return; const now = performance.now() / 1000, s = attente();
    S.envoyer({ k: 'cherche', v: moi.v, elo: moi.elo, nom: moi.nom, s: Math.round(s) });
    for (const [k, a] of autres) if (now - a.vu > 3.5) autres.delete(k);
    if (offre && now - offre.t > 3) offre = null;                     // pas de réponse : il est parti ou a trouvé quelqu'un d'autre
    if (!offre) {
      // Le meilleur adversaire possible : le plus proche en Elo, parmi ceux qui m'acceptent et que j'accepte. Seul le plus petit identifiant propose.
      const ok = [...autres.values()].filter((a) => a.de > S.de && Math.abs(a.elo - moi.elo) <= Math.min(ecartAccepte(s), ecartAccepte(a.attente)))
        .sort((a, b) => Math.abs(a.elo - moi.elo) - Math.abs(b.elo - moi.elo));
      if (ok.length) { offre = { avec: ok[0].de, code: nouveauCode(), t: now }; S.envoyer({ k: 'propose', v: moi.v, pour: offre.avec, code: offre.code }); }
    }
    etat(info());
  }, 1000);
  S.envoyer({ k: 'cherche', v: moi.v, elo: moi.elo, nom: moi.nom, s: 0 });
  return { arreter: finir, info };
}
