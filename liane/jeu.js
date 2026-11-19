// LIANE — les règles du mouvement, sans aucun dessin.
// Vue de côté, l'axe x va vers la droite, l'axe y vers le haut, en mètres.
//
// Le geste : tenir = saisir la liane que les mains touchent ; lâcher = s'élancer, avec exactement la vitesse qu'on a.
// Le balancement : un vrai pendule. Une liane saisie bas donne un grand arc rapide, une liane saisie haut un petit arc lent.
//   Si l'on reste pendu, le singe revient en arrière, se laisse glisser plus bas et repart : on perd du temps, pas la partie.
// Le départ : le singe attend, accroché. On pose le doigt, il se laisse partir ; on lâche, il s'élance. Comme sur toutes les lianes.
// L'arc doré : à chaque liane, le jeu calcule le lâcher le plus rapide qui mène sûrement à la suivante, et le montre.
//   Lâcher dedans donne un cran d'élan (jusqu'à trois) ; lâcher dehors casse la série.
// Comment on perd : on tombe sous les cimes, ou la nuit nous rattrape. Dans les deux cas, c'est fini.

export const CFG = {
  g: 30,                 // pesanteur : forte, pour des arcs nerveux
  sol: 0,                // la cime des arbres du dessous : passer dessous, c'est tomber
  amp: 0.59,             // le singe entretient un balancement qui monte à 66° : c'est ce qui fixe sa vitesse au creux
  elan: 0.13,            // énergie gagnée par cran d'élan (un lâcher dans l'arc doré = un cran)
  crans: 3,              // nombre de crans ; au dernier, le singe est « en flux »
  pump: 22,              // traction du singe vers l'avant, tant qu'il n'a pas retrouvé sa vitesse
  fuite: 2,              // la vitesse en trop se dissipe à ce rythme
  drag: 0.004,           // frein de l'air en vol
  portee: 1.9,           // les mains saisissent une liane à cette distance devant elles
  portee2: 0.9,          // et un peu moins derrière
  minR: 2.4,             // on ne saisit pas une liane juste sous son accroche
  debut: 2,              // les toutes premières lianes sont plus rapprochées de cette distance, puis l'écart s'ouvre sur 120 m
  arcMin: 0.45,          // l'arc doré ne descend jamais plus bas que cet angle
  bout: 1.32,            // angle où le balancement arrive au bout
  glisse: 3,             // s'il revient en arrière, le singe se laisse glisser le long de la liane à cette vitesse : une corde plus longue lui rend de l'élan
  repos: 0.6,            // délai avant de pouvoir resaisir la liane qu'on vient de lâcher
  nuitDepart: 30,        // la nuit part de cette distance derrière le singe
  nuitRecul: 34,         // et ne se laisse jamais distancer de plus
};

