// LIANE — le jeu : un duel de distance contre le fantôme d'un rival, un classement Elo, des skins.
// Tenir pour saisir la liane, lâcher pour s'élancer. On tombe, c'est fini. La nuit rattrape ceux qui traînent.
// Les règles du mouvement sont dans jeu.js, le décor dans decor.js, les rivaux dans rivaux.js.
import { Jeu, CFG, MONDES, rnd, pilote } from './jeu.js?v=15';
import { buildDecor, drawTile, PAL, setPalette } from './decor.js?v=15';
import { corps, poseSinge, dessinerSinge, morpho } from './singe.js?v=15';
import { ESPECES, COMPETENCES, espece } from './especes.js?v=15';
import { chargerPeau, dessinerPeau } from './peau.js?v=15';
import { PARCOURS, SKINS, skinById, rang, fantome, etat, profil, garder, gain, acquerir, possede, adversaire, classement } from './rivaux.js?v=15';

const VERSION = 'v0.7';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const cv = $('ecran'), ctx = cv.getContext('2d', { alpha: false });
const auto = params.get('auto') === '1';        // le pilote joue tout seul, pour les mises au point : ses parties ne comptent jamais
const OR = '255,214,120';
// Un petit journal, gardé sur l'appareil : il dit pourquoi une partie a démarré ou s'est arrêtée. On le lit en ajoutant ?journal=1 à l'adresse.
function journal(q) { try { const j = JSON.parse(localStorage.getItem('liane-journal') || '[]'); j.push([Date.now(), q]); localStorage.setItem('liane-journal', JSON.stringify(j.slice(-60))); } catch (e) { /* rien */ } }
// Le niveau choisi : il fixe la difficulté (jeu.js), les couleurs (decor.js) et l'allure des lianes.
let monde = MONDES[clamp(profil.monde | 0, 0, MONDES.length - 1)];
const ALLURE = { canopee: { ep: 0.1, feuilles: 5 }, aube: { ep: 0.085, feuilles: 6 }, braise: { ep: 0.07, feuilles: 2 }, lune: { ep: 0.12, feuilles: 4 } };
setPalette(monde.id);

// ---------- L'écran ----------
let W = 0, H = 0, S = 1, baseY = 0, D = null, portrait = false, dpr = 1, qualite = 1, ancre = 0.44, vue = 0.44;
function resize() {
  dpr = Math.max(1, Math.min(devicePixelRatio || 1, 2) * qualite);
  W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
  portrait = H > W * 1.1;
  // Le singe est tenu au milieu de l'écran, et l'on voit toujours la liane qui vient.
  // Téléphone debout : on recule (22 m de large), et le jeu occupe une bande au milieu, entre le feuillage du haut et les cimes du bas.
  if (portrait) { S = Math.min(W / 22, H / 24); baseY = Math.round(H * 0.5 + 6.6 * S); ancre = 0.41; } else { S = H / 14; baseY = H - 0.95 * S; ancre = 0.47; }
  liberer(D); D = buildDecor(W, H, S, baseY, +(params.get('decor') || 7));
  $('tourne').classList.add('vu');                       // le jeu se joue maintenant aussi bien debout que couché
}
// Les images de l'ancien décor sont vidées tout de suite : sur téléphone, la mémoire des images est comptée, et la dépasser recharge la page.
function liberer(d, vu = new Set()) { if (!d || typeof d !== 'object' || vu.has(d)) return; vu.add(d); if (typeof d.getContext === 'function') { d.width = d.height = 0; return; } for (const k in d) liberer(d[k], vu); }

// ---------- L'état de la partie ----------
let jeu, M, B, pil, camX = 0, camLead = 3, camDy = 0, time = 0, last = performance.now() / 1000;
let phase = 'accueil';                 // accueil, course ou fin
let parcours = PARCOURS[0], rival = null, G = null, Bg = null, t = 0, mortT = 0, depasse = false, ecartT = -9, ignoreUp = false;
let classe = false, parti = false, aLever = false, appuiFrais = false;     // duel classé ou non ; premier geste fait ; un lever de doigt en attente du prochain pas
let accueilT = -9, aide = 9, arcVu = null, arcT = 0, cransVus = -1, distVue = -1, nuitVue = '', fluide = 0.016, mesureT = 0;
const Mg = {}, trail = [], rings = [], perche = { x: 0, y: 0 };
const X = (x) => (x - camX) * S + W * vue, Y = (y) => baseY - y * S + camDy;
function scene(seed, nuit) { jeu = new Jeu(seed, nuit, monde, esp.regles); M = jeu.M; B = corps(morpho(esp.corps)); perche.x = M.x; perche.y = M.y - B.m.PERCHE; pil = { gout: 0.9 }; camX = M.x + 3; camLead = 3; trail.length = 0; rings.length = 0; mortT = 0; arcVu = null; }
const dire = (txt) => { $('note').textContent = txt; $('note').classList.remove('vu'); };
const taire = () => $('note').classList.add('vu');
function majCrans(n) { if (n === cransVus) return; cransVus = n; const el = $('crans').children; for (let i = 0; i < el.length; i++) el[i].classList.toggle('on', i < n); }

