// APEX v1.0 — refonte complète : monde en volume, animaux vivants, lumière douce.
// Maintiens pour traquer (passer sous les branches), relâche sur le temps fort pour bondir sur la proie.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, patch, buildWorld, ground, pathH } from './monde.js';
import { Beast, PANTHER, DEER } from './betes.js';
import { Son } from './son.js';

const VERSION = 'v1.0 · refonte';
const BPM = 120, SPB = 60 / BPM, SPEED = 9, PERFECT = 0.045, GOOD = 0.09, BARS = 64, SEED = 1789;
const params = new URLSearchParams(location.search);
let autopilot = params.has('auto');
const fuiteOnly = params.has('fuite');
const studio = params.has('studio');                     // vue de profil, pour régler les animations
const TRANSFER_BAR = fuiteOnly ? 0 : (+params.get('bascule') || 32);
const GAP_START = 6, GAP_MAX = 8, GAP_HIT = 2;
const PREY_RUN = 1.7, PREY_SPEED = 4.2;                   // la proie détale 1,7 s avant d'être rattrapée
const L = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const C = { cyan: new THREE.Color('#1EB4DC'), violet: new THREE.Color('#7741D1'), or: new THREE.Color('#E2AC5E'), teal: new THREE.Color('#0BDACB'), magenta: new THREE.Color('#E82ED6') };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const $ = (id) => document.getElementById(id);

// ---------- Rendu ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#0a0920', 0.0185);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 150);
scene.add(new THREE.HemisphereLight('#39348c', '#06050d', 1.15));
const moon = new THREE.DirectionalLight('#7a6cff', 0.75); scene.add(moon); scene.add(moon.target);
const selfLight = new THREE.PointLight('#3fc4ff', 16, 12, 2); scene.add(selfLight);   // la lueur du joueur éclaire le sol
const preyLight = new THREE.PointLight('#ffbf6a', 0, 11, 2); scene.add(preyLight);    // celle de la proie la plus proche

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.72, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * 0.95;                                   // vignette
      c = mix(c, c * vec3(0.94, 0.97, 1.08), 0.5);                   // légère dominante froide
      c += (fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018; // grain
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);

// ---------- Chargement ----------
const texLoader = new THREE.TextureLoader();
const tex = (n) => new Promise((ok, ko) => texLoader.load('assets/' + n, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, ko));
const glb = (n) => new Promise((ok, ko) => new GLTFLoader().load('assets/' + n, ok, undefined, ko));
const [tSol, tEcorce, tFronde, tFeuille, gPanther, gDeer] = await Promise.all([tex('sol.webp'), tex('ecorce.webp'), tex('fronde.webp'), tex('feuille.webp'), glb('panthere-rig.glb'), glb('cerf-rig.glb')]);
const world = buildWorld(scene, { sol: tSol, ecorce: tEcorce, fronde: tFronde, feuille: tFeuille });
if (studio) { world.fronds.visible = world.bushes.visible = world.mush.visible = false; }

// ---------- Les bêtes ----------
const stripeMats = [];
const pantherMat = (m) => { const mat = patch(new THREE.MeshStandardMaterial({ map: m.map, emissiveMap: m.map, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1, roughness: 0.82, metalness: 0 }), { rim: '#0b2c52', stripes: 3.4 }); stripeMats.push(mat); return mat; };
const glassMat = (k) => (m) => patch(new THREE.MeshStandardMaterial({ map: m.map, color: '#2a1c0a', emissiveMap: m.map, emissive: new THREE.Color(1.0, 0.76, 0.4), emissiveIntensity: k, roughness: 0.35, metalness: 0 }), { glass: 1.7 });
const ghostMat = () => patch(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.55, 0.75), transparent: true, opacity: 0.3, depthWrite: false }));

const panther = new Beast(gPanther, { length: 2.5, material: pantherMat, gait: PANTHER }); scene.add(panther.root);
const ghost = new Beast(gPanther, { length: 2.5, material: ghostMat, gait: PANTHER }); ghost.root.visible = false; scene.add(ghost.root);
const deer = new Beast(gDeer, { length: 1.65, material: glassMat(1.15), gait: DEER }); deer.root.visible = false; scene.add(deer.root);
const preyPool = Array.from({ length: 7 }, () => { const b = new Beast(gDeer, { length: 1.55, material: glassMat(1.0), gait: DEER }); b.root.visible = false; scene.add(b.root); return b; });

