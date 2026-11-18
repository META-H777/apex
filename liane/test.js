// LIANE — test d'intégration (voie A) : le monde est un film, le singe et ses lianes sont calculés en direct par-dessus.
// Le singe se balance de liane en liane, vu de dos. Toucher = lâcher et s'élancer ; il attrape la liane suivante si elle est à portée.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Beast } from '../betes.js?v=5';

const VERSION = 'test 5 · lianes';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;

// ---------- Réglages ----------
const HAZE = new THREE.Color('#8e7d45');     // brume dorée relevée dans le film, au point de fuite
const G = 13;                                // pesanteur (un peu adoucie, pour de beaux arcs)
const AY = 11;                               // hauteur d'accroche des lianes (hors champ, dans la canopée)
const REACH = 1.75;                          // portée des bras au rattrapage
const SWING = 0.82;                          // amplitude entretenue du balancement, en radians
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
      gl_FragColor.a *= 1.0 - smoothstep(uFar * 0.72, uFar, vDepthA);`);
  };
  return mat;
}

const [tMoss, tLeaf, gMonkey] = await Promise.all([tex('mousse.webp'), tex('feuilles.webp'), new Promise((ok, ko) => new GLTFLoader().load('assets/singe-rig.glb', ok, undefined, ko))]);
tMoss.wrapS = tMoss.wrapT = THREE.RepeatWrapping;
const mossN = normalFrom(tMoss, 5);
const ropeMat = haze(new THREE.MeshStandardMaterial({ map: tMoss, normalMap: mossN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.9, metalness: 0, color: '#e9dcae', emissive: new THREE.Color('#2a2410'), emissiveIntensity: 0.6 }), 14, 60);
const leafMat = haze(new THREE.MeshStandardMaterial({ map: tLeaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, color: '#9aa57a', emissive: new THREE.Color('#1c2e0a'), emissiveIntensity: 0.35 }), 14, 60);
const nearLeafMat = new THREE.MeshBasicMaterial({ map: blurred(tLeaf, 7), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0.2, 0.26, 0.12), opacity: 0.92 });

// ---------- Les lianes ----------
// Une vraie corde végétale torsadée, accrochée dans la canopée. Elle pivote autour de son point d'accroche.
function rnd(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
const lianas = []; let liSeed = 1, nextZ = 0;
function addLiana() {
  const r = rnd(liSeed++), g = new THREE.Group();
  const x = lianas.length ? clamp(lianas[lianas.length - 1].x + (r() - 0.5) * 1.6, -1.4, 1.4) : 0;
  g.position.set(x, AY, nextZ); g.add(new THREE.Mesh(ropeGeo, ropeMat));
  for (let i = 0; i < 6; i++) {            // quelques feuilles le long de la liane
    const s = 0.28 + r() * 0.32, leaf = new THREE.Mesh(quad, leafMat);
    leaf.scale.set(s, s, 1); leaf.position.set((r() - 0.5) * 0.22, -1.5 - r() * (LEN - 3), (r() - 0.5) * 0.22); leaf.rotation.set(r() * 0.6, r() * 6.28, r() * 6.28); g.add(leaf);
  }
  scene.add(g);
  const li = { g, x, z: nextZ, ang: 0, angV: 0, ph: r() * 6.28, held: false };
  lianas.push(li); nextZ += 6.1 + r() * 1.5;
  return li;
}
while (nextZ < 80) addLiana();

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
const hA = new THREE.Vector3(), hB = new THREE.Vector3(), hands = new THREE.Vector3();
// Place le singe pour que ses mains soient exactement au point de prise sur la liane.
function placeByHands(grip) {
  monkey.root.position.set(0, 0, 0); monkey.root.updateMatrixWorld(true);
  for (const [n, v] of [['FL', hA], ['FR', hB]]) {
    const w = monkey.bones[n + '3'].getWorldPosition(new THREE.Vector3()), e = monkey.bones[n + '2'].getWorldPosition(new THREE.Vector3());
    v.copy(w).add(w.clone().sub(e).multiplyScalar(0.75));      // un peu au-delà du poignet : la paume
  }
  hands.copy(hA).add(hB).multiplyScalar(0.5);
  monkey.root.position.copy(grip).sub(hands);
}

// ---------- Physique : pendule sur la liane, vol libre entre deux lianes ----------
const S = { mode: 'hang', li: lianas[1], R: 6.2, th: -SWING, om: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), lastZ: -1, fall: 0, count: 0 };
const anchorOf = (li) => new THREE.Vector3(li.x, AY, li.z);
let wantRelease = false, time = 0, last = performance.now() / 1000;
const auto = params.has('auto');
function press() { playFilm(); $('note').style.opacity = 0; if (S.mode === 'hang') wantRelease = true; }
addEventListener('pointerdown', (e) => { e.preventDefault(); press(); }, { passive: false });
addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) press(); });

function step(dt) {
  if (S.mode === 'hang') {
    const li = S.li;
    S.om += -(G / S.R) * Math.sin(S.th) * dt; S.th += S.om * dt;
    // Le singe entretient son élan, comme un enfant sur une balançoire.
    const E = 0.5 * S.R * S.R * S.om * S.om + G * S.R * (1 - Math.cos(S.th)), Emin = G * S.R * (1 - Math.cos(SWING));
    if (E < Emin) S.om += Math.sign(S.om || 1) * 1.1 * dt;
    S.pos.set(li.x, AY - S.R * Math.cos(S.th), li.z + S.R * Math.sin(S.th));
    li.ang = S.th; li.angV = S.om; li.held = true;
    if (auto && S.om > 0 && S.th > 0.44) wantRelease = true;
    if (wantRelease) {
      wantRelease = false; li.held = false; S.lastZ = li.z;
      S.vel.set(0, S.R * S.om * Math.sin(S.th), S.R * S.om * Math.cos(S.th)); S.mode = 'fly';
    }
  } else {
    S.vel.y -= G * dt; S.pos.addScaledVector(S.vel, dt);
    const next = lianas.find((l) => l.z > S.lastZ + 1);
    if (next) {
      S.pos.x += (next.x - S.pos.x) * Math.min(1, dt * 5);
      const dz = S.pos.z - next.z, dy = AY - S.pos.y;
      if (Math.abs(dz) < REACH && dy > 3.2 && dy < 10 && S.fall <= 0) {      // à portée : il l'attrape
        S.li = next; S.R = clamp(Math.hypot(dz, dy), 3.4, 9.8); S.th = Math.atan2(dz, dy);
        S.om = (S.vel.z * Math.cos(S.th) + S.vel.y * Math.sin(S.th)) / S.R; S.mode = 'hang'; S.count++;
      } else if (dz > REACH + 0.5) S.lastZ = next.z;                          // manquée : il vise la suivante
    }
    if (S.pos.y < AY - 22) {            // tombé : on le remet sur une liane (ce n'est qu'un test)
      const l = lianas.find((q) => q.z > S.pos.z + 3) || lianas[lianas.length - 1];
      S.li = l; S.R = 6.2; S.th = -SWING; S.om = 0; S.mode = 'hang';
    }
  }
}

function frame() {
  requestAnimationFrame(frame);
  // La physique avance au temps réel, par petits pas : un à-coup d'affichage ne fait pas rater une liane.
  const tn = performance.now() / 1000, real = Math.min(0.25, tn - last); last = tn; time += real;
  const n = Math.max(1, Math.ceil(real / 0.0125)); for (let i = 0; i < n; i++) step(real / n);
  const dt = Math.min(0.033, real);
  loopFilm();

  // Les lianes : celle qu'on tient suit le singe ; les autres se balancent doucement et reviennent quand on les lâche.
  for (const l of lianas) {
    if (!l.held) { const rest = 0.05 * Math.sin(time * 0.7 + l.ph); l.angV += ((rest - l.ang) * 5 - l.angV * 0.9) * dt; l.ang += l.angV * dt; }
    l.g.rotation.x = -l.ang;
  }
  while (nextZ < S.pos.z + 80) addLiana();
  while (lianas.length && lianas[0].z < S.pos.z - 22 && lianas[0] !== S.li) scene.remove(lianas.shift().g);

  // Le singe : suspendu par les bras le long de la liane, ou tendu dans le sens de son vol.
  if (S.mode === 'hang') {
    const lag = clamp(S.om * 0.22, -0.35, 0.35);                    // le corps traîne un peu derrière la liane
    monkey.update(dt, { phase: 0, run: 0, crouch: 0, air: -1, hang: 1, bodyPitch: -Math.PI / 2 - S.th + lag, legs: clamp(S.om * 0.35, -0.5, 0.6) });
  } else {
    const a = Math.atan2(S.vel.y, Math.max(0.5, S.vel.z));
    monkey.update(dt, { phase: 0, run: 0, crouch: 0, air: -1, hang: 0.85, bodyPitch: -a - 0.35, legs: 0.5 });
  }
  placeByHands(S.pos);

  // Caméra : derrière, un peu au-dessus et de côté, pour lire l'arc du balancement.
  const cz = S.pos.z - 6.6, cy = S.pos.y + 0.35;
  camera.userData.z = camera.userData.z === undefined ? cz : camera.userData.z + (cz - camera.userData.z) * Math.min(1, dt * 3.2);
  camera.userData.y = camera.userData.y === undefined ? cy : camera.userData.y + (cy - camera.userData.y) * Math.min(1, dt * 2.2);
  camera.position.set(S.pos.x * 0.5 + 1.15 + Math.sin(time * 0.6) * 0.04, camera.userData.y, camera.userData.z);
  camera.lookAt(S.pos.x * 0.6 - 0.25, camera.userData.y - 0.75, camera.userData.z + 12);
  sun.position.set(camera.position.x - 5, camera.position.y + 9, camera.position.z + 12); sun.target.position.copy(S.pos);
  fill.position.set(camera.position.x + 3, camera.position.y + 1, camera.position.z - 2); fill.target.position.copy(S.pos);
  for (const m of nears) {
    const rel = m.position.z - camera.position.z;
    if (rel < -1 || rel > 90) resetNear(m, camera.position.z + 30 + Math.random() * 40);
    m.position.x = camera.position.x + m.userData.side * (1.5 + (m.userData.dy + 1) * 0.15); m.position.y = camera.position.y + m.userData.dy - 0.6;
    m.material.opacity = 0.92 * clamp((7 - rel) / 4, 0, 1); m.visible = m.material.opacity > 0.01;
  }
  renderer.render(scene, camera);
}

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize); resize();
$('version').textContent = VERSION;
$('chargement').classList.add('hide');
playFilm();
frame();
window.LIANE = { monkey, camera, S, lianas };
