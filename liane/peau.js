// LIANE — la peau du singe : les pièces peintes d'un singe (une planche faite avec Higgsfield, découpée par liane/outils/decoupe.py)
// posées sur le squelette de singe.js. Le mouvement reste celui du jeu ; seule l'apparence vient de l'image.
// Un singe = deux fichiers dans singes/ : <nom>.png (l'atlas) et <nom>.json (où est chaque pièce, et ses deux points d'articulation a et b).

const NIV = 4;                                             // l'atlas est gardé à quatre tailles, pour rester net quand le singe est petit à l'écran
function toile(src, w, h, voile) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
  if (voile) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = voile; g.fillRect(0, 0, c.width, c.height); }
  return c;
}

// allure : comment poser les pièces de ce singe (taille de la tête, largeur du tronc et de la queue, trait de la queue) ; voir especes.js.
const ALLURE = { tete: 0.3, tronc: 0.74, queue: 1.5, trait: [0.1, 0.028], ombre: 0.36 };
export function chargerPeau(nom, allure = ALLURE, v = '25') {
  const peau = { nom, allure, pret: false, f: null, clair: [], sombre: [], poil: '#4a2a1c' };
  const image = new Promise((ok, non) => { const im = new Image(); im.onload = () => ok(im); im.onerror = non; im.src = `singes/${nom}.png?v=${v}`; });
  Promise.all([fetch(`singes/${nom}.json?v=${v}`).then((r) => r.json()), image]).then(([f, im]) => {
    let src = im, w = im.width, h = im.height;
    for (let n = 0; n < NIV; n++) { const c = toile(src, w, h); peau.clair.push(c); peau.sombre.push(toile(c, w, h, `rgba(22,11,8,${allure.ombre ?? 0.36})`)); src = c; w /= 2; h /= 2; }   // les membres du fond sont un peu assombris
    // La couleur moyenne du pelage, lue sur la queue.
    if (f.queue) { const fq = f.queue, q = 1 << (NIV - 1), d = peau.clair[NIV - 1].getContext('2d').getImageData(fq.x / q, fq.y / q, fq.w * 0.4 / q, fq.h / q).data; let r = 0, v = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; v += d[i + 1]; b += d[i + 2]; n++; }
      peau.poil = n ? `rgb(${Math.round(r / n)},${Math.round(v / n)},${Math.round(b / n)})` : '#4a2a1c'; }
    peau.f = f; peau.pret = true;
  }).catch(() => { /* sans image, le jeu garde la silhouette */ });
  return peau;
}

// Pose une pièce : son point a sur (x1, y1), son axe a → b vers (x2, y2). e : pixels d'écran par pixel d'image (sinon l'axe est étiré d'un point à l'autre).
function piece(ctx, jeu, f, x1, y1, x2, y2, e, large, miroir) {
  const pl = Math.hypot(f.bx - f.ax, f.by - f.ay), s = e || Math.hypot(x2 - x1, y2 - y1) / pl;
  const n = Math.max(0, Math.min(NIV - 1, Math.floor(Math.log2(1 / Math.max(s, 1e-3))))), q = 1 << n;
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1)); ctx.scale(s, s * (large || 1) * (miroir ? -1 : 1)); ctx.rotate(-Math.atan2(f.by - f.ay, f.bx - f.ax));
  ctx.drawImage(jeu[n], f.x / q, f.y / q, f.w / q, f.h / q, -f.ax, -f.ay, f.w, f.h); ctx.restore();
  return s;
}

