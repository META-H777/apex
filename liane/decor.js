// LIANE — le décor : tout est dessiné par le code, en silhouettes et en lumière. Aucune image, aucun film.
// Chaque plan de forêt est peint une fois dans une bande qui se répète, puis glisse à sa propre vitesse.
import { rnd } from './jeu.js?v=13';

const TAU = Math.PI * 2;

// Palette : fin d'après-midi dorée sur la forêt. Du plus lointain (noyé dans la lumière) au plus proche (presque noir).
export const PAL = {
  sky: [[0, '#0e2c3a'], [0.28, '#1c5560'], [0.52, '#5fa391'], [0.7, '#e6cf8c'], [0.84, '#ffe9b6'], [1, '#ffdc9c']],
  layers: [
    { top: '#93c2a8', bot: '#e9d9a2' },   // tepuis, très loin
    { top: '#5fa08c', bot: '#d3d39b' },   // forêt lointaine
    { top: '#317a70', bot: '#9cc091' },   // forêt
    { top: '#164f50', bot: '#44826f' },   // grands troncs
  ],
  play: { top: '#0e4144', bot: '#05282b' },
  rim: 'rgba(255,232,170,0.6)',            // le liseré de lumière sur le singe
  ink: '#04161a',                          // le singe, les lianes
  near: '#020f12',                         // les feuilles floues du premier plan
  mist: '255,236,184',
  glow: '255,238,170',
  astre: ['255,250,228', '255,238,180', '255,226,150'],   // le soleil : son cœur, son halo, sa lueur lointaine
};
// Une palette par niveau : la même forêt, à une autre heure. La première est celle d'origine.
export const PALETTES = {
  canopee: JSON.parse(JSON.stringify(PAL)),
  aube: {     // brume rose : le petit matin, mauve et pêche
    sky: [[0, '#241d44'], [0.28, '#553a70'], [0.52, '#a9678c'], [0.7, '#f0a48c'], [0.84, '#ffd6b2'], [1, '#ffe4c6']],
    layers: [{ top: '#c7a2b8', bot: '#f5d0b6' }, { top: '#9d789e', bot: '#e8b6a6' }, { top: '#6a4c82', bot: '#c08b98' }, { top: '#3d285c', bot: '#7b5278' }],
    play: { top: '#2a1a46', bot: '#150c29' }, rim: 'rgba(255,214,196,0.65)', ink: '#0d0719', near: '#080411', mist: '255,216,200', glow: '255,224,196', astre: ['255,246,232', '255,222,196', '255,196,170'],
  },
  braise: {   // braise : le couchant, orange et brun rouge, des lianes sèches
    sky: [[0, '#291320'], [0.28, '#66292c'], [0.52, '#b5512e'], [0.7, '#ee983e'], [0.84, '#ffd07a'], [1, '#ffc25c']],
    layers: [{ top: '#d79a64', bot: '#f5cd86' }, { top: '#b4673e', bot: '#e8a660' }, { top: '#7b392c', bot: '#c1713e' }, { top: '#451c1e', bot: '#7b392a' }],
    play: { top: '#2f121a', bot: '#17080d' }, rim: 'rgba(255,196,120,0.7)', ink: '#12060a', near: '#0b0306', mist: '255,204,140', glow: '255,212,140', astre: ['255,244,214', '255,214,140', '255,170,90'],
  },
  lune: {     // lune : la forêt bleue, sous une lune froide
    sky: [[0, '#040a1c'], [0.28, '#0b1d42'], [0.52, '#1b3d70'], [0.7, '#3e6d9c'], [0.84, '#84acc9'], [1, '#b6d0e0']],
    layers: [{ top: '#7da1c2', bot: '#b5cddc' }, { top: '#52779c', bot: '#91b1c8' }, { top: '#2a4a72', bot: '#5a80a2' }, { top: '#12294a', bot: '#2a4a6e' }],
    play: { top: '#0b1c38', bot: '#040b1c' }, rim: 'rgba(200,226,255,0.7)', ink: '#020611', near: '#01030a', mist: '200,224,255', glow: '214,232,255', astre: ['240,247,255', '204,226,255', '170,205,255'],
  },
};
export function setPalette(id) { Object.assign(PAL, JSON.parse(JSON.stringify(PALETTES[id] || PALETTES.canopee))); }