function majAccueil() {
  const r = rang(profil.elo), cl = classement(), pos = cl.findIndex((c) => c.moi) + 1;
  $('aElo').textContent = profil.elo; $('aRang').textContent = r.nom;
  $('aPos').textContent = pos + (pos === 1 ? 'er' : 'e') + ' sur ' + cl.length;
  $('aSuite').textContent = r.suivant ? r.suivant[1] + ' à ' + r.suivant[0] : 'rang le plus haut';
  const i = MONDES.indexOf(monde), rec = (profil.records || {})[monde.id];
  $('mNom').textContent = monde.nom; $('mInfo').textContent = (monde.essai ? 'à l\'essai : des feuilles sur lesquelles on rebondit' : 'niveau ' + (i + 1) + ' sur ' + MONDES.filter((m) => !m.essai).length) + (rec ? ' · record ' + rec + ' m' : '');
}
function changerMonde(pas) {
  if (phase !== 'accueil') return; accueilT = time;
  const i = (MONDES.indexOf(monde) + pas + MONDES.length) % MONDES.length; monde = MONDES[i]; profil.monde = i; garder();
  setPalette(monde.id); resize(); scene((Math.random() * 1e9) | 0, false); majAccueil();
}
function accueil() {
  doigts.clear(); phase = 'accueil'; accueilT = time; scene((Math.random() * 1e9) | 0, false); majAccueil(); journal('accueil');
  $('fin').classList.remove('pret');
  for (const id of ['fin', 'hud', 'classement', 'skins', 'singes']) $(id).classList.remove('on');
  $('accueil').classList.add('on'); taire();
}
// Un duel classé se joue contre un nouveau rival. Rejouer le même parcours contre le même rival est un entraînement : l'Elo ne bouge pas.
// Le niveau d'essai et le pilote automatique ne comptent jamais.
function lancer(rejouer, source = 'code') {
  rejouer = rejouer && !!rival; journal((rejouer ? 'entraînement lancé : ' : 'duel lancé : ') + source); $('fin').classList.remove('pret'); doigts.clear(); aLever = appuiFrais = false;
  if (!rejouer) { parcours = PARCOURS[(Math.random() * PARCOURS.length) | 0]; rival = adversaire(profil.elo, rival); }
  classe = !rejouer && !auto && !monde.essai; parti = false;
  G = fantome(parcours, rival, monde); Bg = corps(); scene(parcours, true);
  phase = 'course'; t = 0; depasse = false; ecartT = -9; distVue = -1; nuitVue = ''; majCrans(0);
  aide = profil.v + profil.d < 3 ? 0 : 9;                // les premières parties, le jeu dit quoi faire, liane après liane
  for (const id of ['accueil', 'fin', 'classement', 'skins', 'singes']) $(id).classList.remove('on');
  $('hud').classList.add('on'); $('chrono').textContent = '0 m'; $('ecart').className = 'maj'; $('nuit').classList.remove('on');
  // La distance du rival ne s'affiche qu'une fois parti : on ne choisit pas ses adversaires.
  $('hMoi').textContent = classe ? 'toi · ' + profil.elo : 'toi · entraînement'; $('hLui').textContent = rival.nom + ' · ' + rival.elo;
  dire(aide === 0 ? 'pose le doigt et tiens' : 'tiens, puis lâche dans l\'arc doré');
}
// La partie est finie : celui qui est allé le plus loin gagne.
function finir() {
  const dist = Math.round(Math.max(0, M.x)), lui = Math.round(G.dist), gagne = dist > lui, avant = profil.elo, d = classe ? gain(profil, rival.elo, gagne) : 0, rAvant = rang(avant).nom;
  if (classe) { profil.elo = Math.max(100, profil.elo + d); if (gagne) profil.v++; else profil.d++; profil.enCours = null; }
  profil.records = profil.records || {}; const rec = dist > (profil.records[monde.id] || 0); if (rec) profil.records[monde.id] = dist;
  profil.record = Math.max(profil.record || 0, dist);
  garder(); phase = 'fin'; taire(); journal('fin : ' + (M.mort === 'nuit' ? 'nuit' : 'chute') + ' à ' + dist + ' m');
  const skin = acquerir().pop(), rAp = rang(profil.elo).nom; if (skin) garder();
  $('fTitre').textContent = gagne ? 'victoire' : 'défaite'; $('fin').classList.toggle('perdu', !gagne);
  $('fTemps').textContent = dist + ' m';
  $('fLui').textContent = rival.nom + ' ' + lui + ' m · écart ' + (dist - lui >= 0 ? '+' : '−') + Math.abs(dist - lui) + ' m';
  $('fCause').textContent = (M.mort === 'nuit' ? 'rattrapé par la nuit' : 'tombé') + (rec ? ' · nouveau record' : ' · record ' + profil.records[monde.id] + ' m');
  $('fElo').textContent = classe ? avant + ' → ' + profil.elo + ' (' + (d >= 0 ? '+' : '−') + Math.abs(d) + ')' : 'entraînement';
  $('fPlus').textContent = !classe ? (monde.essai ? 'niveau d\'essai : hors classement' : auto ? 'pilote automatique : hors classement' : 'le classement ne bouge pas') : skin ? 'nouveau skin : ' + skin.nom : rAp !== rAvant ? 'nouveau rang : ' + rAp : rang(profil.elo).nom;
  $('hud').classList.remove('on'); $('fin').classList.add('on');
  // Les boutons ne répondent qu'après un instant : un doigt qui tapote encore au moment de la chute ne relance pas une partie par accident.
  setTimeout(() => { if (phase === 'fin') $('fin').classList.add('pret'); }, 700);
}

