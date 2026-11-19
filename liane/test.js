// LIANE — la partie : le monde est un film, le singe, ses lianes, les pièges et les fruits sont calculés en direct par-dessus.
// Toucher = lâcher la liane ; glisser = viser le couloir de gauche ou de droite. Les règles sont dans jeu.js, ici il n'y a que l'affichage.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Beast } from '../betes.js?v=5';
import { Jeu, G, AY, LANES } from './jeu.js?v=6';

const VERSION = 'test 6 · la partie';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;

// ---------- Réglages ----------
const HAZE = new THREE.Color('#8e7d45');     // brume dorée relevée dans le film, au point de fuite
const SINGE = { fSwing: 0.82, fKnee: 1.0, hSwing: 0.86, hKnee: 1.1, hindLag: 0.46, lr: 0.08, spine: 0.15, bob: 0.05, pitch: 0.06, tail: 0.14, crouch: 0.85 };

// ---------- Le film, en boucle fondue ----------
const films = [$('filmA'), $('filmB')]; let cur = 0, fading = false;
function playFilm() { films[cur].play().catch(() => {}); }
function loopFilm() {
  const a = films[cur], b = films[1 - cur];
  if (!a.duration || fading) return;
  if (a.currentTime > a.duration - 1.1) {
    fading = true; b.currentTime = 0; b.play().catch(() => {});
    b.style.transition = a.style.transition = 'opacity 1s linear'; b.style.opacity = 1; a.style.opacity = 0;
    setTimeout(() => { a.pause(); cur = 1 - cur; fading = false; }, 1050);
  }
}

// ---------- Rendu : une couche transparente posée sur le film ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.insertBefore(renderer.domElement, $('note'));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 140);

// La lumière du film : soleil chaud en haut à gauche, devant ; ciel clair au-dessus, vert des feuilles en dessous.
const sun = new THREE.DirectionalLight('#ffd9a3', 3.4); scene.add(sun); scene.add(sun.target);
scene.add(new THREE.HemisphereLight('#d7e6ff', '#42561f', 1.25));
const fill = new THREE.DirectionalLight('#c9d8a0', 0.7); scene.add(fill); scene.add(fill.target);