function blob(g, x, y, r) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }

// Une ligne de cimes : des houppiers ronds serrés, pleins jusqu'en bas.
function canopy(g, TW, TH, by, amp, rad, r, waves = 3) {
  const ph = r() * TAU;
  g.beginPath();
  for (let x = -rad * 2; x < TW + rad * 2; x += rad * (0.5 + r() * 0.7)) {
    const y = by - amp * (0.5 + 0.5 * Math.sin(x / TW * TAU * waves + ph)) - r() * amp * 0.45, rr = rad * (0.55 + r() * 0.8);
    blob(g, x, y, rr); if (r() < 0.35) blob(g, x + rr * 0.7, y - rr * 0.55, rr * 0.55);
  }
  g.rect(-rad, by - amp * 0.15, TW + rad * 2, TH);
  g.fill();
}

// Un arbre émergent : tronc fin, branches en éventail, houppier large et plat comme celui d'un kapokier.
function umbrella(g, x, by, h, r, vines = 3) {
  const lean = (r() - 0.5) * h * 0.14, tw = h * 0.035 + 1.5, tx = x + lean, ty = by - h, fy = ty + h * 0.2;
  g.beginPath(); g.moveTo(x - tw * 1.5, by); g.quadraticCurveTo(x - tw * 0.4 + lean * 0.2, by - h * 0.45, tx - tw * 0.4, fy); g.lineTo(tx + tw * 0.4, fy); g.quadraticCurveTo(x + tw * 0.4 + lean * 0.2, by - h * 0.45, x + tw * 1.5, by); g.fill();
  const cw = h * (0.4 + r() * 0.2), ends = [];
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const u = (i - 2) / 2 + (r() - 0.5) * 0.3, ex = tx + u * cw * 0.85, ey = ty + h * 0.07 + Math.abs(u) * h * 0.07;
    g.lineWidth = tw * 0.75; g.beginPath(); g.moveTo(tx, fy + h * 0.02); g.quadraticCurveTo(tx + u * cw * 0.3, fy - h * 0.02, ex, ey); g.stroke(); ends.push([ex, ey]);
  }
  g.beginPath();
  for (let k = 0; k < 22; k++) { const u = r() * 2 - 1, cx = tx + u * cw, cy = ty + h * 0.06 - (1 - u * u) * h * 0.1 * (0.4 + r() * 0.9); blob(g, cx, cy, h * (0.045 + r() * 0.05)); }
  g.fill();
  g.lineWidth = Math.max(1, h * 0.006);
  for (let i = 0; i < vines; i++) { const [ex, ey] = ends[(r() * ends.length) | 0], len = h * (0.15 + r() * 0.4), sw = (r() - 0.5) * len * 0.2; g.beginPath(); g.moveTo(ex, ey); g.quadraticCurveTo(ex + sw, ey + len * 0.6, ex + sw * 0.4, ey + len); g.stroke(); }
}

// Un palmier : stipe courbe, couronne de palmes retombantes.
function palm(g, x, by, h, r) {
  const lean = (r() - 0.5) * h * 0.35, tx = x + lean, ty = by - h;
  g.lineCap = 'round'; g.lineWidth = h * 0.028 + 1; g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + lean * 0.2, by - h * 0.55, tx, ty); g.stroke();
  const n = 9, L = h * (0.3 + r() * 0.1);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.04 + 0.92 * (i + r() * 0.5) / n), dx = Math.cos(a), dy = Math.sin(a);
    const cx = tx + dx * L * 0.55, cy = ty + dy * L * 0.55 - L * 0.12, ex = tx + dx * L, ey = ty + dy * L * 0.45 + L * 0.42;
    g.lineWidth = Math.max(1, h * 0.008); g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    g.lineWidth = Math.max(0.8, h * 0.005); g.beginPath();
    for (let t = 0.12; t < 1; t += 0.06) {
      const px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * ey, ll = L * 0.24 * (1 - t * 0.55);
      g.moveTo(px, py); g.lineTo(px - dy * ll * 0.25 + dx * ll * 0.3, py + ll); g.moveTo(px, py); g.lineTo(px + dx * ll * 0.55, py + ll * 0.75);
    }
    g.stroke();
  }
}