// ---------- Les commandes : un seul doigt ----------
function hold(h) {
  if (phase !== 'course' || M.mort) return;
  if (h && M.idle) {
    if (aide === 0) { aide = 1; dire('lâche dans l\'arc doré'); } else taire();
  }
  // Un appui plus court qu'une image n'est pas perdu : le doigt reste « posé » jusqu'au prochain pas du mouvement.
  if (h) { appuiFrais = true; aLever = false; jeu.setHold(true); } else if (appuiFrais) aLever = true; else jeu.setHold(false);
}
const ui = (e) => e.target.closest && e.target.closest('[data-ui]');
// On compte les doigts posés : le singe ne lâche que lorsque le dernier se lève. Un second doigt ne provoque plus de lâcher involontaire.
const doigts = new Set();
addEventListener('pointerdown', (e) => {
  if (ui(e)) return; e.preventDefault();
  if (phase === 'accueil') { if (time - accueilT > 0.5) { lancer(false, 'toucher à l\'accueil'); ignoreUp = true; } return; }
  doigts.add(e.pointerId); hold(true);
}, { passive: false });
const leve = (e) => { if (ignoreUp) { ignoreUp = false; doigts.clear(); return; } doigts.delete(e.pointerId); if (!doigts.size) hold(false); };
addEventListener('pointerup', leve);
addEventListener('pointercancel', (e) => { journal('doigt annulé par le système'); leve(e); });
addEventListener('blur', () => { doigts.clear(); hold(false); });
document.addEventListener('visibilitychange', () => journal(document.hidden ? 'page masquée' : 'page affichée'));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => { if (e.code !== 'Space' || e.repeat) return; e.preventDefault(); if (phase === 'accueil') { if (time - accueilT > 0.5) lancer(false, 'clavier'); } else if (phase === 'fin') { if ($('fin').classList.contains('pret')) lancer(true, 'clavier'); } else hold(true); });
addEventListener('keyup', (e) => { if (e.code === 'Space') hold(false); });
const clic = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
const pret = () => $('fin').classList.contains('pret');
clic('bSuivant', () => { if (pret()) lancer(false, 'bouton duel suivant'); }); clic('bRevanche', () => { if (pret()) lancer(true, 'bouton rejouer'); }); clic('bAccueil', () => { if (pret()) accueil(); });
clic('mPrec', () => changerMonde(-1)); clic('mSuiv', () => changerMonde(1));
clic('bClassement', () => { ouvrirClassement(); }); clic('bSkins', () => { ouvrirSkins(); }); clic('bSinge', () => { ouvrirSinges(); });
clic('gFermer', () => { $('singes').classList.remove('on'); accueilT = time; });
clic('cFermer', () => { $('classement').classList.remove('on'); accueilT = time; }); clic('sFermer', () => { $('skins').classList.remove('on'); accueilT = time; });

function ouvrirClassement() {
  const cl = classement();
  $('cListe').innerHTML = cl.map((c, i) => `<li class="${c.moi ? 'moi' : ''}"><span class="p">${i + 1}</span><i style="background:${skinById(c.skin).trail ? 'rgb(' + skinById(c.skin).trail + ')' : '#0b2a2e'}"></i><span class="n">${c.nom}</span><span class="r">${rang(c.elo).nom}</span><span class="e">${c.elo}</span></li>`).join('');
  $('classement').classList.add('on');
  const moi = $('cListe').querySelector('.moi'); if (moi) moi.scrollIntoView({ block: 'center' });
}
// Le choix du singe : quatre espèces, chacune avec son corps et ses seize points de compétence.
function ouvrirSinges() {
  $('gListe').innerHTML = ESPECES.map((e) => {
    const choisi = esp.id === e.id, pts = COMPETENCES.map(([k, nom]) => `<li><span>${nom}</span><em>${'<i class="p"></i>'.repeat(e.points[k])}${'<i></i>'.repeat(5 - e.points[k])}</em></li>`).join('');
    return `<button class="singe ${choisi ? 'choisi' : ''}" data-singe="${e.id}"><img src="singes/${e.id}-portrait.png?v=15" alt=""><b>${e.nom}</b><small>${e.mot}</small><ul>${pts}</ul><p>${e.trait}</p><span class="etat">${choisi ? 'choisi' : 'choisir'}</span></button>`;
  }).join('');
  $('singes').classList.add('on');
}
$('gListe').addEventListener('click', (e) => { const b = e.target.closest('[data-singe]'); if (!b) return; profil.singe = b.dataset.singe; garder(); choisirSinge(profil.singe); accueil(); });
function ouvrirSkins() {
  $('sListe').innerHTML = SKINS.map((s) => {
    const ok = possede(s), choisi = profil.skin === s.id;
    return `<button class="skin ${ok ? '' : 'non'} ${choisi ? 'choisi' : ''}" data-skin="${s.id}"><i style="background:${s.ink};box-shadow:0 0 0 2px ${s.rim}${s.trail ? ', 0 0 18px rgba(' + s.trail + ',.8)' : ''}"></i><b>${s.nom}</b><span>${choisi ? 'porté' : ok ? 'choisir' : 'à ' + s.seuil}</span></button>`;
  }).join('');
  $('skins').classList.add('on');
}
$('sListe').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (!b) return; const s = skinById(b.dataset.skin); if (!possede(s)) return; profil.skin = s.id; garder(); ouvrirSkins(); });

