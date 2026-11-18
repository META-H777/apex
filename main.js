// APEX — version web (three.js) du prototype Unity (Unity/APEX/Assets/Scripts/ApexGame.cs).
// Maintiens pour traquer (passer sous les branches), relâche sur le temps fort pour bondir sur la proie.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VERSION = 'v0.2 · 18/11 · la Fuite';

// ---------- Réglages (mêmes valeurs que dans Unity) ----------
const BPM = 120, SPB = 60 / BPM, SPEED = 9, PERFECT = 0.045, GOOD = 0.09, BARS = 64, SEED = 1789;
const DECOR_SPAN = 140;
const params = new URLSearchParams(location.search);
let autopilot = params.has('auto');
const fuiteOnly = params.has('fuite'); // ?fuite=1 : commence directement dans la peau du cerf

// La partie : on chasse en panthère, puis les rôles s'inversent et on fuit en cerf.
// TRANSFER_BAR : mesure où la bascule a lieu (2 mesures de transition sans obstacle).
const TRANSFER_BAR = fuiteOnly ? 0 : (+params.get('bascule') || 32); // ?bascule=4 : bascule plus tôt, pour tester
const GAP_START = 6, GAP_MAX = 8, GAP_HIT = 2; // distance panthère-cerf pendant la Fuite (en mètres de « marge »)

// Couleurs de la charte (Visuels/CHARTE-VISUELLE.md)
const C = { nuit: '#06060E', brume: '#1E1B4B', violet: '#7741D1', cyan: '#1EB4DC', teal: '#0BDACB', magenta: '#E82ED6', or: '#E2AC5E', perle: '#1A83E5' };
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

function rng(seed) { // mulberry32 : niveau identique à chaque partie
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- Rendu ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.nuit);
scene.fog = new THREE.FogExp2('#120F2B', 0.024);
scene.add(new THREE.AmbientLight('#3A3570', 0.9));
const moon = new THREE.DirectionalLight('#8066FF', 0.35); moon.position.set(-3, 8, -4); scene.add(moon);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 140);
scene.add(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.8, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Chargement ----------
const texLoader = new THREE.TextureLoader();
const tex = (name) => new Promise((ok) => texLoader.load('assets/' + name, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)));
const gltfLoader = new GLTFLoader();
const glb = (name) => new Promise((ok) => gltfLoader.load('assets/' + name, ok, undefined, () => ok(null)));

const [tFern, tMush, tVine, tTrunk, tBranch, tBack, tGround, gPanther, gPrey] = await Promise.all([
  tex('fougere.webp'), tex('champignons.webp'), tex('lianes.webp'), tex('tronc.webp'), tex('branche-basse.webp'),
  tex('fond-canopee.webp'), tex('sol.webp'), glb('panthere.glb'), glb('cerf.glb')]);

// ---------- Matériaux ----------
const glowMats = []; // matériaux qui respirent avec la musique
function glow(mat) { glowMats.push({ mat, base: mat.color.clone() }); return mat; }
const sprite = (map, color, cutout) => new THREE.MeshBasicMaterial({ map, color, side: THREE.DoubleSide,
  transparent: !cutout, alphaTest: cutout ? 0.45 : 0.01, depthWrite: !!cutout });

const fernMat = glow(sprite(tFern, hdr('#FFFFFF', 1.15), true));
const mushMat = glow(sprite(tMush, hdr('#FFFFFF', 1.7), false));
const vineMat = glow(sprite(tVine, hdr('#E8F0FF', 1.6), false));
const trunkMat = sprite(tTrunk, hdr('#C8C0FF', 0.62), true);
const branchMat = glow(sprite(tBranch, hdr('#FFFFFF', 1.6), false));
const barMat = glow(new THREE.MeshBasicMaterial({ color: hdr(C.violet, 1.4) }));

// ---------- Monde ----------
const quad = new THREE.PlaneGeometry(1, 1);

// Toile de fond accrochée à la caméra, sans brouillard (sinon elle disparaîtrait au loin).
const backdrop = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tBack, fog: false, color: hdr('#FFFFFF', 0.85) }));
backdrop.renderOrder = -1;
camera.add(backdrop);
function fitBackdrop() {
  if (!tBack) return;
  const d = camera.far * 0.92;
  let h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.04;
  const ia = tBack.image.width / tBack.image.height;
  const w = Math.max(h * ia, h * camera.aspect * 1.04);
  h = w / ia;
  backdrop.position.set(0, h * 0.06, -d);
  backdrop.scale.set(w, h, 1);
}

// Sol : terre mouillée Higgsfield, tuiles de 8 m en miroir.
if (tGround) { tGround.wrapS = tGround.wrapT = THREE.MirroredRepeatWrapping; tGround.repeat.set(5, 500); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 4000), new THREE.MeshBasicMaterial({ map: tGround, color: hdr('#C8C8FF', 0.8) }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 1900);
scene.add(ground);

