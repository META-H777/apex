// LIANE — le jeu : des duels chronométrés contre le fantôme d'un rival, un classement Elo, des skins.
// Tenir pour s'accrocher, lâcher pour s'élancer. Les règles du mouvement sont dans jeu.js, le décor dans decor.js, les rivaux dans rivaux.js.
import { Jeu, CFG, rnd } from './jeu.js?v=2';
import { buildDecor, drawTile, PAL } from './decor.js?v=2';
import { FIN, PARCOURS, SKINS, skinById, rang, fantome, etat, tempsA, profil, garder, elo, adversaire, classement } from './rivaux.js?v=2';

const VERSION = 'v0.1';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const cv = $('ecran'), ctx = cv.getContext('2d', { alpha: false });
const auto = params.get('auto');

// ---------- L'écran ----------
let W = 0, H = 0, S = 1, baseY = 0, D = null, portrait = false, dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
  portrait = H > W * 1.1;
  S = portrait ? W / 11.5 : H / 14;
  baseY = portrait ? H - 2.6 * S : H - 0.95 * S;
  D = buildDecor(W, H, S, baseY, +(params.get('decor') || 7));
  $('tourne').classList.toggle('vu', !portrait); if (portrait) setTimeout(() => $('tourne').classList.add('vu'), 7000);
}

// ---------- L'état de la partie ----------
let jeu, M, B, camX = 0, camLead = 3, camDy = 0, time = 0, last = performance.now() / 1000, acc = 0;
let phase = 'accueil';                 // accueil, course ou fin
let parcours = PARCOURS[0], rival = null, G = null, Bg = null, t = 0, parti = false, passe = 0, ecartT = -9, tFin = 0, ignoreUp = false;
const Mg = {}, trail = [];
const X = (x) => (x - camX) * S + W * 0.44, Y = (y) => baseY - y * S + camDy;
const corps = () => ({ phi: -0.4, phiV: 0, kick: 0, kickV: 0, tuck: 0, squash: 0, tail: null });
function scene(seed) { jeu = new Jeu(seed); M = jeu.M; B = corps(); camX = M.x + 3; camLead = 3; trail.length = 0; acc = 0; }
const fmt = (s) => s.toFixed(2).replace('.', ',');

function majAccueil() {
  const r = rang(profil.elo), cl = classement(), pos = cl.findIndex((c) => c.moi) + 1;
  $('aElo').textContent = profil.elo; $('aRang').textContent = r.nom;
  $('aPos').textContent = pos + (pos === 1 ? 'er' : 'e') + ' sur ' + cl.length;
  $('aSuite').textContent = r.suivant ? r.suivant[1] + ' à ' + r.suivant[0] : 'rang le plus haut';
}
function accueil() {
  phase = 'accueil'; scene((Math.random() * 1e9) | 0); majAccueil();
  for (const id of ['fin', 'hud', 'classement', 'skins']) $(id).classList.remove('on');
  $('accueil').classList.add('on'); $('note').classList.add('vu');
}
function lancer(revanche) {
  if (!revanche || !rival) { parcours = PARCOURS[(Math.random() * PARCOURS.length) | 0]; rival = adversaire(profil.elo, rival); }
  G = fantome(parcours, rival); Bg = corps(); scene(parcours);
  phase = 'course'; t = 0; parti = false; passe = 0; ecartT = -9;
  for (const id of ['accueil', 'fin', 'classement', 'skins']) $(id).classList.remove('on');
  $('hud').classList.add('on'); $('chrono').textContent = '0,00'; $('ecart').className = '';
  $('hMoi').textContent = 'toi · ' + profil.elo; $('hLui').textContent = rival.nom + ' · ' + rival.elo;
  $('note').textContent = 'lâche pour partir'; $('note').classList.remove('vu');
}
function finir() {
  const gagne = tFin < G.temps, avant = profil.elo, d = elo(profil.elo, rival.elo, gagne), rAvant = rang(avant).nom;
  profil.elo = Math.max(100, profil.elo + d); if (gagne) profil.v++; else profil.d++;
  if (!profil.record[parcours] || tFin < profil.record[parcours]) profil.record[parcours] = +tFin.toFixed(3);
  garder(); phase = 'fin'; $('note').classList.add('vu');
  const skin = SKINS.find((s) => s.seuil > avant && s.seuil <= profil.elo), rAp = rang(profil.elo).nom;
  $('fTitre').textContent = gagne ? 'victoire' : 'défaite'; $('fin').classList.toggle('perdu', !gagne);
  $('fTemps').textContent = fmt(tFin);
  $('fLui').textContent = rival.nom + ' ' + fmt(G.temps) + ' · écart ' + (tFin - G.temps > 0 ? '+' : '−') + fmt(Math.abs(tFin - G.temps));
  $('fElo').textContent = avant + ' → ' + profil.elo + ' (' + (d >= 0 ? '+' : '−') + Math.abs(d) + ')';
  $('fPlus').textContent = skin ? 'nouveau skin : ' + skin.nom : rAp !== rAvant ? 'nouveau rang : ' + rAp : rang(profil.elo).nom;
  $('hud').classList.remove('on'); setTimeout(() => { if (phase === 'fin') $('fin').classList.add('on'); }, 500);
}