// ---------- Le singe ----------
// Son corps est dans singe.js. Ici on lui dit seulement ce qui l'entoure : la liane qu'il tient, celle qui vient, une feuille sous lui.
function autour(m, tenue) {
  const sw = m.mode === 'swing', e = { ancre: null, reste: 0, devant: 99, attend: !!m.idle, tremplin: false, tend: m.hold !== false };
  if (sw) { e.ancre = tenue ? [tenue.x, tenue.y] : [m.ax, m.ay]; e.reste = tenue ? tenue.L - m.R : 0; return e; }
  const mini = m.last === undefined ? 1 : -0.9;            // le fantôme ne dit pas quelle liane il vient de lâcher : on ne regarde que devant lui
  for (const li of jeu.lianas) { const dx = li.x - m.x; if (dx < mini || (li === m.last && m.air < CFG.repos)) continue; e.devant = dx; break; }
  if (m.vy < 0 && m.y < 7) for (const li of jeu.lianas) if (li.tr && Math.abs(m.x - li.tr.x) < li.tr.w / 2 + 1.2) { e.tremplin = true; break; }
  return e;
}
const drawMonkey = (p, col) => dessinerSinge(ctx, p, col, X, Y, S);
// Le singe peint (pièces faites avec Higgsfield, posées sur le même squelette). ?singe=code garde la silhouette dessinée par le code.
// ?singe=gibbon force une espèce pour un essai.
let esp = espece(profil.singe), peau = null; const peaux = {}, sansPeau = params.get('singe') === 'code';
function choisirSinge(id) { esp = espece(id); peau = sansPeau ? null : (peaux[esp.id] = peaux[esp.id] || chargerPeau(esp.id, esp.allure)); }
choisirSinge(params.get('singe') && !sansPeau ? params.get('singe') : profil.singe);

// La branche du départ : le singe y attend, la liane en main, avant de se laisser partir.
function drawPerche() {
  const x1 = X(perche.x + 0.85); if (x1 < -S) return;
  const x0 = X(perche.x - 26), y = Y(perche.y - 0.2), lis = Math.max(1.5, S * 0.035);
  ctx.lineCap = 'round';
  for (const [col, d] of [[PAL.rim, -lis], [PAL.ink, 0]]) {
    ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = S * 0.4; ctx.beginPath(); ctx.moveTo(x0, y + S * 0.5 + d); ctx.quadraticCurveTo((x0 + x1) / 2, y - S * 0.1 + d, x1, y + d); ctx.stroke();
    ctx.lineWidth = S * 0.14; ctx.beginPath(); ctx.moveTo(X(perche.x - 1.6), y + d); ctx.quadraticCurveTo(X(perche.x - 0.6), y - S * 0.7 + d, X(perche.x + 0.2), y - S * 1.5 + d); ctx.stroke();    // un rameau
  }
  ctx.fillStyle = PAL.ink; ctx.beginPath();
  for (const [dx, dy, a] of [[0.2, 1.5, -0.6], [-0.15, 1.15, 0.7], [-0.5, 0.75, -0.9], [0.9, -0.05, 0.5], [-3.2, 0.05, -0.4]]) { const lx = X(perche.x + dx), ly = y - dy * S, sz = S * 0.22; ctx.moveTo(lx, ly); ctx.ellipse(lx + Math.cos(a) * sz, ly + Math.sin(a) * sz, sz, sz * 0.42, a, 0, TAU); }
  ctx.fill();
}