// Dessine le singe habillé. p : la pose rendue par poseSinge ; X, Y : du monde vers l'écran ; S : pixels par mètre.
export function dessinerPeau(ctx, p, peau, X, Y, S) {
  const f = peau.f, C = peau.clair, D = peau.sombre, A = peau.allure, K = p.m.K, lisse = ctx.imageSmoothingQuality; ctx.imageSmoothingQuality = 'high';
  // La queue : l'image, droite, est coupée en tranches posées le long de la chaîne ; chaque tranche déborde un peu sur ses voisines pour fermer les coudes.
  // Dessous, un trait effilé de la couleur du pelage : quand le singe est petit à l'écran, c'est lui qui donne une ligne nette.
  if (f.queue && p.queue.length > 1) { const Q = p.queue, fq = f.queue, n = Q.length - 1, lq = fq.bx - fq.ax, tr = lq / n, u = K * S;
    ctx.strokeStyle = peau.poil; ctx.lineCap = ctx.lineJoin = 'round';
    for (let i = 1; i <= n; i++) { ctx.lineWidth = u * (A.trait[0] + (A.trait[1] - A.trait[0]) * (i - 0.5) / n); ctx.beginPath(); ctx.moveTo(X(Q[i - 1].x), Y(Q[i - 1].y)); ctx.lineTo(X(Q[i].x), Y(Q[i].y)); ctx.stroke(); }
    const maille = Math.hypot(X(Q[1].x) - X(Q[0].x), Y(Q[1].y) - Y(Q[0].y)), pas = 1;
    if (maille >= 5) for (let i = n - 1; i >= 0; i -= pas) {      // en jeu, le singe est trop petit pour que le poil se voie : sous cinq pixels par maillon, le trait suffit
      const j = Math.min(n, i + pas), x1 = X(Q[i].x), y1 = Y(Q[i].y), x2 = X(Q[j].x), y2 = Y(Q[j].y), lt = tr * (j - i), s = Math.hypot(x2 - x1, y2 - y1) / lt;
      const g = i ? tr * 0.35 : fq.ax, d = j < n ? tr * 0.35 : fq.w - fq.bx, x0 = fq.ax + i * tr - g, w = lt + g + d;
      const m = Math.max(0, Math.min(NIV - 1, Math.floor(Math.log2(1 / Math.max(s, 1e-3))))), q = 1 << m;
      ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1)); ctx.scale(s, s * A.queue);
      ctx.drawImage(C[m], (fq.x + x0) / q, fq.y / q, w / q, fq.h / q, -g, -fq.ay, w, fq.h); ctx.restore();
    } }
  const jambe = (l, jeu) => {
    const s = piece(ctx, jeu, f.jambe, X(l[0]), Y(l[1]), X(l[2]), Y(l[3]));
    piece(ctx, jeu, f.pied, X(l[2]), Y(l[3]), X(l[4]), Y(l[5]), s);
    piece(ctx, jeu, f.cuisse, X(p.jx), Y(p.jy), X(l[0]), Y(l[1]));
  };
  const bras = (b, jeu) => {
    const s = piece(ctx, jeu, f.avant, X(b[0]), Y(b[1]), X(b[2]), Y(b[3]));
    piece(ctx, jeu, f.bras, X(p.sx), Y(p.sy), X(b[0]), Y(b[1]));
    piece(ctx, jeu, f.main, X(b[2]), Y(b[3]), X(b[4]), Y(b[5]), s, 1, true);            // les doigts se referment du côté de la liane
  };
  // Du fond vers l'avant : la jambe et le bras du fond, le tronc, la jambe de devant, la tête, le bras de devant.
  jambe(p.legs[0], D); bras(p.bras[1], D);
  { const x1 = X(p.sx), y1 = Y(p.sy), x2 = X(p.hx), y2 = Y(p.hy), dx = x2 - x1, dy = y2 - y1;
    piece(ctx, C, f.tronc, x1, y1, x2, y2, 0, A.tronc, dy * p.av[0] + dx * p.av[1] < 0); }    // le ventre doré du côté où il regarde
  jambe(p.legs[1], C);
  { const a = Math.atan2(p.museau[1] - p.tete[1], p.museau[0] - p.tete[0]) + 0.35, x = X(p.tete[0]), y = Y(p.tete[1]);
    piece(ctx, C, f.tete, x, y, x + Math.cos(a), y - Math.sin(a), A.tete * K * S / (f.tete.w * 0.8)); }
  bras(p.bras[0], C);
  ctx.imageSmoothingQuality = lisse;
}