// ---------- Les commandes : un seul doigt ----------
function hold(h) {
  if (phase !== 'course') return;
  if (h) $('note').classList.add('vu');
  jeu.setHold(h);
}
const ui = (e) => e.target.closest && e.target.closest('[data-ui]');
addEventListener('pointerdown', (e) => {
  if (ui(e)) return; e.preventDefault();
  if (phase === 'accueil') { lancer(false); ignoreUp = true; return; }
  hold(true);
}, { passive: false });
addEventListener('pointerup', (e) => { if (ignoreUp) { ignoreUp = false; return; } if (!ui(e)) hold(false); });
addEventListener('pointercancel', () => hold(false));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => { if (e.code !== 'Space' || e.repeat) return; e.preventDefault(); if (phase === 'accueil') lancer(false); else if (phase === 'fin') lancer(false); else hold(true); });
addEventListener('keyup', (e) => { if (e.code === 'Space') hold(false); });
const clic = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
clic('bSuivant', () => lancer(false)); clic('bRevanche', () => lancer(true)); clic('bAccueil', accueil);
clic('bClassement', () => { ouvrirClassement(); }); clic('bSkins', () => { ouvrirSkins(); });
clic('cFermer', () => $('classement').classList.remove('on')); clic('sFermer', () => { $('skins').classList.remove('on'); });

function ouvrirClassement() {
  const cl = classement();
  $('cListe').innerHTML = cl.map((c, i) => `<li class="${c.moi ? 'moi' : ''}"><span class="p">${i + 1}</span><i style="background:${skinById(c.skin).trail ? 'rgb(' + skinById(c.skin).trail + ')' : '#0b2a2e'}"></i><span class="n">${c.nom}</span><span class="r">${rang(c.elo).nom}</span><span class="e">${c.elo}</span></li>`).join('');
  $('classement').classList.add('on');
  const moi = $('cListe').querySelector('.moi'); if (moi) moi.scrollIntoView({ block: 'center' });
}
function ouvrirSkins() {
  $('sListe').innerHTML = SKINS.map((s) => {
    const ok = profil.elo >= s.seuil, choisi = profil.skin === s.id;
    return `<button class="skin ${ok ? '' : 'non'} ${choisi ? 'choisi' : ''}" data-skin="${s.id}"><i style="background:${s.ink};box-shadow:0 0 0 2px ${s.rim}${s.trail ? ', 0 0 18px rgba(' + s.trail + ',.8)' : ''}"></i><b>${s.nom}</b><span>${choisi ? 'porté' : ok ? 'choisir' : 'à ' + s.seuil}</span></button>`;
  }).join('');
  $('skins').classList.add('on');
}
$('sListe').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (!b) return; const s = skinById(b.dataset.skin); if (profil.elo < s.seuil) return; profil.skin = s.id; garder(); ouvrirSkins(); });

