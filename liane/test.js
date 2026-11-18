// LIANE — test d'intégration (voie A) : le monde est un film, le singe et sa branche sont calculés en direct par-dessus.
// But du test : voir si le premier plan s'accorde au film (lumière, perspective, vitesse) ou s'il a l'air collé.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Beast } from '../betes.js';

const VERSION = 'test 3 · 19/11';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const L = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;

// ---------- Réglages d'accord avec le film ----------
const HAZE = new THREE.Color('#8e7d45');     // brume dorée relevée dans le film, au point de fuite
const SPEED = +(params.get('v') || 6.2);     // vitesse du premier plan, en mètres par seconde
const VP = { x: -0.14, y: 0.26 };            // point de fuite du film, en coordonnées d'écran (-1..1)
const TOP = 0.78;                            // hauteur du dessus de la branche
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
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 120);

// La lumière du film : soleil chaud en haut à gauche, devant ; ciel clair au-dessus, vert des feuilles en dessous.
const sun = new THREE.DirectionalLight('#ffd9a3', 3.4); sun.position.set(-5, 9, 7); scene.add(sun);
scene.add(new THREE.HemisphereLight('#d7e6ff', '#42561f', 1.25));
const fill = new THREE.DirectionalLight('#c9d8a0', 0.7); fill.position.set(3, 2, -6); scene.add(fill);   // rebond vert-doré venant de derrière nous