// Jungle en sprites, recyclée devant la panthère.
const decor = [];
function billboard(map, mat, height, x, y, z, yaw, hanging = false, widthFactor = 1) {
  const m = new THREE.Mesh(quad, mat);
  const w = height * map.image.width / map.image.height * widthFactor;
  m.scale.set(w, height, 1);
  m.position.set(x, y + (hanging ? -height / 2 : height / 2), z);
  m.rotation.y = yaw;
  scene.add(m); decor.push(m);
}
{
  const r = rng(SEED);
  const R = (a, b) => a + (b - a) * r();
  const side = () => (r() < 0.5 ? -1 : 1);
  const deg = THREE.MathUtils.degToRad;
  if (tTrunk) for (let i = 0; i < 22; i++) billboard(tTrunk, trunkMat, R(38, 50), side() * R(7.5, 16), -0.5, R(0, DECOR_SPAN), deg(R(-20, 20)), false, 0.5);
  if (tFern) for (let i = 0; i < 110; i++) billboard(tFern, fernMat, R(1.4, 3.6), side() * R(2.3, 10), -0.05, R(0, DECOR_SPAN), deg(R(-35, 35)));
  if (tMush) for (let i = 0; i < 55; i++) billboard(tMush, mushMat, R(0.6, 1.5), side() * R(2.0, 7.5), -0.02, R(0, DECOR_SPAN), deg(R(-30, 30)));
  if (tVine) for (let i = 0; i < 34; i++) billboard(tVine, vineMat, R(3.5, 6.5), side() * R(1.8, 9), R(7.5, 10), R(0, DECOR_SPAN), deg(R(-25, 25)), true);
}

// Lignes de temps au sol.
const bars = [];
{ const g = new THREE.BoxGeometry(3.2, 0.02, 0.08); for (let i = 0; i < 48; i++) { const b = new THREE.Mesh(g, barMat); scene.add(b); bars.push(b); } }

// Anneaux de lumière qui partent sous la panthère à chaque temps (charte).
const rings = [];
{
  const g = new THREE.RingGeometry(0.92, 1, 64); g.rotateX(-Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hdr(C.cyan, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(m); rings.push({ m, born: -9 });
  }
}
let ringIdx = 0;
function spawnRing(z, accent, t) {
  const r = rings[ringIdx++ % rings.length];
  r.born = t; r.m.position.set(0, 0.03, z);
  r.m.material.color.copy(accent ? hdr(C.violet, 2.2) : hdr(C.cyan, 1.3));
}

// ---------- Modèles ----------
// Met le modèle tête vers +Z (repère « Tete » posé dans Blender), à la bonne longueur, pattes au sol.
function fitModel(gltf, length, material) {
  if (!gltf) return null;
  const inner = gltf.scene.clone(true);
  const rot = new THREE.Group(); rot.add(inner);
  const holder = new THREE.Group(); holder.add(rot);
  holder.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  let head = null; inner.traverse((o) => { if (o.name.startsWith('Tete')) head = o; });
  const dir = head ? head.getWorldPosition(new THREE.Vector3()).sub(c) : new THREE.Vector3(0, 0, 1);
  rot.rotation.y = -Math.atan2(dir.x, dir.z);
  inner.traverse((o) => { if (o.isMesh) { o.material = material(o.material); o.frustumCulled = true; } });
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(rot);
  const s = length / Math.max(0.01, box.max.z - box.min.z);
  rot.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(rot);
  const cc = box.getCenter(new THREE.Vector3());
  rot.position.set(-cc.x, -box.min.y, -cc.z);
  return holder;
}

const pantherSrc = fitModel(gPanther, 2.4, (m) => new THREE.MeshStandardMaterial({ map: m.map, emissiveMap: m.map, emissive: new THREE.Color('#FFFFFF'), emissiveIntensity: 2.2, roughness: 0.55, metalness: 0 }));
const ghostMat = new THREE.MeshBasicMaterial({ color: hdr(C.cyan, 1.2), transparent: true, opacity: 0.45, depthWrite: false });
const preyMat = (m) => new THREE.MeshBasicMaterial({ map: m.map, color: new THREE.Color(2.3, 1.9, 1.4) });
const preySrc = fitModel(gPrey, 1.5, preyMat);

// Le cerf que l'on incarne pendant la Fuite (or plus vif que les proies : c'est « toi »).
const deer = new THREE.Group(); deer.visible = false; scene.add(deer);
const deerModel = fitModel(gPrey, 1.5, (m) => new THREE.MeshBasicMaterial({ map: m.map, color: new THREE.Color(1.7, 1.4, 1.0) }))
  || new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12).translate(0, 0.8, 0), new THREE.MeshBasicMaterial({ color: hdr(C.or, 3) }));
deer.add(deerModel);