// ---------- Le singe : une silhouette articulée, posée par le mouvement ----------
// phi : l'angle du corps qui pend sous les mains (0 = droit vers le bas, positif = vers l'avant). Il suit avec retard : c'est ce qui donne du poids.
const K = 1.45;   // le singe est dessiné plus grand que nature, pour se lire d'un coup d'œil
const ARM = 0.37 * K, TORSO = 0.58 * K, THIGH = 0.36 * K, SHIN = 0.38 * K, HEAD = 0.15 * K, LIMB = 0.095 * K, TAILN = 10, TAILSEG = 0.115 * K;
const dir = (a) => [Math.sin(a), -Math.cos(a)];
function spring(o, k, target, stiff, damp, dt) { o[k + 'V'] += ((target - o[k]) * stiff - o[k + 'V'] * damp) * dt; o[k] += o[k + 'V'] * dt; }
// Coude ou genou : le point milieu d'un membre à deux os entre a et b.
function joint(ax, ay, bx, by, l1, l2, side) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-4; const m = Math.min(d, l1 + l2 - 1e-3); dx /= d; dy /= d;
  const a = (l1 * l1 - l2 * l2 + m * m) / (2 * m), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [ax + dx * a - dy * h * side, ay + dy * a + dx * h * side];
}
function poseMonkey(M, B, dt) {
  const sp = Math.hypot(M.vx, M.vy), sw = M.mode === 'swing';
  let tPhi, tKick, tTuck;
  if (sw) { tPhi = M.th - clamp(M.om * 0.085, -0.5, 0.5); tKick = clamp(M.th * 0.8 + M.om * 0.16, -0.55, 1.15); tTuck = 0.15; }
  else { tPhi = clamp(Math.atan2(-M.vx, M.vy + 0.42 * sp), -1.85, -0.35); tTuck = clamp(1 - Math.abs(M.vy) / 11, 0, 1); tKick = 0.2 + tTuck * 0.7; }
  spring(B, 'phi', tPhi, 190, 19, dt); spring(B, 'kick', tKick, 160, 17, dt);
  B.tuck += (tTuck - B.tuck) * Math.min(1, dt * 9); B.squash = Math.max(0, B.squash - dt * 4);
  const px = M.x, py = M.y, d0 = dir(B.phi), d1 = dir(B.phi + (sw ? -clamp(M.om * 0.05, -0.3, 0.3) : B.tuck * 0.35));
  const sx = px + d0[0] * (ARM * 1.9), sy = py + d0[1] * (ARM * 1.9);                      // épaules
  const tl = TORSO * (1 - B.squash * 0.25), hx = sx + d1[0] * tl, hy = sy + d1[1] * tl;    // hanches
  // Les mains : toutes deux sur la liane quand il est pendu, l'une derrière l'autre en vol.
  let h2x, h2y;
  if (sw) { h2x = px + Math.sin(M.th) * 0.3 * K; h2y = py - Math.cos(M.th) * 0.3 * K; } else { h2x = px - (0.22 + B.tuck * 0.12) * K; h2y = py - 0.22 * K; }
  const e1 = joint(sx, sy, px, py, ARM, ARM, -1), e2 = joint(sx, sy, h2x, h2y, ARM, ARM, -1);
  // Les jambes : elles se lancent vers l'avant quand il remonte, se replient au sommet du vol.
  const legs = [];
  for (const s of [-1, 1]) {
    const a = B.phi + B.kick + s * (0.2 + B.tuck * 0.12), kn = 0.45 + B.tuck * 1.2 + Math.max(0, -B.kick) * 0.6 + s * 0.12;
    const tt = dir(a), kx = hx + tt[0] * THIGH, ky = hy + tt[1] * THIGH, u = dir(a - kn);
    legs.push([kx, ky, kx + u[0] * SHIN, ky + u[1] * SHIN]);
  }
  // La queue : une chaîne libre accrochée aux hanches, qui traîne et fouette toute seule.
  if (!B.tail) { B.tail = []; for (let i = 0; i < TAILN; i++) B.tail.push({ x: hx - i * TAILSEG, y: hy, px: hx - i * TAILSEG, py: hy }); }
  const T = B.tail; T[0].x = hx; T[0].y = hy;
  for (let i = 1; i < TAILN; i++) { const n = T[i], vx = (n.x - n.px) * 0.93, vy = (n.y - n.py) * 0.93; n.px = n.x; n.py = n.y; n.x += vx; n.y += vy - CFG.g * 0.35 * dt * dt; }
  for (let k = 0; k < 4; k++) for (let i = 1; i < TAILN; i++) { const a = T[i - 1], b = T[i]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4; b.x = a.x + dx / d * TAILSEG; b.y = a.y + dy / d * TAILSEG; }
  // La tête, entre les bras, tournée vers l'avant.
  const f = [Math.cos(B.phi), Math.sin(B.phi)], cxh = sx - d0[0] * 0.2 * K + f[0] * 0.17 * K, cyh = sy - d0[1] * 0.2 * K + f[1] * 0.17 * K;
  return { px, py, h2x, h2y, sx, sy, hx, hy, e1, e2, legs, T, head: [cxh, cyh], f };
}
function drawMonkey(p, col) {
  const L = (x1, y1, x2, y2) => { ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); };
  ctx.strokeStyle = ctx.fillStyle = col; ctx.lineCap = ctx.lineJoin = 'round';
  for (let i = 1; i < TAILN; i++) { ctx.lineWidth = S * LIMB * (0.95 - 0.6 * i / TAILN); ctx.beginPath(); L(p.T[i - 1].x, p.T[i - 1].y, p.T[i].x, p.T[i].y); ctx.stroke(); }   // la queue, de plus en plus fine
  ctx.lineWidth = S * LIMB;
  ctx.beginPath();
  for (const l of p.legs) { L(p.hx, p.hy, l[0], l[1]); ctx.lineTo(X(l[2]), Y(l[3])); }
  L(p.sx, p.sy, p.e1[0], p.e1[1]); ctx.lineTo(X(p.px), Y(p.py));
  L(p.sx, p.sy, p.e2[0], p.e2[1]); ctx.lineTo(X(p.h2x), Y(p.h2y));
  ctx.stroke();
  ctx.lineWidth = S * 0.22 * K; ctx.beginPath(); L(p.sx, p.sy, p.hx, p.hy); ctx.stroke();                                          // le torse
  ctx.lineWidth = S * 0.27 * K; ctx.beginPath(); L(p.sx * 0.4 + p.hx * 0.6, p.sy * 0.35 + p.hy * 0.65, p.hx, p.hy); ctx.stroke();   // le ventre rond
  ctx.beginPath(); ctx.arc(X(p.head[0]), Y(p.head[1]), S * HEAD, 0, TAU); ctx.arc(X(p.head[0] + p.f[0] * 0.11 * K), Y(p.head[1] + p.f[1] * 0.11 * K - 0.04 * K), S * 0.08 * K, 0, TAU);
  for (const l of p.legs) { ctx.moveTo(X(l[2]), Y(l[3])); ctx.arc(X(l[2]), Y(l[3]), S * 0.062 * K, 0, TAU); }
  ctx.moveTo(X(p.px), Y(p.py)); ctx.arc(X(p.px), Y(p.py), S * 0.06 * K, 0, TAU); ctx.moveTo(X(p.h2x), Y(p.h2y)); ctx.arc(X(p.h2x), Y(p.h2y), S * 0.06 * K, 0, TAU);
  ctx.fill();
}