// Un tepuy : une montagne-table, falaises raides et sommet plat.
function tepui(g, x, by, w, h, r) {
  g.beginPath(); g.moveTo(x - w * 0.5 - h * 0.9, by + 4); g.quadraticCurveTo(x - w * 0.5 - h * 0.25, by - h * 0.35, x - w * 0.5 - h * 0.08, by - h * 0.55);
  g.lineTo(x - w * 0.5, by - h * (0.93 + r() * 0.05));
  let px = x - w * 0.5; while (px < x + w * 0.5) { px += w * (0.08 + r() * 0.16); g.lineTo(Math.min(px, x + w * 0.5), by - h * (0.94 + r() * 0.06)); }
  g.lineTo(x + w * 0.5 + h * 0.06, by - h * 0.5); g.quadraticCurveTo(x + w * 0.5 + h * 0.3, by - h * 0.3, x + w * 0.5 + h * 1.1, by + 4); g.fill();
}

// Un tronc géant qui traverse tout l'écran, avec ses contreforts, ses branches et ses lianes.
function giant(g, x, TH, by, w, S, r) {
  const sway = (r() - 0.5) * w * 0.8, f = w * (1.1 + r() * 0.8);
  g.beginPath(); g.moveTo(x - w * 0.5 - f, TH + 10); g.quadraticCurveTo(x - w * 0.55, by - S * 0.5, x - w * 0.5 + sway * 0.3, by - S * 5);
  g.lineTo(x - w * 0.42 + sway, -20); g.lineTo(x + w * 0.42 + sway, -20); g.lineTo(x + w * 0.5 + sway * 0.3, by - S * 5); g.quadraticCurveTo(x + w * 0.55, by - S * 0.5, x + w * 0.5 + f, TH + 10); g.fill();
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {                 // branches maîtresses, avec leurs paquets de feuilles et d'épiphytes
    const dir = r() < 0.5 ? -1 : 1, y0 = by - S * (6.5 + r() * 5), len = S * (4 + r() * 5), ex = x + sway * 0.6 + dir * len, ey = y0 - len * (0.25 + r() * 0.3);
    g.lineWidth = w * (0.22 + r() * 0.14); g.beginPath(); g.moveTo(x + sway * 0.5, y0 + w * 0.2); g.quadraticCurveTo(x + sway * 0.5 + dir * len * 0.5, y0 - len * 0.02, ex, ey); g.stroke();
    g.beginPath(); for (let k = 0; k < 9; k++) blob(g, ex + (r() - 0.5) * len * 0.7, ey - r() * len * 0.22, S * (0.5 + r() * 0.7)); g.fill();
    for (let k = 0; k < 4; k++) {                // lianes qui pendent de la branche
      const t = 0.25 + r() * 0.75, lx = x + sway * 0.5 + dir * len * t, ly = y0 - len * 0.2 * t, ll = S * (2 + r() * 7), sw = (r() - 0.5) * S * 1.2;
      g.lineWidth = Math.max(1, S * (0.03 + r() * 0.03)); g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo(lx + sw, ly + ll * 0.6, lx + sw * 0.3, ly + ll); g.stroke();
    }
    const bx = x + sway * 0.5 + dir * len * (0.35 + r() * 0.3), byy = y0 - len * 0.1 - w * 0.1;   // une broméliacée posée sur la branche
    g.lineWidth = Math.max(1, S * 0.035); g.beginPath(); for (let k = 0; k < 9; k++) { const a = -Math.PI * (0.08 + 0.84 * k / 8), ll = S * (0.45 + r() * 0.3); g.moveTo(bx, byy); g.quadraticCurveTo(bx + Math.cos(a) * ll * 0.6, byy + Math.sin(a) * ll, bx + Math.cos(a) * ll, byy + Math.sin(a) * ll * 0.55); } g.stroke();
  }
}