// Griffes au sol : là où la panthère va bondir (texture dessinée à la volée, trois entailles cyan).
function clawTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  for (const [blur, width, alpha] of [[18, 22, 0.5], [6, 12, 0.9], [0, 5, 1]]) {
    g.shadowColor = '#1EB4DC'; g.shadowBlur = blur; g.strokeStyle = `rgba(200,250,255,${alpha})`; g.lineWidth = width;
    for (let i = -1; i <= 1; i++) {
      g.beginPath(); g.moveTo(70 + i * 55, 40); g.quadraticCurveTo(128 + i * 45, 128, 100 + i * 55, 220); g.stroke();
    }
  }
  return new THREE.CanvasTexture(c);
}
const clawMat = glow(new THREE.MeshBasicMaterial({ map: clawTexture(), color: hdr(C.cyan, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
const clawGeo = new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2);

const panther = new THREE.Group(); scene.add(panther);
const pantherModel = pantherSrc ? pantherSrc : new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.4, 4, 12).rotateX(Math.PI / 2).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ color: '#0A0A14', emissive: hdr(C.cyan, 0.8) }));
panther.add(pantherModel);
const ghost = new THREE.Group(); scene.add(ghost); ghost.visible = false;
if (pantherSrc) { const g = pantherSrc.clone(true); g.traverse((o) => { if (o.isMesh) o.material = ghostMat; }); ghost.add(g); }

// ---------- Particules ----------
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}
const dot = dotTexture();
function makePoints(n, color, size) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.PointsMaterial({ map: dot, size, color, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p); return p;
}
// Gerbe de spores dorées à la mise à mort.
const BURST = 420;
const burst = makePoints(BURST, hdr('#FF9A2E', 2.4), 0.22);
const bv = new Float32Array(BURST * 3), bl = new Float32Array(BURST), bmax = new Float32Array(BURST);
let burstIdx = 0;
function emitBurst(pos, n) {
  const p = burst.geometry.attributes.position.array;
  for (let k = 0; k < n; k++) {
    const i = burstIdx++ % BURST;
    const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    const s = 3 + Math.random() * 7;
    p[i * 3] = pos.x + d.x * 0.3; p[i * 3 + 1] = pos.y + d.y * 0.3; p[i * 3 + 2] = pos.z + d.z * 0.3;
    bv[i * 3] = d.x * s; bv[i * 3 + 1] = d.y * s + 2; bv[i * 3 + 2] = d.z * s;
    bmax[i] = bl[i] = 0.4 + Math.random() * 0.6;
  }
}
function updateBurst(dt) {
  const p = burst.geometry.attributes.position.array, col = burst.geometry.attributes.color.array;
  for (let i = 0; i < BURST; i++) {
    if (bl[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
    bl[i] -= dt; bv[i * 3 + 1] -= 4.9 * dt;
    p[i * 3] += bv[i * 3] * dt; p[i * 3 + 1] += bv[i * 3 + 1] * dt; p[i * 3 + 2] += bv[i * 3 + 2] * dt;
    const k = Math.max(0, bl[i] / bmax[i]); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  burst.geometry.attributes.position.needsUpdate = true; burst.geometry.attributes.color.needsUpdate = true;
}
// Spores teal ambiantes qui flottent devant la panthère.
const AMB = 320;
const amb = makePoints(AMB, hdr(C.teal, 1.8), 0.1);
const ap = [], aph = [];
for (let i = 0; i < AMB; i++) { ap.push(new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 6, Math.random() * 30)); aph.push(Math.random() * 6.28); }
function updateAmbient(z, time) {
  const p = amb.geometry.attributes.position.array, col = amb.geometry.attributes.color.array;
  for (let i = 0; i < AMB; i++) {
    const a = ap[i];
    if (a.z < z - 4) a.z += 30;
    a.y += Math.sin(time * 0.7 + aph[i]) * 0.003;
    p[i * 3] = a.x + Math.sin(time * 0.5 + aph[i]) * 0.3; p[i * 3 + 1] = a.y; p[i * 3 + 2] = a.z;
    const k = 0.4 + 0.6 * Math.max(0, Math.sin(time * 1.3 + aph[i] * 3));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  amb.geometry.attributes.position.needsUpdate = true; amb.geometry.attributes.color.needsUpdate = true;
}

// ---------- Son (WebAudio) : tambours tribaux + électro, synthétisés ----------
let ctx = null, master = null, noiseBuf = null;
function audioInit() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Débloque le son sur iPhone : un son muet joué pendant le geste.
  const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(master); b.start();
}
function env(t, a, d, peak) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(master); return g; }
function kick(t, v = 1) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); o.connect(env(t, 0.003, 0.32, 0.9 * v)); o.start(t); o.stop(t + 0.4); }
function noise(t, dur, freq, q, v, type = 'bandpass') { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); f.connect(env(t, 0.002, dur, v)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
function tom(t, f0, v) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.25); o.connect(env(t, 0.004, 0.3, v)); o.start(t); o.stop(t + 0.4); }
function bass(t, f, dur) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur); o.connect(lp); lp.connect(env(t, 0.02, dur, 0.22)); o.start(t); o.stop(t + dur + 0.1); }
function thump(v) { const t = ctx.currentTime; const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.17); o.connect(env(t, 0.002, 0.35, 0.9 * v)); o.start(t); o.stop(t + 0.4); noise(t, 0.08, 2500, 0.8, 0.35 * v); }
const BASS = [41.2, 41.2, 49.0, 36.7]; // mi, mi, sol, ré
const BASS_FUITE = [36.7, 36.7, 43.65, 32.7]; // plus grave, plus inquiet pendant la Fuite
let nextStep = 0; // en croches
function scheduleMusic() {
  if (!audioClock) return;
  while (true) {
    const at = startAudio + nextStep * SPB / 2;
    if (at > ctx.currentTime + 0.2) break;
    if (at > ctx.currentTime - 0.01) {
      const beat = nextStep / 2, inBar = beat % 4, bar = Math.floor(beat / 4), onBeat = nextStep % 2 === 0;
      if (onBeat) {
        kick(at, inBar === 0 ? 1 : 0.8);
        if (inBar === 1 || inBar === 3) noise(at, 0.12, 1800, 0.9, 0.35); // claque
        const fuite = transferT >= 0 ? at - startAudio >= transferT - 0.01 : true;
        if (inBar === 0) bass(at, (fuite ? BASS_FUITE : BASS)[bar % 4], SPB * 3.6);
        if (fuite) tom(at, inBar % 2 ? 150 : 115, 0.32); // tambours de poursuite sur chaque temps
        else if (bar >= 8 && inBar === 2) tom(at, 180, 0.35);
      } else {
        noise(at, 0.03, 8000, 0.7, bar >= 4 ? 0.16 : 0.08, 'highpass'); // charleston
        const fuite = transferT >= 0 ? at - startAudio >= transferT : true;
        if (fuite) tom(at, 230, 0.16);
        else if (bar >= 16 && inBar === 3) tom(at, 240, 0.25);
      }
    }
    nextStep++;
  }
}