// ---------- Les lianes ----------
function drawLianas() {
  ctx.strokeStyle = ctx.fillStyle = PAL.ink; ctx.lineCap = 'round';
  for (const li of jeu.lianas) {
    const ax = X(li.x); if (ax < -S * 12 || ax > W + S * 12) continue;
    const ay = Y(li.y); let ex, ey, cx, cy; const r = rnd(li.seed);
    if (li.held) {            // tendue jusqu'aux mains, le reste pend et traîne
      const hx = X(M.x), hy = Y(M.y), rem = Math.max(0, li.L - M.R);
      li.ta = (li.ta ?? M.th) + ((M.th * 0.5 - clamp(M.om * 0.16, -0.6, 0.6)) - (li.ta ?? M.th)) * 0.18;   // le bout libre pend surtout vers le bas
      ex = hx + Math.sin(li.ta) * rem * S; ey = hy + Math.cos(li.ta) * rem * S;
      ctx.lineWidth = S * 0.1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.quadraticCurveTo(hx + Math.sin(M.th) * rem * S * 0.35, hy + Math.cos(M.th) * rem * S * 0.35, ex, ey); ctx.stroke();
      cx = (ax + hx) / 2; cy = (ay + hy) / 2;
    } else {                  // libre : elle se balance et se courbe selon son élan
      li.ta = undefined;
      ex = ax + Math.sin(li.a) * li.L * S; ey = ay + Math.cos(li.a) * li.L * S;
      cx = (ax + ex) / 2 - Math.cos(li.a) * li.av * li.L * S * 0.07; cy = (ay + ey) / 2;
      ctx.lineWidth = S * 0.1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
    }
    ctx.beginPath();          // quelques feuilles le long de la liane
    for (let i = 0; i < 5; i++) {
      const tt = 0.2 + 0.72 * (i + r()) / 5, side = i % 2 ? 1 : -1, lx = (1 - tt) * (1 - tt) * ax + 2 * (1 - tt) * tt * cx + tt * tt * ex, ly = (1 - tt) * (1 - tt) * ay + 2 * (1 - tt) * tt * cy + tt * tt * ey;
      const sz = S * (0.16 + r() * 0.1), an = (li.held ? M.th : li.a) * -1 + side * (0.9 + r() * 0.4) + Math.PI / 2;
      ctx.moveTo(lx, ly); ctx.ellipse(lx + Math.cos(an) * sz, ly + Math.sin(an) * sz, sz, sz * 0.42, an, 0, TAU);
    }
    ctx.fill();
  }
}

