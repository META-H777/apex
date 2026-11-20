// LIANE — le jeu : un duel de distance contre le fantôme d'un rival, ou en direct contre un ami, un classement Elo, des tenues.
// Tenir pour saisir la liane, lâcher pour s'élancer. On tombe, c'est fini. La nuit rattrape ceux qui traînent.
// Les règles du mouvement sont dans jeu.js, le décor dans decor.js, les rivaux dans rivaux.js, les dessins de l'interface dans ui.js.
import { Jeu, CFG, MONDES, rnd, pilote } from './jeu.js?v=27';
import { buildDecor, drawTile, PAL, setPalette } from './decor.js?v=27';
import { corps, poseSinge, dessinerSinge, morpho } from './singe.js?v=27';
import { ESPECES, COMPETENCES, espece, RARETES, PACKS, cleTenue, euros } from './especes.js?v=27';
import { chargerPeau, dessinerPeau } from './peau.js?v=27';
import { PARCOURS, SKINS, skinById, rang, fantome, etat, profil, garder, gain, elo, bouger, acquerir, possede, adversaire, classement, RANGS } from './rivaux.js?v=27';
import { embleme, ICONE, DEFS, compter } from './ui.js?v=27';
import { liaison, nouveauCode, nettoyerCode } from './reseau.js?v=27';
import { creerScene, jouerScene, TEMPS } from './fin.js?v=27';

const VERSION = 'v0.15';
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
let gel = false, unTour = false;       // un panneau couvre le jeu : l'image de la forêt est figée derrière lui (unTour : la redessiner une fois)
function resize() {
  dpr = Math.max(1, Math.min(devicePixelRatio || 1, 2) * qualite);
  W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
  portrait = H > W * 1.1;
  // Le singe est tenu au milieu de l'écran, et l'on voit toujours la liane qui vient.
  // Téléphone debout : on recule (22 m de large), et le jeu occupe une bande au milieu, entre le feuillage du haut et les cimes du bas.
  if (portrait) { S = Math.min(W / 22, H / 24); baseY = Math.round(H * 0.5 + 6.6 * S); ancre = 0.41; } else { S = H / 14; baseY = H - 0.95 * S; ancre = 0.47; }
  liberer(D); D = buildDecor(W, H, S, baseY, +(params.get('decor') || 7)); unTour = true;
  if (scn && eloFin && eloFin.dit) placerElo(cadreScene());
}
// Les images de l'ancien décor sont vidées tout de suite : sur téléphone, la mémoire des images est comptée, et la dépasser recharge la page.
function liberer(d, vu = new Set()) { if (!d || typeof d !== 'object' || vu.has(d)) return; vu.add(d); if (typeof d.getContext === 'function') { d.width = d.height = 0; return; } for (const k in d) liberer(d[k], vu); }

// ---------- L'état de la partie ----------
let jeu, M, B, pil, camX = 0, camLead = 3, camDy = 0, time = 0, last = performance.now() / 1000;
let phase = 'accueil';                 // accueil, course ou fin
let parcours = PARCOURS[0], rival = null, G = null, Bg = null, t = 0, mortT = 0, depasse = false, ecartT = -9;
let classe = false, parti = false, aLever = false, appuiFrais = false;     // duel classé ou non ; premier geste fait ; un lever de doigt en attente du prochain pas
let accueilT = -9, aide = 9, arcVu = null, arcT = 0, cransVus = -1, distVue = -1, nuitVue = '', fluide = 0.016, mesureT = 0;
let attendVu = false, lancement = false, vsPret = false, vsFin = 0, conseil = '', ongletVu = 'jouer', segVu = 'route', pisteMoi = -1, pisteLui = -1;
let scn = null, eloFin = null;         // la scène de fin de duel, et ce que les compteurs d'Elo doivent y montrer
let net = null, veilleur = 0, calqueLui = null;     // le duel en direct : la liaison avec l'autre téléphone, quand il y en a une
const Mg = {}, Ma = {}, trail = [], rings = [], perche = { x: 0, y: 0 };
let Ba = null, chargeVue = -1, pouvoirT = 0, dRaf = 0, dT = 0, dLast = 0, Bp = null;
const X = (x) => (x - camX) * S + W * vue, Y = (y) => baseY - y * S + camDy;
const hasard = () => (Math.random() * 1e9) | 0;
function scene(seed, nuit) { jeu = new Jeu(seed, nuit, monde, esp.regles); jeu.aides = true; M = jeu.M; B = corps(morpho(esp.corps)); perche.x = M.x; perche.y = M.y - B.m.PERCHE; pil = { gout: 0.9 }; camX = M.x + 3; camLead = 3; trail.length = 0; rings.length = 0; mortT = 0; arcVu = null; unTour = true; }
const dire = (txt, milieu = false) => { $('note').textContent = txt; $('note').classList.toggle('milieu', milieu); $('note').classList.remove('vu'); };   // milieu : à l'accueil, au-dessus des boutons
const taire = () => $('note').classList.add('vu');
// Le bouton du pouvoir : un anneau qui se remplit, s'allume quand le pouvoir est chargé, et disparaît une fois qu'il a servi.
function majPouvoir() {
  const c = M.sauve ? -1 : Math.round(jeu.charge * 24) / 24; if (c === chargeVue) return; chargeVue = c;
  const el = $('pouvoir'); el.style.setProperty('--c', Math.max(0, c)); el.classList.toggle('pret', c >= 1); el.classList.toggle('servi', c < 0);
}
function pouvoir(source) { if (phase !== 'course' || window.LIANE.pause || vsPret) return; if (jeu.pouvoir()) journal('pouvoir ' + esp.pouvoir.id + ' : ' + source); }
function majCrans(n) { if (n === cransVus) return; cransVus = n; const el = $('crans').children; for (let i = 0; i < el.length; i++) el[i].classList.toggle('on', i < n); }

// ---------- Le téléphone : vibrations, écran qui reste allumé, plein écran, installation ----------
const tactile = matchMedia('(pointer: coarse)').matches, ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
const installee = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
// Une vibration brève sous le doigt (les téléphones Android ; l'iPhone ne le permet pas à une page web).
const vibre = (m) => { try { if (tactile && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(m); } catch (e) { /* rien */ } };
// Pendant une course, l'écran ne se met pas en veille.
let verrou = null;
async function eveil(on) { try { if (on && 'wakeLock' in navigator && !verrou) { verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); } else if (!on && verrou) { const v = verrou; verrou = null; await v.release(); } } catch (e) { verrou = null; } }
// Sur Android, la partie passe en plein écran dès qu'on touche Jouer. Sur iPhone, le plein écran vient de l'installation sur l'écran d'accueil.
function pleinEcran() { try { const el = document.documentElement; if (tactile && !installee && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* rien */ } }
let invite = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invite = e; majInstaller(); });
function majInstaller() { $('bInstaller').hidden = installee || !tactile || !!profil.sansInstall || !(invite || ios); }