// ---------- État du jeu ----------
const State = { Menu: 0, Playing: 1, Dead: 2, Won: 3 };
let state = State.Menu;
let audioClock = false, startAudio = 0, startPerf = 0;
const now = () => performance.now() / 1000;
const songTime = () => (audioClock ? ctx.currentTime - startAudio : now() - startPerf);
const latency = () => (audioClock ? (ctx.outputLatency || ctx.baseLatency || 0) : 0);

let preys = [], branches = [], cues = [], levelRoot = null, levelEnd = 0;
let mode = 'traque', transferT = Infinity, gap = GAP_START, gapShown = GAP_START, chaserPounce = -1, dodgeSide = 1, camBlendT = -9, urgent = false;
let score = 0, combo = 0, mult = 1, best = 0, held = false, waitRelease = false;
let pounceT = -1, shake = 0, flash = 0, deathTime = -9, lastBeatRing = -1;
let bestRun = null, currentRun = null, ghostIdx = 0, ghostHeld = false, ghostPounce = -1;
try { best = +localStorage.getItem('apex_best') || 0; bestRun = JSON.parse(localStorage.getItem('apex_ghost') || 'null'); } catch { best = 0; bestRun = null; }

function buildLevel() {
  if (levelRoot) scene.remove(levelRoot);
  levelRoot = new THREE.Group(); scene.add(levelRoot);
  preys = []; branches = []; cues = [];
  const r = rng(SEED);
  transferT = TRANSFER_BAR > 0 ? TRANSFER_BAR * 4 * SPB : -1;
  for (let bar = 2; bar < BARS; bar++) {
    const fuite = bar >= TRANSFER_BAR;
    if (fuite && TRANSFER_BAR > 0 && bar < TRANSFER_BAR + 2) continue; // 2 mesures pour comprendre ce qui arrive
    // La difficulté repart de zéro au début de la Fuite, puis remonte plus vite.
    const d = fuite ? Math.floor((bar - TRANSFER_BAR) / (TRANSFER_BAR > 0 ? 5 : 8)) : Math.floor(bar / 8);
    const beats = [0];
    if (d >= 1) beats.push(2);
    if (d >= 2 && r() < 0.55) beats.push(1);
    if (d >= 3 && r() < 0.55) beats.push(3);
    if (d >= 4 && r() < 0.35) beats.push(1.5);
    if (d >= 5 && r() < 0.35) beats.push(2.5);
    beats.sort((a, b) => a - b);
    for (const b of beats) (fuite ? addCue : addPrey)((bar * 4 + b) * SPB, r);
    if (r() < 0.25 + 0.08 * d && !beats.includes(3) && bar < BARS - 1) addBranch((bar * 4 + 3.5) * SPB);
  }
  preys.sort((a, b) => a.t - b.t);
  cues.sort((a, b) => a.t - b.t);
  levelEnd = (BARS * 4 + 2) * SPB;
}
// Un bond de la panthère pendant la Fuite : des griffes au sol, pile sur le temps.
function addCue(t) {
  const m = new THREE.Mesh(clawGeo, clawMat); m.position.set(0, 0.04, t * SPEED + 1.1);
  levelRoot.add(m);
  cues.push({ t, tr: m, done: false });
}
function addPrey(t, r) {
  const root = new THREE.Group(); root.position.set(0, 0, t * SPEED + 1.1);
  root.add(preySrc ? preySrc.clone(true) : new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: hdr(C.or, 3) })));
  levelRoot.add(root);
  preys.push({ t, tr: root, done: false, killed: false, doneAt: 0, side: r() < 0.5 ? -1 : 1 });
}
function addBranch(t) {
  const root = new THREE.Group(); root.position.set(0, 0, t * SPEED);
  if (tBranch) {
    const w = 5.6, h = w * tBranch.image.height / tBranch.image.width;
    const m = new THREE.Mesh(quad, branchMat); m.scale.set(w, h, 1); m.position.y = 1.45 + (0.5 - 0.48) * h; root.add(m);
  } else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: hdr(C.magenta, 2.5) })); m.position.y = 1.25; root.add(m);
  }
  levelRoot.add(root); branches.push({ t, tr: root, passed: false });
}