// ---------- La vie autour : lucioles, feuilles arrachées, oiseaux au loin, feuilles floues tout près ----------
const flies = []; { const r = rnd(31); for (let i = 0; i < 46; i++) flies.push({ x: r() * 60, y: 0.5 + r() * 11.5, par: 0.35 + r() * 0.9, ph: r() * TAU, sp: 0.4 + r() * 0.8, s: 0.5 + r() * 0.9 }); }
const bits = [];
function burst(x, y, n, up) { for (let i = 0; i < n; i++) bits.push({ x: x + (Math.random() - 0.5) * 1.6, y, vx: M.vx * 0.35 + (Math.random() - 0.5) * 5, vy: up * (0.4 + Math.random() * 0.9), a: Math.random() * TAU, av: (Math.random() - 0.5) * 9, life: 1.1 + Math.random() * 0.7, s: 0.1 + Math.random() * 0.12 }); }
const birds = { x: -999, y: 0, t: 6 };
const nears = [0, 1, 2].map((k) => ({ k, x: -999, top: false, s: 1, rot: 0 }));
// Un faisceau de lumière vertical : l'arrivée, et plus discrètement les deux passages intermédiaires.
function faisceau(x, a, w) {
  const sx = X(x); if (sx < -S * 3 || sx > W + S * 3) return;
  const g = ctx.createLinearGradient(sx - w * S, 0, sx + w * S, 0); g.addColorStop(0, `rgba(${PAL.glow},0)`); g.addColorStop(0.5, `rgba(${PAL.glow},${a})`); g.addColorStop(1, `rgba(${PAL.glow},0)`);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(sx - w * S, 0, w * S * 2, H); ctx.globalCompositeOperation = 'source-over';
}