// ---------- L'accueil ----------
// La part du chemin faite vers le rang suivant, de 0 à 1. Le bronze est compté à partir de 700 : c'est là que jouent les rivaux les plus faibles.
function avance(elo) { const r = rang(elo); if (!r.suivant) return 1; const bas = r.i ? r.bas : 700; return clamp((elo - bas) / (r.suivant[0] - bas), 0.04, 1); }
const suite = (elo) => { const r = rang(elo); return r.suivant ? r.suivant[1] + ' dans ' + (r.suivant[0] - elo) + ' pts' : 'rang le plus haut'; };
const ordinal = (n) => n + (n === 1 ? 'er' : 'e');
const visage = (e) => `singes/${e.id}-portrait.png?v=27`;
function majAccueil() {
  const r = rang(profil.elo), cl = classement(), pos = cl.findIndex((c) => c.moi) + 1;
  $('aEmb').innerHTML = embleme(r.i, 46); $('aElo').textContent = profil.elo; $('aRang').textContent = r.nom; $('aBarre').style.width = avance(profil.elo) * 100 + '%'; $('aSuite').textContent = suite(profil.elo);
  $('aPos').innerHTML = pos + '<sup>' + (pos === 1 ? 'er' : 'e') + '</sup>'; $('aSur').textContent = 'sur ' + cl.length;
  const i = MONDES.indexOf(monde), rec = (profil.records || {})[monde.id];
  $('mNom').textContent = monde.essai ? 'Tremplins' : monde.nom;
  $('mInfo').textContent = monde.essai ? 'à l\'essai' : rec ? 'record ' + rec + ' m' : 'niveau ' + (i + 1) + '/' + MONDES.filter((m) => !m.essai).length;
  $('mPoints').innerHTML = MONDES.map((m, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  const tn = tenueDe(esp); $('aSingeImg').src = visage(esp); $('aSingeNom').textContent = esp.nom; $('aSingeTenue').textContent = tn.id === 'naturel' ? 'ton singe' : tn.nom;
  $('aMise').textContent = monde.essai ? 'entraînement · hors classement' : 'duel classé · ' + monde.nom;
  majInstaller();
}
function changerMonde(pas) {
  if (phase !== 'accueil' || lancement) return; accueilT = time;
  const i = (MONDES.indexOf(monde) + pas + MONDES.length) % MONDES.length; monde = MONDES[i]; profil.monde = i; garder();
  setPalette(monde.id); resize(); scene(hasard(), false); majAccueil();
}
// Les onglets : jouer (la forêt), et trois panneaux posés par-dessus. Sous un panneau, l'image de la forêt est figée : le téléphone ne dessine pas ce qu'on ne voit pas.
const PANNEAUX = ['singes', 'boutique', 'rangs'];
function onglet(nom, seg) {
  if (phase !== 'accueil' || lancement) return;
  ongletVu = nom; accueilT = time; fermerFiche(); if (seg) segVu = seg;
  if (nom === 'singes') majSinges(); else if (nom === 'boutique') majBoutique(); else if (nom === 'rangs') majRangs(); else majAccueil();
  for (const id of PANNEAUX) { $(id).classList.toggle('on', id === nom); if (id === nom) $(id).scrollTop = 0; }
  $('accueil').classList.toggle('on', nom === 'jouer');
  for (const b of $('onglets').children) b.classList.toggle('actif', b.dataset.onglet === nom);
  gel = nom !== 'jouer';
  if (nom === 'singes') { const c = $('gListe').querySelector('.choisi'); if (c) $('gListe').scrollLeft = c.offsetLeft - ($('gListe').clientWidth - c.offsetWidth) / 2; }
  if (nom === 'rangs') majSeg();
}
function accueil() {
  if (lancement) return;
  doigts.clear(); phase = 'accueil'; eveil(false); accueilT = time; finScene(); scene(hasard(), false); journal('accueil');
  $('fin').classList.remove('pret'); for (const id of ['fin', 'hud', 'duel']) $(id).classList.remove('on');
  $('onglets').classList.remove('cache'); taire(); onglet('jouer');
}

// ---------- Lancer une partie ----------
// Le bouton Jouer annonce d'abord le duel : toi, ton rival, ce que vaut la partie. Puis la forêt s'ouvre.
function defier(source) {
  if (lancement || net || (phase !== 'accueil' && phase !== 'fin')) return;
  if (auto) { lancer(false, source); return; }
  pleinEcran(); lancement = true; vsPret = false; fermerFiche();
  parcours = PARCOURS[(Math.random() * PARCOURS.length) | 0]; rival = adversaire(profil.elo, rival);
  const cl = !monde.essai, rm = rang(profil.elo), rl = rang(rival.elo), tr = skinById(rival.skin).trail;
  $('vTitre').textContent = (cl ? 'duel classé' : 'entraînement') + ' · ' + (monde.essai ? 'tremplins' : monde.nom);
  $('vMoiImg').src = visage(esp); $('vMoiEmb').innerHTML = embleme(rm.i, 22); $('vMoiElo').textContent = profil.elo; $('vMoiRang').textContent = rm.nom;
  $('vLuiAv').textContent = rival.nom[0]; $('vLuiAv').style.setProperty('--c', tr ? `rgb(${tr})` : 'rgba(255,246,220,.35)'); $('vRegle').textContent = 'même forêt pour vous deux · le plus loin gagne';
  $('vLuiNom').textContent = rival.nom; $('vLuiEmb').innerHTML = embleme(rl.i, 22); $('vLuiElo').textContent = rival.elo; $('vLuiRang').textContent = rl.nom;
  $('vMise').innerHTML = cl ? `<span class="plus">Victoire +${gain(profil, rival.elo, true)}</span><span class="moins">Défaite −${Math.abs(gain(profil, rival.elo, false))}</span>` : '<span>Hors classement : ton Elo ne bouge pas</span>';
  $('duel').classList.add('on'); $('onglets').classList.add('cache'); $('accueil').classList.remove('on'); $('fin').classList.remove('on', 'pret');
  // La course du rival se calcule pendant l'annonce : la partie démarre ensuite sans à-coup.
  setTimeout(() => { lancer(false, source, true); vsPret = true; vsFin = setTimeout(fermerVs, 1900); }, 90);
}
// En direct, l'annonce ne se passe pas d'un geste : les deux téléphones doivent partir ensemble. Elle se ferme seule, puis vient le décompte.
function fermerVs(force) { if (!vsPret || (net && force !== true)) return; clearTimeout(vsFin); vsPret = false; lancement = false; $('duel').classList.remove('on'); $('hud').classList.add('on'); if (net) decompter(3); else if (phase === 'course' && M.idle) dire(conseil); }
// Un duel classé se joue contre un nouveau rival. Rejouer le même parcours contre le même rival est un entraînement : l'Elo ne bouge pas.
// Le niveau d'essai et le pilote automatique ne comptent jamais. choisi : le rival et le parcours viennent d'être tirés par l'annonce.
function lancer(rejouer, source = 'code', choisi = false) {
  rejouer = rejouer && !!rival; journal((rejouer ? 'entraînement lancé : ' : 'duel lancé : ') + source); $('fin').classList.remove('pret'); doigts.clear(); aLever = appuiFrais = false;
  if (!rejouer && !choisi) { parcours = PARCOURS[(Math.random() * PARCOURS.length) | 0]; rival = adversaire(profil.elo, rival); }
  classe = !rejouer && !auto && !monde.essai; parti = false; gel = false; finScene(); if (!net && !sansPeau) { const h = habitDe(rival); peauDe(h.e, h.x); }      // la tenue du rival se charge pendant la course : elle servira à la scène de fin
  if (net) { G = { rival, dist: 0, temps: 0, direct: true }; Bg = corps(morpho(net.lui.e.corps)); net.etape = 'course'; } else { G = fantome(parcours, rival, monde); Bg = corps(); }
  scene(parcours, true);
  eveil(true); phase = 'course'; t = 0; depasse = !!net; ecartT = -9; distVue = -1; nuitVue = ''; pisteMoi = pisteLui = -1; majCrans(0); chargeVue = -2; pouvoirT = 0; $('pNom').textContent = esp.pouvoir.nom; majPouvoir();
  aide = profil.v + profil.d < 3 ? (net ? 1 : 0) : 9;    // les premières parties, le jeu dit quoi faire, liane après liane
  for (const id of ['accueil', 'fin', ...PANNEAUX]) $(id).classList.remove('on'); fermerFiche();
  $('onglets').classList.add('cache'); $('hud').classList.toggle('on', !choisi); $('chrono').textContent = '0'; $('ecart').className = 'bulle'; $('nuit').classList.remove('on');
  // La distance du rival ne s'affiche qu'une fois parti : on ne choisit pas ses adversaires.
  $('hMoi').textContent = classe ? 'toi · ' + profil.elo : 'entraînement'; $('hLui').textContent = rival.nom + ' · ' + rival.elo;
  conseil = aide === 0 ? 'pose le doigt et tiens' : 'tiens, puis lâche dans l\'arc doré'; if (choisi) taire(); else dire(conseil);
}
// La partie est finie : celui qui est allé le plus loin gagne.
function finir() {
  const direct = !!(net && G.direct), dist = Math.round(Math.max(0, M.x)); let croise = false;
  if (direct) {            // le premier tombé a perdu ; tombés en même temps, le plus loin gagne
    const L = net.mortLui; croise = !!L && net.issue !== 'gagne';
    if (net.issue !== 'gagne') net.issue = L && (L.cause === 'parti' || M.x > L.x) ? 'gagne' : 'perdu';
    if (L) G.dist = L.x; net.etape = 'fin'; net.finT = 0; clearTimeout(net.compte);
    if (net.issue === 'gagne' && !M.mort) { net.lien.envoyer({ k: 'fin', x: dist }); jeu.nuit.on = false; }      // le gagnant dit où il s'est arrêté, et son singe continue sa promenade
  }
  const lui = Math.round(G.dist), gagne = direct ? net.issue === 'gagne' : dist > lui, avant = profil.elo, d = classe ? gain(profil, rival.elo, gagne) : 0, rA = rang(avant);
  if (classe) { profil.elo = Math.max(100, profil.elo + d); if (gagne) { profil.v++; profil.serie = (profil.serie | 0) + 1; } else { profil.d++; profil.serie = 0; } profil.enCours = null; }
  profil.records = profil.records || {}; const rec = dist > (profil.records[monde.id] || 0); if (rec) profil.records[monde.id] = dist;
  profil.record = Math.max(profil.record || 0, dist);
  garder(); phase = 'fin'; eveil(direct); vibre(gagne ? [14, 70, 14, 70, 40] : 30); taire(); journal('fin' + (direct ? ' en direct (' + (gagne ? 'gagné' : 'perdu') + ')' : '') + ' : ' + (M.mort === 'nuit' ? 'nuit' : M.mort ? 'chute' : 'debout') + ' à ' + dist + ' m');
  const skin = acquerir().pop(), rB = rang(profil.elo); if (skin) garder();
  const tenue = classe ? ESPECES.flatMap((e) => e.tenues.filter((x) => x.elo && avant < x.elo && profil.elo >= x.elo && aTenue(e, x)).map((x) => x.nom))[0] : null;
  $('fTitre').textContent = gagne ? 'Victoire' : 'Défaite'; $('fin').classList.toggle('perdu', !gagne);
  compter($('fTemps'), 0, dist, 700);
  $('fMoi').textContent = dist + ' m'; $('fLui').textContent = lui + ' m'; $('fLuiNom').textContent = rival.nom; $('fbMoi').style.width = $('fbLui').style.width = '0%';
  const cL = direct && net.mortLui ? net.mortLui.cause : '', sort = direct && gagne ? (croise ? 'tombés ensemble, toi plus loin' : rival.nom + (cL === 'nuit' ? ' rattrapé par la nuit' : cL === 'parti' ? ' a quitté le duel' : ' est tombé')) : croise ? 'tombés ensemble, ' + rival.nom + ' plus loin' : direct && net.absent ? 'duel fini pendant ton absence' : M.mort === 'nuit' ? 'rattrapé par la nuit' : 'tombé';
  $('fCause').textContent = croise || (direct && net.absent) ? sort : sort + ' · ' + (rec ? 'nouveau record' : 'record ' + profil.records[monde.id] + ' m');
  $('fEloBloc').classList.toggle('hors', !classe);
  if (classe) {
    $('fEmb').innerHTML = embleme(rB.i, 40); $('fRang').textContent = rB.nom; $('fDelta').textContent = (d >= 0 ? '+' : '−') + Math.abs(d); $('fDelta').classList.toggle('baisse', d < 0); $('fSuite').textContent = suite(profil.elo);
    $('fBarre').style.transition = 'none'; $('fBarre').style.width = (rA.i === rB.i ? avance(avant) : rB.i > rA.i ? 0 : 1) * 100 + '%';
    compter($('fElo'), avant, profil.elo, 1000);
  } else $('fHors').textContent = monde.essai ? 'niveau d\'essai : hors classement' : auto ? 'pilote automatique : hors classement' : 'entraînement : ton Elo ne bouge pas';
  // Ce que la partie a rapporté de plus : un rang, une tenue, une traînée, une série.
  const plus = []; if (classe) { if (rB.i > rA.i) plus.push('Nouveau rang : ' + rB.nom); if (tenue) plus.push('tenue ' + tenue + ' gagnée'); if (skin) plus.push('traînée ' + skin.nom + ' gagnée'); if (!plus.length && profil.serie >= 2) plus.push(profil.serie + ' victoires de suite'); }
  $('fPlus').textContent = plus.join(' · ').replace(/^./, (c) => c.toUpperCase());
  $('fin').classList.toggle('direct', direct); $('bSuivant').disabled = false; $('bAccueil').textContent = direct ? 'Quitter' : 'Accueil';
  if (direct) majRevanche(); else { $('bSuivant').firstElementChild.textContent = 'Duel suivant'; $('bSuivant').lastElementChild.textContent = monde.essai ? 'hors classement' : 'classé · nouveau rival'; }
  $('hud').classList.remove('on'); $('fin').classList.add('on');
  const max = Math.max(dist, lui, 1);
  requestAnimationFrame(() => requestAnimationFrame(() => { $('fbMoi').style.width = dist / max * 100 + '%'; $('fbLui').style.width = lui / max * 100 + '%'; $('fBarre').style.transition = ''; $('fBarre').style.width = avance(profil.elo) * 100 + '%'; }));
  // La scène de fin : les deux singes, l'Elo de chacun au-dessus de lui. Le rival simulé perd ou gagne des points comme toi ; en direct, chacun annonce les siens.
  if (!auto) {
    const h = direct ? { e: net.lui.e, x: net.lui.x } : habitDe(rival), dLui = !classe ? 0 : direct ? elo(rival.elo, avant, !gagne) : elo(rival.elo, avant, !gagne), luiAvant = rival.elo;
    if (classe && !direct) { bouger(rival, dLui); garder(); }
    if (direct) { net.dLui = null; net.lien.envoyer({ k: 'elo', d, apres: profil.elo }); }
    scn = creerScene({ corps: esp.corps, peau, encre: skinById(profil.skin).ink }, { corps: h.e.corps, peau: sansPeau ? null : peauDe(h.e, h.x), encre: skinById(rival.skin).ink }, gagne);
    eloFin = { dit: false, avant, apres: profil.elo, d, luiAvant, dLui, direct, classe };
    $('fin').classList.add('scene'); for (const id of ['sMoi', 'sLui']) $(id).classList.remove('on');
    $('sMoiEmb').innerHTML = embleme(rA.i, 24); $('sMoiElo').textContent = avant; $('sMoiD').textContent = ''; $('sMoiSuite').textContent = '';
    $('sLuiNom').textContent = rival.nom; $('sLuiEmb').innerHTML = embleme(rang(luiAvant).i, 24); $('sLuiElo').textContent = luiAvant; $('sLuiD').textContent = '';
  } else finScene();
  // Les boutons ne répondent qu'après un instant : un doigt qui tapote encore au moment de la chute ne relance pas une partie par accident.
  setTimeout(() => { if (phase === 'fin') $('fin').classList.add('pret'); }, 700);
}

// ---------- Les commandes : un seul doigt ----------
function hold(h) {
  if (phase !== 'course' || M.mort) return;
  if (net && !net.go) return;                            // en direct, rien ne bouge avant « Partez »
  if (h && M.idle) {
    if (aide === 0) { aide = 1; dire('lâche dans l\'arc doré'); } else taire();
  }
  // Un appui plus court qu'une image n'est pas perdu : le doigt reste « posé » jusqu'au prochain pas du mouvement.
  if (h) { appuiFrais = true; aLever = false; jeu.setHold(true); } else if (appuiFrais) aLever = true; else jeu.setHold(false);
}
const ui = (e) => e.target.closest && e.target.closest('[data-ui]');
// On compte les doigts posés : le singe ne lâche que lorsque le dernier se lève. Un second doigt ne provoque plus de lâcher involontaire.
// À l'accueil, toucher la forêt ne lance rien : c'est le bouton Jouer qui lance.
const doigts = new Set();
addEventListener('pointerdown', (e) => {
  if (ui(e)) return; e.preventDefault();
  if (phase !== 'course') return;
  doigts.add(e.pointerId); hold(true);
}, { passive: false });
const leve = (e) => { doigts.delete(e.pointerId); if (!doigts.size) hold(false); };
addEventListener('pointerup', leve);
addEventListener('pointercancel', (e) => { journal('doigt annulé par le système'); leve(e); });
addEventListener('blur', () => { doigts.clear(); hold(false); });
document.addEventListener('visibilitychange', () => { journal(document.hidden ? 'page masquée' : 'page affichée'); if (!document.hidden && (phase === 'course' || net)) eveil(true); if (!document.hidden && net) net.lien.reveiller(); });
addEventListener('contextmenu', (e) => e.preventDefault());
const saisie = (e) => e.target && e.target.tagName === 'INPUT';       // on écrit dans un champ : le clavier ne commande pas le jeu
addEventListener('keydown', (e) => {
  if (saisie(e)) { if (e.code === 'Enter' || e.key === 'Enter') { e.preventDefault(); if (e.target.id === 'xCode') $('xRejoindre').click(); else e.target.blur(); } return; }
  if (e.code === 'Escape') { if (!$('direct').hidden) { quitterDirect(); fermerDirect(); } else if (!$('dAchat').hidden) { $('dAchat').hidden = true; achat = null; } else fermerFiche(); return; }
  if (e.code !== 'Space' || e.repeat) return; e.preventDefault();
  if (!$('direct').hidden) return;
  if (vsPret) fermerVs();
  else if (phase === 'accueil') { if (ongletVu === 'jouer' && time - accueilT > 0.5) defier('clavier'); }
  else if (phase === 'fin') { if ($('fin').classList.contains('pret')) { if (net) revanche(); else lancer(true, 'clavier'); } }
  else hold(true);
});
addEventListener('keyup', (e) => { if (e.code === 'Space') hold(false); });
addEventListener('keydown', (e) => { if (!saisie(e) && !e.repeat && (e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) pouvoir('clavier'); });
$('pouvoir').addEventListener('pointerdown', (e) => { e.preventDefault(); pouvoir('bouton'); });
const clic = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
const pret = () => $('fin').classList.contains('pret');
clic('iOui', () => { if (invite) { const i = invite; invite = null; i.prompt(); i.userChoice.then(() => majInstaller(), () => majInstaller()); } else $('installe').hidden = false; });
clic('iNon', () => { profil.sansInstall = true; garder(); majInstaller(); }); clic('iFermer', () => { $('installe').hidden = true; });
clic('bJouer', () => { if (time - accueilT > 0.3) defier('bouton jouer'); }); clic('duel', () => fermerVs());
clic('bSuivant', () => { if (pret()) { if (net) revanche(); else defier('bouton duel suivant'); } }); clic('bRevanche', () => { if (pret() && !net) lancer(true, 'bouton rejouer'); }); clic('bAccueil', () => { if (pret()) { quitterDirect(); accueil(); } });
clic('bDirect', () => { if (time - accueilT > 0.3) ouvrirDirect(); }); clic('xFermer', () => { quitterDirect(); fermerDirect(); });
clic('xCreer', () => { if (!net) brancher(nouveauCode(), true); });
clic('xRejoindre', () => { if (net) return; const c = nettoyerCode($('xCode').value); $('xCode').value = c; if (c.length === 4) brancher(c, false); else { $('xCode').focus(); } });
clic('xPartager', () => { if (net && navigator.share) navigator.share({ title: 'LIANE', text: 'Rejoins mon duel LIANE avec le code ' + net.code, url: location.origin + location.pathname + '?duel=' + net.code }).catch(() => {}); });
$('xCode').addEventListener('input', () => { $('xCode').value = nettoyerCode($('xCode').value); });
clic('mPrec', () => changerMonde(-1)); clic('mSuiv', () => changerMonde(1));
clic('bSinge', () => onglet('singes')); clic('bProfil', () => onglet('rangs', 'route')); clic('bPlace', () => onglet('rangs', 'monde'));
clic('onglets', (e) => { const b = e.target.closest('[data-onglet]'); if (b) onglet(b.dataset.onglet); });
clic('rSeg', (e) => { const b = e.target.closest('[data-seg]'); if (b) { segVu = b.dataset.seg; majSeg(); } });

// ---------- Le classement : ton rang, le chemin des rangs, et le tableau ----------
const rangDe = (elo) => RANGS.find((r) => r[0] === elo)?.[1] || elo;
const pastille = (c) => `<span class="rond" style="--c:${c.moi ? 'var(--or)' : skinById(c.skin).trail ? 'rgb(' + skinById(c.skin).trail + ')' : 'rgba(255,246,220,.3)'}">${c.moi ? 'T' : c.nom[0]}</span>`;
function majRangs() {
  const r = rang(profil.elo), cl = classement(), pos = cl.findIndex((c) => c.moi) + 1, n = profil.v + profil.d;
  $('rMoi').innerHTML = `<span class="emb">${embleme(r.i, 68)}</span><span class="mElo"><b>${profil.elo}</b><em>${r.nom}</em></span><span class="mSuite"><span class="barre"><i style="width:${avance(profil.elo) * 100}%"></i></span><small>${suite(profil.elo)}</small></span>
<div class="mStats"><div><b>${ordinal(pos)}</b><small>sur ${cl.length}</small></div><div><b>${n}</b><small>duels</small></div><div><b>${n ? Math.round(profil.v / n * 100) + ' %' : '–'}</b><small>victoires</small></div><div><b>${profil.record ? profil.record + ' m' : '–'}</b><small>record</small></div></div>`;
  // Ce que chaque rang donne : les traînées et les tenues qui se gagnent en montant.
  const gains = [...SKINS.filter((s) => s.seuil > 0).map((s) => ({ seuil: s.seuil, nom: 'Traînée ' + s.nom, ok: possede(s) })),
    ...ESPECES.flatMap((e) => e.tenues.filter((x) => x.elo).map((x) => ({ seuil: x.elo, nom: 'Tenue ' + x.nom, ok: aTenue(e, x) })))].sort((a, b) => a.seuil - b.seuil);
  $('rRoute').innerHTML = RANGS.map(([bas, nom], i) => {
    const haut = RANGS[i + 1] ? RANGS[i + 1][0] : Infinity, etat = i < r.i ? 'fait' : i === r.i ? 'ici' : 'loin';
    const g = gains.filter((x) => x.seuil >= bas && x.seuil < haut).map((x) => `<span class="gain ${x.ok ? 'ok' : ''}">${x.ok ? ICONE.coche : ICONE.cadenas}${x.nom} · ${x.seuil}</span>`).join('');
    return `<div class="palier ${etat}"><span class="emb">${embleme(i, 44)}</span><b>${nom}</b><span class="seuil">${i ? 'à partir de ' + bas + ' Elo' : 'le départ'}</span><span class="etat">${etat === 'fait' ? ICONE.coche + 'atteint' : etat === 'ici' ? 'tu es ici' : 'encore ' + (bas - profil.elo) + ' pts'}</span><div class="gains">${g}</div></div>`;
  }).reverse().join('');
  const marche = (c, i) => c ? `<div class="marche ${i === 0 ? 'un' : ''}"><small>${ordinal(i + 1)}</small>${pastille(c)}<b>${c.moi ? 'Toi' : c.nom}</b><strong>${c.elo}</strong></div>` : '<div></div>';
  $('cPodium').innerHTML = marche(cl[1], 1) + marche(cl[0], 0) + marche(cl[2], 2);
  $('cListe').innerHTML = cl.slice(3).map((c, i) => `<li class="${c.moi ? 'moi' : ''}"><span class="p">${i + 4}</span>${pastille(c)}<span class="n">${c.moi ? 'Toi' : c.nom}</span><span class="emb">${embleme(rang(c.elo).i, 22)}</span><span class="e">${c.elo}</span></li>`).join('');
}
function majSeg() {
  for (const b of $('rSeg').children) b.classList.toggle('actif', b.dataset.seg === segVu);
  $('rRoute').hidden = segVu !== 'route'; $('rMonde').hidden = segVu !== 'monde';
}

// ---------- Les singes : quatre espèces, chacune avec son corps, ses seize points, son geste et son pouvoir ----------
function majSinges() {
  const defile = $('gListe').scrollLeft;
  $('gListe').innerHTML = ESPECES.map((e) => {
    const choisi = esp.id === e.id, portee = tenueDe(e);
    const pts = COMPETENCES.map(([k, nom]) => `<span>${nom}</span><span class="jauge">${'<i class="p"></i>'.repeat(e.points[k])}${'<i></i>'.repeat(5 - e.points[k])}</span>`).join('');
    const tenues = e.tenues.map((x) => `<button class="puce ${x.id === portee.id ? 'portee' : ''}" data-fiche="${cleTenue(e, x)}">${aTenue(e, x) ? '' : ICONE.cadenas}${x.nom}</button>`).join('');
    return `<article class="singe ${choisi ? 'choisi' : ''}"><div class="sHaut"><img src="${visage(e)}" alt=""><div><b>${e.nom}</b><i>${e.latin}</i><em>${e.mot}</em></div></div>
<div class="stats">${pts}</div><div class="sTxt"><p class="geste">${e.geste}</p><div class="pouv">${ICONE.eclair}<div><b>${e.pouvoir.nom}</b><span>${e.pouvoir.texte}</span></div></div></div>
<div class="sTenues">${tenues}</div><button class="btn ${choisi ? 'creux' : 'plein'}" data-singe="${e.id}" ${choisi ? 'disabled' : ''}>${choisi ? 'Choisi' : 'Choisir'}</button></article>`;
  }).join('');
  $('gListe').scrollLeft = defile;
  $('sListe').innerHTML = SKINS.map((s) => {
    const ok = possede(s), choisi = profil.skin === s.id;
    return `<button class="skin ${ok ? '' : 'non'} ${choisi ? 'choisi' : ''}" data-skin="${s.id}"><i style="background:${s.ink};box-shadow:0 0 0 2px ${s.rim}${s.trail ? ', 0 0 18px rgba(' + s.trail + ',.8)' : ''}"></i><b>${s.nom}</b><span>${choisi ? 'portée' : ok ? 'choisir' : ICONE.cadenas + s.seuil + ' Elo'}</span></button>`;
  }).join('');
}
$('gListe').addEventListener('click', (e) => {
  const f = e.target.closest('[data-fiche]'); if (f) { ouvrirFiche(...trouver(f.dataset.fiche)); return; }
  const b = e.target.closest('[data-singe]'); if (!b) return; profil.singe = b.dataset.singe; garder(); choisirSinge(profil.singe); scene(hasard(), false); majSinges();
});
$('sListe').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (!b) return; const s = skinById(b.dataset.skin); if (!possede(s)) return; profil.skin = s.id; garder(); majSinges(); });

// ---------- La boutique ----------
// Le premier pack d'essai (v0.10) prêtait aussi les deux tenues de classement. Un pack ne contient plus que des tenues payantes :
// on reprend celles de classement à qui n'a pas encore le rang.
if (profil.dressing.v < 2) {
  const D = profil.dressing;
  if (D.intentions.some((i) => i.quoi === 'pack:depart')) D.possede = D.possede.filter((cle) => { const [es, te] = cle.split(':'), x = espece(es).tenues.find((y) => y.id === te); return !(x && x.elo && profil.elo < x.elo); });
  D.v = 2; garder();
}
const trouver = (cle) => { const [es, te] = cle.split(':'), e = espece(es); return [e, e.tenues.find((x) => x.id === te) || e.tenues[0]]; };
const dateFr = (d) => d.split('-').reverse().join('/');
const joursRestants = (fin) => Math.ceil((new Date(fin + 'T23:59:59') - Date.now()) / 864e5);
// Ce qui s'écrit sous une tenue : elle est à toi, elle a un prix, ou elle attend un rang.
const prixDe = (e, x) => aTenue(e, x) ? `<span class="prix ok">${ICONE.coche}${tenueDe(e).id === x.id ? 'portée' : 'à toi'}</span>` : x.elo ? `<span class="prix">${ICONE.cadenas}rang ${rangDe(x.elo)}</span>` : `<span class="prix">${euros(x.prix)}</span>`;
function majBoutique() {
  const A = ESPECES.flatMap((e) => e.tenues.filter((x) => x.elo || x.prix).map((x) => ({ e, x, cle: cleTenue(e, x) })));
  const une = A.find((a) => a.x.rarete === 'epique'), saison = A.filter((a) => a.x.rarete === 'saison'), reste = A.filter((a) => a !== une && !saison.includes(a));
  const etiquette = (a) => aTenue(a.e, a.x) ? 'à toi' : euros(a.x.prix);
  let h = '';
  if (une) { const unique = une.x.edition && une.x.edition.type === 'unique';
    h += `<button class="une" data-fiche="${une.cle}"><span class="uTxt"><em class="tag r-epique">Épique${unique ? ' · unique' : ''}</em><h4>${une.x.nom}</h4><p>${une.e.nom}.${unique ? ' Un seul exemplaire au monde.' : ''}</p><span class="prix">${etiquette(une)}</span></span><canvas data-vig="${une.cle}"></canvas></button>`; }
  for (const a of saison) { const ed = a.x.edition, j = ed && ed.fin ? joursRestants(ed.fin) : 0;
    h += `<button class="une saison" data-fiche="${a.cle}"><span class="uTxt"><em class="tag r-saison">${a.x.theme || 'Saison'}</em><h4>${a.x.nom}</h4><p>${a.e.nom}.${ed ? ` ${ed.total} exemplaires numérotés${j > 0 ? `, encore ${j} jour${j > 1 ? 's' : ''}` : ''}.` : ''}</p><span class="prix">${etiquette(a)}</span></span><canvas data-vig="${a.cle}"></canvas></button>`; }
  const pack = PACKS[0], complet = pack.tenues.length >= pack.taille, manque = pack.tenues.filter((c) => !profil.dressing.possede.includes(c)).length;
  if (!(complet && manque === 0)) h += `<button class="pack" data-pack="${pack.id}" ${complet ? '' : 'disabled'}><b>${pack.nom}</b><small>${pack.taille} tenues payantes${complet ? '' : ` · bientôt : ${pack.tenues.length} sur ${pack.taille} sont prêtes`}</small><strong>${euros(pack.prix)}</strong></button>`;
  const article = (a) => `<button class="article" data-fiche="${a.cle}"><canvas class="f-${a.x.rarete}" data-vig="${a.cle}"></canvas><em class="tag r-${a.x.rarete}">${a.x.theme || RARETES[a.x.rarete]}</em><span class="aTxt"><b>${a.x.nom}</b><small>${a.e.nom}</small>${prixDe(a.e, a.x)}</span></button>`;
  const rayon = (titre, liste) => liste.length ? `<h3>${titre}</h3><div class="grille">${liste.map(article).join('')}</div>` : '';
  h += rayon('En boutique', reste.filter((a) => a.x.prix)) + rayon('À gagner au classement', reste.filter((a) => a.x.elo));
  $('bqCorps').innerHTML = h;
  for (const c of $('bqCorps').querySelectorAll('canvas[data-vig]')) vignette(c, ...trouver(c.dataset.vig));
}
$('bqCorps').addEventListener('click', (e) => {
  const f = e.target.closest('[data-fiche]'); if (f) { ouvrirFiche(...trouver(f.dataset.fiche)); return; }
  const b = e.target.closest('[data-pack]'); if (!b || b.disabled) return; const p = PACKS.find((x) => x.id === b.dataset.pack);
  demander({ id: 'pack:' + p.id, titre: p.nom + ' · ' + p.tenues.length + ' tenues', prix: p.prix, cles: p.tenues, detail: p.tenues.map((c) => trouver(c)[1].nom).join(' · ') });
});

// La fiche d'une tenue : le singe en grand, pendu à sa liane, et ce qu'il faut pour l'avoir.
const Mp = { mode: 'swing', idle: false, depart: false, hold: true, li: null };
let fEsp = null, dVue = null, peauVue = null, achat = null; const cadreFiche = { x: null };
function ouvrirFiche(e, x) {
  fEsp = e; dVue = x; Bp = corps(morpho(e.corps)); cadreFiche.x = null; peauVue = sansPeau ? null : peauDe(e, x); majFiche();
  $('fiche').classList.add('on'); if (!dRaf) { dLast = performance.now(); dRaf = requestAnimationFrame(dessinerFiche); }
}
function fermerFiche() { $('fiche').classList.remove('on'); $('dAchat').hidden = true; achat = null; if (dRaf) { cancelAnimationFrame(dRaf); dRaf = 0; } }
const ficheOuverte = () => $('fiche').classList.contains('on');
function majFiche() {
  const e = fEsp, x = dVue, a = aTenue(e, x), portee = esp.id === e.id && tenueDe(e).id === x.id, ed = x.edition, r = x.rarete || 'naturel', n = profil.dressing.numeros[cleTenue(e, x)];
  $('dFond').className = 'fVue f-' + r; $('dRare').className = 'tag r-' + r; $('dRare').textContent = x.theme || RARETES[x.rarete] || 'De naissance';
  $('dNom').textContent = x.nom; $('dSinge').textContent = 'Tenue entière · ' + e.nom;
  $('dTexte').textContent = !x.elo && !x.prix ? 'Sa robe de naissance : elle est à toi depuis le début.'
    : x.elo ? (a ? 'Gagnée au classement : elle reste à toi, même si ton Elo redescend.' : `Elle ne s'achète pas : elle se gagne au rang ${rangDe(x.elo)} (${x.elo} Elo). Il te manque ${x.elo - profil.elo} points.`)
    : (ed && ed.type === 'unique' ? 'Exemplaire unique : un seul joueur au monde la portera.' : ed ? `Édition limitée à ${ed.total} exemplaires numérotés, jusqu'au ${dateFr(ed.fin)}.` : 'Une tenue entière pour ce singe.') + (a ? (n ? ` Tu as le n° ${n} (numéro d'essai).` : '') + ' Elle t\'est prêtée pendant l\'essai de la boutique.' : '');
  const b = $('dAction'), txt = b.firstElementChild; b.disabled = false;
  if (portee) { txt.textContent = 'Portée'; b.disabled = true; }
  else if (a) txt.textContent = esp.id === e.id ? 'Porter' : 'Porter avec ce singe';
  else if (x.elo) { txt.textContent = 'Rang ' + rangDe(x.elo) + ' requis'; b.disabled = true; }
  else if (ed && ed.fin && joursRestants(ed.fin) <= 0) { txt.textContent = 'Édition terminée'; b.disabled = true; }
  else txt.textContent = 'Acheter · ' + euros(x.prix);
}
// La boutique est en essai : rien n'est encaissé. Confirmer note l'intention d'achat (sur l'appareil) et prête la tenue.
function demander(a) { achat = a; $('aTitre').textContent = a.titre; $('aPrix').textContent = euros(a.prix); $('aDetail').textContent = a.detail || ''; $('dAchat').hidden = false; }
function rafraichir() { if (ficheOuverte()) majFiche(); if (ongletVu === 'singes') majSinges(); else if (ongletVu === 'boutique') majBoutique(); }
function confirmer() {
  if (!achat) return;
  const D = profil.dressing; D.intentions.push({ quoi: achat.id, prix: achat.prix, quand: new Date().toISOString().slice(0, 16) });
  for (const cle of achat.cles) {
    if (!D.possede.includes(cle)) D.possede.push(cle);
    const x = trouver(cle)[1];
    if (x && x.edition && x.edition.type === 'limitee' && !D.numeros[cle]) D.numeros[cle] = 1 + Math.floor(Math.random() * x.edition.total);   // numéro d'essai : le vrai viendra du serveur
  }
  garder(); journal('boutique : ' + achat.id); $('dAchat').hidden = true; achat = null; rafraichir();
}
// Le bouton de la fiche : porter la tenue (et prendre ce singe), ou l'acheter.
function agir() {
  const e = fEsp, x = dVue; if (!e) return;
  if (aTenue(e, x)) { profil.tenues[e.id] = x.id; profil.singe = e.id; garder(); choisirSinge(e.id); scene(hasard(), false); rafraichir(); return; }
  if (!x.prix) return; const ed = x.edition;
  demander({ id: cleTenue(e, x), titre: x.nom + ' · ' + e.nom, prix: x.prix, cles: [cleTenue(e, x)],
    detail: ed ? (ed.type === 'unique' ? 'Exemplaire unique : un seul joueur au monde la portera.' : `Édition limitée à ${ed.total} exemplaires numérotés, jusqu'au ${dateFr(ed.fin)}.`) : '' });
}
clic('dAction', () => agir()); clic('dFermer', () => fermerFiche()); clic('aOui', () => confirmer()); clic('aNon', () => { $('dAchat').hidden = true; achat = null; });
// Le singe pendu à une liane, dessiné dans un canevas quelconque : la fiche (qui bouge) et les vignettes de la boutique (posées une fois).
function pendu(g, w, h, Bq, pk, pas, temps, cadre, zoom = 1) {
  const m = Bq.m, long = m.ALLONGE + m.TRONC + m.CUISSE + m.JAMBE, Sp = Math.min(h / (long * 1.5), w / (long * 1.02)) * zoom, R = 3.2, th = 0.28 * Math.sin(temps * 1.5), om = 0.42 * Math.cos(temps * 1.5);
  Mp.th = th; Mp.om = om; Mp.R = R; Mp.x = R * Math.sin(th); Mp.y = R - R * Math.cos(th); Mp.vx = R * om * Math.cos(th); Mp.vy = R * om * Math.sin(th); Mp.li = { x: 0, y: R, L: R + 3 };
  const p = poseSinge(Mp, Bq, pas, { ancre: [0, R], reste: 3, devant: 99, attend: false, tend: true });
  // Le cadre suit lentement le milieu du corps : un singe qui se tient en retrait de la liane (le colobe) reste dans l'image, et le balancement se voit encore.
  const milieu = (p.sx + p.hx) / 2; cadre.x = cadre.x === null ? milieu : cadre.x + (milieu - cadre.x) * Math.min(1, pas * 1.2);
  if (!g) return;
  const Xp = (x) => w * 0.5 + (x - cadre.x) * Sp, Yp = (y) => h * (0.13 - (zoom - 1) * 0.2) - y * Sp;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(11,42,46,.95)'; g.lineWidth = Math.max(2, Sp * 0.07); g.lineCap = 'round'; g.beginPath(); g.moveTo(Xp(0), Yp(R)); g.lineTo(Xp(p.px), Yp(p.py)); g.lineTo(Xp(p.px + Math.sin(p.bas) * 3), Yp(p.py - Math.cos(p.bas) * 3)); g.stroke();
  if (pk && pk.pret) dessinerPeau(g, p, pk, Xp, Yp, Sp); else dessinerSinge(g, p, '#0b1d16', Xp, Yp, Sp);
}
const taille = (c) => { const r = c.getBoundingClientRect(), d = Math.min(3, devicePixelRatio || 1), w = Math.round(r.width * d), h = Math.round(r.height * d); if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } return [w, h]; };
function dessinerFiche(now) {
  dRaf = requestAnimationFrame(dessinerFiche);
  const c = $('dApercu'), [w, h] = taille(c); if (!w || !h || !Bp) return;
  const pas = Math.min(0.05, Math.max(0.001, (now - dLast) / 1000)); dLast = now; dT += pas;
  pendu(c.getContext('2d'), w, h, Bp, peauVue, pas, dT, cadreFiche);
}
// Une vignette attend que l'image de la tenue soit chargée, puis se dessine une seule fois (le corps est d'abord laissé pendre une seconde, pour que la queue trouve sa place).
const vignettes = []; let vRaf = 0;
function vignette(c, e, x) { vignettes.push({ c, e, pk: sansPeau ? null : peauDe(e, x), essais: 0 }); if (!vRaf) vRaf = requestAnimationFrame(poserVignettes); }
function poserVignettes() {
  vRaf = 0;
  for (let i = vignettes.length - 1; i >= 0; i--) {
    const v = vignettes[i]; if (!v.c.isConnected) { vignettes.splice(i, 1); continue; }
    const [w, h] = taille(v.c); if ((v.pk && !v.pk.pret && ++v.essais < 600) || !w || !h) continue;
    const Bq = corps(morpho(v.e.corps)), cadre = { x: null }; for (let k = 0; k < 90; k++) pendu(null, w, h, Bq, null, 1 / 60, 3.5 + k / 60, cadre);
    cadre.x = null; pendu(v.c.getContext('2d'), w, h, Bq, v.pk, 1 / 60, 5, cadre, 1.22); vignettes.splice(i, 1);
  }
  if (vignettes.length) vRaf = requestAnimationFrame(poserVignettes);
}

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
// La tenue portée par un singe (?tenue=ninja en force une pour un essai), et l'atlas de pièces qui va avec.
// Une tenue est à soi si elle est de naissance, si le classement l'a donnée (elle reste acquise ensuite), ou si elle a été prise à la boutique.
function aTenue(e, t) {
  if (!t.elo && !t.prix) return true; const cle = cleTenue(e, t), D = profil.dressing;
  if (D.possede.includes(cle)) return true;
  if (t.elo && profil.elo >= t.elo) { D.possede.push(cle); garder(); return true; }
  return false;
}
const tenueDe = (e) => { const forcee = params.get('tenue'), t = e.tenues.find((x) => x.id === (forcee || profil.tenues[e.id])); return t && (forcee || aTenue(e, t)) ? t : e.tenues[0]; };
const peauDe = (e, t) => (peaux[t.fichier] = peaux[t.fichier] || chargerPeau(t.fichier, { ...e.allure, ...(t.allure || {}) }));
function choisirSinge(id) { esp = espece(id); peau = sansPeau ? null : peauDe(esp, tenueDe(esp)); }
choisirSinge(params.get('singe') && !sansPeau ? params.get('singe') : profil.singe);