function startRun() {
  audioInit();
  buildLevel();
  score = 0; combo = 0; mult = 1; pounceT = -1; flash = 0; lastBeatRing = -1;
  audioClock = ctx && ctx.state === 'running';
  startAudio = audioClock ? ctx.currentTime + 1.0 : 0; // 1 s d'élan
  startPerf = now() + 1.0;
  nextStep = 0; autoLast = -1;
  currentRun = { score: 0, death: 0, ev: [] };
  ghostIdx = 0; ghostHeld = false; ghostPounce = -1;
  ghost.visible = !fuiteOnly && !!(bestRun && bestRun.ev && bestRun.ev.length);
  pantherModel.rotation.set(0, 0, 0);
  deerModel.rotation.set(0, 0, 0);
  mode = 'traque'; gap = gapShown = GAP_START; chaserPounce = -1; camBlendT = -9; urgent = false;
  deer.visible = false;
  if (fuiteOnly) beginFuite(0, true);
  state = State.Playing;
  showScreen();
}

// La bascule : la panthère devient le prédateur qui te poursuit, tu deviens le cerf.
function beginFuite(t, silent = false) {
  mode = 'fuite'; urgent = true; camBlendT = silent ? -9 : t;
  gap = gapShown = GAP_START; chaserPounce = -1;
  deer.visible = true; deer.position.set(0, 0, t * SPEED); deer.scale.set(1, 1, 1);
  ghost.visible = false; $('fantome').textContent = '';
  pounceT = -1;
  if (!silent) { flash = 1.2; shake = 0.5; emitBurst(new THREE.Vector3(0, 1, t * SPEED + 1), 160); if (navigator.vibrate) navigator.vibrate([30, 30, 30]); }
  banner();
  updateHud();
}

function onRelease(t) {
  pounceT = t;
  if (mode === 'fuite') { fuiteRelease(t); return; }
  const tj = t - latency(); // le joueur entend le temps avec le retard du haut-parleur
  let target = null, bestD = 999;
  for (const p of preys) {
    if (p.done) continue;
    const d = Math.abs(tj - p.t);
    if (d < bestD) { bestD = d; target = p; }
    if (p.t > tj + 1) break;
  }
  if (!target || bestD > 0.28) return; // bond dans le vide : pas de pénalité
  if (bestD <= PERFECT) kill(target, true);
  else if (bestD <= GOOD) kill(target, false);
  else escape(target, t);
}
function kill(p, perfect) {
  p.done = true; p.killed = true; p.doneAt = songTime(); p.tr.visible = false;
  combo++;
  mult = combo >= 24 ? 8 : combo >= 16 ? 4 : combo >= 8 ? 2 : 1;
  score += (perfect ? 300 : 100) * mult;
  judge(perfect ? 'parfait' : 'bien');
  emitBurst(p.tr.position.clone().add(new THREE.Vector3(0, 0.9, 0)), perfect ? 140 : 60);
  shake = perfect ? 0.35 : 0.18; flash = perfect ? 1 : 0.5;
  if (ctx) thump(perfect ? 1 : 0.6);
  if (navigator.vibrate) navigator.vibrate(perfect ? 25 : 12);
  updateHud();
}
function escape(p, t) { p.done = true; p.doneAt = t; combo = 0; mult = 1; judge('rate'); updateHud(); }