// ---------- Matières ----------
const texLoader = new THREE.TextureLoader();
const tex = (n) => new Promise((ok, ko) => texLoader.load('assets/' + n, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t); }, undefined, ko));
function normalFrom(t, strength) {
  const w = 512, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(t.image, 0, 0, w, h);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const Lm = (x, y) => { const i = (((y + h) % h) * w + ((x + w) % w)) * 4; return (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (Lm(x + 1, y) - Lm(x - 1, y)) * strength, dy = (Lm(x, y + 1) - Lm(x, y - 1)) * strength, n = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx * n * 0.5 + 0.5) * 255; d[i + 1] = (dy * n * 0.5 + 0.5) * 255; d[i + 2] = (n * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const nt = new THREE.CanvasTexture(c); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; return nt;
}
function blurred(t, px) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.filter = `blur(${px}px)`; g.drawImage(t.image, 16, 16, 480, 480);
  const bt = new THREE.CanvasTexture(c); bt.colorSpace = THREE.SRGBColorSpace; return bt;
}
// Fond dans la brume : au loin, la matière prend la couleur de l'air du film puis disparaît.
function haze(mat, near, far) {
  mat.transparent = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = { value: HAZE }; sh.uniforms.uNear = { value: near }; sh.uniforms.uFar = { value: far };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDepthA;').replace('#include <project_vertex>', '#include <project_vertex>\nvDepthA = -mvPosition.z;');
    sh.fragmentShader = 'uniform vec3 uHaze; uniform float uNear; uniform float uFar; varying float vDepthA;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float hz = smoothstep(uNear, uFar, vDepthA);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, hz * 0.85);
      gl_FragColor.a *= 1.0 - smoothstep(uFar * 0.72, uFar, vDepthA);
      gl_FragColor.a *= smoothstep(1.6, 4.6, vDepthA);`);   // ce qui frôle l'objectif s'efface au lieu de boucher l'écran
  };
  return mat;
}

const [tMoss, tLeaf, gMonkey] = await Promise.all([tex('mousse.webp'), tex('feuilles.webp'), new Promise((ok, ko) => new GLTFLoader().load('assets/singe-rig.glb', ok, undefined, ko))]);
tMoss.wrapS = tMoss.wrapT = THREE.RepeatWrapping;
const mossN = normalFrom(tMoss, 5);
const ropeMat = haze(new THREE.MeshStandardMaterial({ map: tMoss, normalMap: mossN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.9, metalness: 0, color: '#e9dcae', emissive: new THREE.Color('#2a2410'), emissiveIntensity: 0.6 }), 14, 60);
const leafMat = haze(new THREE.MeshStandardMaterial({ map: tLeaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, color: '#9aa57a', emissive: new THREE.Color('#1c2e0a'), emissiveIntensity: 0.35 }), 14, 60);
const nearLeafMat = new THREE.MeshBasicMaterial({ map: blurred(tLeaf, 7), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0.2, 0.26, 0.12), opacity: 0.92 });

// Matière sèche pour la liane pourrie : la même fibre, sans sa mousse, grise et cassante.
function dryFrom(t) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.drawImage(t.image, 0, 0, 512, 512);
  const im = g.getImageData(0, 0, 512, 512), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.pow((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, 0.8);
    d[i] = 52 + l * 150; d[i + 1] = 40 + l * 124; d[i + 2] = 30 + l * 92;
  }
  g.putImageData(im, 0, 0);
  const dt = new THREE.CanvasTexture(c); dt.colorSpace = THREE.SRGBColorSpace; dt.wrapS = dt.wrapT = THREE.RepeatWrapping; dt.anisotropy = 8; return dt;
}
const dryMat = haze(new THREE.MeshStandardMaterial({ map: dryFrom(tMoss), normalMap: mossN, normalScale: new THREE.Vector2(2.2, 2.2), roughness: 1, metalness: 0, color: '#f1e4cb', emissive: new THREE.Color('#3a2c1c'), emissiveIntensity: 0.6 }), 14, 60);
const fruitMat = haze(new THREE.MeshStandardMaterial({ color: '#c9661a', roughness: 0.5, metalness: 0, emissive: new THREE.Color('#4a1c04'), emissiveIntensity: 0.3 }), 14, 60);
const stemMat = haze(new THREE.MeshStandardMaterial({ color: '#4a3b22', roughness: 1 }), 14, 60);

// ---------- Les lianes ----------
// Une vraie corde végétale torsadée, accrochée dans la canopée. Elle pivote autour de son point d'accroche.
const LEN = 16, quad = new THREE.PlaneGeometry(1, 1);
const ropeGeo = (() => {
  const g = new THREE.CylinderGeometry(0.05, 0.07, LEN, 7, 48, true).translate(0, -LEN / 2, 0), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)), tw = 1 + 0.35 * Math.sin(a * 2 + y * 2.4);       // deux brins enroulés
    p.setX(i, p.getX(i) * tw + 0.035 * Math.sin(y * 1.7)); p.setZ(i, p.getZ(i) * tw + 0.035 * Math.cos(y * 1.3));
    uv.setXY(i, uv.getX(i) * 1, uv.getY(i) * 9);
  }
  g.computeVertexNormals(); return g;
})();
const strandGeo = new THREE.CylinderGeometry(0.004, 0.011, 0.55, 4, 1).translate(0, -0.275, 0);
const stemGeo = new THREE.CylinderGeometry(0.012, 0.009, 5.4, 5, 1).translate(0, 2.7, 0);
const fruitGeo = new THREE.SphereGeometry(1, 14, 10);
const rnd = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function buildLiana(li) {
  const r = rnd(li.seed), g = new THREE.Group(), L = li.len + 0.5;
  g.position.set(li.x, AY, li.z);
  const rope = new THREE.Mesh(ropeGeo, li.rotten ? dryMat : ropeMat); rope.scale.y = L / LEN; g.add(rope);
  if (!li.rotten) for (let i = 0; i < 6; i++) {            // quelques feuilles le long de la liane
    const s = 0.28 + r() * 0.32, leaf = new THREE.Mesh(quad, leafMat);
    leaf.scale.set(s, s, 1); leaf.position.set((r() - 0.5) * 0.22, -1.5 - r() * (L - 2.5), (r() - 0.5) * 0.22); leaf.rotation.set(r() * 0.6, r() * 6.28, r() * 6.28); g.add(leaf);
  }
  else {                                                   // la liane pourrie : nue, plus mince, des fibres qui se détachent
    rope.scale.x = rope.scale.z = 0.78; g.rotation.z = (r() - 0.5) * 0.07;
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(strandGeo, dryMat), a = r() * 6.28, tilt = 0.5 + r() * 0.9;
      s.position.set(0, -3 - r() * (L - 3.5), 0); s.rotation.set(Math.cos(a) * tilt, 0, Math.sin(a) * tilt); s.scale.setScalar(0.7 + r() * 0.9); g.add(s);
    }
  }
  scene.add(g); li.g = g; li.fallY = 0; li.fallV = 0;
}
function buildFruit(f) {
  const r = rnd(f.seed), g = new THREE.Group(); g.position.set(f.x, f.y, f.z);
  g.add(new THREE.Mesh(stemGeo, stemMat));                 // la tige qui le porte, accrochée plus haut
  const bunch = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(fruitGeo, fruitMat), s = 0.07 + r() * 0.025, a = i * 1.7 + r();
    m.scale.set(s, s * 1.12, s); m.position.set(Math.cos(a) * 0.09 * (i ? 1 : 0), -0.05 - i * 0.07, Math.sin(a) * 0.09 * (i ? 1 : 0)); bunch.add(m);
  }
  const leaf = new THREE.Mesh(quad, leafMat); leaf.scale.setScalar(0.3); leaf.position.set(0.1, 0.12, 0); leaf.rotation.set(0.4, r() * 6.28, 0.6); bunch.add(leaf);
  g.add(bunch); scene.add(g); f.g = g; f.bunch = bunch; f.k = 1;
}

// Feuilles floues qui passent tout près de l'objectif, sur les bords.
const nears = [];
for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(quad, nearLeafMat.clone()); m.renderOrder = 10; scene.add(m); nears.push(m); m.position.z = -999; }
function resetNear(m, z) { const side = Math.random() < 0.5 ? -1 : 1, s = 2.6 + Math.random() * 2.2; m.scale.set(s, s, 1); m.userData.side = side; m.userData.dy = -0.6 + Math.random() * 2; m.position.z = z; m.rotation.set(0, side * -0.5, Math.random() * 6.28); }

// ---------- Le singe ----------
const fur = (m) => {
  const mat = new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.93, metalness: 0, color: '#69655e' });
  mat.onBeforeCompile = (sh) => {   // liseré chaud : le soleil du film découpe le pelage par l'arrière
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(1.0, 0.72, 0.36) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.2) * 0.22;`);
  };
  return mat;
};
const monkey = new Beast(gMonkey, { length: +(params.get('taille') || 1.9), material: fur, gait: SINGE });
scene.add(monkey.root);
const hA = new THREE.Vector3(), hB = new THREE.Vector3(), hands = new THREE.Vector3(), grip = new THREE.Vector3();
// Place le singe pour que ses mains soient exactement au point de prise sur la liane.
function placeByHands(p) {
  monkey.root.position.set(0, 0, 0); monkey.root.updateMatrixWorld(true);
  for (const [n, v] of [['FL', hA], ['FR', hB]]) {
    const w = monkey.bones[n + '3'].getWorldPosition(new THREE.Vector3()), e = monkey.bones[n + '2'].getWorldPosition(new THREE.Vector3());
    v.copy(w).add(w.clone().sub(e).multiplyScalar(0.75));      // un peu au-delà du poignet : la paume
  }
  hands.copy(hA).add(hB).multiplyScalar(0.5);
  monkey.root.position.copy(p).sub(hands);
}