// ---------- Spores : la proie se désagrège, la lumière revient au chasseur ----------
const NP = 1600;
const sp = { pos: new Float32Array(NP * 3), vel: new Float32Array(NP * 3), col: new Float32Array(NP * 3), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP), home: new Uint8Array(NP), k: new Float32Array(NP), i: 0 };
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(sp.pos, 3)); spGeo.setAttribute('aCol', new THREE.BufferAttribute(sp.col, 3));
spGeo.setAttribute('aK', new THREE.BufferAttribute(sp.k, 1)); spGeo.setAttribute('aSize', new THREE.BufferAttribute(sp.size, 1));
const spores = new THREE.Points(spGeo, new THREE.ShaderMaterial({
  uniforms: { ...U, uScale: { value: innerHeight } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform vec2 uBend; uniform float uScale; attribute vec3 aCol; attribute float aK; attribute float aSize; varying vec3 vC;
    void main(){
      vC = aCol * aK;
      vec4 mv = viewMatrix * vec4(position, 1.0);
      mv.xy += uBend * mv.z * mv.z;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aK > 0.0 ? uScale * aSize / max(0.5, -mv.z) : 0.0;
    }`,
  fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC * pow(max(0.0, 1.0 - d), 2.0), 1.0); }`,
}));
spores.frustumCulled = false; scene.add(spores);
function emit(x, y, z, vx, vy, vz, color, life, size, home) {
  const i = sp.i++ % NP;
  sp.pos[i * 3] = x; sp.pos[i * 3 + 1] = y; sp.pos[i * 3 + 2] = z; sp.vel[i * 3] = vx; sp.vel[i * 3 + 1] = vy; sp.vel[i * 3 + 2] = vz;
  sp.col[i * 3] = color.r; sp.col[i * 3 + 1] = color.g; sp.col[i * 3 + 2] = color.b; sp.life[i] = sp.max[i] = life; sp.size[i] = size; sp.home[i] = home ? 1 : 0;
}
const sporeGold = new THREE.Color(1.0, 0.62, 0.2), sporeTeal = new THREE.Color(0.1, 0.9, 0.8);
let charge = 0; // lumière absorbée par la panthère : ses rayures s'avivent
function updateSpores(dt, time, target) {
  for (let i = 0; i < NP; i++) {
    if (sp.life[i] <= 0) { sp.k[i] = 0; continue; }
    sp.life[i] -= dt;
    const a = i * 3, age = sp.max[i] - sp.life[i];
    // turbulence douce + traînée
    sp.vel[a] += Math.sin(time * 3.1 + i * 1.7) * 2.2 * dt; sp.vel[a + 1] += (0.9 + Math.sin(time * 2.3 + i)) * 1.2 * dt; sp.vel[a + 2] += Math.cos(time * 2.7 + i * 0.9) * 2.2 * dt;
    const drag = Math.exp(-2.2 * dt); sp.vel[a] *= drag; sp.vel[a + 1] *= drag; sp.vel[a + 2] = L(SPEED * 0.55, sp.vel[a + 2], drag);
    if (sp.home[i] && target && age > 0.3) { // aspirées par le chasseur
      const dx = target.x - sp.pos[a], dy = target.y - sp.pos[a + 1], dz = target.z - sp.pos[a + 2], d = Math.hypot(dx, dy, dz) + 1e-3, pull = Math.min(60, 14 + age * 40);
      sp.vel[a] += dx / d * pull * dt; sp.vel[a + 1] += dy / d * pull * dt; sp.vel[a + 2] += dz / d * pull * dt + (SPEED - sp.vel[a + 2]) * 3 * dt;
      if (d < 0.55) { sp.life[i] = 0; charge = Math.min(1.5, charge + 0.004); }
    }
    sp.pos[a] += sp.vel[a] * dt; sp.pos[a + 1] += sp.vel[a + 1] * dt; sp.pos[a + 2] += sp.vel[a + 2] * dt;
    const t = sp.life[i] / sp.max[i]; sp.k[i] = Math.min(1, t * 3) * Math.min(1, age * 12);
  }
  spGeo.attributes.position.needsUpdate = true; spGeo.attributes.aK.needsUpdate = true; spGeo.attributes.aCol.needsUpdate = true; spGeo.attributes.aSize.needsUpdate = true;
}
// La bête se dissout : chaque spore naît là où se trouvait sa peau.
function dissolve(beast, n, color, home, vz) {
  const pts = beast.sample(n, []);
  for (let i = 0; i < n; i++) {
    const a = i * 3, r1 = Math.random() - 0.5, r2 = Math.random(), r3 = Math.random() - 0.5;
    emit(pts[a], pts[a + 1], pts[a + 2], r1 * 2.4, 0.4 + r2 * 2.2, vz + r3 * 2.4, color, 0.9 + Math.random() * 1.1, 0.05 + Math.random() * 0.07, home);
  }
}
function puff(x, y, z, n, color, spread, size) { for (let i = 0; i < n; i++) emit(x + (Math.random() - 0.5) * spread, y + Math.random() * 0.2, z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 2.5, Math.random() * 1.4, SPEED * 0.6 + (Math.random() - 0.5) * 2.5, color, 0.5 + Math.random() * 0.7, size, false); }

// ---------- Obstacles et repères ----------
// Branche basse : un vrai tronc couché en travers du sentier, d'où pendent des gouttes de lumière rose.
const branchGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-7, 3.1, 0.4], [-3.4, 1.85, 0.15], [0, 1.52, 0], [3.4, 1.8, -0.15], [7, 3.0, -0.4]].map((p) => new THREE.Vector3(...p))), 28, 0.19, 7);
const branchMat = patch(world.barkMat(), { rim: '#3a0a36' });
const dropsGeo = (() => {
  const r = rng(7), parts = [];
  for (let i = 0; i < 13; i++) {
    const x = -3.2 + i * 0.53 + (r() - 0.5) * 0.2, top = 1.5 + 0.03 * x * x - 0.17, len = 0.22 + r() * 0.5;
    parts.push(new THREE.CylinderGeometry(0.008, 0.008, len, 4).translate(x, top - len / 2, 0).toNonIndexed());
    parts.push(new THREE.SphereGeometry(0.035 + r() * 0.025, 8, 6).translate(x, top - len, 0).toNonIndexed());
  }
  return mergeGeometries(parts);
})();
const dropsMat = patch(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.28, 1.35) }));
// Griffes au sol (Fuite) : l'endroit et l'instant où le prédateur va bondir.
const clawTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.lineCap = 'round';
  for (const [blur, width, alpha] of [[16, 16, 0.35], [5, 7, 0.8], [0, 2.5, 1]]) {
    g.shadowColor = '#1EB4DC'; g.shadowBlur = blur; g.strokeStyle = `rgba(190,245,255,${alpha})`; g.lineWidth = width;
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(74 + i * 50, 46); g.quadraticCurveTo(128 + i * 42, 128, 104 + i * 50, 214); g.stroke(); }
  }
  return new THREE.CanvasTexture(c);
})();
const clawGeo = new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2);
const clawMat = patch(new THREE.MeshBasicMaterial({ map: clawTex, color: new THREE.Color(0.5, 0.9, 1.1), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));

// ---------- État du jeu ----------
const son = new Son();
const State = { Menu: 0, Playing: 1, Dead: 2, Won: 3 };
let state = State.Menu, startPerf = 0, audioClock = false;
const now = () => performance.now() / 1000;
const songTime = () => (audioClock ? son.time() : now() - startPerf);
const latency = () => (audioClock ? son.latency : 0);
let preys = [], branches = [], cues = [], levelRoot = null, levelEnd = 0;
let score = 0, combo = 0, mult = 1, best = 0, held = false, waitRelease = false;
let pounceT = -1, shake = 0, deathTime = -9, lastBeat = -1, autoLast = -1;
let mode = 'traque', transferT = Infinity, gap = GAP_START, gapShown = GAP_START, chaserPounce = -1, dodgeSide = 1, camBlendT = -9;
let bestRun = null, currentRun = null, ghostIdx = 0, ghostHeld = false, ghostPounce = -1;
let vital = 0, fovPunch = 0, camY = 1.5, leanS = 0;
try { best = +localStorage.getItem('apex_best') || 0; bestRun = JSON.parse(localStorage.getItem('apex_ghost') || 'null'); } catch { best = 0; bestRun = null; }

function buildLevel() {
  if (levelRoot) scene.remove(levelRoot);
  levelRoot = new THREE.Group(); scene.add(levelRoot);
  preys = []; branches = []; cues = [];
  const r = rng(SEED);
  transferT = TRANSFER_BAR > 0 ? TRANSFER_BAR * 4 * SPB : -1;
  for (let bar = 2; bar < BARS; bar++) {
    const fuite = bar >= TRANSFER_BAR;
    if (fuite && TRANSFER_BAR > 0 && bar < TRANSFER_BAR + 2) continue;
    const d = fuite ? Math.floor((bar - TRANSFER_BAR) / (TRANSFER_BAR > 0 ? 5 : 8)) : Math.floor(bar / 8);
    const beats = [0];
    if (d >= 1) beats.push(2);
    if (d >= 2 && r() < 0.55) beats.push(1);
    if (d >= 3 && r() < 0.55) beats.push(3);
    if (d >= 4 && r() < 0.35) beats.push(1.5);
    if (d >= 5 && r() < 0.35) beats.push(2.5);
    beats.sort((a, b) => a - b);
    for (const b of beats) {
      const t = (bar * 4 + b) * SPB;
      if (fuite) {
        const z = t * SPEED + 1.1, m = new THREE.Mesh(clawGeo, clawMat); m.position.set(0, ground(0, z) + 0.07, z); levelRoot.add(m);
        cues.push({ t, tr: m, done: false });
      } else preys.push({ t, done: false, killed: false, doneAt: 0, side: r() < 0.5 ? -1 : 1, beast: null, x: 0, seed: r() });
    }
    if (r() < 0.25 + 0.08 * d && !beats.includes(3) && bar < BARS - 1) {
      const t = (bar * 4 + 3.5) * SPB, z = t * SPEED, g = new THREE.Group();
      g.position.set(0, ground(0, z), z); g.rotation.y = (r() - 0.5) * 0.3;
      g.add(new THREE.Mesh(branchGeo, branchMat), new THREE.Mesh(dropsGeo, dropsMat)); levelRoot.add(g);
      branches.push({ t, tr: g, passed: false });
    }
  }
  preys.sort((a, b) => a.t - b.t); cues.sort((a, b) => a.t - b.t);
  levelEnd = (BARS * 4 + 2) * SPB;
  for (const b of preyPool) { b.root.visible = false; b.user = null; }
}

function startRun() {
  son.init();
  buildLevel();
  score = 0; combo = 0; mult = 1; pounceT = -1; lastBeat = -1; autoLast = -1; charge = 0;
  audioClock = son.ok;
  if (audioClock) son.startRun(transferT);
  startPerf = now() + 1.0;
  currentRun = { score: 0, death: 0, ev: [] };
  ghostIdx = 0; ghostHeld = false; ghostPounce = -1;
  ghost.root.visible = !fuiteOnly && !!(bestRun && bestRun.ev && bestRun.ev.length);
  mode = 'traque'; gap = gapShown = GAP_START; chaserPounce = -1; camBlendT = -9;
  deer.root.visible = false; panther.body.rotation.set(0, 0, 0); deer.body.rotation.set(0, 0, 0);
  if (fuiteOnly) beginFuite(0, true);
  state = State.Playing;
  showScreen();
}

function beginFuite(t, silent = false) {
  mode = 'fuite'; camBlendT = silent ? -9 : t;
  gap = gapShown = GAP_START; chaserPounce = -1; pounceT = -1;
  const z = t * SPEED;
  deer.root.visible = true; deer.root.position.set(0, ground(0, z), z);
  ghost.root.visible = false; $('fantome').textContent = '';
  if (!silent) {
    U.uWave.value.set(0, z, U.uTime.value, 1.2); shake = 0.3;
    puff(0, ground(0, z) + 0.8, z + 1, 160, sporeGold, 1.6, 0.07);
    if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
  }
  if (audioClock) son.fuite();
  banner(); updateHud();
}

// ----- Jugement -----
function nearest(list, tj) {
  let target = null, bestD = 999;
  for (const p of list) { if (p.done) continue; const d = Math.abs(tj - p.t); if (d < bestD) { bestD = d; target = p; } if (p.t > tj + 1) break; }
  return [target, bestD];
}
function onRelease(t) {
  pounceT = t;
  const tj = t - latency();
  if (mode === 'fuite') {
    const [c, d] = nearest(cues, tj);
    if (!c || d > 0.28) return;
    if (d <= PERFECT) dodge(c, true); else if (d <= GOOD) dodge(c, false); else hit(c);
    return;
  }
  const [p, d] = nearest(preys, tj);
  if (!p || d > 0.28) return;                 // bond dans le vide : pas de pénalité
  if (d <= PERFECT) kill(p, true); else if (d <= GOOD) kill(p, false); else escape(p, t);
}
function gain(perfect) {
  combo++; mult = combo >= 24 ? 8 : combo >= 16 ? 4 : combo >= 8 ? 2 : 1;
  score += (perfect ? 300 : 100) * mult;
  judge(perfect ? 'parfait' : 'bien');
  if (audioClock) son.kill(perfect, combo);
  if (navigator.vibrate) navigator.vibrate(perfect ? 22 : 10);
  updateHud();
}
function kill(p, perfect) {
  p.done = true; p.killed = true; p.doneAt = songTime();
  if (p.beast) {
    dissolve(p.beast, perfect ? 420 : 260, sporeGold, true, PREY_SPEED);   // elle se désagrège là où elle se trouvait
    const pos = p.beast.root.position;
    U.uWave.value.set(pos.x, pos.z, U.uTime.value, perfect ? 1.0 : 0.5);    // et une onde de lumière traverse la forêt
    p.beast.root.visible = false; p.beast.user = null; p.beast = null;
  }
  shake = perfect ? 0.22 : 0.1; fovPunch = perfect ? 1 : 0.5;
  gain(perfect);
}
function escape(p, t) { p.done = true; p.doneAt = t; combo = 0; mult = 1; judge('rate'); if (audioClock) son.miss(); updateHud(); }
function dodge(c, perfect) {
  c.done = true; c.tr.visible = false;
  gap = Math.min(GAP_MAX, gap + (perfect ? 0.6 : 0.2)); dodgeSide = -dodgeSide; chaserPounce = c.t;
  const pos = deer.root.position;
  puff(pos.x, pos.y + 0.5, pos.z - 0.6, perfect ? 70 : 30, sporeGold, 0.8, 0.06);
  U.uWave.value.set(pos.x, pos.z, U.uTime.value, perfect ? 0.8 : 0.4);
  shake = perfect ? 0.16 : 0.08; fovPunch = perfect ? 0.8 : 0.4;
  gain(perfect);
}
function hit(c) {
  c.done = true; c.tr.visible = false; combo = 0; mult = 1; gap -= GAP_HIT; chaserPounce = c.t;
  judge('rate'); shake = 0.45; if (audioClock) son.hit();
  if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  updateHud();
  if (gap <= 0.01) endRun(false);
}
function endRun(won) {
  state = won ? State.Won : State.Dead; deathTime = now();
  currentRun.score = score; currentRun.death = won ? 99999 : songTime();
  if (!won) {
    if (mode === 'fuite') { chaserPounce = songTime(); gap = 0; dissolve(deer, 380, sporeGold, false, 0); deer.root.visible = false; }
    shake = 0.5; if (audioClock) son.hit(); if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  }
  if (score > best) { best = score; bestRun = currentRun; try { localStorage.setItem('apex_best', best); localStorage.setItem('apex_ghost', JSON.stringify(bestRun)); } catch { /* stockage indisponible */ } }
  waitRelease = held;
  showScreen();
}

// ---------- Entrées (un seul doigt) ----------
function press() {
  if (held) return; held = true;
  if (state === State.Playing) { if (!waitRelease) currentRun.ev.push(Math.max(0.0001, songTime())); return; }
  if (waitRelease) return;
  if (state === State.Menu || now() - deathTime > 0.7) { waitRelease = true; startRun(); }
}
function release() {
  if (!held) return; held = false;
  if (waitRelease) { waitRelease = false; return; }
  if (state === State.Playing && !autopilot) { const t = songTime(); currentRun.ev.push(-Math.max(0.0001, t)); onRelease(t); }
}
addEventListener('pointerdown', (e) => { e.preventDefault(); son.init(); press(); }, { passive: false });
addEventListener('pointerup', release); addEventListener('pointercancel', release);
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { son.init(); press(); } } if (e.code === 'KeyA') autopilot = !autopilot; });
addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });
addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Interface ----------
const fmt = (n) => n.toLocaleString('fr-FR');
const MOTS = { parfait: 'parfait', bien: 'bien', rate: 'manqué' };
function judge(kind) { const j = $('juge'); j.textContent = MOTS[kind]; j.className = ''; void j.offsetWidth; j.className = 'pop ' + kind; }
function banner() { const b = $('banniere'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function updateHud() {
  $('score').textContent = fmt(score);
  $('serie').textContent = combo > 1 ? 'série ' + combo : '';
  $('mult').classList.toggle('hide', mult <= 1); $('multN').textContent = '×' + mult;
  $('distance').classList.toggle('hide', mode !== 'fuite' || state !== State.Playing);
  $('distanceBar').style.width = clamp(gap / GAP_MAX, 0, 1) * 100 + '%';
  $('distanceBar').classList.toggle('danger', gap <= GAP_HIT + 0.01);
}
function showScreen() {
  $('menu').classList.toggle('hide', state !== State.Menu || studio);
  $('hud').classList.toggle('hide', state === State.Menu);
  $('fin').classList.toggle('hide', state !== State.Dead && state !== State.Won);
  $('record').textContent = best > 0 ? 'record · ' + fmt(best) : '';
  $('fantome').textContent = ghost.root.visible && bestRun ? 'fantôme à battre · ' + fmt(bestRun.score) : '';
  if (state === State.Dead || state === State.Won) {
    const caught = state === State.Dead && mode === 'fuite';
    $('finTitre').textContent = state === State.Won ? 'Territoire conquis' : caught ? 'Attrapé' : 'Repérée';
    $('finSous').textContent = state === State.Won ? 'La Canopée Noire est à toi.' : caught ? 'Le prédateur a eu ta peau.' : "Ta proie t'a entendue.";
    $('finScore').textContent = 'score ' + fmt(score) + '  ·  record ' + fmt(best);
    $('juge').className = '';
  }
  updateHud();
}
$('version').textContent = VERSION;

// ---------- Boucle ----------
let dt = 0, last = now(), time = 0;
const player = () => (mode === 'fuite' ? deer : panther);
const tmpV = new THREE.Vector3();
const prints = [], ripples = []; let printIdx = 0, rippleIdx = 0;

function updatePreys(t) {
  let nearestD = 1e9, nearestB = null;
  for (const p of preys) {
    const zc = p.t * SPEED + 1.3, dtp = p.t - t;
    if (!p.done && t - latency() > p.t + GOOD) escape(p, t);
    if (p.killed) continue;
    if (dtp > 9 || (p.done && t - p.doneAt > 1.4)) { if (p.beast) { p.beast.root.visible = false; p.beast.user = null; p.beast = null; } if (dtp > 9) break; continue; }
    if (!p.beast) { const b = preyPool.find((b) => !b.user); if (!b) continue; b.user = p; p.beast = b; b.root.visible = true; b.cr = 0; p.x = 0; }
    const b = p.beast;
    let z, run = 0, look = 0, phase = (t * 2.3 + p.seed * 7) % 1;
    if (p.done) {            // manquée : elle bondit hors du sentier
      const k = t - p.doneAt; p.x = p.side * (k * 7 + k * k * 5); z = zc + k * (SPEED + 2.5); run = 1;
    } else if (dtp > PREY_RUN) { z = zc - PREY_RUN * PREY_SPEED; look = Math.sin(t * 0.7 + p.seed * 9) * 0.5 + (dtp < PREY_RUN + 0.8 ? 1.0 : 0); phase = 0.2; }
    else { z = zc - dtp * PREY_SPEED; run = 1; }
    b.root.position.set(p.x, ground(p.x, z), z);
    b.update(dt, { phase, run, crouch: 0, air: -1, look, lean: p.done ? p.side * 0.5 : 0 });
    const d = Math.abs(z - t * SPEED);
    if (!p.done && d < nearestD) { nearestD = d; nearestB = b; }
  }
  return nearestB;
}

function updateGhost(t, phase) {
  if (!ghost.root.visible || !bestRun) return;
  while (ghostIdx < bestRun.ev.length && Math.abs(bestRun.ev[ghostIdx]) <= t) { const e = bestRun.ev[ghostIdx++]; if (e > 0) ghostHeld = true; else { ghostHeld = false; ghostPounce = -e; } }
  if (t > bestRun.death) { ghost.root.visible = false; $('fantome').textContent = ''; return; }
  const pt = ghostPounce >= 0 ? (t - ghostPounce) / 0.38 : 2, air = pt >= 0 && pt <= 1, z = t * SPEED;
  ghost.root.position.set(-1.5, ground(-1.5, z), z);
  ghost.update(dt, { phase, run: 1, crouch: ghostHeld && !air ? 1 : 0, air: air ? pt : -1, y: air ? Math.sin(pt * Math.PI) * 0.95 : 0 });
}

function frame() {
  requestAnimationFrame(frame);
  const tn = now(), rawDt = tn - last; dt = Math.min(0.05, rawDt); last = tn; time += dt;
  adapt(rawDt);
  U.uTime.value = time; grade.uniforms.uTime.value = time % 10;

  const playing = state === State.Playing;
  let t = 0, nearPrey = null;
  if (playing) {
    t = songTime();
    if (mode === 'traque' && transferT > 0 && t >= transferT) beginFuite(t);
    if (autopilot) {
      held = true;
      for (const p of mode === 'fuite' ? cues : preys) { if (p.t > t) break; if (p.t > autoLast && !p.done) onRelease(p.t + latency()); }
      autoLast = t;
    }
    son.schedule();
  }
  const tt = state === State.Menu ? time : songTime();
  const z = Math.max(0, tt) * SPEED;
  const beat = tt / SPB, b0 = Math.floor(beat), phase = (((beat % 1) + 1) % 1 + 0.18) % 1;

  if (state === State.Menu) {
    // Menu : la panthère trottine dans la jungle qui défile lentement.
    panther.root.position.set(0, ground(0, time * 2.2), time * 2.2);
    panther.update(dt, { phase: (time * 1.1) % 1, run: 0.55, crouch: 0, air: -1, look: Math.sin(time * 0.5) * 0.25 });
  } else if (mode === 'traque') {
    if (playing) {
      nearPrey = updatePreys(t);
      const pt = pounceT >= 0 ? (t - pounceT) / 0.38 : 2, air = pt >= 0 && pt <= 1;
      const y = air ? Math.sin(pt * Math.PI) * 0.95 : 0, lunge = air ? Math.sin(pt * Math.PI) * 0.9 : 0;
      panther.root.position.set(0, ground(0, z + lunge), z + lunge);
      const pose = params.get('pose'); // réglage des animations : ?studio=1&pose=run|crouch|air
      if (pose) panther.update(dt, { phase, run: 1, crouch: pose === 'crouch' ? 1 : 0, air: pose === 'air' ? 0.5 : -1, y: pose === 'air' ? 0.95 : 0 });
      else panther.update(dt, { phase, run: 1, crouch: held && !air ? 1 : 0, air: air ? pt : -1, y });
      if (air && pt > 0.9 && !panther.landed) { panther.landed = true; puff(0, panther.root.position.y + 0.1, panther.root.position.z + 0.6, 26, sporeTeal, 0.9, 0.045); }
      if (!air) panther.landed = false;
      updateGhost(t, phase);
    } else panther.update(dt, { phase: 0.2, run: 0, crouch: 1, air: -1 });   // repérée : elle se tapit
  } else {
    // Fuite : on est le cerf, la panthère talonne.
    if (playing) {
      for (const c of cues) { if (c.done) continue; if (c.t > t + 20) break; if (t - latency() > c.t + GOOD) { hit(c); if (state !== State.Playing) break; } }
    }
    if (state === State.Playing) {
      const pt = pounceT >= 0 ? (t - pounceT) / 0.38 : 2, air = pt >= 0 && pt <= 1, s = air ? Math.sin(pt * Math.PI) : 0;
      const x = dodgeSide * 1.3 * s, zz = z + s * 0.6;
      leanS += ((air ? dodgeSide * Math.cos(pt * Math.PI) : 0) - leanS) * Math.min(1, dt * 12);
      deer.root.position.set(x, ground(x, zz), zz);
      deer.update(dt, { phase: (beat + 0.3) % 1, run: 1, crouch: held && !air ? 1 : 0, air: air ? pt : -1, y: s, lean: leanS });
    }
    gapShown += (gap - gapShown) * Math.min(1, dt * 4);
    let off = 2.2 + Math.max(0, gapShown) * 0.5;
    if (camBlendT >= 0) off *= clamp((tt - camBlendT) / 1.0, 0, 1);
    const cp = chaserPounce >= 0 ? (tt - chaserPounce) / 0.45 : 2, cair = cp >= 0 && cp <= 1, cs = cair ? Math.sin(cp * Math.PI) : 0;
    const cz = deer.root.position.z - off + cs * off * (playing ? 0.7 : 1);
    panther.root.position.set(0, ground(0, cz), cz);
    panther.update(dt, { phase, run: !playing && cp > 1 ? 0 : 1, crouch: 0, air: cair ? cp : -1, y: cs * 1.1 });
  }
  if (state === State.Playing) {
    for (const b of branches) {
      if (b.passed || t < b.t) continue; b.passed = true;
      const crouched = autopilot || (held && (pounceT < 0 || t - pounceT > 0.35));
      if (!crouched) { endRun(false); break; }
    }
    if (t > levelEnd && state === State.Playing) endRun(true);
  }

  // ----- Lumière : rien ne clignote. La jungle s'éveille lentement avec la série. -----
  const P = player().root.visible ? player() : panther, pp = P.root.position, py = P.body.position.y;
  vital += ((state === State.Playing ? 0.25 + 0.75 * Math.min(1, combo / 20) : 0.35) - vital) * Math.min(1, dt * 0.9);
  U.uVital.value = vital;
  charge = Math.max(0, charge - dt * 0.5);
  const heart = 0.5 + 0.5 * Math.cos((beat % 1) * Math.PI * 2);            // battement discret, jamais un flash
  for (const m of stripeMats) m.emissiveIntensity = 0.85 + 0.5 * vital + charge * 0.9 + heart * 0.08;
  U.uPlayer.value.set(pp.x, pp.y + py, pp.z);
  selfLight.color.copy(mode === 'fuite' ? C.or : C.cyan); selfLight.intensity = 5 + 4 * vital + charge * 5;
  selfLight.position.set(pp.x, pp.y + 2.0 + py, pp.z + 1.4);
  if (mode === 'fuite') { preyLight.color.copy(C.cyan); preyLight.position.copy(panther.root.position); preyLight.position.y += 1.2; preyLight.intensity = 9; }
  else {
    preyLight.color.set('#ffbf6a');
    if (nearPrey) { preyLight.position.copy(nearPrey.root.position); preyLight.position.y += 1.1; }
    preyLight.intensity += ((nearPrey ? 11 : 0) - preyLight.intensity) * Math.min(1, dt * 4);
  }

  // ----- Empreintes et ondes : le sol mouillé s'allume sous les pattes, sur le temps -----
  if (state === State.Playing && b0 >= 0 && b0 !== lastBeat) {
    lastBeat = b0;
    const fx = pp.x, fz = pp.z + 0.5;
    for (const sx of [-0.2, 0.2]) { prints[printIdx % 24] = { x: fx + sx, z: fz + (sx > 0 ? 0.15 : -0.1), born: time }; printIdx++; }
    ripples[rippleIdx % 6] = { x: fx, z: fz, born: time, strong: b0 % 4 === 0 }; rippleIdx++;
  }
  const tint = mode === 'fuite' ? C.or : (vital > 0.6 ? C.violet : C.cyan);
  for (let i = 0; i < 24; i++) { const p = prints[i]; if (!p) continue; const a = (time - p.born) / 2.4; if (a >= 1) { world.dyn.hide(8 + i); prints[i] = null; } else world.dyn.set(8 + i, p.x, p.z, 0.3, tint, (1 - a) * (1 - a) * 0.55, 0); }
  for (let i = 0; i < 6; i++) { const p = ripples[i]; if (!p) continue; const a = (time - p.born) / 1.1; if (a >= 1) { world.dyn.hide(32 + i); ripples[i] = null; } else world.dyn.set(32 + i, p.x, p.z, 0.35 + a * (p.strong ? 2.6 : 1.7), tint, (1 - a) * (1 - a) * (p.strong ? 0.3 : 0.16), 1); }
  world.dyn.set(0, pp.x, pp.z, 2.3, mode === 'fuite' ? C.or : C.cyan, 0.09 + 0.1 * vital + charge * 0.2, 0);
  if (nearPrey) world.dyn.set(1, nearPrey.root.position.x, nearPrey.root.position.z, 2.6, C.or, 0.32, 0); else world.dyn.hide(1);
  if (mode === 'fuite') world.dyn.set(2, panther.root.position.x, panther.root.position.z, 3, C.cyan, 0.3, 0); else world.dyn.hide(2);

  // ----- Caméra : basse, proche, portée par des ressorts -----
  shake = Math.max(0, shake - dt * 2.2); fovPunch = Math.max(0, fovPunch - dt * 2.5);
  let kk = 0;
  if (mode === 'fuite') { const a = camBlendT < 0 ? 1 : clamp((tt - camBlendT) / 1.4, 0, 1); kk = a * a * (3 - 2 * a); }
  const gy = pathH(pp.z);
  camY += (gy + L(1.95, 3.4, kk) - (P.cr || 0) * 0.32 + Math.max(0, py) * 0.3 - camY) * Math.min(1, dt * 7);
  if (studio) { camera.position.set(3.3, pp.y + 0.9, pp.z + 0.1); camera.lookAt(0, pp.y + 0.7, pp.z + 0.1); }
  else {
    camera.position.set(L(0.6, 1.5, kk) + Math.sin(time * 0.7) * 0.04 + (Math.random() - 0.5) * shake * 0.2, camY + (Math.random() - 0.5) * shake * 0.2, pp.z - L(5.7, 10, kk));
    camera.lookAt(pp.x * 0.35, gy + L(0.95, 0.75, kk), pp.z + L(9, 4.2, kk));
  }
  const fov = 60 + 3 * vital + fovPunch * 2.2;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const cz = camera.position.z;
  U.uCamZ.value = cz;
  U.uBend.value.set(studio ? 0 : 0.00085 * Math.sin(cz * 0.012) + 0.0004 * Math.sin(cz * 0.031 + 1), studio ? 0 : -0.00032);
  world.follow(camera.position);
  moon.position.set(-5, 10, cz - 8); moon.target.position.set(0, 0, cz + 6);
  bloom.strength = 0.5 + 0.12 * vital + charge * 0.12;

  updateSpores(dt, time, mode === 'traque' ? tmpV.set(pp.x, pp.y + 0.9, pp.z + 0.3) : null);
  composer.render();
}

// Qualité adaptative : si le téléphone peine, on réduit la définition plutôt que la fluidité.
let fAcc = 0, fN = 0, drops = 0;
function adapt(d) {
  if (d > 0.2 || d <= 0) return;             // onglet caché ou reprise : on ignore
  fAcc += d; fN++;
  if (fN < 90) return;
  const avg = fAcc / fN; fAcc = 0; fN = 0;
  if (avg > 0.0215 && drops < 3) { drops++; pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
}

function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  world.resize(innerHeight * pixelRatio); spores.material.uniforms.uScale.value = innerHeight * pixelRatio * 1.1;
}
addEventListener('resize', resize);
resize();
buildLevel();
$('chargement').classList.add('hide');
showScreen();
frame();

window.APEX = { start: startRun, get state() { return state; }, set auto(v) { autopilot = v; }, get score() { return score; }, endRun, panther, deer, get mode() { return mode; }, get px() { return pixelRatio; } };