// ----- Fuite : esquiver les bonds de la panthère -----
function fuiteRelease(t) {
  const tj = t - latency();
  let target = null, bestD = 999;
  for (const c of cues) {
    if (c.done) continue;
    const d = Math.abs(tj - c.t);
    if (d < bestD) { bestD = d; target = c; }
    if (c.t > tj + 1) break;
  }
  if (!target || bestD > 0.28) return; // saut dans le vide : pas de pénalité
  if (bestD <= PERFECT) dodge(target, true);
  else if (bestD <= GOOD) dodge(target, false);
  else hit(target);
}
function dodge(c, perfect) {
  c.done = true; c.tr.visible = false;
  combo++;
  mult = combo >= 24 ? 8 : combo >= 16 ? 4 : combo >= 8 ? 2 : 1;
  score += (perfect ? 300 : 100) * mult;
  gap = Math.min(GAP_MAX, gap + (perfect ? 0.6 : 0.2));
  dodgeSide = -dodgeSide;
  chaserPounce = c.t; // la panthère bondit… dans le vide
  judge(perfect ? 'parfait' : 'bien');
  emitBurst(deer.position.clone().add(new THREE.Vector3(0, 0.6, -0.5)), perfect ? 90 : 40);
  shake = perfect ? 0.25 : 0.12; flash = perfect ? 0.7 : 0.3;
  if (ctx) thump(perfect ? 0.8 : 0.5);
  if (navigator.vibrate) navigator.vibrate(perfect ? 20 : 10);
  updateHud();
}
function hit(c) {
  c.done = true; c.tr.visible = false;
  combo = 0; mult = 1;
  gap -= GAP_HIT;
  chaserPounce = c.t;
  judge('rate');
  shake = 0.55;
  if (ctx) thump(1);
  if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  updateHud();
  if (gap <= 0.01) endRun(false);
}

function endRun(won) {
  state = won ? State.Won : State.Dead;
  deathTime = now();
  currentRun.score = score; currentRun.death = won ? 99999 : songTime();
  if (!won) {
    (mode === 'fuite' ? deerModel : pantherModel).rotation.z = THREE.MathUtils.degToRad(80);
    if (mode === 'fuite') { chaserPounce = songTime(); gap = 0; } // la panthère te rattrape
    shake = 0.6; if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  }
  if (score > best) {
    best = score; bestRun = currentRun;
    try { localStorage.setItem('apex_best', best); localStorage.setItem('apex_ghost', JSON.stringify(bestRun)); } catch { /* stockage indisponible : on garde en mémoire */ }
  }
  waitRelease = held;
  showScreen();
}

// Pilote automatique (touche A ou ?auto=1) : reste baissé, relâche pile sur chaque proie.
let autoLast = -1;