function frame() {
  requestAnimationFrame(frame);
  const tn = performance.now() / 1000, real = Math.min(0.25, tn - last); last = tn; time += real; acc += real;
  const paused = window.LIANE.pause; if (paused) acc = 0;
  while (acc >= 1 / 120) {
    if (phase !== 'course' || auto) jeu.autopilot('bon');          // hors course, le singe joue tout seul
    const x0 = M.x; jeu.step(1 / 120); acc -= 1 / 120;
    if (phase === 'course' && !M.idle) {
      if (!parti) { parti = true; $('note').classList.add('vu'); } t += 1 / 120;
      if (M.x >= FIN) { tFin = t - (1 / 120) * (M.x - FIN) / Math.max(1e-3, M.x - x0); finir(); }
      else if (passe < 2 && M.x >= FIN * (passe + 1) / 3) {       // passage intermédiaire : l'écart avec le rival
        passe++; const d = t - tempsA(G, FIN * passe / 3);
        $('ecart').textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d)); $('ecart').className = 'on ' + (d > 0 ? 'retard' : 'avance'); ecartT = time;
      }
    }
    if (window.LIANE.stop && window.LIANE.stop(M)) { window.LIANE.pause = true; acc = 0; }
  }
  for (const e of jeu.events) { if (e.type === 'bounce') { burst(e.x, e.y, 9, 7); B.squash = 1; } else if (e.type === 'grab') burst(e.x, e.y + 1.5, 2, -1); }
  jeu.events.length = 0;
  const dt = Math.min(0.05, real), skin = skinById(profil.skin);
  if (phase === 'course') { $('chrono').textContent = fmt(t); if (ecartT > 0 && time - ecartT > 1.8) { $('ecart').className = ''; ecartT = -9; } }
  if (auto) { if (phase === 'accueil' && time > 2) lancer(false); else if (phase === 'fin' && $('fin').classList.contains('on') && !window.LIANE.attente) { window.LIANE.attente = setTimeout(() => { window.LIANE.attente = 0; if (phase === 'fin') lancer(false); }, 2500); } }

  // La caméra devance le singe d'autant plus qu'il va vite, et suit à peine sa hauteur.
  camLead += (clamp(M.vx * 0.32, 1.5, 6.5) - camLead) * Math.min(1, dt * 1.6);
  camX += (M.x + camLead - camX) * Math.min(1, dt * 7);
  camDy += ((M.y - 6) * S * 0.16 - camDy) * Math.min(1, dt * 2.5);

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
  if (phase !== 'accueil') { faisceau(FIN / 3, 0.1, 0.5); faisceau(FIN * 2 / 3, 0.1, 0.5); faisceau(FIN, 0.42, 1.3); }

  // Le plan du jeu : le feuillage du haut, les lianes, le fantôme du rival, le singe, la cime du bas.
  drawTile(ctx, D.top.c, D.TW, camX * S, D.top.y + camDy, W);
  drawLianas();
  if (phase !== 'accueil' && G) {                        // le fantôme : il porte le skin de son joueur
    etat(G, parti ? t : 0, Mg);
    if (!Mg.fini || phase === 'course') {
      const gs = skinById(rival.skin), gp = poseMonkey(Mg, Bg, paused ? 0 : dt);
      ctx.globalAlpha = 0.42;
      if (Mg.mode === 'swing') { ctx.strokeStyle = PAL.ink; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.moveTo(X(Mg.ax), Y(Mg.ay)); ctx.lineTo(X(Mg.x), Y(Mg.y)); ctx.stroke(); }
      if (gs.trail) { ctx.save(); ctx.translate(Math.max(1.5, S * 0.03), -Math.max(1.5, S * 0.03)); drawMonkey(gp, gs.rim); ctx.restore(); }
      drawMonkey(gp, gs.ink);
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff6dc'; ctx.font = `300 ${Math.round(11 * dpr)}px Jost, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(rival.nom, X(Mg.x), Y(Mg.y) - S * 0.6);
      ctx.globalAlpha = 1;
    }
  }
  // Le singe du joueur : sa traînée s'il en a une, un liseré de lumière, puis la silhouette.
  const pose = poseMonkey(M, B, paused ? 0 : dt), o = Math.max(1.5, S * 0.03);
  if (skin.trail) {
    trail.push(pose.hx, pose.hy); if (trail.length > 44) trail.splice(0, 2);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 2; i < trail.length; i += 2) { const k = i / trail.length; ctx.strokeStyle = `rgba(${skin.trail},${0.5 * k * k})`; ctx.lineWidth = S * 0.26 * k; ctx.beginPath(); ctx.moveTo(X(trail[i - 2]), Y(trail[i - 1])); ctx.lineTo(X(trail[i]), Y(trail[i + 1])); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  } else trail.length = 0;
  ctx.save(); ctx.translate(o, -o); drawMonkey(pose, skin.rim); ctx.restore(); drawMonkey(pose, skin.ink);
  ctx.fillStyle = PAL.ink;
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i]; b.life -= dt; if (b.life <= 0) { bits.splice(i, 1); continue; }
    b.vy -= 9 * dt; b.vx *= 1 - 1.2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.av * dt;
    ctx.globalAlpha = Math.min(1, b.life * 2); ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.y), S * b.s, S * b.s * 0.45, b.a, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawTile(ctx, D.floor.c, D.TW, camX * S, D.floor.y + camDy, W);
  ctx.fillStyle = PAL.play.bot; ctx.fillRect(0, D.floor.y + D.floor.h + camDy - 1, W, H);

  // Tout près de l'objectif, de grandes feuilles floues passent vite : c'est elles qui donnent la vitesse.
  for (const n of nears) {
    const sx = (n.x - camX) * S * 2.1 + W * 0.44;
    if (sx < -S * 9 || sx > W * 3) { n.x = camX + (W * 0.9 / S + 6 + Math.random() * 16) / 2.1; n.top = Math.random() < 0.45; n.s = S * (3.6 + Math.random() * 2.4); n.rot = (Math.random() - 0.5) * 0.7; continue; }
    ctx.save(); ctx.translate(sx, n.top ? -n.s * 0.3 : H + n.s * 0.3); ctx.rotate(n.rot + (n.top ? Math.PI : 0)); ctx.globalAlpha = 0.92; ctx.drawImage(D.near[n.k], -n.s / 2, -n.s, n.s, n.s); ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(D.vig, 0, 0, W, H);

  // En course : une ligne fine en haut de l'écran, avec ta position et celle du rival.
  if (phase === 'course') {
    const x0 = W * 0.3, x1 = W * 0.7, y = Math.round(9 * dpr), p = (v) => x0 + (x1 - x0) * clamp(v / FIN, 0, 1);
    ctx.strokeStyle = 'rgba(255,246,220,0.35)'; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,246,220,0.85)'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(p(Mg.x || 0), y, 3.5 * dpr, 0, TAU); ctx.stroke();
    ctx.fillStyle = skin.trail ? `rgb(${skin.trail})` : '#fff6dc'; ctx.beginPath(); ctx.arc(p(M.x), y, 3.5 * dpr, 0, TAU); ctx.fill();
  }
}

addEventListener('resize', resize); resize();
$('version').textContent = VERSION;
window.LIANE = { get jeu() { return jeu; }, get M() { return M; }, get phase() { return phase; }, get t() { return t; }, get rival() { return rival; }, get G() { return G; }, profil, CFG, lancer, accueil, pause: false, stop: null, attente: 0 };   // pour les mises au point
accueil();
$('chargement').classList.add('vu');
frame();