// De grandes feuilles et des frondes qui dépassent d'une cime.
function fronds(g, x, by, S, r) {
  const n = 5 + ((r() * 4) | 0);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.12 + 0.76 * (i + r() * 0.6) / n), L = S * (0.9 + r() * 1.3), ex = x + Math.cos(a) * L, ey = by + Math.sin(a) * L * 0.9 + L * 0.15, w = L * 0.17, nx = -Math.sin(a), ny = Math.cos(a);
    g.moveTo(x, by); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + nx * w, by + Math.sin(a) * L * 0.5 + ny * w, ex, ey); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 - nx * w, by + Math.sin(a) * L * 0.5 - ny * w, x, by);
  }
  g.fill();
}

function makeTile(TW, TH, draw, colTop, colBot, y0, y1) {
  const c = document.createElement('canvas'); c.width = TW; c.height = TH; const g = c.getContext('2d');
  g.fillStyle = g.strokeStyle = '#000';
  for (const off of [-TW, 0, TW]) { g.save(); g.translate(off, 0); draw(g); g.restore(); }   // trois passes décalées : la bande se raccorde sur elle-même
  g.globalCompositeOperation = 'source-in';
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, colTop); gr.addColorStop(1, colBot);
  g.fillStyle = gr; g.fillRect(0, 0, TW, TH);
  return c;
}