// ---------- La partie ----------
const auto = params.has('auto');
let jeu = null, record = 0, time = 0, last = performance.now() / 1000, tOver = -1, shownDist = -1, shownFruits = -1;
try { record = +localStorage.getItem('liane-record') || 0; } catch (e) { /* stockage indisponible : le record ne sera pas gardé */ }
function newGame(z0) {
  if (jeu) { for (const o of jeu.lianas) scene.remove(o.g); for (const o of jeu.fruits) scene.remove(o.g); }
  jeu = new Jeu({ seed: +(params.get('graine') || 0) || (Math.random() * 1e9) | 0, z0, n0: +(params.get('rang') || 0), onLiana: buildLiana, onFruit: buildFruit });
  camera.userData.z = camera.userData.y = undefined; tOver = -1;
  $('fin').classList.remove('show'); $('hud').classList.remove('off');
}
function endGame() {
  const d = Math.floor(jeu.S.dist), best = d > record;
  if (best) { record = d; try { localStorage.setItem('liane-record', String(d)); } catch (e) { /* rien */ } }
  $('finDist').textContent = d; $('finFruits').textContent = jeu.S.fruits ? jeu.S.fruits + (jeu.S.fruits > 1 ? ' fruits' : ' fruit') : '';
  $('finRec').textContent = best && d > 0 ? 'nouveau record' : 'record ' + record + ' m';
  $('fin').classList.add('show'); $('hud').classList.add('off');
}