// ---------- Les lianes ----------
function drawLianas(pose) {
  const al = ALLURE[monde.id] || ALLURE.canopee, lis = Math.max(1.5, S * 0.035);
  ctx.strokeStyle = ctx.fillStyle = PAL.ink; ctx.lineCap = 'round';
  for (const li of jeu.lianas) {
    const ax = X(li.x); if (ax < -S * 12 || ax > W + S * 12) continue;
    const ay = Y(li.y), tenue = M.mode === 'swing' && li === M.li; let ex, ey, cx, cy; const r = rnd(li.seed);
    if (tenue) {              // tendue jusqu'aux mains, le reste pend et traîne
      const hx = X(pose.px), hy = Y(pose.py), rem = Math.max(0, li.L - M.R);      // la liane va jusqu'aux mains du singe
      li.ta = pose.bas;                                   // le bout libre pend sous les mains, en retard : c'est le corps du singe qui en tient le compte
      ex = hx + Math.sin(li.ta) * rem * S; ey = hy + Math.cos(li.ta) * rem * S;
      const pli = Math.exp(-pose.saisi * 15) * 0.9;        // juste après la saisie, la liane pendait encore droit : elle se tend en un instant, sous le poids
      ctx.lineWidth = S * al.ep; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + hx) / 2 + (ax - hx) / 2 * pli, (ay + hy) / 2, hx, hy); ctx.quadraticCurveTo(hx + Math.sin(li.ta) * rem * S * 0.5, hy + Math.cos(li.ta) * rem * S * 0.5, ex, ey); ctx.stroke();
      cx = (ax + hx) / 2; cy = (ay + hy) / 2;
    } else {                  // libre : elle se balance et se courbe selon son élan
      li.ta = undefined;
      ex = ax + Math.sin(li.a) * li.L * S; ey = ay + Math.cos(li.a) * li.L * S;
      cx = (ax + ex) / 2 - Math.cos(li.a) * li.av * li.L * S * 0.07; cy = (ay + ey) / 2;
      if (li.dur) { ctx.strokeStyle = PAL.rim; ctx.lineWidth = S * al.ep; ctx.beginPath(); ctx.moveTo(ax + lis, ay - lis); ctx.quadraticCurveTo(cx + lis, cy - lis, ex + lis, ey - lis); ctx.stroke(); ctx.strokeStyle = PAL.ink; }   // un liseré de lumière la détache du fond
      ctx.lineWidth = S * al.ep; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
    }
    ctx.beginPath();          // quelques feuilles le long de la liane
    for (let i = 0; i < al.feuilles; i++) {
      const tt = 0.2 + 0.72 * (i + r()) / al.feuilles, side = i % 2 ? 1 : -1, lx = (1 - tt) * (1 - tt) * ax + 2 * (1 - tt) * tt * cx + tt * tt * ex, ly = (1 - tt) * (1 - tt) * ay + 2 * (1 - tt) * tt * cy + tt * tt * ey;
      const sz = S * (0.16 + r() * 0.1), an = (tenue ? M.th : li.a) * -1 + side * (0.9 + r() * 0.4) + Math.PI / 2;
      ctx.moveTo(lx, ly); ctx.ellipse(lx + Math.cos(an) * sz, ly + Math.sin(an) * sz, sz, sz * 0.42, an, 0, TAU);
    }
    ctx.fill();
    if (li.dur) {             // une liane de passage dur porte des fleurs claires : on la reconnaît de loin
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9;
      for (let i = 0; i < 4; i++) { const tt = 0.3 + 0.7 * i / 3, fx = (1 - tt) * (1 - tt) * ax + 2 * (1 - tt) * tt * cx + tt * tt * ex, fy = (1 - tt) * (1 - tt) * ay + 2 * (1 - tt) * tt * cy + tt * tt * ey, fs = S * (0.26 + 0.08 * (i % 2)); ctx.drawImage(D.dot, fx - fs, fy - fs, fs * 2, fs * 2); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = PAL.ink;
    }
  }
}
// Les tremplins (à l'essai) : une grande feuille sur sa tige, qui s'enfonce puis renvoie le singe.
function drawTremplins(dt) {
  const lis = Math.max(1.5, S * 0.035);
  for (const li of jeu.lianas) {
    const tr = li.tr; if (!tr) continue; const x = X(tr.x); if (x < -S * 4 || x > W + S * 4) continue;
    tr.ecrase = Math.max(0, (tr.ecrase || 0) - dt * 3.5);
    const y = Y(tr.y) + tr.ecrase * S * 0.4, w = tr.w * S / 2, h = S * (0.36 - 0.12 * tr.ecrase);
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = S * 0.17; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - S * 0.6, y + S * 1.3, x + S * 0.2, Y(-1.6)); ctx.stroke();
    ctx.fillStyle = PAL.rim; ctx.beginPath(); ctx.ellipse(x, y - lis * 1.5, w, h, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.drawImage(D.dot, x - w * 1.1, y - h * 3.2, w * 2.2, h * 5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
}
// L'arc doré : la portion du balancement où il faut lâcher. Il s'éclaire quand les mains y passent.
function drawArc() {
  if (M.mode !== 'swing' || !M.arc || M.mort || M.idle) { arcVu = null; return; }
  if (M.arc !== arcVu) { arcVu = M.arc; arcT = time; }
  const a = M.arc, k = clamp((time - arcT) / 0.14, 0, 1), dedans = M.om > 0 && M.th >= a[0] && M.th <= a[1], ax = X(M.li.x), ay = Y(M.li.y), r = M.R * S;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255,190,90,${(dedans ? 0.3 : 0.16) * k})`; ctx.lineWidth = S * 0.6; ctx.beginPath(); ctx.arc(ax, ay, r, Math.PI / 2 - a[1], Math.PI / 2 - a[0]); ctx.stroke();
  ctx.strokeStyle = `rgba(255,232,170,${(dedans ? 1 : 0.72) * k})`; ctx.lineWidth = S * 0.16; ctx.beginPath(); ctx.arc(ax, ay, r, Math.PI / 2 - a[1], Math.PI / 2 - a[0]); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- La vie autour : lucioles, feuilles arrachées, oiseaux au loin, feuilles floues tout près ----------
const flies = []; { const r = rnd(31); for (let i = 0; i < 46; i++) flies.push({ x: r() * 60, y: 0.5 + r() * 11.5, par: 0.35 + r() * 0.9, ph: r() * TAU, sp: 0.4 + r() * 0.8, s: 0.5 + r() * 0.9 }); }
const bits = [];
function burst(x, y, n, up) { for (let i = 0; i < n; i++) bits.push({ x: x + (Math.random() - 0.5) * 1.6, y, vx: M.vx * 0.35 + (Math.random() - 0.5) * 5, vy: up * (0.4 + Math.random() * 0.9), a: Math.random() * TAU, av: (Math.random() - 0.5) * 9, life: 1.1 + Math.random() * 0.7, s: 0.1 + Math.random() * 0.12 }); }
const birds = { x: -999, y: 0, t: 6 };
const nears = [0, 1, 2].map((k) => ({ k, x: -999, top: false, s: 1, rot: 0 }));
// Un faisceau de lumière vertical : il marque l'endroit où le rival s'est arrêté.
function faisceau(x, a, w) {
  const sx = X(x); if (sx < -S * 3 || sx > W + S * 3) return false;
  const g = ctx.createLinearGradient(sx - w * S, 0, sx + w * S, 0); g.addColorStop(0, `rgba(${PAL.glow},0)`); g.addColorStop(0.5, `rgba(${PAL.glow},${a})`); g.addColorStop(1, `rgba(${PAL.glow},0)`);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(sx - w * S, 0, w * S * 2, H); ctx.globalCompositeOperation = 'source-over';
  return true;
}

function frame() {
  requestAnimationFrame(frame);
  const tn = performance.now() / 1000, brut = tn - last, real = Math.min(0.05, brut); last = tn; time += real;
  const paused = window.LIANE.pause;
  // Le mouvement avance du temps réellement écoulé, découpé en pas courts : l'image suit le doigt sans à-coup.
  if (!paused) {
    const n = Math.max(1, Math.ceil(real * 120 - 1e-6)), h = real / n;
    for (let i = 0; i < n && !M.mort; i++) {
      if (phase !== 'course' || auto) pilote(jeu, pil);            // hors course, le singe joue tout seul
      jeu.step(h);
      if (appuiFrais) { appuiFrais = false; if (aLever) { aLever = false; jeu.setHold(false); } }
      if (phase === 'course' && !M.idle && !M.mort) t += h;
      if (window.LIANE.stop && window.LIANE.stop(M)) { window.LIANE.pause = true; break; }
    }
  }
  for (const e of jeu.events) {
    if (e.type === 'saisie') { burst(e.x, e.y + 1.5, 2, -1); if (aide < 9 && phase === 'course') { if (M.saisies >= 3) { aide = 9; taire(); } else dire('lâche dans l\'arc doré'); } }
    else if (e.type === 'lacher') { if (e.parfait) rings.push({ x: e.x, y: e.y, t: 0 }); if (aide < 9 && phase === 'course') dire('tiens pour attraper la liane'); }
    else if (e.type === 'rebond') { e.tr.ecrase = 1; burst(e.x, e.y + 0.4, 6, 5); B.squash = 1; }
    else if (e.type === 'mort') { if (e.cause === 'chute') burst(e.x, 0.5, 14, 6); taire(); }
  }
  jeu.events.length = 0;
  const dt = paused ? 0 : real, skin = skinById(profil.skin);
  if (M.mort && !mortT) mortT = time;
  if (mortT && phase === 'course' && time - mortT > 0.7) finir();
  if (mortT && phase === 'accueil' && time - mortT > 1.2) scene((Math.random() * 1e9) | 0, false);
  if (phase === 'course') {
    // Le premier geste engage le duel : la mise est notée tout de suite. Quitter ou recharger la page en cours de duel compte comme une défaite.
    if (!parti && !M.idle) { parti = true; $('hLui').textContent = rival.nom + ' · ' + Math.round(G.dist) + ' m'; if (classe) { profil.enCours = { rival: rival.id, elo: rival.elo }; garder(); } }
    const d = Math.max(0, Math.round(M.x)); if (d !== distVue) { distVue = d; $('chrono').textContent = d + ' m'; }
    majCrans(M.chaine);
    if (!depasse && Math.round(M.x) > Math.round(G.dist)) { depasse = true; $('ecart').textContent = rival.nom + ' dépassé'; $('ecart').className = 'maj on avance'; ecartT = time; }
    if (ecartT > 0 && time - ecartT > 2.4) { $('ecart').className = 'maj'; ecartT = -9; }
    const dn = M.x - jeu.nuit.x, txt = !M.idle && dn < 22 ? 'la nuit · ' + Math.max(0, Math.round(dn)) + ' m' : '';
    if (txt !== nuitVue) { nuitVue = txt; if (txt) $('nuit').textContent = txt; $('nuit').classList.toggle('on', !!txt); }
  }
  if (auto) { if (phase === 'accueil' && time > 2) lancer(false); else if (phase === 'fin' && !window.LIANE.attente) { window.LIANE.attente = setTimeout(() => { window.LIANE.attente = 0; if (phase === 'fin') lancer(false); }, 2500); } }
  // Si l'appareil peine, on baisse la finesse de l'image plutôt que la fluidité. Jamais pendant une course.
  if (brut < 0.25) fluide += (brut - fluide) * 0.05;
  if (phase !== 'course' && !params.get('net') && time - mesureT > 3 && fluide > 0.022 && dpr > 1 && qualite > 0.75) { qualite = Math.max(0.75, qualite - 0.25); mesureT = time; fluide = 0.016; resize(); }

  // La caméra devance le singe d'autant plus qu'il va vite, et suit à peine sa hauteur. À l'accueil, elle le décale à droite du titre.
  vue += ((phase === 'accueil' && !portrait ? 0.66 : ancre) - vue) * Math.min(1, real * 3);
  camLead += (clamp(M.vx * 0.16, 0.5, portrait ? 1.6 : 2.6) - camLead) * Math.min(1, dt * 1.6);   // elle le devance à peine : juste de quoi compenser son retard, pour qu'il reste au milieu
  camX += (M.x + camLead - camX) * Math.min(1, dt * 7);
  camDy += ((Math.max(M.y, 0) - 6) * S * 0.3 - camDy) * Math.min(1, dt * 2.5);

  // Le ciel, puis les plans de forêt avec leurs nappes de brume, puis les rayons.
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(D.sky, 0, 0);
  const mist = (yw, h, a) => { const y = baseY - yw * S + camDy * 0.3, g = ctx.createLinearGradient(0, y - h * S, 0, y + h * S * 0.6); g.addColorStop(0, `rgba(${PAL.mist},0)`); g.addColorStop(0.6, `rgba(${PAL.mist},${a})`); g.addColorStop(1, `rgba(${PAL.mist},0)`); ctx.fillStyle = g; ctx.fillRect(0, y - h * S, W, h * S * 1.6); };
  for (let i = 0; i < 4; i++) {
    const Ly = D.layers[i];
    if (i === 3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 + 0.2 * Math.sin(time * 0.23); ctx.drawImage(D.rays, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    drawTile(ctx, Ly.c, D.TW, camX * S * Ly.par, camDy * Ly.par, W);
    mist([3.2, 2.5, 1.7, 0.9][i], [2.2, 2, 2.2, 2.6][i], [0.3, 0.3, 0.26, 0.2][i] * (0.9 + 0.1 * Math.sin(time * 0.31 + i)));
    if (i === 1) {            // un vol d'oiseaux, très loin, de temps en temps
      birds.t -= dt; if (birds.t < 0 && birds.x < -60) { birds.x = W / S + 4; birds.y = 7 + Math.random() * 3.5; birds.t = 16 + Math.random() * 18; }
      if (birds.x > -60) { birds.x -= dt * 2.2; ctx.strokeStyle = PAL.layers[2].top; ctx.lineWidth = Math.max(1, S * 0.035); ctx.lineCap = 'round'; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const bx = (birds.x + k * 0.55 + (k % 2) * 0.3) * S, by = baseY - (birds.y + (k % 3) * 0.3 - k * 0.08) * S, fl = Math.sin(time * 7 + k * 1.3) * S * 0.09, w = S * 0.16; ctx.moveTo(bx - w, by - fl); ctx.quadraticCurveTo(bx - w * 0.4, by - S * 0.05, bx, by); ctx.quadraticCurveTo(bx + w * 0.4, by - S * 0.05, bx + w, by - fl); }
        ctx.stroke(); }
    }
  }
  // Les lucioles : elles s'allument et s'éteignent lentement.
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flies) {
    const span = W / S + 8, fx = ((((f.x + Math.sin(time * 0.3 * f.sp + f.ph) * 0.8 - camX * f.par) % span) + span) % span - 4) * S, fy = baseY - (f.y + Math.sin(time * 0.5 * f.sp + f.ph * 2) * 0.5) * S + camDy * f.par;
    const a = Math.max(0, Math.sin(time * 0.6 * f.sp + f.ph)) ** 2; if (a < 0.02) continue;
    const sz = S * 0.34 * f.s * (0.6 + f.par * 0.5); ctx.globalAlpha = a * 0.85; ctx.drawImage(D.dot, fx - sz, fy - sz, sz * 2, sz * 2);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // Le repère du rival : un faisceau à l'endroit où il s'est arrêté. Le dépasser, c'est gagner.
  if (phase !== 'accueil' && G && (parti || phase === 'fin') && faisceau(G.dist, 0.34, 1.1)) {
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff6dc'; ctx.font = `300 ${Math.round(11 * dpr)}px Jost, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(rival.nom.toUpperCase() + '  ·  ' + Math.round(G.dist) + ' M', X(G.dist), Y(9.8)); ctx.globalAlpha = 1;
  }

  // Le plan du jeu : le feuillage du haut, les lianes, le fantôme du rival, l'arc doré, le singe, la cime du bas.
  drawTile(ctx, D.top.c, D.TW, camX * S, D.top.y + camDy, W);
  if (D.top.y + camDy > -S * 2) { ctx.fillStyle = PAL.play.bot; ctx.fillRect(0, 0, W, Math.ceil(D.top.y + camDy + S * 2)); }      // au-dessus : l'épaisseur du feuillage
  drawTremplins(dt);
  const pose = poseSinge(M, B, dt, autour(M, M.mode === 'swing' ? M.li : null));
  if (phase !== 'accueil') drawPerche();
  drawLianas(pose);
  if (phase !== 'accueil' && G) {                        // le fantôme : il porte le skin de son joueur
    etat(G, t, Mg);
    if (!Mg.fini) {
      const gs = skinById(rival.skin), gp = poseSinge(Mg, Bg, dt, autour(Mg, null));
      ctx.globalAlpha = 0.42;
      if (Mg.mode === 'swing') { ctx.strokeStyle = PAL.ink; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.moveTo(X(Mg.ax), Y(Mg.ay)); ctx.lineTo(X(Mg.x), Y(Mg.y)); ctx.stroke(); }
      if (gs.trail) { ctx.save(); ctx.translate(Math.max(1.5, S * 0.03), -Math.max(1.5, S * 0.03)); drawMonkey(gp, gs.rim); ctx.restore(); }
      drawMonkey(gp, gs.ink);
      if (Math.abs(Mg.x - M.x) > 2.5) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff6dc'; ctx.font = `300 ${Math.round(11 * dpr)}px Jost, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(rival.nom, X(Mg.x), Y(Mg.y) - S * 0.6); }
      ctx.globalAlpha = 1;
    }
  }
  drawArc();
  // Le singe du joueur : sa traînée (celle de son skin, ou l'or de l'élan), un liseré de lumière, puis la silhouette.
  const o = Math.max(1.5, S * 0.03), tc = skin.trail || (M.chaine > 0 ? OR : null);
  if (tc) {
    const long = 2 * (22 + 9 * M.chaine), fort = skin.trail ? 0.4 + 0.15 * M.chaine : 0.2 + 0.2 * M.chaine;
    trail.push(pose.hx, pose.hy); while (trail.length > long) trail.splice(0, 2);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 2; i < trail.length; i += 2) { const k = i / trail.length; ctx.strokeStyle = `rgba(${tc},${fort * k * k})`; ctx.lineWidth = S * 0.26 * k; ctx.beginPath(); ctx.moveTo(X(trail[i - 2]), Y(trail[i - 1])); ctx.lineTo(X(trail[i]), Y(trail[i + 1])); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  } else if (trail.length) trail.splice(0, 4);
  if (peau && peau.pret) dessinerPeau(ctx, pose, peau, X, Y, S);
  else { ctx.save(); ctx.translate(o, -o); drawMonkey(pose, skin.rim); ctx.restore(); drawMonkey(pose, skin.ink); }
  // Un lâcher dans l'arc doré : un anneau de lumière s'ouvre, une seule fois.
  if (rings.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / 0.5; if (k >= 1) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255,232,170,${0.9 * (1 - k) * (1 - k)})`; ctx.lineWidth = Math.max(1, S * 0.09 * (1 - k)); ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), S * (0.5 + 2.6 * k), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = PAL.ink;
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i]; b.life -= dt; if (b.life <= 0) { bits.splice(i, 1); continue; }
    b.vy -= 9 * dt; b.vx *= 1 - 1.2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.av * dt;
    ctx.globalAlpha = Math.min(1, b.life * 2); ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.y), S * b.s, S * b.s * 0.45, b.a, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawTile(ctx, D.floor.c, D.TW, camX * S, D.floor.y + camDy, W);
  ctx.fillStyle = PAL.play.bot; ctx.fillRect(0, D.floor.y + D.floor.h + camDy - 1, W, H);

  // La nuit : un voile sombre qui avance depuis la gauche. Quand il touche le singe, c'est fini.
  if (jeu.nuit.on) {
    const nx = X(jeu.nuit.x + (M.mort === 'nuit' ? (time - mortT) * 16 : 0)), w = 15 * S;
    if (nx + w > 0) {
      if (nx > 0) { ctx.fillStyle = '#020a14'; ctx.fillRect(0, 0, nx + 1, H); }
      const x0 = Math.max(0, nx), g = ctx.createLinearGradient(nx, 0, nx + w, 0); g.addColorStop(0, 'rgba(2,10,20,1)'); g.addColorStop(0.25, 'rgba(3,12,32,0.86)'); g.addColorStop(0.6, 'rgba(6,18,48,0.45)'); g.addColorStop(1, 'rgba(8,22,56,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, 0, nx + w - x0, H);
    }
  }

  // Tout près de l'objectif, de grandes feuilles floues passent vite : c'est elles qui donnent la vitesse.
  for (const n of nears) {
    const sx = (n.x - camX) * S * 2.1 + W * vue;
    if (sx < -S * 9 || sx > W * 3) { n.x = camX + (W * 0.9 / S + 6 + Math.random() * 16) / 2.1; n.top = Math.random() < 0.45; n.s = S * (3.6 + Math.random() * 2.4); n.rot = (Math.random() - 0.5) * 0.7; continue; }
    ctx.save(); ctx.translate(sx, n.top ? -n.s * 0.3 : H + n.s * 0.3); ctx.rotate(n.rot + (n.top ? Math.PI : 0)); ctx.globalAlpha = 0.92; ctx.drawImage(D.near[n.k], -n.s / 2, -n.s, n.s, n.s); ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(D.vig, 0, 0, W, H);

  // En course : une ligne fine en haut de l'écran, de ton départ jusqu'au repère du rival.
  if (phase === 'course') {
    const x0 = W * 0.3, x1 = W * 0.7, y = Math.round(9 * dpr), fin = Math.max(60, G.dist), p = (v) => x0 + (x1 - x0) * clamp(v / fin, 0, 1);
    ctx.strokeStyle = 'rgba(255,246,220,0.35)'; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x1, y - 4 * dpr); ctx.lineTo(x1, y + 4 * dpr); ctx.stroke();
    if (!Mg.fini) { ctx.strokeStyle = 'rgba(255,246,220,0.85)'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(p(Mg.x || 0), y, 3.5 * dpr, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = skin.trail ? `rgb(${skin.trail})` : '#fff6dc'; ctx.beginPath(); ctx.arc(p(M.x), y, 3.5 * dpr, 0, TAU); ctx.fill();
  }
}

addEventListener('resize', resize); resize();
$('version').textContent = VERSION;
window.LIANE = { get jeu() { return jeu; }, get M() { return M; }, get phase() { return phase; }, get t() { return t; }, get rival() { return rival; }, get G() { return G; }, get image() { return { dpr, qualite, fluide }; }, get cadre() { return { x: X(M.x) / W, y: Y(M.y) / H, large: W / S, portrait }; }, profil, CFG, lancer, accueil, hold, pause: false, stop: null, attente: 0 };   // pour les mises au point
journal('page ouverte');
// Un duel classé était engagé quand la page a été quittée ou rechargée : il compte comme une défaite.
let abandon = 0;
if (profil.enCours && Number.isFinite(profil.enCours.elo)) { abandon = gain(profil, profil.enCours.elo, false); profil.elo = Math.max(100, profil.elo + abandon); profil.d++; journal('duel quitté en cours : défaite comptée (' + abandon + ')'); }
profil.enCours = null; garder();
if (params.get('journal')) { let j = []; try { j = JSON.parse(localStorage.getItem('liane-journal') || '[]'); } catch (e) { /* rien */ }
  const pre = document.createElement('pre'); pre.setAttribute('data-ui', ''); pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:12px;overflow:auto;background:rgba(2,12,16,.94);color:#fff6dc;font:12px/1.5 monospace;z-index:9;touch-action:pan-y;-webkit-user-select:text;user-select:text';
  pre.textContent = 'Journal de LIANE ' + VERSION + ' (les plus récents en bas)\n\n' + j.map(([t, q]) => new Date(t).toLocaleTimeString('fr-FR') + '  ' + q).join('\n'); document.body.appendChild(pre); }
accueil();
if (abandon) { dire('duel quitté en cours : −' + Math.abs(abandon) + ' au classement'); setTimeout(() => { if (phase === 'accueil') taire(); }, 5000); }
$('chargement').classList.add('vu');
frame();