// ---------- Entrées (un seul doigt) ----------
function press() {
  if (held) return; held = true;
  if (state === State.Playing) { if (!waitRelease) currentRun.ev.push(Math.max(0.0001, songTime())); return; }
  if (waitRelease) return;
  if (state === State.Menu || now() - deathTime > 0.6) { waitRelease = true; startRun(); }
}
function release() {
  if (!held) return; held = false;
  if (waitRelease) { waitRelease = false; return; }
  if (state === State.Playing && !autopilot) { const t = songTime(); currentRun.ev.push(-Math.max(0.0001, t)); onRelease(t); }
}
addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); press(); }, { passive: false });
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { audioInit(); press(); } } if (e.code === 'KeyA') autopilot = !autopilot; });
addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });
addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Interface ----------
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('fr-FR');
const judgeImg = { parfait: 'assets/juge-parfait.webp', bien: 'assets/juge-bien.webp', rate: 'assets/juge-rate.webp' };
for (const src of [...Object.values(judgeImg), 'assets/fin-reperee.webp', 'assets/fin-conquis.webp', 'assets/fin-attrape.webp', 'assets/fuis.webp']) new Image().src = src;
function judge(kind) { const j = $('juge'); j.src = judgeImg[kind]; j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); }
function banner() { const b = $('banniere'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function updateHud() {
  $('score').textContent = fmt(score);
  $('serie').textContent = 'Série ' + combo;
  $('distance').classList.toggle('hide', mode !== 'fuite' || state !== State.Playing);
  $('distanceBar').style.width = Math.max(0, Math.min(1, gap / GAP_MAX)) * 100 + '%';
  $('distanceBar').classList.toggle('danger', gap <= GAP_HIT + 0.01);
  $('frenesie').classList.toggle('hide', mult <= 1);
  $('frenesie').querySelector('span').textContent = '×' + mult;
}
function showScreen() {
  $('menu').classList.toggle('hide', state !== State.Menu);
  $('hud').classList.toggle('hide', state === State.Menu);
  $('fin').classList.toggle('hide', state !== State.Dead && state !== State.Won);
  $('record').textContent = best > 0 ? 'Record : ' + fmt(best) : '';
  $('fantome').textContent = ghost.visible && bestRun ? 'Fantôme à battre : ' + fmt(bestRun.score) : '';
  if (state === State.Dead || state === State.Won) {
    const caught = state === State.Dead && mode === 'fuite';
    $('fin').querySelector('.titre').src = state === State.Won ? 'assets/fin-conquis.webp' : caught ? 'assets/fin-attrape.webp' : 'assets/fin-reperee.webp';
    $('fin').querySelector('.titre').style.filter = caught ? 'brightness(1.7)' : ''; // lettres d'obsidienne : plus lisibles sur la jungle
    $('finSous').textContent = caught ? 'Le prédateur a eu ta peau' : "Ta proie t'a repérée";
    $('finSous').classList.toggle('hide', state === State.Won);
    $('finScore').textContent = 'Score ' + fmt(score) + '   ·   Record ' + fmt(best);
    $('juge').classList.remove('pop');
  }
  updateHud();
}
$('version').textContent = VERSION;

// ---------- Boucle ----------
function setGlow(k) { for (const g of glowMats) g.mat.color.copy(g.base).multiplyScalar(Math.min(k, 2.2)); }

function updatePanther(t) {
  const z = t * SPEED;
  let y = 0, lunge = 0;
  const pt = pounceT >= 0 ? (t - pounceT) / 0.38 : 2;
  if (pt >= 0 && pt <= 1) { y = Math.sin(pt * Math.PI) * 1.1; lunge = Math.sin(pt * Math.PI) * 0.9; }
  panther.position.set(0, y, z + lunge);
  const crouch = held && (pt < 0 || pt > 1) ? 0.62 : 1;
  panther.scale.y += (crouch - panther.scale.y) * Math.min(1, dt * 18);
  pantherModel.rotation.x = pt >= 0 && pt <= 1 ? -THREE.MathUtils.degToRad(18) * Math.cos(pt * Math.PI) : 0;
}
function updateGhost(t) {
  if (!ghost.visible || !bestRun) return;
  while (ghostIdx < bestRun.ev.length && Math.abs(bestRun.ev[ghostIdx]) <= t) {
    const e = bestRun.ev[ghostIdx++];
    if (e > 0) ghostHeld = true; else { ghostHeld = false; ghostPounce = -e; }
  }
  if (t > bestRun.death) { ghost.visible = false; $('fantome').textContent = ''; return; }
  const pt = ghostPounce >= 0 ? (t - ghostPounce) / 0.38 : 2;
  ghost.position.set(-1.8, pt >= 0 && pt <= 1 ? Math.sin(pt * Math.PI) * 1.1 : 0, t * SPEED);
  ghost.scale.y = ghostHeld && (pt < 0 || pt > 1) ? 0.62 : 1;
}
function updatePreys(t) {
  for (const p of preys) {
    if (!p.done && t - latency() > p.t + GOOD) escape(p, t);
    if (!p.tr.visible) continue;
    if (p.done && !p.killed) {
      p.tr.position.x += p.side * 9 * dt; p.tr.position.z += 6 * dt;
      if (t - p.doneAt > 0.8) p.tr.visible = false;
    } else if (Math.abs(p.tr.position.z - t * SPEED) < 150) {
      p.tr.position.y = Math.abs(Math.sin((t / SPB) * Math.PI)) * 0.25;
    }
  }
}
function updateBranches(t) {
  for (const b of branches) {
    if (b.passed || t < b.t) continue;
    b.passed = true;
    // Le pilote automatique ne meurt jamais sur une branche (sinon une image sautée suffit à le tuer).
    const crouched = autopilot || (held && (pounceT < 0 || t - pounceT > 0.35));
    if (!crouched) { endRun(false); return; }
  }
}
function updateWorld(t, z) {
  for (const d of decor) if (d.position.z < z - 12) d.position.z += DECOR_SPAN;
  const beat = t / SPB, b0 = Math.floor(beat);
  for (let i = 0; i < bars.length; i++) bars[i].position.set(0, 0.01, (b0 + i) * SPB * SPEED + 1.1);
  const phase = beat - b0;
  const pulse = Math.exp(-phase * 7) * (b0 % 4 === 0 ? 1.4 : 0.8);
  setGlow(0.7 + pulse * 0.9 + (mult / 8) * 1.2);
  if (state === State.Playing && b0 >= 0 && b0 !== lastBeatRing) { lastBeatRing = b0; spawnRing(z, b0 % 4 === 0, t); }
  for (const r of rings) {
    const a = (t - r.born) / 0.7;
    r.m.material.opacity = a >= 0 && a < 1 ? (1 - a) * 0.9 : 0;
    const s = 0.4 + a * 4.2; r.m.scale.set(s, 1, s);
  }
  flash = Math.max(0, flash - dt * 3);
  bloom.strength = 0.75 + mult * 0.06 + flash * 0.8 + pulse * 0.18;
}
// k = 0 : cadrage de la Traque (trois quarts arrière de la panthère)
// k = 1 : cadrage de la Fuite (plus haut et plus loin, pour voir la panthère qui te talonne)
function camBlend(t) {
  if (mode !== 'fuite') return 0;
  if (camBlendT < 0) return 1;
  const a = Math.min(1, Math.max(0, (t - camBlendT) / 1.4));
  return a * a * (3 - 2 * a);
}
function updateCamera(z, k = 0) {
  shake = Math.max(0, shake - dt * 2.5);
  const j = shake * 0.25;
  const L = THREE.MathUtils.lerp;
  camera.position.set(L(2.1, 2.6, k) + (Math.random() - 0.5) * j, L(2.9, 4.6, k) + (Math.random() - 0.5) * j, z - L(5.6, 11, k));
  camera.lookAt(L(-0.3, -0.2, k), L(1.0, 0.6, k), z + L(5, 3, k));
}

// ----- Fuite : le cerf (toi) et la panthère (le prédateur) -----
function updateCues(t) {
  for (const c of cues) {
    if (c.done) continue;
    if (c.t > t + 20) break;
    if (t - latency() > c.t + GOOD) { hit(c); if (state !== State.Playing) return; }
  }
}
function updateDeer(t) {
  const z = t * SPEED;
  let y = 0, x = 0, lunge = 0;
  const pt = pounceT >= 0 ? (t - pounceT) / 0.38 : 2;
  if (pt >= 0 && pt <= 1) { const s = Math.sin(pt * Math.PI); y = s * 1.15; lunge = s * 0.6; x = dodgeSide * 1.3 * s; }
  deer.position.set(x, y, z + lunge);
  const crouch = held && (pt < 0 || pt > 1) ? 0.62 : 1;
  deer.scale.y += (crouch - deer.scale.y) * Math.min(1, dt * 18);
  deerModel.rotation.x = pt >= 0 && pt <= 1 ? -THREE.MathUtils.degToRad(15) * Math.cos(pt * Math.PI) : 0;
  deerModel.rotation.y = pt >= 0 && pt <= 1 ? dodgeSide * 0.35 * Math.sin(pt * Math.PI) : 0;
}
function updateChaser(t) {
  gapShown += (gap - gapShown) * Math.min(1, dt * 4);
  let off = 1.8 + Math.max(0, gapShown) * 0.45; // distance réelle derrière le cerf
  if (camBlendT >= 0) off *= Math.min(1, Math.max(0, (t - camBlendT) / 1.0)); // à la bascule, la panthère « décroche »
  const cp = chaserPounce >= 0 ? (t - chaserPounce) / 0.45 : 2;
  let y = Math.abs(Math.sin((t / SPB) * Math.PI)) * 0.08, lunge = 0;
  if (cp >= 0 && cp <= 1) { const s = Math.sin(cp * Math.PI); y = s * 1.3; lunge = s * off * (state === State.Playing ? 0.7 : 1); }
  panther.position.set(0, y, deer.position.z - off + lunge);
  panther.scale.y = 1;
  pantherModel.rotation.set(cp >= 0 && cp <= 1 ? -THREE.MathUtils.degToRad(20) * Math.cos(cp * Math.PI) : 0, 0, 0);
}

let dt = 0, last = now();
function frame() {
  requestAnimationFrame(frame);
  const tn = now(); dt = Math.min(0.05, tn - last); last = tn;

  if (state === State.Playing) {
    const t = songTime();
    if (mode === 'traque' && transferT > 0 && t >= transferT) beginFuite(t);
    if (autopilot) {
      // Relâche pile à l'instant de chaque proie (ou bond), même si des images ont sauté entre deux frames.
      held = true;
      for (const p of mode === 'fuite' ? cues : preys) {
        if (p.t > t) break;
        if (p.t > autoLast && !p.done) onRelease(p.t + latency());
      }
      autoLast = t;
    }
    scheduleMusic();
    updatePreys(t);
    if (mode === 'traque') { updatePanther(t); updateGhost(t); }
    else { updateCues(t); updateDeer(t); updateChaser(t); }
    if (state === State.Playing) updateBranches(t);
    updateWorld(t, t * SPEED);
    updateCamera(mode === 'fuite' ? deer.position.z : panther.position.z, camBlend(t));
    if (t > levelEnd && state === State.Playing) endRun(true);
  } else {
    // Menu / fin : la jungle respire au tempo, la panthère piétine.
    const k = tn;
    if (state === State.Menu) panther.position.set(0, Math.abs(Math.sin(k * 2)) * 0.15, 0);
    if (state === State.Dead && mode === 'fuite') updateChaser(songTime()); // la panthère finit son bond sur toi
    const beat = k * BPM / 60; const pulse = Math.exp(-(beat - Math.floor(beat)) * 7);
    setGlow(0.7 + pulse * 0.6);
    bloom.strength = 0.75 + pulse * 0.15;
    flash = Math.max(0, flash - dt * 3);
    updateCamera(mode === 'fuite' ? deer.position.z : panther.position.z, mode === 'fuite' ? 1 : 0);
  }
  updateBurst(dt);
  updateAmbient(panther.position.z, tn);
  composer.render();
}

function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  fitBackdrop();
}
addEventListener('resize', resize);
resize();
buildLevel();
$('chargement').classList.add('hide');
showScreen();
frame();

// Accès de test depuis la console : APEX.start(), APEX.auto = true…
window.APEX = { start: startRun, get state() { return state; }, set auto(v) { autopilot = v; }, get score() { return score; }, endRun };