// ---------- Matières ----------
const texLoader = new THREE.TextureLoader();
const tex = (n) => new Promise((ok, ko) => texLoader.load('assets/' + n, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t); }, undefined, ko));
function normalFrom(t, strength) {
  const img = t.image, w = 512, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const Lm = (x, y) => { const i = (((y + h) % h) * w + ((x + w) % w)) * 4; return (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (Lm(x + 1, y) - Lm(x - 1, y)) * strength, dy = (Lm(x, y + 1) - Lm(x, y - 1)) * strength, n = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx * n * 0.5 + 0.5) * 255; d[i + 1] = (dy * n * 0.5 + 0.5) * 255; d[i + 2] = (n * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const nt = new THREE.CanvasTexture(c); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; return nt;
}
// Version floutée d'une texture, pour les feuilles tout près de l'objectif (comme la faible profondeur de champ du film).
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

const [tMoss, tLeaf, tLiana, gMonkey] = await Promise.all([tex('mousse.webp'), tex('feuilles.webp'), tex('liane.webp'), new Promise((ok, ko) => new GLTFLoader().load('assets/singe-rig.glb', ok, undefined, ko))]);
tMoss.wrapS = tMoss.wrapT = THREE.RepeatWrapping;
const mossN = normalFrom(tMoss, 5);
const branchMat = haze(new THREE.MeshStandardMaterial({ map: tMoss, normalMap: mossN, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.86, metalness: 0, color: '#c9cfae' }), 16, 58);
const leafMat = haze(new THREE.MeshStandardMaterial({ map: tLeaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, color: '#9aa57a', emissive: new THREE.Color('#1c2e0a'), emissiveIntensity: 0.35 }), 16, 58);
const lianaMat = haze(new THREE.MeshStandardMaterial({ map: tLiana, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#d5d8b8' }), 16, 58);
const nearLeafMat = new THREE.MeshBasicMaterial({ map: blurred(tLeaf, 7), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0.2, 0.26, 0.12), opacity: 0.92 });

// ---------- La branche : des tronçons qui viennent vers nous, séparés par des vides ----------
function rnd(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const quad = new THREE.PlaneGeometry(1, 1);
function makeSegment(seed, len) {
  const r = rnd(seed), g = new THREE.Group(), RS = 18, LS = Math.round(len * 2.2);
  const pos = [], uv = [], idx = [], p1 = r() * 6.28, p2 = r() * 6.28;
  for (let i = 0; i <= LS; i++) {
    const t = i / LS, z = t * len, end = Math.min(1, Math.min(t, 1 - t) * len / 1.6);          // extrémités arrondies, cassées
    const cx = 0.22 * Math.sin(z * 0.23 + p1), cy = 0.12 * Math.sin(z * 0.31 + p2);
    for (let j = 0; j <= RS; j++) {
      const th = j / RS * Math.PI * 2;
      const rad = (0.74 + 0.07 * Math.sin(th * 3 + z * 0.8 + p1) + 0.05 * Math.sin(th * 5 - z * 1.7 + p2)) * (0.02 + 0.98 * Math.pow(end, 0.45));
      pos.push(cx + Math.cos(th) * rad * 1.12, cy + Math.sin(th) * rad * 0.9, z); uv.push(j / RS * 2, z * 0.34 + seed * 0.37);
    }
  }
  for (let i = 0; i < LS; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, branchMat); g.add(m);
  // Épiphytes plantés sur les flancs et lianes qui pendent : la branche appartient à la forêt.
  const nL = Math.round(len / 2.6);
  for (let i = 0; i < nL; i++) {
    const z = 1 + r() * (len - 2), side = r() < 0.5 ? -1 : 1, s = 0.45 + r() * 0.55;
    const leaf = new THREE.Mesh(quad, leafMat); leaf.scale.set(s, s, 1);
    leaf.position.set(side * (0.62 + r() * 0.2), 0.3 + s * 0.32, z); leaf.rotation.set(-0.15, side * (0.5 + r() * 0.7), side * -0.35); g.add(leaf);
  }
  for (let i = 0; i < Math.round(len / 4.5); i++) {
    const z = 1 + r() * (len - 2), side = r() < 0.5 ? -1 : 1, h = 2.2 + r() * 2.6;
    const li = new THREE.Mesh(quad, lianaMat); li.scale.set(h * 0.33, h, 1);
    li.position.set(side * (0.55 + r() * 0.35), -h / 2 + 0.1, z); li.rotation.y = r() * 3.14; g.add(li);
  }
  g.userData.len = len;
  return g;
}
const segs = []; let nextZ = -14, segSeed = 1;
function addSegment(gapBefore) {
  const len = 13 + (segSeed * 7 % 9);
  const g = makeSegment(segSeed++, len); g.position.z = nextZ + gapBefore; scene.add(g); segs.push(g);
  nextZ = g.position.z + len;
}
addSegment(0); while (nextZ < 70) addSegment(2.6 + (segSeed % 3) * 0.5);
function groundAt(z) { for (const g of segs) { const a = g.position.z, b = a + g.userData.len; if (z > a + 0.25 && z < b - 0.25) return true; } return false; }

// Feuilles floues qui passent tout près de l'objectif.
const nears = [];
for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(quad, nearLeafMat.clone()); m.renderOrder = 10; scene.add(m); nears.push(m); resetNear(m, 20 + i * 14); }
function resetNear(m, z) { const side = Math.random() < 0.5 ? -1 : 1, s = 2.6 + Math.random() * 2.2; m.scale.set(s, s, 1); m.position.set(side * (1.55 + Math.random() * 0.5), TOP + 0.9 + Math.random() * 1.9, z); m.rotation.set(0, side * -0.5, Math.random() * 6.28); }

// ---------- Le singe ----------
const furMats = [];
const fur = (m) => {
  const mat = new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.93, metalness: 0, color: '#69655e' });
  mat.onBeforeCompile = (sh) => {   // liseré chaud : le soleil du film découpe le pelage par l'arrière
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(1.0, 0.72, 0.36) * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.2) * 0.22;`);
  };
  furMats.push(mat); return mat;
};
const monkey = new Beast(gMonkey, { length: +(params.get('taille') || 1.75), material: fur, gait: SINGE });
scene.add(monkey.root);
// Ombre de contact sur la mousse.
const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.55 }));
shadow.renderOrder = 2; scene.add(shadow);

// ---------- Jeu minimal : courir, sauter les vides ----------
let jumpT = -1, y = 0, vy = 0, falling = false, held = false, time = 0, last = performance.now() / 1000, dist = 0;
function press() { playFilm(); $('note').style.opacity = 0; if (!falling && y <= 0.001 && jumpT < 0) { jumpT = 0; vy = 6.4; held = true; } }
addEventListener('pointerdown', (e) => { e.preventDefault(); press(); }, { passive: false });
addEventListener('pointerup', () => { held = false; }); addEventListener('pointercancel', () => { held = false; });
addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) press(); }); addEventListener('keyup', () => { held = false; });
const auto = params.has('auto');

function frame() {
  requestAnimationFrame(frame);
  const tn = performance.now() / 1000, dt = Math.min(0.05, tn - last); last = tn; time += dt;
  loopFilm();
  // Le monde vient vers nous.
  const dz = SPEED * dt; dist += dz;
  for (const g of segs) g.position.z -= dz;
  nextZ -= dz;
  if (segs[0].position.z + segs[0].userData.len < -16) { scene.remove(segs.shift()); }
  while (nextZ < 70) addSegment(2.4 + (segSeed % 3) * 0.55);
  // Elles n'apparaissent que tout près de l'objectif, sur les bords : jamais de feuille qui flotte au loin.
  for (const m of nears) { m.position.z -= dz; m.material.opacity = 0.92 * clamp((3.5 - m.position.z) / 4, 0, 1); m.visible = m.material.opacity > 0.01; if (m.position.z < -4.4) resetNear(m, 40 + Math.random() * 40); }

  // Pilote automatique (?auto=1) : saute juste avant chaque vide.
  if (auto && y <= 0.001 && !falling && jumpT < 0 && !groundAt(1.15) && groundAt(0)) press();

  // Saut : maintenir prolonge un peu l'envol.
  const onBranch = groundAt(0);
  if (jumpT >= 0 || y > 0 || falling) {
    jumpT += dt; vy -= (held && vy > 0 ? 13 : 22) * dt; y += vy * dt;
    if (y <= 0 && !falling) { if (onBranch) { y = 0; vy = 0; jumpT = -1; } else falling = true; }
  } else if (!onBranch) { falling = true; vy = 0; jumpT = 0; }
  if (falling && y < -9) { falling = false; y = 0; vy = 0; jumpT = -1; }      // on le repose sur la branche : ce n'est qu'un test
  const air = jumpT >= 0 && !falling ? clamp(jumpT / 0.62, 0, 1) : -1;
  monkey.root.position.set(0, TOP - 0.05, 0);
  monkey.update(dt, { phase: (time * 2.35) % 1, run: 1, crouch: 0, air, y });
  shadow.position.set(0, TOP - 0.02, 0.1); const sk = clamp(1 - y / 2.2, 0, 1);
  shadow.scale.set(1.5 * (0.6 + 0.4 * sk), 1, 2.3 * (0.6 + 0.4 * sk)); shadow.material.opacity = onBranch ? 0.55 * sk : 0;

  // Caméra : derrière et au-dessus, orientée pour que la branche fuie vers le point de fuite du film.
  const camY = TOP + 1.9 + Math.max(0, y) * 0.3;
  camera.position.set(0.3 + Math.sin(time * 0.6) * 0.03, camY + Math.sin(time * 4.7) * 0.012, -5.2);
  const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ';
  camera.rotation.y = Math.PI - Math.atan(VP.x * th * camera.aspect);   // regarde vers +Z, légèrement décalé
  camera.rotation.x = -Math.atan(VP.y * th);
  renderer.render(scene, camera);
}

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize); resize();
$('version').textContent = VERSION;
$('chargement').classList.add('hide');
playFilm();
frame();
window.LIANE = { monkey, camera, segs, get dist() { return dist; } };
