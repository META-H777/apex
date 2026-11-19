// LIANE — l'atelier du singe : le même mouvement que dans le jeu, découpé image par image, pour juger chaque pose.
// Paramètres d'adresse : s = chaine | attente | depart | rebond ; de = instant de départ (s) ; n = nombre d'images ; pas = pas de 1/120 s entre deux images ;
// col = images par ligne ; px = pixels par mètre ; graine ; monde.
import { Jeu, MONDES, pilote, rnd } from './jeu.js?v=10';
import { corps, poseSinge, dessinerSinge, PERCHE } from './singe.js?v=10';
const P = new URLSearchParams(location.search), num = (k, d) => (P.has(k) ? +P.get(k) : d);
const sc = P.get('s') || 'chaine';
let de = num('de', 1.2);
const  N = num('n', 24), pasI = num('pas', 4), COL = num('col', 6), PX = num('px', 40), cell = num('cell', 200);
const jeu = new Jeu(num('graine', 11), false, MONDES[sc === 'rebond' ? 4 : num('monde', 0)]), M = jeu.M, B = corps(), st = { gout: 1, r: rnd(5) };
const images = []; let t = 0;
if (sc === 'rebond') { const j2 = new Jeu(num('graine', 11), false, MONDES[4]), s2 = { gout: 1, r: rnd(5) }; let t2 = 0, vu = 0; while (t2 < 120) { pilote(j2, s2); j2.step(1 / 120); t2 += 1 / 120; if (j2.events.some((e) => e.type === 'rebond') && ++vu > num('k', 0)) break; j2.events.length = 0; } de = t2 - 0.3; }
const devant = () => { let d = 99; for (const li of jeu.lianas) { const dx = li.x - M.x; if (dx > -0.9 && li !== M.last && !(M.mode === 'swing' && li === M.li)) { d = dx; break; } } return d; };
function avance() {
  if (sc === 'attente') { if (t < 0.05) jeu.setHold(true); else if (t < de - 0.2) pilote(jeu, st); else jeu.setHold(true); }
  else if (sc === 'depart') { if (t > 0.6) pilote(jeu, st); }
  else pilote(jeu, st);
  jeu.step(1 / 120); if (jeu.events.some((e) => e.type === 'rebond')) B.squash = 1; jeu.events.length = 0; t += 1 / 120;
  const sw = M.mode === 'swing', tr = !sw && M.vy < 0 && M.y < 7 && jeu.lianas.some((l) => l.tr && Math.abs(M.x - l.tr.x) < l.tr.w / 2 + 1.2);
  return poseSinge(M, B, 1 / 120, { ancre: sw ? [M.li.x, M.li.y] : null, reste: sw ? M.li.L - M.R : 0, devant: devant(), attend: M.idle, tend: M.hold, tremplin: tr });
}
const copie = (p) => JSON.parse(JSON.stringify(p));
let pose = null; while (t < (sc === 'depart' ? 0 : de)) pose = avance();
for (let i = 0; i < N; i++) { for (let k = 0; k < pasI; k++) pose = avance(); images.push({ p: copie(pose), t, mode: M.mode, th: M.th, om: M.om, x: M.x, y: M.y, li: M.mode === 'swing' ? { x: M.li.x, y: M.li.y, L: M.li.L, R: M.R } : null, autres: jeu.lianas.filter((l) => Math.abs(l.x - M.x) < 8).map((l) => ({ x: l.x, y: l.y, L: l.L, a: l.a })), trs: jeu.lianas.filter((l) => l.tr && Math.abs(l.tr.x - M.x) < 8).map((l) => ({ x: l.tr.x, y: l.tr.y, w: l.tr.w })), arc: M.arc ? [...M.arc] : null }); }
// Chronophotographie : la caméra ne bouge pas, toutes les poses sont posées sur la même image, comme sur une planche de Marey.
if (P.get('vue') === 'chrono') {
  const cv = document.getElementById('c'), x0 = images[0].x - 4, x1 = images[images.length - 1].x + 4, y0 = num('y0', 0), y1 = num('y1', 14), dpr = 2;
  cv.width = (x1 - x0) * PX * dpr; cv.height = (y1 - y0) * PX * dpr; cv.style.width = (x1 - x0) * PX + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.fillStyle = '#eaf1ea'; ctx.fillRect(0, 0, cv.width, cv.height);
  const X = (x) => (x - x0) * PX, Y = (y) => (y1 - y) * PX;
  ctx.strokeStyle = '#9db5a3'; ctx.lineWidth = PX * 0.07; ctx.lineCap = 'round';
  const vues = new Set(); for (const im of images) for (const l of im.autres) { if (vues.has(l.x)) continue; vues.add(l.x); ctx.beginPath(); ctx.moveTo(X(l.x), Y(l.y)); ctx.lineTo(X(l.x), Y(l.y - l.L)); ctx.stroke(); }
  images.forEach((im, i) => { const p = im.p;
    if (im.li) { ctx.strokeStyle = 'rgba(53,82,63,.55)'; ctx.lineWidth = PX * 0.06; ctx.beginPath(); ctx.moveTo(X(im.li.x), Y(im.li.y)); ctx.lineTo(X(p.px), Y(p.py)); ctx.stroke(); }
    dessinerSinge(ctx, p, im.mode === 'swing' ? 'rgba(11,29,22,.9)' : 'rgba(60,40,20,.9)', X, Y, PX); });
} else {
const cv = document.getElementById('c'), rows = Math.ceil(N / COL), dpr = 2; cv.width = COL * cell * dpr; cv.height = rows * cell * dpr; cv.style.width = COL * cell + 'px';
const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
images.forEach((im, i) => {
  const ox = (i % COL) * cell, oy = Math.floor(i / COL) * cell, p = im.p, cx = (p.px + p.hx) / 2, cy = (p.py + p.hy) / 2 - 0.2;
  const X = (x) => ox + cell / 2 + (x - cx) * PX, Y = (y) => oy + cell / 2 - (y - cy) * PX;
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, cell, cell); ctx.clip();
  ctx.fillStyle = i % 2 ? '#e3ebe4' : '#eaf1ea'; ctx.fillRect(ox, oy, cell, cell);
  ctx.strokeStyle = '#7d9a86'; ctx.lineWidth = PX * 0.09; ctx.lineCap = 'round';
  for (const l of im.autres) { if (im.li && l.x === im.li.x) continue; ctx.beginPath(); ctx.moveTo(X(l.x), Y(l.y)); ctx.lineTo(X(l.x + Math.sin(l.a) * l.L), Y(l.y - Math.cos(l.a) * l.L)); ctx.stroke(); }
  if (im.li) { const rem = im.li.L - im.li.R; ctx.strokeStyle = '#35523f'; ctx.beginPath(); ctx.moveTo(X(im.li.x), Y(im.li.y)); ctx.lineTo(X(p.px), Y(p.py)); ctx.lineTo(X(p.px + Math.sin(p.bas) * rem), Y(p.py - Math.cos(p.bas) * rem)); ctx.stroke();
    if (im.arc) { ctx.strokeStyle = 'rgba(230,170,40,.8)'; ctx.lineWidth = PX * 0.12; ctx.beginPath(); ctx.arc(X(im.li.x), Y(im.li.y), im.li.R * PX, Math.PI / 2 - im.arc[1], Math.PI / 2 - im.arc[0]); ctx.stroke(); } }
  for (const tr of im.trs) { ctx.strokeStyle = '#5f8a6b'; ctx.lineWidth = PX * 0.3; ctx.beginPath(); ctx.moveTo(X(tr.x - tr.w / 2), Y(tr.y - 0.15)); ctx.lineTo(X(tr.x + tr.w / 2), Y(tr.y - 0.15)); ctx.stroke(); }
  if (im.x < 2) { ctx.strokeStyle = '#35523f'; ctx.lineWidth = PX * 0.3; ctx.beginPath(); ctx.moveTo(X(-12), Y(7.03 - PERCHE - 0.17)); ctx.lineTo(X(-2.9), Y(7.03 - PERCHE - 0.17)); ctx.stroke(); }
  dessinerSinge(ctx, p, '#0b1d16', X, Y, PX);
  ctx.fillStyle = '#35523f'; ctx.font = '10px system-ui'; ctx.fillText(`${im.t.toFixed(2)} s · ${im.mode === 'swing' ? 'liane' : 'vol'} · θ ${im.th.toFixed(2)}`, ox + 6, oy + 13);
  ctx.restore();
});
}
window.LABO = { images };