// ---------- Le duel en direct : deux téléphones, un code de partie, la même forêt, un départ ensemble ----------
// Il n'y a pas encore de serveur : les deux téléphones se parlent par des relais publics (reseau.js). Chacun joue sa partie et dit où il est dix fois par seconde.
// La règle : le premier qui tombe, ou que la nuit rattrape, a perdu, et la partie s'arrête pour les deux. Tombés au même instant, le plus loin gagne.
// L'Elo se calcule sur chaque téléphone : sans serveur, rien ne l'empêche d'être truqué. C'est un prototype.
const PROTO = 1, SILENCE = 8;                            // version des messages ; secondes sans nouvelles avant de considérer l'adversaire parti
const propre = (v) => String(v || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, 12);
const maFiche = () => ({ nom: propre(profil.pseudo), elo: profil.elo, singe: esp.id, tenue: tenueDe(esp).id, skin: profil.skin });
// Ce que l'autre téléphone dit de son joueur n'est jamais cru sur parole : tout est remis dans les bornes du jeu.
function lireFiche(p) {
  p = p && typeof p === 'object' ? p : {};
  const e = ESPECES.find((x) => x.id === p.singe) || ESPECES[0], x = e.tenues.find((y) => y.id === p.tenue) || e.tenues[0];
  return { nom: propre(p.nom) || 'Ton rival', elo: clamp(Math.round(+p.elo) || 800, 100, 4000), e, x, skin: skinById(p.skin).id };
}
function adopter(p) { const L = net.lui = lireFiche(p); net.peauLui = sansPeau ? null : peauDe(L.e, L.x); rival = { id: -1, nom: L.nom, elo: L.elo, skin: L.skin }; }
// Une petite toile à part : le singe adverse y est dessiné entier, puis posé à demi transparent sur la forêt.
function calque() { const n = Math.round(S * 9); if (!calqueLui) calqueLui = document.createElement('canvas'); if (calqueLui.width !== n) calqueLui.width = calqueLui.height = n; return calqueLui; }
function majDirect() {
  const a = !!net; $('xChoix').hidden = a; $('xAttente').hidden = !a; $('xTitre').textContent = !a ? 'Duel en direct' : net.hote ? 'Ta partie est ouverte' : 'Tu rejoins la partie';
  if (!a) return;
  $('xLegende').textContent = net.hote ? 'Donne ce code à ton adversaire' : 'Le code de sa partie'; $('xCodeVu').textContent = net.code; $('xPartager').hidden = !net.hote || !navigator.share;
  const long = performance.now() / 1000 - net.depuis > 9;
  $('xEtat').textContent = !net.lien.ouverts ? (long ? 'pas de liaison : vérifie ta connexion' : 'connexion au relais…') : net.lui ? net.lui.nom + ' arrive…' : net.hote ? 'en attente de ton adversaire…' : long ? 'aucune partie ouverte avec ce code pour l\'instant' : 'recherche de la partie…';
}
function ouvrirDirect(code) { if (phase !== 'accueil' || lancement || net) return; $('xPseudo').value = profil.pseudo || ''; $('xCode').value = code || ''; $('direct').hidden = false; majDirect(); }
function fermerDirect() { $('direct').hidden = true; $('xPseudo').blur(); $('xCode').blur(); }
function brancher(code, hote) {
  profil.pseudo = propre($('xPseudo').value); garder(); pleinEcran(); $('xPseudo').blur(); $('xCode').blur();
  net = { code, hote, etape: 'attente', lui: null, peauLui: null, luiDe: null, manche: 0, vu: performance.now() / 1000, tic: performance.now() / 1000, depuis: performance.now() / 1000, tampon: [], mortLui: null, mortDite: false, issue: null, finT: 0, go: false, compte: 0, seul: false, encoreMoi: false, encoreLui: false, envoiT: 0, distVue: -1, invitation: null, mondeAvant: monde, lien: null };
  net.lien = liaison(code, hote, recuDirect, () => { if (net && net.etape === 'attente') majDirect(); });
  clearInterval(veilleur); veilleur = setInterval(veille, 700); eveil(true); journal('duel en direct : partie ' + (hote ? 'créée' : 'rejointe')); majDirect();
}
// Toutes les 0,7 s : l'invité frappe à la porte, l'hôte redit son invitation tant qu'elle n'a pas de réponse, et chacun donne signe de vie.
function veille() {
  if (!net) { clearInterval(veilleur); return; }
  const now = performance.now() / 1000; if (now - net.tic > 3) net.vu = now; net.tic = now;      // la page dormait (téléphone verrouillé) : on ne conclut rien tout de suite
  if (net.etape === 'attente') { if (!net.hote) net.lien.envoyer({ k: 'salut', v: PROTO, p: maFiche() }); majDirect(); }
  else if (net.etape === 'invite') net.lien.envoyer(net.invitation);
  else if (!net.go || phase !== 'course') net.lien.envoyer({ k: 'ping' });
  if (net.luiDe && !net.seul && now - net.vu > SILENCE) { journal('duel en direct : plus de nouvelles de l\'adversaire'); luiParti(); }
}
// L'hôte tire la forêt et invite. L'invité répond « prêt » : les deux annonces partent alors à un souffle d'écart.
function manche() {
  net.manche++; net.encoreMoi = net.encoreLui = false; net.etape = 'invite'; parcours = hasard() || 1;
  net.invitation = { k: 'bienvenue', v: PROTO, pour: net.luiDe, m: net.manche, graine: parcours, monde: MONDES.indexOf(monde), p: maFiche() }; net.lien.envoyer(net.invitation);
  if (phase === 'fin') majRevanche(); else majDirect();
}
function recuDirect(m) {
  if (!net) return; const now = performance.now() / 1000;
  if (!net.luiDe) {                                      // personne en face pour l'instant
    if (net.hote) { if (m.k !== 'salut' || net.etape !== 'attente') return; if (m.v !== PROTO) { net.lien.envoyer({ k: 'refus', pour: m.de }); return; } net.luiDe = m.de; net.vu = now; adopter(m.p); manche(); return; }
    if (m.pour !== net.lien.de) return;
    if (m.k === 'refus') { $('xEtat').textContent = 'vos deux jeux n\'ont pas la même version : rechargez la page'; return; }
    if (m.k !== 'bienvenue' || m.v !== PROTO) return; net.luiDe = m.de;
  }
  if (m.de !== net.luiDe) return;                        // un troisième téléphone sur le même code : ignoré
  net.vu = now; if (net.seul && m.k !== 'quitte') { net.seul = false; if (net.etape === 'fin') majRevanche(); }
  if (m.k === 'e') {
    if (net.etape === 'fin' && now - (net.finiDit || 0) > 1) { net.finiDit = now; net.lien.envoyer({ k: 'fini', gagne: net.issue === 'gagne', x: Math.round(Math.max(0, M.x)) }); }      // il joue encore : sa page dormait quand le duel s'est fini
    const d = m.d; if (net.etape !== 'course' || !Array.isArray(d) || d.length !== 9 || !d.every(Number.isFinite) || !Number.isFinite(m.t)) return;
    net.tampon.push({ r: now, t: m.t, d }); if (net.tampon.length > 24) net.tampon.shift(); if (!net.mortLui) G.dist = Math.max(0, d[0]);
  } else if (m.k === 'salut') { if (net.hote && net.etape === 'invite') net.lien.envoyer(net.invitation); }
  else if (m.k === 'bienvenue') {
    if (net.hote || m.pour !== net.lien.de || m.v !== PROTO) return;
    if (m.m === net.manche) { net.lien.envoyer({ k: 'pret', m: m.m }); return; }        // déjà reçue : on redit qu'on est prêt
    if (net.etape !== 'attente' && net.etape !== 'fin') return;
    net.manche = m.m; adopter(m.p); parcours = (m.graine | 0) || 1;
    const i = clamp(m.monde | 0, 0, MONDES.length - 1); if (MONDES[i] !== monde) { monde = MONDES[i]; setPalette(monde.id); resize(); }      // on joue dans le niveau de l'hôte
    net.lien.envoyer({ k: 'pret', m: m.m }); annoncer();
  } else if (m.k === 'pret') { if (net.hote && net.etape === 'invite' && m.m === net.manche) annoncer(); }
  else if (m.k === 'mort') {
    if (net.etape !== 'course' || net.mortLui) return;
    net.mortLui = { x: Math.max(0, +m.x || 0), cause: m.cause === 'nuit' ? 'nuit' : 'chute' }; G.dist = net.mortLui.x; if (!M.mort) gagner();
  } else if (m.k === 'fin') { if (Number.isFinite(m.x) && (net.etape === 'course' || net.etape === 'fin')) { G.dist = Math.max(0, m.x); if (phase === 'fin') { $('fLui').textContent = Math.round(G.dist) + ' m'; const d = Math.round(Math.max(0, M.x)), mx = Math.max(d, G.dist, 1); $('fbMoi').style.width = d / mx * 100 + '%'; $('fbLui').style.width = G.dist / mx * 100 + '%'; } } }
  else if (m.k === 'fini') {                             // le duel s'est fini sans nous (page endormie, message perdu) : on s'aligne sur ce que dit l'autre
    if (net.etape !== 'course' || !net.go || net.issue) return;
    if (m.gagne) { net.issue = 'perdu'; net.absent = !M.mort; if (Number.isFinite(m.x)) G.dist = Math.max(0, m.x); if (!M.mort) finir(); }
    else if (!net.mortLui) { net.mortLui = { x: Math.max(0, Number.isFinite(m.x) ? m.x : G.dist), cause: 'chute' }; G.dist = net.mortLui.x; if (!M.mort) gagner(); }
  }
  else if (m.k === 'elo') { if (Number.isFinite(m.d)) { net.dLui = clamp(Math.round(m.d), -200, 200); if (eloFin && eloFin.direct && !eloFin.dit) eloFin.dLui = net.dLui; } }
  else if (m.k === 'encore') { net.encoreLui = true; if (net.etape === 'fin') { majRevanche(); if (net.hote && net.encoreMoi) manche(); } }
  else if (m.k === 'quitte') luiParti();
}
// L'annonce du duel en direct : les deux joueurs, la mise, puis la forêt s'ouvre et le décompte commence.
function annoncer() {
  fermerDirect(); fermerFiche(); lancement = true; vsPret = false;
  Object.assign(net, { etape: 'annonce', go: false, mortLui: null, mortDite: false, issue: null, absent: false, finiDit: 0, finT: 0, seul: false, encoreMoi: false, encoreLui: false, distVue: -1 }); net.tampon.length = 0; clearTimeout(net.compte);
  const cl = !monde.essai, rm = rang(profil.elo), rl = rang(rival.elo), L = net.lui, av = $('vLuiAv'), im = new Image();
  $('vTitre').textContent = 'duel en direct · ' + (monde.essai ? 'tremplins' : monde.nom);
  $('vMoiImg').src = visage(esp); $('vMoiEmb').innerHTML = embleme(rm.i, 22); $('vMoiElo').textContent = profil.elo; $('vMoiRang').textContent = rm.nom;
  av.textContent = ''; im.alt = ''; im.src = visage(L.e); av.appendChild(im); av.style.setProperty('--c', 'transparent');
  $('vLuiNom').textContent = L.nom; $('vLuiEmb').innerHTML = embleme(rl.i, 22); $('vLuiElo').textContent = rival.elo; $('vLuiRang').textContent = rl.nom;
  $('vMise').innerHTML = cl ? `<span class="plus">Victoire +${gain(profil, rival.elo, true)}</span><span class="moins">Défaite −${Math.abs(gain(profil, rival.elo, false))}</span>` : '<span>Hors classement : ton Elo ne bouge pas</span>';
  $('vRegle').textContent = 'même forêt, départ ensemble · le premier qui tombe a perdu';
  $('duel').classList.add('on'); $('onglets').classList.add('cache'); $('accueil').classList.remove('on'); $('fin').classList.remove('on', 'pret'); taire();
  setTimeout(() => { if (!net || net.etape !== 'annonce') return; lancer(false, 'en direct', true); vsPret = true; vsFin = setTimeout(() => fermerVs(true), 2300); }, 90);
}
// Trois, deux, un : au « Partez », les deux singes se laissent partir ensemble, que le doigt soit posé ou non.
function decompter(n) {
  if (!net || net.etape !== 'course' || net.go || phase !== 'course') return;
  const el = $('decompte'); el.textContent = n > 0 ? n : 'Partez'; el.classList.toggle('mot', n <= 0); el.classList.remove('bat'); void el.offsetWidth; el.classList.add('bat'); vibre(n > 0 ? 8 : 30);
  if (n > 0) { net.compte = setTimeout(() => decompter(n - 1), 750); return; }
  net.go = true; jeu.setHold(true); if (aide < 9) dire('lâche dans l\'arc doré');
}
// Pendant la course : dire où l'on est, dix fois par seconde, et dire tout de suite qu'on est tombé.
function directCourse() {
  if (!net.go) return;
  if (M.mort) { if (!net.mortDite && net.issue !== 'gagne') { net.mortDite = true; net.lien.envoyer({ k: 'mort', x: Math.round(Math.max(0, M.x) * 10) / 10, cause: M.mort }); } return; }
  if (net.issue || time - net.envoiT < 0.095) return; net.envoiT = time;
  const sw = M.mode === 'swing' && M.li;
  net.lien.envoyer({ k: 'e', t: Math.round(t * 1000) / 1000, d: [M.x, M.y, M.th, M.om, sw ? 1 : 0, sw ? M.li.x : 0, sw ? M.li.y : 0, M.vx, M.vy].map((v) => Math.round(v * 100) / 100) });
}
// Il est tombé, ou parti, et l'on tient encore : c'est gagné. La partie s'arrête un instant plus tard.
function gagner() {
  const c = net.mortLui.cause; net.issue = 'gagne'; net.finT = time + 0.7; jeu.nuit.on = false; $('nuit').classList.remove('on'); nuitVue = '';
  dire(rival.nom + (c === 'nuit' ? ' rattrapé par la nuit' : c === 'parti' ? ' a quitté le duel' : ' est tombé')); vibre([14, 70, 14]);
}
function luiParti() {
  if (!net) return; const e = net.etape;
  if (e === 'attente') return;
  if (e === 'fin') { net.seul = true; majRevanche(); return; }
  if (e === 'course' && net.go) { net.seul = true; if (!net.issue && !M.mort && !net.mortLui) { net.mortLui = { x: G.dist, cause: 'parti' }; gagner(); } return; }
  abandonnerDirect(rival.nom + ' a quitté la partie');   // pendant l'invitation, l'annonce ou le décompte : personne ne perd rien
}
function majRevanche() {
  const b = $('bSuivant'); b.firstElementChild.textContent = 'Revanche';
  b.lastElementChild.textContent = net.seul ? rival.nom + ' est parti' : net.encoreMoi ? 'en attente de ' + rival.nom + '…' : net.encoreLui ? rival.nom + ' veut sa revanche' : 'en direct · ' + rival.nom;
  b.disabled = !!(net.seul || net.encoreMoi);
}
function revanche() { if (!net || net.etape !== 'fin' || net.seul || net.encoreMoi) return; net.encoreMoi = true; net.lien.envoyer({ k: 'encore' }); majRevanche(); if (net.hote && net.encoreLui) manche(); }
// Quitter le duel en direct : on prévient l'autre, on coupe la liaison, on retrouve son niveau.
function quitterDirect() {
  if (!net) return; clearInterval(veilleur); clearTimeout(net.compte); if (net.luiDe) net.lien.envoyer({ k: 'quitte' });
  const l = net.lien, m0 = net.mondeAvant; net = null; setTimeout(() => l.fermer(), 400); eveil(false); journal('duel en direct : quitté');
  $('decompte').classList.remove('bat'); $('fin').classList.remove('direct'); $('bSuivant').disabled = false; $('bAccueil').textContent = 'Accueil'; majDirect();
  if (m0 !== monde) { monde = m0; setPalette(monde.id); resize(); }
}
function abandonnerDirect(msg) {
  clearTimeout(vsFin); vsPret = false; lancement = false; quitterDirect(); fermerDirect(); accueil();
  if (msg) { dire(msg, true); setTimeout(() => { if (phase === 'accueil') taire(); }, 4500); }
}
// Où dessiner l'adversaire : on rejoue ce qu'il a envoyé avec un léger retard (0,16 s), pour que son geste reste lisse même si un message tarde.
function etatDirect(out) {
  const T = net && net.etape === 'course' && !net.mortLui ? net.tampon : null;
  if (!T || !T.length) { out.fini = true; return out; }
  let dec = Infinity; for (const s of T) dec = Math.min(dec, s.r - s.t);
  const tt = performance.now() / 1000 - dec - 0.16; let i = T.length - 1; while (i > 0 && T[i].t > tt) i--;
  const a = T[i].d, b = T[Math.min(i + 1, T.length - 1)].d, ta = T[i].t, tb = T[Math.min(i + 1, T.length - 1)].t, k = tb > ta ? clamp((tt - ta) / (tb - ta), 0, 1) : 0, L = (j) => a[j] + (b[j] - a[j]) * k, meme = a[4] === b[4];
  out.x = L(0); out.y = L(1); out.th = meme ? L(2) : a[2]; out.om = meme ? L(3) : a[3]; out.mode = a[4] > 0.5 ? 'swing' : 'fly'; out.ax = a[5]; out.ay = a[6]; out.vx = L(7); out.vy = L(8); out.fini = false;
  return out;
}
addEventListener('pagehide', () => { if (net && net.luiDe) net.lien.envoyer({ k: 'quitte' }); });