export function rnd(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ---------- Les niveaux : la même règle du jeu, une forêt de plus en plus exigeante ----------
// x0, pente : où la difficulté commence à monter, et sur quelle distance elle atteint son maximum.
// ecart : distance moyenne entre deux lianes, au plus facile puis au plus dur ; alea : de combien elle varie ; serre : chance d'un écart resserré.
// bout : hauteur du bout libre des lianes (plus c'est haut, plus la liane est courte) ; haut : de combien les accroches montent ou descendent.
// passage : distance entre deux passages durs, au plus facile puis au plus dur. arc : largeur de l'arc doré, au début, au plus dur, puis très loin.
// nuit : vitesse de la nuit au départ, à la longue, temps pour y arriver, et accélération sans fin. tenue : les rivaux y tiennent moins longtemps.
export const MONDES = [
  { id: 'canopee', nom: 'Canopée', x0: 40, pente: 800, ecart: [11.5, 13.4], alea: 5, serre: 0.14, bout: [2.4, 3.4], haut: 3.2, passage: [190, 80], arc: [0.3, 0.15, 0.09], nuit: [4.8, 12.3, 75, 0.004], tenue: 1 },
  { id: 'aube', nom: 'Brume rose', x0: -60, pente: 650, ecart: [11.8, 13.8], alea: 6, serre: 0.2, bout: [2.4, 3], haut: 3.6, passage: [140, 60], arc: [0.26, 0.13, 0.08], nuit: [5.6, 12.6, 65, 0.004], tenue: 0.8 },
  { id: 'braise', nom: 'Braise', x0: -160, pente: 520, ecart: [12, 14], alea: 5.5, serre: 0.16, bout: [3.2, 3.2], haut: 3.4, passage: [105, 48], arc: [0.23, 0.14, 0.09], nuit: [6.4, 12.9, 55, 0.005], tenue: 0.62 },
  { id: 'lune', nom: 'Lune', x0: -300, pente: 450, ecart: [12, 14.2], alea: 6.5, serre: 0.22, bout: [2.8, 3.4], haut: 4.4, passage: [75, 36], arc: [0.2, 0.13, 0.09], nuit: [7.4, 13.1, 45, 0.005], tenue: 0.48 },
  { id: 'essai', nom: 'Essai · tremplins', essai: true, x0: 40, pente: 800, ecart: [11.5, 13.4], alea: 5, serre: 0.14, bout: [2.4, 3.4], haut: 3.2, passage: [60, 45], arc: [0.3, 0.15, 0.09], nuit: [4.8, 12.3, 75, 0.004], tenue: 1 },
];
// Les passages durs : des lianes qui demandent un lâcher précis. f vaut 1 au premier essai et baisse si la liane est refusée par les éclaireurs.
const HAUTE = (r, k, f) => { const y = 14 + r() * 1.3 * f, L = 3.4 + r() * 1.2 + (1 - f) * 2.5; return { dx: 6.6 + r() * 1.8, y, bout: y - L }; };   // courte et haute : il faut arriver par en haut
const SAUT = (r, k, f) => ({ dx: 13.4 + (1.6 + 2.2 * k) * f + r() * 0.8, y: 13 + (r() - 0.5), bout: 2.4 + r() * 1.4 });                                // grand vide : un lâcher tendu, sans marge
const SERREE = (r, k, f) => ({ dx: 7 + r() * 1.4, y: 13 + (r() - 0.5) * 2.6 * f, bout: 3 + r() * 4.4 * f });                                           // enfilade : trois lianes coup sur coup
const MARCHE = (j) => (r, k, f) => ({ dx: 7.8 + r() * 1.6, y: 12.5 + j * 1.05 * f, bout: 5 + j * 1.4 * f + r() * 0.8 });                               // escalier : chaque liane plus haute et plus courte
const PLONGEON = (r, k, f) => ({ dx: 6.4 + r() * 2.2 + (1 - f) * 2, y: 13 + (r() - 0.5), bout: 2.4 });                                                 // après une liane haute : on se laisse tomber sur une longue liane, et la chute devient de l'élan
const TREMPLIN = (r, k, f) => ({ dx: 17.5 + r() * 3.5 * f, y: 13 + (r() - 0.5), bout: 2.4 + r(), tr: { ou: 0.48 + r() * 0.06, y: 1.3, w: 3.8 - 0.8 * k } });   // un vide infranchissable d'un seul saut, avec une feuille au milieu
const MOTIFS_ESSAI = [[TREMPLIN], [TREMPLIN], [SERREE, TREMPLIN], [HAUTE, PLONGEON, TREMPLIN]];
const MOTIFS = [[HAUTE, PLONGEON], [SAUT], [SERREE, SERREE, SERREE], [MARCHE(0), MARCHE(1), MARCHE(2), PLONGEON], [HAUTE, PLONGEON, HAUTE, PLONGEON], [SAUT, HAUTE, PLONGEON], [SERREE, SAUT]];
// L'énergie de balancement que le singe entretient sur une corde de longueur R, selon ses crans d'élan.
const cible = (R, chaine) => CFG.g * R * CFG.amp * (1 + CFG.elan * Math.min(chaine, CFG.crans));

function pose(m) { const li = m.li, s = Math.sin(m.th), c = Math.cos(m.th); m.x = li.x + m.R * s; m.y = li.y - m.R * c; m.vx = m.R * m.om * c; m.vy = m.R * m.om * s; }

function lacher(m, ev) {
  pose(m);
  // Dans l'arc doré : un cran d'élan de plus, que le singe prendra au balancement suivant. Hors de l'arc : la série est cassée.
  const parfait = !!m.arc && m.om > 0 && m.th >= m.arc[0] - 0.012 && m.th <= m.arc[1] + 0.012;
  if (parfait) { m.chaine = Math.min(CFG.crans, m.chaine + 1); m.parfaits++; } else m.chaine = 0;
  m.mode = 'fly'; m.depart = false; m.want = false; m.air = 0; m.last = m.li;
  if (ev) ev.push({ type: 'lacher', x: m.x, y: m.y, parfait, chaine: m.chaine, li: m.li, th: m.th, om: m.om });
}

// La liane que les mains touchent : sa corde passe à portée, entre son accroche et son bout.
function saisissable(m, lianas) {
  let best = null, bestD = 1e9;
  for (const li of lianas) {
    const dx = m.x - li.x; if (dx > CFG.portee2) continue; if (dx < -CFG.portee) break;
    if (li === m.last && m.air < CFG.repos) continue;
    if (m.y > li.y - CFG.minR || m.y < li.y - li.L - 0.3) continue;      // trop près de l'accroche, ou sous le bout de la liane
    if (Math.abs(dx) < bestD) { bestD = Math.abs(dx); best = li; }
  }
  return best;
}

// Saisir : la corde prend la longueur qu'il faut, la vitesse se garde entière et suit le balancement. Rien ne saute.
function saisir(m, li, ev) {
  const dx = m.x - li.x, dy = li.y - m.y, sp = Math.hypot(m.vx, m.vy);
  m.th = Math.atan2(dx, dy); m.R = Math.hypot(dx, dy);
  const vt = m.vx * Math.cos(m.th) + m.vy * Math.sin(m.th);
  m.om = (vt > -2 ? 1 : -1) * sp / m.R;
  m.li = li; m.mode = 'swing'; m.want = false; m.saisies++; m.arc = null;
  pose(m); if (ev) ev.push({ type: 'saisie', x: m.x, y: m.y, li });
}

// Un pas du mouvement. Sert au jeu, aux fantômes et aux essais du pilote : la même règle pour tous.
export function pas(m, lianas, dt, ev) {
  const C = CFG;
  if (m.mode === 'swing') {
    if (m.idle) { m.om = 0; pose(m); return; }                           // avant le premier geste : il attend, accroché
    m.om += -(C.g / m.R) * Math.sin(m.th) * dt;
    const v = m.R * m.om, E = 0.5 * v * v + C.g * m.R * (1 - Math.cos(m.th));   // l'énergie du balancement, comptée depuis son creux
    if (m.om > 0) {
      const Et = cible(m.R, m.chaine);
      if (E < Et) { if (m.th < 1) m.om += C.pump / m.R * dt; }          // il se tracte vers l'avant, jusqu'à retrouver sa vitesse
      else if (E > Et + 4) { const v2 = Math.max(0, v * v - 2 * C.fuite * (E - Et) * dt); m.om = Math.sqrt(v2) / m.R; }
      if (m.th > C.bout) m.om -= m.om * Math.min(1, 30 * dt);            // au bout du balancement, il ne monte plus
    } else {
      m.om -= m.om * 0.7 * dt;                                           // en arrière, il s'essouffle
      const Rmax = m.li.L - 0.6;                                         // et il se laisse glisser vers le bas de la liane
      if (m.R < Rmax) { const R2 = Math.min(Rmax, m.R + C.glisse * dt); m.om *= m.R / R2; m.R = R2; }
      if (m.th < -C.bout) m.om -= m.om * Math.min(1, 30 * dt);
    }
    m.th += m.om * dt;
    if (m.th > C.bout + 0.15) { m.th = C.bout + 0.15; m.om = Math.min(0, m.om); } else if (m.th < -C.bout - 0.15) { m.th = -C.bout - 0.15; m.om = Math.max(0, m.om); }
    pose(m);
    if (m.want && (!m.depart || m.th >= 0.6)) lacher(m, ev);             // sur la toute première liane, un lâcher trop tôt attend le bon moment
  } else {
    m.air += dt;
    m.vy -= C.g * dt;
    const sp = Math.hypot(m.vx, m.vy), k = 1 - C.drag * sp * dt; m.vx *= k; m.vy *= k;
    m.x += m.vx * dt; m.y += m.vy * dt;
    // Un tremplin : une grande feuille tendue au-dessus des cimes. Le singe qui tombe dessus rebondit, d'autant plus haut qu'il arrive vite.
    if (m.vy < 0 && m.y < 4) for (const li of lianas) {
      const tr = li.tr; if (li.x - 40 > m.x) break; if (!tr || Math.abs(m.x - tr.x) > tr.w / 2) continue;
      const pieds = m.y - 0.9; if (pieds <= tr.y && pieds - m.vy * dt > tr.y - 0.5) { m.y = tr.y + 0.9; m.vy = 14.5 - 0.22 * m.vy; m.vx = Math.max(m.vx, 7.5); if (ev) ev.push({ type: 'rebond', x: m.x, y: tr.y, tr }); }
    }
    if (m.hold) { const li = saisissable(m, lianas); if (li) saisir(m, li, ev); }
    if (m.mode === 'fly' && m.y < C.sol - 1.2) { m.mort = 'chute'; if (ev) ev.push({ type: 'mort', cause: 'chute', x: m.x, y: m.y }); }
  }
}

// ---------- Les essais : le jeu joue un lâcher à l'avance, avec les mêmes règles, pour savoir où il mène ----------
// Essaie un lâcher à l'angle th. Renvoie l'état du singe accroché à la liane suivante, ou rien s'il tombe.
export function essai(m0, lianas, th, delai = 0.06) {
  const m = { ...m0 }, dt = 1 / 120; let n = 0; m.hold = true; m.want = false;
  if (m.idle) { m.idle = false; m.depart = true; }
  while (m.mode === 'swing') {
    if (m.om > 0 && m.th >= th) { m.hold = false; m.want = true; }
    else if (m.om < 0 && n > 2) return null;                             // il n'atteint pas cet angle
    pas(m, lianas, dt, null); if (++n > 480) return null;
  }
  while (m.mode === 'fly') { m.hold = m.air >= delai; pas(m, lianas, dt, null); if (m.mort || ++n > 1000) return null; }
  m.T = n * dt; return m;
}
const SUITE = [0.5, 0.7, 0.9, 1.1];
// Un lâcher sûr : la liane suivante est saisie avec de la marge au-dessus de son bout, et pas trop près de son accroche.
function sur(m, lianas, th, marge) {
  const r = essai(m, lianas, th); if (!r) return null;
  if (r.y - (r.li.y - r.li.L) < marge || r.y > r.li.y - CFG.minR - 0.25) return null;
  return r;
}
// L'arc doré : il commence au lâcher le plus tendu (donc le plus rapide) qui reste sûr, et dure « largeur » radians.
// prof = 2 : on vérifie aussi qu'on peut continuer depuis la liane suivante.
export function arcDore(m, lianas, largeur, prof = 2) {
  let debut = -1;
  for (let th = Math.max(CFG.arcMin, m.th + 0.06); th <= 1.25; th += 0.02) {
    const r = sur(m, lianas, th, 0.9); if (!r) continue;
    if (prof < 2 || SUITE.some((t2) => essai(r, lianas, t2))) { debut = th; break; }
  }
  if (debut < 0) return null;
  let fin = debut;
  for (let th = debut + 0.02; th <= debut + largeur + 1e-6; th += 0.02) { if (!sur(m, lianas, th, 0.5)) break; fin = th; }
  return [debut, Math.max(fin, debut + 0.02)];
}

export class Jeu {
  // nuit : faux pour l'écran d'accueil, où le singe se promène sans danger. monde : le niveau, qui fixe la difficulté.
  constructor(seed = 1, nuit = true, monde = MONDES[0]) {
    this.r = rnd(seed); this.d = monde; this.lianas = []; this.id = 0; this.time = 0; this.events = []; this.impasses = 0; this.durs = 0;
    this.file = []; this.prochain = 70 + monde.passage[0] * (0.3 + 0.5 * this.r());       // le premier passage dur n'arrive pas tout de suite
    const li = this.liane(0, 13, 2.4);
    this.M = { mode: 'swing', li, R: 7, th: -0.55, om: 0, x: 0, y: 0, vx: 0, vy: 0, hold: false, idle: true, depart: false, want: false, air: 0, last: null, chaine: 0, parfaits: 0, saisies: 0, mort: null, arc: null };
    pose(this.M);
    // Deux éclaireurs parcourent la forêt à mesure qu'elle pousse : l'un sans élan, l'autre en flux. Une liane n'est gardée que si les deux passent.
    this.eclaireurs = [0, CFG.crans].map((c) => ({ ...this.M, idle: false, depart: true, chaine: c, cran: c }));
    while (this.dernier.x < 90) this.addLiana();
    this.nuit = { on: nuit, x: -CFG.nuitDepart, t: 0, v: 0 };
  }
  get dernier() { return this.lianas[this.lianas.length - 1]; }
  // La difficulté, de 0 à 1, selon la distance ; la largeur de l'arc doré ; la vitesse de la nuit.
  niv(x) { return clamp((x - this.d.x0) / this.d.pente, 0, 1); }
  larg(x) { const a = this.d.arc, fin = this.d.x0 + this.d.pente; return x < fin ? a[0] + (a[1] - a[0]) * this.niv(x) : a[1] + (a[2] - a[1]) * clamp((x - fin) / 3000, 0, 1); }
  vNuit(t) { const n = this.d.nuit; return n[0] + (n[1] - n[0]) * (1 - Math.exp(-t / n[2])) + n[3] * t; }
  liane(x, y, bout) { const li = { id: this.id++, x, y, L: y - bout, a: 0, av: 0, ph: this.r() * 6.28, seed: (this.r() * 1e9) | 0 }; this.lianas.push(li); return li; }

  // Est-ce que les deux éclaireurs franchissent la dernière liane avec un arc doré assez large ? Si oui, renvoie leurs arcs.
  passable(larg) {
    const arcs = [];
    for (const e of this.eclaireurs) {
      const a = arcDore(e, this.lianas, larg, 1); if (!a || a[1] - a[0] < larg - 0.03) return null; arcs.push(a);
    }
    return arcs;
  }
  // Une liane ordinaire : l'écart s'ouvre avec la distance, mais se resserre de temps en temps ; hauteurs et longueurs de plus en plus inégales.
  libre(k, f) {
    const r = this.r, d = this.d, prev = this.dernier;
    const dx = r() < d.serre * (0.4 + 0.6 * k) ? 7.6 + r() * 1.6 : d.ecart[0] + (d.ecart[1] - d.ecart[0]) * k * f - CFG.debut * Math.max(0, 1 - prev.x / 120) + (r() - 0.5) * (0.8 + d.alea * k) * f;
    return { dx, y: 13 + (r() - 0.5) * d.haut * k * f, bout: d.bout[0] + k * (0.4 + r() * d.bout[1]) * f };
  }
  addLiana() {
    const r = this.r, d = this.d, prev = this.dernier, k = this.niv(prev.x), larg = this.larg(prev.x);
    // De loin en loin, un passage dur : une ou plusieurs lianes spéciales, tirées au hasard. De plus en plus souvent avec la distance.
    if (!this.file.length && prev.x >= this.prochain) { const liste = d.essai ? MOTIFS_ESSAI : MOTIFS; this.file = liste[(r() * liste.length) | 0].slice(); this.prochain = prev.x + (d.passage[0] + (d.passage[1] - d.passage[0]) * k) * (0.6 + 0.8 * r()); }
    const moule = this.file.shift() || null;
    let arcs = null, li = null;
    for (let i = 0; i < 8 && !arcs; i++) {
      const f = 1 - i / 8, v = moule ? moule(r, k, f) : this.libre(k, f);    // à chaque refus des éclaireurs, on propose une liane moins extrême
      li = this.liane(prev.x + v.dx, v.y, v.bout); li.dur = !!moule; if (v.tr) li.tr = { x: prev.x + v.dx * v.tr.ou, y: v.tr.y, w: v.tr.w, ecrase: 0 };
      arcs = this.passable(moule ? Math.max(0.1, larg * 0.6) : larg); if (!arcs) { this.lianas.pop(); this.id--; }
    }
    if (arcs && moule) this.durs++;
    for (let e = 0; e < 19 && !arcs; e++) {                              // en dernier recours : une longue liane, à la distance qui convient
      li = this.liane(prev.x + 10.5 + (e % 2 ? 1 : -1) * Math.ceil(e / 2) * 0.55, 13, 2.4); arcs = this.passable(0.1); if (!arcs) { this.lianas.pop(); this.id--; }
    }
    if (!arcs) { li = this.liane(prev.x + 11, 13, 2.4); this.impasses++; }
    // Les éclaireurs avancent d'une liane, en lâchant au milieu de leur arc.
    this.eclaireurs = this.eclaireurs.map((e, i) => {
      const a = arcs && arcs[i], n = essai(e, this.lianas, a ? (a[0] + a[1]) / 2 : 0.7);
      if (n && n.li === li) { n.chaine = e.cran; n.cran = e.cran; n.arc = null; return n; }
      const m = { ...e, li, R: Math.min(6.5, li.L - 0.5), th: -0.25, mode: 'swing', idle: false, depart: false, want: false, chaine: e.cran, arc: null };   // éclaireur perdu : on le repose sur la liane
      m.om = Math.sqrt(2 * cible(m.R, m.chaine)) / m.R * 0.9; pose(m); return m;
    });
  }

  setHold(h) {
    const M = this.M; if (h === M.hold) return; M.hold = h;
    if (h && M.idle) { M.idle = false; M.depart = true; }                // premier geste : il se laisse partir
    else if (!h && M.mode === 'swing' && !M.idle) M.want = true;         // lâcher la liane
  }

  step(dt) {
    const M = this.M, C = CFG; if (M.mort) return; this.time += dt;
    const li0 = M.mode === 'swing' ? M.li : null, n0 = M.saisies, om0 = M.om;
    pas(M, this.lianas, dt, this.events);
    // À chaque saisie, et à chaque retour vers l'avant, on calcule l'arc doré de cette liane.
    if (M.mode === 'swing' && !M.idle && (M.saisies !== n0 || (om0 <= 0 && M.om > 0))) M.arc = arcDore(M, this.lianas, this.larg(M.li.x));
    if (li0 && M.mode === 'fly') { li0.a = M.th; li0.av = M.om * 0.35; }   // la liane lâchée repart en arrière
    const N = this.nuit;
    if (N.on && !M.idle && !M.mort) {                  // la nuit avance, de plus en plus vite
      N.t += dt; N.v = this.vNuit(N.t); N.x = Math.max(N.x + N.v * dt, M.x - C.nuitRecul);
      if (N.x > M.x - 0.8) { M.mort = 'nuit'; this.events.push({ type: 'mort', cause: 'nuit', x: M.x, y: M.y }); }
    }
    for (const li of this.lianas) {                    // les lianes libres : un souffle de vent, et le retour après un lâcher (pour l'œil seulement)
      if (M.mode === 'swing' && li === M.li) { li.a = M.th; li.av = M.om; continue; }
      const rest = 0.03 * Math.sin(this.time * 0.9 + li.ph);
      li.av += ((rest - li.a) * 9 - li.av * 1.3) * dt; li.a += li.av * dt;
    }
    // La forêt pousse devant le singe. Ce calcul est lourd : on le fait de préférence en vol, juste après un lâcher, jamais au moment de viser.
    if (M.mode === 'fly' && this.dernier.x < M.x + 128) this.addLiana();     // une liane d'avance par pas, pendant le vol
    while (this.dernier.x < M.x + 92) this.addLiana();
    while (this.lianas.length > 2 && this.lianas[0].x < M.x - 45 && this.lianas[0] !== M.li) this.lianas.shift();
  }
}

// ---------- Le pilote : il sert à l'écran d'accueil, aux rivaux simulés et aux vérifications ----------
// Choisit l'angle du prochain lâcher. gout : la chance de viser l'arc doré ; sinon, un lâcher plus tardif, sûr mais lent.
export function choisir(m, lianas, gout = 0.6, hasard = Math.random) {
  const a = m.arc; if (!a) { for (let th = Math.max(0.3, m.th + 0.06); th <= 1.25; th += 0.05) if (sur(m, lianas, th, 0.3)) return th; return undefined; }
  if (hasard() < gout) return a[0] + (a[1] - a[0]) * (0.2 + 0.6 * hasard());
  for (let k = 0; k < 6; k++) { const th = a[1] + 0.05 + hasard() * 0.3; const r = sur(m, lianas, th, 0.5); if (r && SUITE.some((t2) => essai(r, lianas, t2))) return th; }
  return a[0] + (a[1] - a[0]) * 0.5;
}
// Tient le doigt du pilote, pas après pas. st garde ses intentions ; st.fini = il n'attrape plus rien.
export function pilote(jeu, st) {
  const M = jeu.M; if (M.mort) return;
  if (M.mode === 'swing') {
    if (M.idle) { jeu.setHold(true); return; }
    // S'il ne voit aucun lâcher sûr, il reste pendu un aller-retour pour reprendre de la vitesse, puis réessaie. Quand la nuit est sur ses talons, il ne vise plus que l'arc doré.
    if (st.th === undefined || (M.om > 0 && st.sens <= 0)) { st.th = choisir(M, jeu.lianas, jeu.nuit.on && M.x - jeu.nuit.x < 16 ? 1 : st.gout ?? 0.6, st.r || Math.random); if (st.th === undefined) st.th = (st.essais = (st.essais || 0) + 1) > 3 ? 0.75 : 9; else st.essais = 0; }
    st.sens = M.om;
    if (M.om > 0 && M.th + M.om / 240 >= st.th) jeu.setHold(false);
  } else { st.th = undefined; jeu.setHold(!st.fini && M.air >= 0.06); }
}