// Toucher = lâcher. Glisser le doigt de côté pendant l'élan = viser le couloir voisin.
let sx = null, steered = false;
function press() {
  playFilm(); $('note').style.opacity = 0;
  if (jeu.S.over) { if (tOver >= 0 && time - tOver > 0.9) newGame(jeu.S.pos.z + 6); return; }
  jeu.release();
}
addEventListener('pointerdown', (e) => { e.preventDefault(); sx = e.clientX; steered = false; press(); }, { passive: false });
addEventListener('pointermove', (e) => {
  if (sx === null || steered) return;
  const dx = e.clientX - sx; if (Math.abs(dx) > Math.max(22, innerWidth * 0.06)) { steered = true; jeu.steer(Math.sign(dx)); }
});
addEventListener('pointerup', () => { sx = null; }); addEventListener('pointercancel', () => { sx = null; });
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') press(); else if (e.code === 'ArrowLeft') jeu.steer(-1); else if (e.code === 'ArrowRight') jeu.steer(1);
});

function frame() {
  requestAnimationFrame(frame);
  // Les règles avancent au temps réel, par petits pas : un à-coup d'affichage ne fait pas rater une liane.
  const tn = performance.now() / 1000, real = Math.min(0.25, tn - last); last = tn; time += real;
  const n = Math.max(1, Math.ceil(real / 0.0125)); for (let i = 0; i < n; i++) jeu.step(real / n, auto);
  for (const o of jeu.prune()) scene.remove(o.g);
  const dt = Math.min(0.033, real), S = jeu.S;
  loopFilm();
  if (S.over && tOver < 0) { tOver = time; setTimeout(endGame, 450); }
  if (auto && S.over && time - tOver > 2.5) newGame(S.pos.z + 6);

  // Les lianes : celle qu'on tient suit le singe ; les autres se balancent doucement et reviennent quand on les lâche.
  for (const l of jeu.lianas) {
    if (!l.held) { const rest = 0.05 * Math.sin(time * 0.7 + l.ph); l.angV += ((rest - l.ang) * 5 - l.angV * 0.9) * dt; l.ang += l.angV * dt; }
    if (l.broken) { l.fallV += G * dt; l.fallY += l.fallV * dt; }       // la liane pourrie qui a cédé tombe avec lui
    l.g.rotation.x = -l.ang; l.g.position.y = AY - l.drop - l.fallY;
  }
  for (const f of jeu.fruits) {
    if (f.taken && f.k > 0) { f.k = Math.max(0, f.k - dt * 7); f.bunch.scale.setScalar(f.k); f.bunch.visible = f.k > 0; }
    f.g.rotation.z = 0.04 * Math.sin(time * 0.9 + f.seed);
  }

  // Le singe : suspendu par les bras le long de la liane, ou tendu dans le sens de son vol.
  if (S.mode === 'hang') {
    const lag = clamp(S.om * 0.22, -0.35, 0.35);                    // le corps traîne un peu derrière la liane
    monkey.update(dt, { phase: 0, run: 0, crouch: 0, air: -1, hang: 1, bodyPitch: -Math.PI / 2 - S.th + lag, legs: clamp(S.om * 0.35, -0.5, 0.6) });
  } else {
    const a = Math.atan2(S.vel.y, Math.max(0.5, S.vel.z)), fall = S.mode === 'fallen' ? 1 : 0;
    monkey.update(dt, { phase: 0, run: 0, crouch: 0, air: -1, hang: 0.85, bodyPitch: -a - 0.35, legs: 0.5 + fall * 0.3 * Math.sin(time * 9) });
  }
  placeByHands(grip.set(S.pos.x, S.pos.y, S.pos.z));

  // Caméra : derrière, un peu au-dessus, pour lire l'arc du balancement et les trois couloirs. Elle ne suit pas la chute jusqu'en bas.
  const cz = S.pos.z - 6.6, cy = Math.max(S.pos.y, AY - 12.5) + 0.35;
  camera.userData.z = camera.userData.z === undefined ? cz : camera.userData.z + (cz - camera.userData.z) * Math.min(1, dt * 3.2);
  camera.userData.y = camera.userData.y === undefined ? cy : camera.userData.y + (cy - camera.userData.y) * Math.min(1, dt * 2.2);
  camera.position.set(S.pos.x * 0.6 + 0.55 + Math.sin(time * 0.6) * 0.04, camera.userData.y, camera.userData.z);
  camera.lookAt(S.pos.x * 0.75 - 0.1, camera.userData.y - 0.75, camera.userData.z + 12);
  sun.position.set(camera.position.x - 5, camera.position.y + 9, camera.position.z + 12); sun.target.position.copy(grip);
  fill.position.set(camera.position.x + 3, camera.position.y + 1, camera.position.z - 2); fill.target.position.copy(grip);
  for (const m of nears) {
    const rel = m.position.z - camera.position.z;
    if (rel < -1 || rel > 90) resetNear(m, camera.position.z + 30 + Math.random() * 40);
    m.position.x = camera.position.x + m.userData.side * (1.5 + (m.userData.dy + 1) * 0.15); m.position.y = camera.position.y + m.userData.dy - 0.6;
    m.material.opacity = 0.92 * clamp((7 - rel) / 4, 0, 1); m.visible = m.material.opacity > 0.01;
  }

  // L'affichage : la distance, et les fruits dès qu'il y en a un.
  const d = Math.floor(S.dist);
  if (d !== shownDist) { shownDist = d; $('dist').textContent = d; }
  if (S.fruits !== shownFruits) { shownFruits = S.fruits; $('fruits').textContent = S.fruits ? S.fruits + (S.fruits > 1 ? ' fruits' : ' fruit') : ''; }
  renderer.render(scene, camera);
}

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize); resize();
newGame(0);
$('version').textContent = VERSION;
$('chargement').classList.add('hide');
playFilm();
frame();
window.LIANE = { monkey, camera, get jeu() { return jeu; }, newGame };