// Construit tout le décor pour une taille d'écran donnée. W, H : écran en pixels réels ; S : pixels par mètre ; baseY : hauteur à l'écran du sol du monde.
export function buildDecor(W, H, S, baseY, seed = 7) {
  const TW = Math.max(2048, Math.ceil(W * 1.5)), D = { TW };
  const yw = (y) => baseY - y * S;

  // Le ciel, le soleil derrière les arbres, quelques voiles de nuages.
  const sky = document.createElement('canvas'); sky.width = W; sky.height = H; { const g = sky.getContext('2d');
    const hor = yw(2.2), top = Math.min(0, yw(15.5)), gr = g.createLinearGradient(0, top, 0, hor);
    for (const [t, c] of PAL.sky) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const sx = W * 0.7, sy = yw(5.4), r = rnd(seed + 11);
    for (let i = 0; i < 7; i++) {                // voiles de nuages, étirés à l'horizontale
      const cx = r() * W, cy = yw(4 + r() * 8), rx = S * (5 + r() * 9), ry = S * (0.35 + r() * 0.5);
      g.save(); g.translate(cx, cy); g.scale(1, ry / rx); const cg = g.createRadialGradient(0, 0, 0, 0, 0, rx); cg.addColorStop(0, `rgba(${PAL.astre[0]},0.26)`); cg.addColorStop(1, `rgba(${PAL.astre[0]},0)`); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
    }
    let sg = g.createRadialGradient(sx, sy, 0, sx, sy, S * 13); sg.addColorStop(0, `rgba(${PAL.astre[0]},0.95)`); sg.addColorStop(0.12, `rgba(${PAL.astre[1]},0.6)`); sg.addColorStop(0.45, `rgba(${PAL.astre[2]},0.2)`); sg.addColorStop(1, `rgba(${PAL.astre[2]},0)`);
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    sg = g.createRadialGradient(sx, sy, 0, sx, sy, S * 1.5); sg.addColorStop(0, 'rgba(255,255,244,1)'); sg.addColorStop(0.7, 'rgba(255,252,230,0.95)'); sg.addColorStop(1, 'rgba(255,246,210,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, S * 1.5, 0, TAU); g.fill();
    D.sun = { x: sx, y: sy };
  }
  D.sky = sky;

  // Les rayons : des faisceaux de lumière qui descendent du soleil à travers la forêt.
  const rays = document.createElement('canvas'); rays.width = W; rays.height = H; { const g = rays.getContext('2d'), r = rnd(seed + 5), { x: sx, y: sy } = D.sun, L = Math.hypot(W, H);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (-0.12 + 1.24 * (i + r() * 0.7) / 9), wd = 0.02 + r() * 0.04, gr = g.createLinearGradient(sx, sy, sx + Math.cos(a) * L * 0.75, sy + Math.sin(a) * L * 0.75);
      gr.addColorStop(0, `rgba(${PAL.glow},0)`); gr.addColorStop(0.08, `rgba(${PAL.glow},${0.1 + r() * 0.1})`); gr.addColorStop(1, `rgba(${PAL.glow},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - wd) * L, sy + Math.sin(a - wd) * L); g.lineTo(sx + Math.cos(a + wd) * L, sy + Math.sin(a + wd) * L); g.fill();
    }
  }
  D.rays = rays;

  // Les quatre plans de forêt, du plus lointain au plus proche.
  const P = PAL.layers;
  D.layers = [
    { par: 0.03, c: makeTile(TW, H, (g) => { const r = rnd(seed + 1), by = yw(3.4);
        for (let i = 0; i < 4; i++) tepui(g, TW * (i + 0.2 + r() * 0.6) / 4, by, S * (4 + r() * 7), S * (3.5 + r() * 4.5), r);
        canopy(g, TW, H, by, S * 0.5, S * 1.4, r, 2); }, P[0].top, P[0].bot, yw(11), yw(3)) },
    { par: 0.08, c: makeTile(TW, H, (g) => { const r = rnd(seed + 2), by = yw(2.7);
        for (let i = 0; i < 9; i++) umbrella(g, TW * (i + r()) / 9, by + S * 0.3, S * (2.6 + r() * 2.6), r, 0);
        canopy(g, TW, H, by, S * 0.9, S * 0.9, r, 3); }, P[1].top, P[1].bot, yw(8), yw(1.6)) },
    { par: 0.18, c: makeTile(TW, H, (g) => { const r = rnd(seed + 3), by = yw(1.9);
        for (let i = 0; i < 7; i++) umbrella(g, TW * (i + r()) / 7, by + S * 0.5, S * (5 + r() * 4.5), r, 4);
        for (let i = 0; i < 5; i++) palm(g, TW * (i + r()) / 5, by + S * 0.3, S * (3.2 + r() * 2.4), r);
        canopy(g, TW, H, by, S * 1.2, S * 1.1, r, 4); }, P[2].top, P[2].bot, yw(11), yw(0.4)) },
    { par: 0.42, c: makeTile(TW, H, (g) => { const r = rnd(seed + 4), by = yw(0.9), n = Math.max(3, Math.round(TW / (S * 13)));
        for (let i = 0; i < n; i++) giant(g, TW * (i + 0.25 + r() * 0.5) / n, H, by, S * (1.1 + r() * 1.1), S, r);
        for (let i = 0; i < 6; i++) palm(g, TW * (i + r()) / 6, by + S * 0.4, S * (3.5 + r() * 3), r);
        canopy(g, TW, H, by, S * 1.1, S * 1.3, r, 5); }, P[3].top, P[3].bot, yw(13), yw(0)) },
  ];

  // Le plan du jeu : la cime des arbres en bas (on y rebondit) et le feuillage d'où pendent les lianes en haut.
  const fh = Math.ceil(S * 5.2), fTop = baseY - S * 2.7;   // la cime est tenue assez bas pour que le singe reste lisible au creux du balancement
  D.floor = { y: fTop, h: fh, c: makeTile(TW, fh, (g) => { const r = rnd(seed + 6), by = S * 3.0;
      for (let i = 0; i < 9; i++) fronds(g, TW * (i + r()) / 9, by - S * (0.2 + r() * 0.5), S, r);
      for (let i = 0; i < 3; i++) palm(g, TW * (i + r()) / 3, by + S * 0.6, S * (2 + r() * 1.2), r);
      canopy(g, TW, fh, by, S * 0.75, S * 0.85, r, 6); }, PAL.play.top, PAL.play.bot, S * 1.2, S * 4.6) };
  const th = Math.ceil(S * 5.4), tTop = yw(16.4);
  D.top = { y: tTop, h: th, c: makeTile(TW, th, (g) => { const r = rnd(seed + 8), edge = yw(12.1) - tTop;
      g.beginPath();
      for (let x = -S * 2; x < TW + S * 2; x += S * (0.45 + r() * 0.6)) {
        const dip = 0.5 + 0.5 * Math.sin(x / TW * TAU * 5 + 1.3), y = edge - S * (0.5 + dip * 0.8) - r() * S * 0.5, rr = S * (0.6 + r() * 0.75);
        blob(g, x, y, rr); blob(g, x + (r() - 0.5) * S, y - S * (0.4 + r() * 0.6), S * (0.7 + r() * 0.5)); blob(g, x, S * (1.9 + r() * 0.5), S * (0.7 + r() * 0.75));
      }
      g.fill();
      g.lineCap = 'round';
      for (let x = 0; x < TW; x += S * (1.2 + r() * 2.6)) {            // petites lianes et grappes de feuilles qui pendent
        const ll = S * (0.5 + r() * 2.2), sw = (r() - 0.5) * S * 0.5, y0 = edge - S * 0.6;
        g.lineWidth = Math.max(1, S * 0.04); g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + sw, y0 + ll * 0.6, x + sw * 0.5, y0 + ll); g.stroke();
        if (r() < 0.6) { g.beginPath(); for (let k = 0; k < 4; k++) { const t = 0.4 + k * 0.18, lx = x + sw * t, ly = y0 + ll * t; g.ellipse(lx + (k % 2 ? 1 : -1) * S * 0.12, ly, S * 0.17, S * 0.07, (k % 2 ? 0.6 : -0.6) + 1.57, 0, TAU); } g.fill(); }
      }
      for (let i = 0; i < 7; i++) { g.save(); g.translate(TW * (i + r()) / 7, edge - S * 0.5); g.scale(1, -1); fronds(g, 0, 0, S * 0.8, r); g.restore(); }
    }, PAL.play.bot, PAL.play.top, 0, th) };

  // Trois grandes feuilles floues, pour le tout premier plan.
  D.near = [0, 1, 2].map((k) => { const n = 72, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), r = rnd(seed + 20 + k);
    g.fillStyle = PAL.near; g.translate(n / 2, n * 0.92); fronds(g, 0, 0, n * 0.34, r);
    const big = document.createElement('canvas'); big.width = big.height = 512; const b = big.getContext('2d'); b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.drawImage(c, 0, 0, 512, 512); return big; });

  // Le point de lumière d'une luciole, et l'assombrissement des bords.
  const dot = document.createElement('canvas'); dot.width = dot.height = 48; { const g = dot.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, 'rgba(255,248,200,1)'); gr.addColorStop(0.25, 'rgba(255,236,150,0.55)'); gr.addColorStop(1, 'rgba(255,230,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); }
  D.dot = dot;
  const vig = document.createElement('canvas'); vig.width = Math.ceil(W / 4); vig.height = Math.ceil(H / 4); { const g = vig.getContext('2d'), w = vig.width, h = vig.height, gr = g.createRadialGradient(w * 0.55, h * 0.5, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.62); gr.addColorStop(0, 'rgba(2,18,22,0)'); gr.addColorStop(1, 'rgba(2,18,22,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  D.vig = vig;
  return D;
}

// Dessine une bande répétée, décalée selon la caméra.
export function drawTile(ctx, c, TW, off, y, W) {
  let x = -(((off % TW) + TW) % TW);
  for (; x < W; x += TW) ctx.drawImage(c, Math.round(x), Math.round(y));
}