// ---------- La scène de fin de duel (fin.js) : où elle se place à l'écran, et les compteurs d'Elo au-dessus des singes ----------
// Téléphone debout : la scène occupe le haut de l'écran, le résultat est en bas. Couché : la scène à gauche, le résultat à droite.
function cadreScene() { const w = portrait ? W : W * 0.54, h = portrait ? H * 0.6 : H, Z = Math.min(w / 6.4, h * 0.62 / 3); return { cx: portrait ? W / 2 : W * 0.27, y0: h * (portrait ? 0.4 : 0.43), Z, W, H }; }
// Un rival simulé a lui aussi son espèce et, pour un sur trois, une tenue : toujours les mêmes pour un même rival.
function habitDe(b) { const e = ESPECES[b.id % ESPECES.length], n = e.tenues.length; return { e, x: e.tenues[n > 1 && b.id % 3 === 0 ? 1 + (b.id % (n - 1)) : 0] }; }
function montrerElo(c) {
  const E = eloFin; E.dit = true; if (E.direct && net && net.dLui !== null && E.classe) E.dLui = net.dLui;
  const signe = (d) => (d >= 0 ? '+' : '−') + Math.abs(d); placerElo(c);
  $('sMoi').classList.add('on'); $('sLui').classList.add('on'); if (!E.classe) return;
  $('sMoiD').textContent = signe(E.d); $('sMoiD').classList.toggle('baisse', E.d < 0); $('sLuiD').textContent = signe(E.dLui); $('sLuiD').classList.toggle('baisse', E.dLui < 0);
  compter($('sMoiElo'), E.avant, E.apres, 1100); compter($('sLuiElo'), E.luiAvant, Math.max(100, E.luiAvant + E.dLui), 1100);
  setTimeout(() => { if (eloFin !== E) return; $('sMoiEmb').innerHTML = embleme(rang(E.apres).i, 24); $('sLuiEmb').innerHTML = embleme(rang(Math.max(100, E.luiAvant + E.dLui)).i, 24); }, 1150);
}
// Les compteurs se posent au-dessus des mains de chaque singe, assez haut pour que le geste de victoire ne passe pas dessus.
function placerElo(c) { const px = dpr; $('sMoi').style.left = (c.cx - 1.55 * c.Z) / px + 'px'; $('sLui').style.left = (c.cx + 1.55 * c.Z) / px + 'px'; $('sMoi').style.top = $('sLui').style.top = Math.max(portrait ? 62 : 44, c.y0 / px - 122) + 'px'; }
function finScene() { scn = null; eloFin = null; $('fin').classList.remove('scene'); for (const id of ['sMoi', 'sLui']) $(id).classList.remove('on'); }

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
  const al = ALLURE[monde.id] || ALLURE.canopee, lis = Math.max(1.5, S * 0.035), ep = Math.max(S * al.ep * (portrait ? 1.5 : 1.15), 2 * dpr);   // sur téléphone, une liane ne doit jamais être un fil
  // La liane à atteindre : la prochaine devant le singe. Un liseré de lumière la détache, et la partie que ses mains peuvent saisir luit doucement.
  let vise = null;
  if (phase === 'course' && !M.mort) { const x0 = M.mode === 'swing' ? M.li.x + 0.5 : M.x - CFG.portee2; for (const li of jeu.lianas) { if (li.x < x0 || (li === M.last && M.air < CFG.repos)) continue; vise = li; break; } }
  ctx.strokeStyle = ctx.fillStyle = PAL.ink; ctx.lineCap = 'round';
  for (const li of jeu.lianas) {
    const ax = X(li.x); if (ax < -S * 12 || ax > W + S * 12) continue;
    const ay = Y(li.y), tenue = M.mode === 'swing' && li === M.li; let ex, ey, cx, cy; const r = rnd(li.seed);
    if (tenue) {              // tendue jusqu'aux mains, le reste pend et traîne
      const hx = X(pose.px), hy = Y(pose.py), rem = Math.max(0, li.L - M.R);      // la liane va jusqu'aux mains du singe
      li.ta = pose.bas;                                   // le bout libre pend sous les mains, en retard : c'est le corps du singe qui en tient le compte
      ex = hx + Math.sin(li.ta) * rem * S; ey = hy + Math.cos(li.ta) * rem * S;
      const pli = Math.exp(-pose.saisi * 15) * 0.9;        // juste après la saisie, la liane pendait encore droit : elle se tend en un instant, sous le poids
      ctx.lineWidth = ep; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + hx) / 2 + (ax - hx) / 2 * pli, (ay + hy) / 2, hx, hy); ctx.quadraticCurveTo(hx + Math.sin(li.ta) * rem * S * 0.5, hy + Math.cos(li.ta) * rem * S * 0.5, ex, ey); ctx.stroke();
      cx = (ax + hx) / 2; cy = (ay + hy) / 2;
    } else {                  // libre : elle se balance et se courbe selon son élan
      li.ta = undefined;
      ex = ax + Math.sin(li.a) * li.L * S; ey = ay + Math.cos(li.a) * li.L * S;
      cx = (ax + ex) / 2 - Math.cos(li.a) * li.av * li.L * S * 0.07; cy = (ay + ey) / 2;
      if (li === vise) {      // la partie saisissable, de sous l'accroche jusqu'au bout : une lueur
        const t0 = Math.min(0.9, CFG.minR / li.L), u = 1 - t0, sx = u * u * ax + 2 * u * t0 * cx + t0 * t0 * ex, sy = u * u * ay + 2 * u * t0 * cy + t0 * t0 * ey;
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${PAL.glow},0.2)`; ctx.lineWidth = ep * 3.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx + (ex - cx) * t0, cy + (ey - cy) * t0, ex, ey); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = PAL.ink;
      }
      if (li.dur || li === vise) { ctx.strokeStyle = PAL.rim; ctx.lineWidth = ep; ctx.beginPath(); ctx.moveTo(ax + lis, ay - lis); ctx.quadraticCurveTo(cx + lis, cy - lis, ex + lis, ey - lis); ctx.stroke(); ctx.strokeStyle = PAL.ink; }   // un liseré de lumière la détache du fond
      ctx.lineWidth = ep; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
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
// La zone sûre (pâle) : tous les lâchers qui mènent à la liane suivante. L'arc doré, dedans : ceux qui donnent de l'élan. Il s'éclaire quand les mains y passent.
// Sans zone ni arc, aucun lâcher ne passe à ce balancement : il faut rester accroché, le singe reprend de l'élan.
function drawArc() {
  if (M.mode !== 'swing' || (!M.arc && !M.zone) || M.mort || M.idle) { arcVu = null; return; }
  if (!arcVu) arcT = time; arcVu = M.arc || M.zone;
  const k = clamp((time - arcT) / 0.14, 0, 1), ax = X(M.li.x), ay = Y(M.li.y), r = M.R * S, fin = Math.max(S * 0.16, 2.6 * dpr);
  ctx.lineCap = 'round';
  // La zone sûre : un trait clair bordé de sombre, pour se lire aussi bien sur le ciel que sur les feuillages.
  if (M.zone) { const z = M.zone, dans = M.om > 0 && M.th >= z[0] && M.th <= z[1], trace = () => { ctx.beginPath(); ctx.arc(ax, ay, r, Math.PI / 2 - z[1], Math.PI / 2 - z[0]); ctx.stroke(); };
    ctx.strokeStyle = `rgba(4,30,34,${0.3 * k})`; ctx.lineWidth = fin * 1.9; trace(); ctx.strokeStyle = `rgba(255,250,232,${(dans ? 0.95 : 0.7) * k})`; ctx.lineWidth = fin * 0.75; trace(); }
  ctx.globalCompositeOperation = 'lighter';
  if (M.arc) { const a = M.arc, dedans = M.om > 0 && M.th >= a[0] && M.th <= a[1];
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = `rgba(214,140,40,${0.9 * k})`; ctx.lineWidth = fin * 2.1; ctx.beginPath(); ctx.arc(ax, ay, r, Math.PI / 2 - a[1], Math.PI / 2 - a[0]); ctx.stroke(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,190,90,${(dedans ? 0.3 : 0.16) * k})`; ctx.lineWidth = fin * 3.8; ctx.beginPath(); ctx.arc(ax, ay, r, Math.PI / 2 - a[1], Math.PI / 2 - a[0]); ctx.stroke();
    ctx.strokeStyle = `rgba(255,232,170,${(dedans ? 1 : 0.72) * k})`; ctx.lineWidth = fin * 1.15; ctx.beginPath(); ctx.arc(ax, ay, r, Math.PI / 2 - a[1], Math.PI / 2 - a[0]); ctx.stroke(); }
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
  const tn = performance.now() / 1000, brut = tn - last, real = Math.min(0.05, brut); last = tn;
  if (gel && !unTour) return;                            // un panneau couvre la forêt : on ne la redessine pas
  unTour = false; time += real;
  const paused = window.LIANE.pause;
  // Le mouvement avance du temps réellement écoulé, découpé en pas courts : l'image suit le doigt sans à-coup.
  if (!paused) {
    const n = Math.max(1, Math.ceil(real * 120 - 1e-6)), h = real / n;
    for (let i = 0; i < n && !M.mort && !scn; i++) {
      if (phase !== 'course' || auto) pilote(jeu, pil);            // hors course, le singe joue tout seul
      jeu.step(h);
      if (appuiFrais) { appuiFrais = false; if (aLever) { aLever = false; jeu.setHold(false); } }
      if (phase === 'course' && !M.idle && !M.mort) t += h;
      if (window.LIANE.stop && window.LIANE.stop(M)) { window.LIANE.pause = true; break; }
    }
  }
  for (const e of jeu.events) {
    if (e.type === 'saisie') { burst(e.x, e.y + 1.5, 2, -1); if (phase === 'course') vibre(6); if (aide < 9 && phase === 'course') { if (M.saisies >= 3) { aide = 9; taire(); } else dire('lâche dans l\'arc doré'); } }
    else if (e.type === 'lacher') { if (e.parfait) { rings.push({ x: e.x, y: e.y, t: 0 }); if (phase === 'course') vibre(12); } if (aide < 9 && phase === 'course') dire('tiens pour attraper la liane'); }
    else if (e.type === 'rebond') { e.tr.ecrase = 1; burst(e.x, e.y + 0.4, 6, 5); B.squash = 1; }
    else if (e.type === 'mort') { if (e.cause === 'chute') burst(e.x, 0.5, 14, 6); taire(); }
    else if (e.type === 'pouvoir') { vibre(30); rings.push({ x: e.x, y: e.y, t: 0 }, { x: e.x + 0.5, y: e.y + 0.5, t: 0 }); burst(e.x, e.y, 10, 4); dire(esp.pouvoir.nom); pouvoirT = time; }
  }
  jeu.events.length = 0;
  const dt = paused ? 0 : real, skin = skinById(profil.skin);
  if (M.mort && !mortT) mortT = time;
  if (net && phase === 'course') directCourse();
  if (mortT && phase === 'course' && time - mortT > (net ? 1.1 : 0.7)) finir();           // en direct, on laisse à sa chute le temps d'arriver, s'il est tombé au même instant
  else if (net && net.finT && phase === 'course' && time > net.finT) finir();
  if (mortT && phase === 'accueil' && time - mortT > 1.2) scene(hasard(), false);
  if (phase === 'course') {
    // Le premier geste engage le duel : la mise est notée tout de suite. Quitter ou recharger la page en cours de duel compte comme une défaite.
    if (!parti && !M.idle) { parti = true; $('hLui').textContent = rival.nom + ' · ' + Math.round(G.dist) + ' m'; if (classe) { profil.enCours = { rival: rival.id, elo: rival.elo }; garder(); } }
    const d = Math.max(0, Math.round(M.x)); if (d !== distVue) { distVue = d; $('chrono').textContent = d; }
    majCrans(M.chaine); majPouvoir(); if (pouvoirT && time - pouvoirT > 1.8) { taire(); pouvoirT = 0; }
    // Aucun lâcher ne passe à ce balancement : le jeu le dit, tant que c'est vrai.
    const attends = M.mode === 'swing' && !M.idle && !M.depart && M.om > 0.2 && M.th > -0.2 && !M.arc && !M.zone && !jeu.aZone;
    if (attends !== attendVu) { attendVu = attends; if (attends) dire('reste accroché : il reprend de l\'élan'); else if (aide >= 9 && !pouvoirT) taire(); }
    if (G.direct && net) { const dl = Math.round(G.dist); if (dl !== net.distVue && parti) { net.distVue = dl; $('hLui').textContent = rival.nom + ' · ' + dl + ' m'; } }
    if (!depasse && Math.round(M.x) > Math.round(G.dist)) { depasse = true; $('ecart').textContent = rival.nom + ' dépassé'; $('ecart').className = 'bulle on avance'; ecartT = time; }
    if (ecartT > 0 && time - ecartT > 2.4) { $('ecart').className = 'bulle'; ecartT = -9; }
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
  if (phase !== 'accueil' && G && (parti || phase === 'fin') && (!G.direct || (net && net.mortLui && net.mortLui.cause !== 'parti')) && faisceau(G.dist, 0.34, 1.1)) {
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff6dc'; ctx.font = `300 ${Math.round(11 * dpr)}px Jost, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(rival.nom.toUpperCase() + '  ·  ' + Math.round(G.dist) + ' M', X(G.dist), Y(9.8)); ctx.globalAlpha = 1;
  }

  // Le plan du jeu : le feuillage du haut, les lianes, le fantôme du rival, l'arc doré, le singe, la cime du bas.
  drawTile(ctx, D.top.c, D.TW, camX * S, D.top.y + camDy, W);
  if (D.top.y + camDy > -S * 2) { ctx.fillStyle = PAL.play.bot; ctx.fillRect(0, 0, W, Math.ceil(D.top.y + camDy + S * 2)); }      // au-dessus : l'épaisseur du feuillage
  if (D.rangs) for (const R of D.rangs.haut) drawTile(ctx, R.c, D.TW, camX * S * R.par, R.y + camDy * R.par, W);                // téléphone debout : la canopée continue jusqu'en haut de l'écran
  drawTremplins(dt);
  const pose = poseSinge(M, B, dt, autour(M, M.mode === 'swing' ? M.li : null));
  if (phase !== 'accueil') drawPerche();
  drawLianas(pose);
  if (phase !== 'accueil' && G && G.direct) {            // l'adversaire en direct : son vrai singe, dans sa tenue, un peu transparent pour ne pas le confondre avec le sien
    etatDirect(Mg);
    if (!Mg.fini) {
      const gp = poseSinge(Mg, Bg, dt, autour(Mg, null)), pl = net.peauLui, c = calque(), o = c.width / 2, Xc = (x) => (x - Mg.x) * S + o, Yc = (y) => (Mg.y - y) * S + o, g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      if (pl && pl.pret) dessinerPeau(g, gp, pl, Xc, Yc, S); else dessinerSinge(g, gp, skinById(rival.skin).ink, Xc, Yc, S);
      ctx.globalAlpha = 0.5;
      if (Mg.mode === 'swing') { ctx.strokeStyle = PAL.ink; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.moveTo(X(Mg.ax), Y(Mg.ay)); ctx.lineTo(X(Mg.x), Y(Mg.y)); ctx.stroke(); }
      ctx.globalAlpha = 0.74; ctx.drawImage(c, Math.round(X(Mg.x) - o), Math.round(Y(Mg.y) - o));
      if (Math.abs(Mg.x - M.x) > 1.6 || Math.abs(Mg.y - M.y) > 1.6) {            // son nom, sur une pastille sombre : lisible aussi sur le ciel clair
        const px = Math.round(11 * dpr), tx = clamp(X(Mg.x), px * 4, W - px * 4), ty = Y(Mg.y) - S * 0.95; ctx.font = `500 ${px}px Jost, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lw = ctx.measureText(rival.nom).width + px * 1.5, lh = px * 1.9; ctx.globalAlpha = 0.62; ctx.fillStyle = 'rgb(3,22,26)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(tx - lw / 2, ty - lh / 2, lw, lh, lh / 2); else ctx.rect(tx - lw / 2, ty - lh / 2, lw, lh); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff6dc'; ctx.fillText(rival.nom, tx, ty + px * 0.06); ctx.textBaseline = 'alphabetic';
      }
      ctx.globalAlpha = 1;
    }
  } else if (phase !== 'accueil' && G) {                 // le fantôme : il porte le skin de son joueur
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
  if (!scn) drawArc();
  // Le singe du joueur : sa traînée (celle de son skin, ou l'or de l'élan), un liseré de lumière, puis la silhouette.
  const o = Math.max(1.5, S * 0.03), tc = skin.trail || (M.chaine > 0 ? OR : null);
  if (tc) {
    const long = 2 * (22 + 9 * M.chaine), fort = skin.trail ? 0.4 + 0.15 * M.chaine : 0.2 + 0.2 * M.chaine;
    trail.push(pose.hx, pose.hy); while (trail.length > long) trail.splice(0, 2);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 2; i < trail.length; i += 2) { const k = i / trail.length; ctx.strokeStyle = `rgba(${tc},${fort * k * k})`; ctx.lineWidth = S * 0.26 * k; ctx.beginPath(); ctx.moveTo(X(trail[i - 2]), Y(trail[i - 1])); ctx.lineTo(X(trail[i]), Y(trail[i + 1])); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  } else if (trail.length) trail.splice(0, 4);
  // Les pouvoirs qui se voient : la queue qui se tend vers la liane, et le singe ami descendu de la canopée avec la sienne.
  if (M.tir && esp.pouvoir.id === 'queue') {
    const T = M.tir; ctx.strokeStyle = peau && peau.pret ? peau.poil : skin.ink; ctx.lineCap = 'round'; ctx.lineWidth = S * B.m.K * 0.075;
    ctx.beginPath(); ctx.moveTo(X(pose.hx), Y(pose.hy)); ctx.quadraticCurveTo(X((pose.hx + T.li.x) / 2 - 0.6), Y(Math.max(pose.hy, T.y1) + 1.3), X(T.li.x), Y(T.y1 + 0.3)); ctx.stroke();
  }
  const ami = jeu.lianas.find((l) => l.ami);
  if (ami && X(ami.x) > -S * 4) {
    if (!Ba || Ba.li !== ami) { Ba = corps(B.m); Ba.li = ami; }
    const R = 2.5; Ma.mode = 'swing'; Ma.li = ami; Ma.R = R; Ma.th = ami.a; Ma.om = ami.av; Ma.x = ami.x + Math.sin(ami.a) * R; Ma.y = ami.y - Math.cos(ami.a) * R; Ma.vx = R * ami.av * Math.cos(ami.a); Ma.vy = R * ami.av * Math.sin(ami.a); Ma.hold = true;
    const pa = poseSinge(Ma, Ba, dt, { ancre: [ami.x, ami.y], reste: ami.L - R, devant: 99, attend: false, tend: true });
    if (peau && peau.pret) dessinerPeau(ctx, pa, peau, X, Y, S); else drawMonkey(pa, skin.ink);
  }
  if (scn) { /* la scène de fin montre les deux singes : celui de la course s'efface */ }
  else if (peau && peau.pret) dessinerPeau(ctx, pose, peau, X, Y, S);
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
  // Téléphone debout : sous les cimes, la forêt descend. Deux rangs de feuillage, une nappe de brume entre eux, les rayons du soleil qui tombent dedans, et des lucioles en haut comme en bas.
  if (D.rangs) {
    for (const R of D.rangs.bas) {
      const y = R.y + camDy * R.par, g = ctx.createLinearGradient(0, y - S * 2, 0, y + S * 7); g.addColorStop(0, `rgba(${PAL.mist},0)`); g.addColorStop(0.4, `rgba(${PAL.mist},${0.13 + 0.03 * Math.sin(time * 0.3 + R.par * 9)})`); g.addColorStop(1, `rgba(${PAL.mist},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, y - S * 2, W, S * 9);
      drawTile(ctx, R.c, D.TW, camX * S * R.par, y, W);
    }
    const y0 = Math.max(0, Math.round(D.floor.y + camDy + S * 2.5));
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + 0.1 * Math.sin(time * 0.23); ctx.drawImage(D.rays, 0, y0, W, H - y0, 0, y0, W, H - y0);
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i], par = f.par + 0.45, yb = i % 2 ? -1.6 - f.y * 1.15 : 15.6 + f.y * 1.1, span = W / S + 8;
      const a = Math.max(0, Math.sin(time * 0.6 * f.sp + f.ph + 1.7)) ** 2; if (a < 0.02) continue;
      const fx = ((((f.x * 1.7 + Math.sin(time * 0.3 * f.sp + f.ph) * 0.8 - camX * par) % span) + span) % span - 4) * S, fy = baseY - (yb + Math.sin(time * 0.5 * f.sp + f.ph * 2) * 0.5) * S + camDy * par, sz = S * 0.4 * f.s;
      ctx.globalAlpha = a * 0.8; ctx.drawImage(D.dot, fx - sz, fy - sz, sz * 2, sz * 2);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

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
  if (scn) {
    const c = cadreScene(); jouerScene(ctx, scn, real * (window.LIANE.lent || 1), c, PAL.ink);          // lent : un ralenti, pour les mises au point
    if (!eloFin.dit && scn.t >= TEMPS.elo) montrerElo(c);
  }

  // En course : la ligne du haut, de ton départ jusqu'au repère du rival. Les deux points avancent dessus.
  if (phase === 'course') {
    // En direct, il n'y a pas de repère à atteindre : la ligne s'allonge avec celui qui mène.
    const fin = G.direct ? Math.max(60, M.x, G.dist) * 1.12 : Math.max(60, G.dist), pm = Math.round(clamp(M.x / fin, 0, 1) * 400) / 4, pl = G.direct ? Math.round(clamp(G.dist / fin, 0, 1) * 400) / 4 : Mg.fini ? 100 : Math.round(clamp((Mg.x || 0) / fin, 0, 1) * 400) / 4;
    if (pm !== pisteMoi) { pisteMoi = pm; $('hpMoi').style.left = pm + '%'; }
    if (pl !== pisteLui) { pisteLui = pl; $('hpLui').style.left = pl + '%'; }
  }
}

// Pendant qu'on écrit (pseudo, code de partie), le clavier du téléphone peut changer la taille de la page : on ne reconstruit la forêt qu'une fois le clavier refermé.
const ajuster = () => { if (document.activeElement && document.activeElement.tagName === 'INPUT') return; if (Math.round(innerWidth * dpr) !== W || Math.round(innerHeight * dpr) !== H) resize(); };
addEventListener('resize', ajuster); addEventListener('focusout', () => setTimeout(ajuster, 350)); resize();
$('version').textContent = VERSION;
// Les dessins de l'interface : dégradés des emblèmes, icônes des onglets et des boutons.
document.body.insertAdjacentHTML('afterbegin', DEFS);
{ const noms = { jouer: 'Jouer', singes: 'Singes', boutique: 'Boutique', rangs: 'Classement' }; for (const b of $('onglets').children) b.innerHTML = ICONE[b.dataset.onglet] + '<span>' + noms[b.dataset.onglet] + '</span>'; }
$('iNon').innerHTML = ICONE.croix; $('mPrec').innerHTML = ICONE.retour; $('mSuiv').innerHTML = ICONE.fleche; $('dFermer').innerHTML = ICONE.croix; $('pouvoir').firstElementChild.innerHTML = ICONE.eclair;
window.LIANE = { get jeu() { return jeu; }, get M() { return M; }, get phase() { return phase; }, get t() { return t; }, get rival() { return rival; }, get G() { return G; }, get net() { return net; }, get scn() { return scn; }, get image() { return { dpr, qualite, fluide }; }, get cadre() { return { x: X(M.x) / W, y: Y(M.y) / H, large: W / S, portrait }; }, profil, CFG, lancer, defier, onglet, accueil, hold, pause: false, stop: null, attente: 0 };   // pour les mises au point
journal('page ouverte');
// Un duel classé était engagé quand la page a été quittée ou rechargée : il compte comme une défaite.
let abandon = 0;
if (profil.enCours && Number.isFinite(profil.enCours.elo)) { abandon = gain(profil, profil.enCours.elo, false); profil.elo = Math.max(100, profil.elo + abandon); profil.d++; journal('duel quitté en cours : défaite comptée (' + abandon + ')'); }
profil.enCours = null; garder();
if (params.get('journal')) { let j = []; try { j = JSON.parse(localStorage.getItem('liane-journal') || '[]'); } catch (e) { /* rien */ }
  const pre = document.createElement('pre'); pre.setAttribute('data-ui', ''); pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:12px;overflow:auto;background:rgba(2,12,16,.94);color:#fff6dc;font:12px/1.5 monospace;z-index:9;touch-action:pan-y;-webkit-user-select:text;user-select:text';
  pre.textContent = 'Journal de LIANE ' + VERSION + ' (les plus récents en bas)\n\n' + j.map(([t, q]) => new Date(t).toLocaleTimeString('fr-FR') + '  ' + q).join('\n'); document.body.appendChild(pre); }
accueil();
{ const c = nettoyerCode(params.get('duel')); if (c.length === 4) ouvrirDirect(c); }
if (abandon) { dire('duel quitté en cours : −' + Math.abs(abandon) + ' au classement', true); setTimeout(() => { if (phase === 'accueil') taire(); }, 5000); }
$('chargement').classList.add('vu');
frame();
