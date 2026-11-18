// APEX — le monde : la Canopée Noire en vrai volume.
// Terrain en relief, sentier qui serpente (courbure du monde), troncs, fougères, champignons, lianes,
// canopée, brume, lucioles. Tout est instancié et recyclé sur le GPU : rien n'est déplacé image par image.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPAN = 160; // longueur de jungle recyclée devant la caméra

// Uniforms partagés par tous les matériaux du monde.
export const U = {
  uTime: { value: 0 },
  uPlayer: { value: new THREE.Vector3() },
  uBend: { value: new THREE.Vector2() },   // courbure du monde (le sentier serpente, l'horizon plonge)
  uCamZ: { value: 0 },
  uWave: { value: new THREE.Vector4(0, 0, -99, 0) }, // onde de lumière : x, z, instant de départ, force
  uVital: { value: 0 },                    // 0 = jungle endormie, 1 = jungle éveillée (série en cours)
};

// ---------- Relief : la même formule côté JS (placement) et côté GPU (affichage) ----------
export const pathH = (z) => 0.55 * Math.sin(z * 0.045) + 0.3 * Math.sin(z * 0.11 + 1.7);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function ground(x, z) {
  const a = Math.abs(x), side = sstep(1.7, 7, a);
  const bumps = 0.9 * Math.sin(x * 0.33 + 1.3) * Math.sin(z * 0.21 + 0.4) + 0.45 * Math.sin(x * 0.8 + z * 0.47) + 0.2 * Math.sin(x * 1.9 - z * 1.3);
  return pathH(z) + side * (0.5 + 0.12 * a) + side * bumps * 0.5 + 0.035 * Math.sin(x * 3.1 + z * 2.3) * (0.3 + side);
}

export const COMMON = /* glsl */`
#define SPAN ${SPAN.toFixed(1)}
uniform float uTime; uniform vec3 uPlayer; uniform vec2 uBend; uniform float uCamZ; uniform vec4 uWave; uniform float uVital;
float pathH(float z){ return 0.55*sin(z*0.045) + 0.3*sin(z*0.11+1.7); }
float ground(vec2 p){
  float a = abs(p.x); float side = smoothstep(1.7, 7.0, a);
  float bumps = 0.9*sin(p.x*0.33+1.3)*sin(p.y*0.21+0.4) + 0.45*sin(p.x*0.8+p.y*0.47) + 0.2*sin(p.x*1.9-p.y*1.3);
  return pathH(p.y) + side*(0.5+0.12*a) + side*bumps*0.5 + 0.035*sin(p.x*3.1+p.y*2.3)*(0.3+side);
}
float wrapZ(float z){ float b = uCamZ - 14.0; return b + mod(z - b, SPAN); }
float hash1(float n){ return fract(sin(n)*43758.5453); }
// Onde de lumière douce qui parcourt la forêt après une mise à mort.
float waveAt(vec2 xz){
  float age = uTime - uWave.z;
  float d = distance(xz, uWave.xy);
  return uWave.w * exp(-pow((d - age*26.0)/7.0, 2.0)) * smoothstep(2.8, 0.0, age) * step(0.0, age);
}
// Respiration lente + éveil au passage du joueur + onde.
float lifeAt(vec2 xz, float seed){
  float prox = smoothstep(12.0, 1.5, distance(xz, uPlayer.xz));
  return (0.8 + 0.2*sin(uTime*0.6 + seed)) * mix(0.5, 1.0, uVital) + prox*0.55 + waveAt(xz);
}
`;

const BEND = /* glsl */`
  mvPosition.xy += uBend * mvPosition.z * mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
`;

// Ajoute la courbure du monde (et, au besoin, le recyclage) à un matériau standard de three.js.
export function patch(mat, { wrap = false, terrain = false, rim = null, glass = 0, stripes = 0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (rim) sh.uniforms.uRim = { value: new THREE.Color(rim) };
    let v = sh.vertexShader.replace('#include <common>', '#include <common>\n' + COMMON);
    if (terrain) {
      v = v.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec2 gp = position.xz + modelMatrix[3].xz;
        #ifdef USE_MAP
          vMapUv = gp * 0.23;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = gp * 0.23;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = gp * 0.23;
        #endif`)
        .replace('#include <beginnormal_vertex>', `float ge = 0.4; float gh = ground(gp);
        vec3 objectNormal = normalize(vec3(ground(gp - vec2(ge, 0.0)) - ground(gp + vec2(ge, 0.0)), 2.0*ge, ground(gp - vec2(0.0, ge)) - ground(gp + vec2(0.0, ge))));`)
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, gh, position.z);');
    }
    v = v.replace('#include <project_vertex>', `
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      wp = modelMatrix * wp;
      ${wrap ? `{ vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z); wp.z += oz - o.z; wp.y += ground(vec2(o.x, oz)); }` : ''}
      vec4 mvPosition = viewMatrix * wp;
      ${BEND}`);
    sh.vertexShader = v;
    let f = sh.fragmentShader, extra = '';
    // Rayures : seule la partie claire de la texture émet de la lumière, le pelage reste noir velours.
    if (stripes) extra += `totalEmissiveRadiance *= ${stripes.toFixed(2)} * smoothstep(0.035, 0.26, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));\n`;
    // Verre : plus lumineux sur les bords qu'au centre.
    if (glass) extra += `totalEmissiveRadiance *= 0.45 + ${glass.toFixed(2)} * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 1.6);\n`;
    // Liseré : détoure la silhouette sur le noir.
    if (rim) { f = 'uniform vec3 uRim;\n' + f; extra += 'totalEmissiveRadiance += uRim * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0);\n'; }
    if (extra) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + extra);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => `apex-${wrap}-${terrain}-${rim}-${glass}-${stripes}`;
  return mat;
}

const fogU = () => ({ fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, fogNear: { value: 1 }, fogFar: { value: 2 } });
const FOG_FADE = /* glsl */`
  #ifdef USE_FOG
    col *= exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #endif`;

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Carte de relief calculée à partir de la luminosité d'une texture (écorce, sol).
function normalFrom(tex, strength) {
  const img = tex.image, w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const L = (x, y) => { const i = (((y + h) % h) * w + ((x + w) % w)) * 4; return (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (L(x + 1, y) - L(x - 1, y)) * strength, dy = (L(x, y + 1) - L(x, y - 1)) * strength;
    const n = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx * n * 0.5 + 0.5) * 255; d[i + 1] = (dy * n * 0.5 + 0.5) * 255; d[i + 2] = (n * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4;
  return t;
}

// ---------- Matériau de feuillage (frondes, feuilles) : vent, poussée du joueur, lueur vivante ----------
function foliage({ map, tint, dark, glow, sway, push, follow }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU(), map: { value: map }, uTint: { value: new THREE.Color(tint) }, uDark: { value: dark }, uGlow: { value: glow }, uSway: { value: sway }, uPush: { value: push } },
    fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      uniform float uSway; uniform float uPush;
      varying vec2 vUv; varying float vGlow;
      void main(){
        vUv = uv;
        vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z);
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.z += oz - o.z;
        wp.y += ${follow ? 'ground(vec2(o.x, oz))' : 'pathH(oz)'};
        float ph = hash1(o.x*12.9898 + o.z*78.233) * 6.2831;
        float f = uv.y, f2 = f*f;
        wp.x += sin(uTime*1.1 + ph + wp.y*0.6) * uSway * f2;
        wp.z += cos(uTime*0.8 + ph*1.7) * uSway * 0.6 * f2;
        vec2 dp = wp.xz - uPlayer.xz;
        float pk = smoothstep(2.6, 0.4, length(dp)) * smoothstep(3.0, 0.0, abs(wp.y - uPlayer.y)) * f * uPush;
        wp.xz += normalize(dp + 1e-4) * pk; wp.y -= pk*0.35;
        vGlow = lifeAt(vec2(o.x, oz), ph);
        vec4 mvPosition = viewMatrix * wp;
        ${BEND}
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform sampler2D map; uniform vec3 uTint; uniform float uDark; uniform float uGlow;
      varying vec2 vUv; varying float vGlow;
      void main(){
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.5) discard;
        float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
        vec3 col = t.rgb * uTint * (uDark + vGlow * uGlow * smoothstep(0.1, 0.55, lum));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

function instanced(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.frustumCulled = false; m.matrixAutoUpdate = false;
  return m;
}

// ---------- Construction ----------
export function buildWorld(scene, T) {
  const r = rng(1789);
  const R = (a, b) => a + (b - a) * r();
  const side = () => (r() < 0.5 ? -1 : 1);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const put = (mesh, i, x, y, z, rx, ry, rz, sx, sy, sz) => { E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz)); mesh.setMatrixAt(i, M); };

  // ----- Ciel : une lueur violette au bout du sentier, noire partout ailleurs -----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(130, 24, 12), new THREE.ShaderMaterial({
    uniforms: { ...U }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec2 uBend; uniform float uVital; uniform float uTime; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        d.x += uBend.x * 95.0;                         // la lueur suit les virages du sentier
        float glow = exp(-pow((d.y - 0.02)*4.2, 2.0)) * exp(-pow(d.x*1.7, 2.0)) * step(0.0, d.z);
        vec3 night = vec3(0.012, 0.011, 0.032);
        vec3 col = night + vec3(0.16, 0.09, 0.42) * glow * (0.55 + 0.45*uVital) + vec3(0.02, 0.05, 0.09) * exp(-pow(d.y*2.2, 2.0)) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  // ----- Sol : relief calculé sur le GPU, terre mouillée qui accroche la lumière -----
  T.sol.wrapS = T.sol.wrapT = THREE.MirroredRepeatWrapping;
  const solN = normalFrom(T.sol, 3.2);
  const groundMat = patch(new THREE.MeshStandardMaterial({
    map: T.sol, normalMap: solN, normalScale: new THREE.Vector2(1.15, 1.15), roughness: 0.5, metalness: 0.0, color: '#8a87b0',
    emissiveMap: T.sol, emissive: new THREE.Color(0.22, 0.24, 0.38),
  }), { terrain: true });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(84, 150, 84, 150).rotateX(-Math.PI / 2), groundMat);
  groundMesh.frustumCulled = false; scene.add(groundMesh);

  // ----- Troncs colossaux : vraie géométrie, racines en contreforts -----
  T.ecorce.wrapS = T.ecorce.wrapT = THREE.RepeatWrapping;
  const trunkGeo = (() => {
    const RS = 22, HS = 15, H = 44, pos = [], uv = [], idx = [];
    for (let i = 0; i <= HS; i++) {
      const t = i / HS, y = H * Math.pow(t, 2.3);
      for (let j = 0; j <= RS; j++) {
        const th = j / RS * Math.PI * 2, flare = Math.exp(-y / 1.5);
        let rad = 1 + flare * (0.8 + 1.9 * Math.pow(Math.abs(Math.sin(th * 2.5 + 0.6)), 1.5)) + 0.07 * Math.sin(th * 3 + y * 0.35) + 0.05 * Math.sin(th * 7 + y * 1.1);
        rad *= 1 - 0.25 * t;
        pos.push(Math.cos(th) * rad, y - 0.6, Math.sin(th) * rad); uv.push(j / RS * 4, y * 0.14);
      }
    }
    for (let i = 0; i < HS; i++) for (let j = 0; j < RS; j++) { const a = i * (RS + 1) + j, b = a + RS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  })();
  const barkN = normalFrom(T.ecorce, 4);
  const barkMat = () => new THREE.MeshStandardMaterial({ map: T.ecorce, normalMap: barkN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.92, color: '#7d7aa3', emissiveMap: T.ecorce, emissive: new THREE.Color(0.05, 0.07, 0.11) });
  const trunks = instanced(trunkGeo, patch(barkMat(), { wrap: true, rim: '#0b0a26' }), 58);
  for (let i = 0; i < 58; i++) {
    const near = i < 24, s = near ? R(0.75, 1.5) : R(0.6, 1.9);
    put(trunks, i, side() * (near ? R(6.5, 13) : R(13, 36)), 0, R(0, SPAN), 0, R(0, 6.28), 0, s, s * R(0.9, 1.2), s);
  }
  scene.add(trunks);

  // ----- Fougères : chaque plante est une rosette de frondes arquées -----
  const frondGeo = (() => {
    const g = new THREE.PlaneGeometry(0.36, 1, 2, 7), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.5, a = y * 1.3, x = p.getX(i);
      p.setXYZ(i, x, Math.sin(a) / 1.3 + Math.abs(x) * 0.25, (1 - Math.cos(a)) / 1.3); // arche + léger pli en V
    }
    g.computeVertexNormals(); return g;
  })();
  const NPLANT = 150, fr = [];
  for (let i = 0; i < NPLANT; i++) {
    const x = side() * (1.9 + 13 * Math.pow(r(), 1.8)), z = R(0, SPAN), size = R(0.8, 1.9) * (Math.abs(x) < 3.2 ? 0.75 : 1), n = 7 + Math.floor(r() * 4), a0 = R(0, 6.28);
    for (let k = 0; k < n; k++) fr.push([x, z, a0 + k / n * 6.283 + R(-0.25, 0.25), R(0.1, 0.75), size * R(0.8, 1.25)]);
  }
  const fronds = instanced(frondGeo, foliage({ map: T.fronde, tint: '#ffffff', dark: 0.5, glow: 1.5, sway: 0.07, push: 0.8, follow: true }), fr.length);
  fr.forEach(([x, z, yaw, tilt, len], i) => put(fronds, i, x, -0.04, z, tilt, yaw, 0, len * 1.15, len, len));
  scene.add(fronds);

  // ----- Grandes feuilles : buissons bas sur les talus, et canopée au-dessus du sentier -----
  const leafGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 2, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.5, x = p.getX(i); p.setXYZ(i, x, y, 0.25 * y * y + Math.abs(x) * 0.18); }
    g.computeVertexNormals(); return g;
  })();
  const bush = [];
  for (let i = 0; i < 70; i++) {
    const x = side() * R(3.2, 15), z = R(0, SPAN), n = 4 + Math.floor(r() * 4), a0 = R(0, 6.28), s = R(0.7, 1.7);
    for (let k = 0; k < n; k++) bush.push([x, z, a0 + k / n * 6.283 + R(-0.3, 0.3), R(0.35, 1.05), s * R(0.7, 1.2)]);
  }
  const bushes = instanced(leafGeo, foliage({ map: T.feuille, tint: '#cfd8ff', dark: 0.42, glow: 0.8, sway: 0.05, push: 0.5, follow: true }), bush.length);
  bush.forEach(([x, z, yaw, tilt, s], i) => put(bushes, i, x, -0.05, z, tilt, yaw, 0, s, s, s));
  scene.add(bushes);
  const NCAN = 300;
  const canopy = instanced(leafGeo, foliage({ map: T.feuille, tint: '#9aa6e8', dark: 0.13, glow: 0.22, sway: 0.12, push: 0, follow: false }), NCAN);
  for (let i = 0; i < NCAN; i++) {
    const s = R(2.2, 4.8), x = R(-22, 22);
    put(canopy, i, x, R(12.5, 19) + (Math.abs(x) < 3.5 ? 3.5 : 0) + Math.abs(x) * 0.1, R(0, SPAN), R(1.2, 2.0), R(0, 6.28), R(-0.3, 0.3), s, s, s);
  }
  scene.add(canopy);

  // ----- Champignons : vrais volumes, lumière qui vient des lamelles -----
  const mushGeo = (() => {
    const stem = new THREE.CylinderGeometry(0.06, 0.1, 1, 8, 4, true).translate(0, 0.5, 0);
    const sp = stem.attributes.position, sE = new Float32Array(sp.count), sC = new Float32Array(sp.count);
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); sp.setX(i, sp.getX(i) + 0.07 * y * y); sE[i] = 0.12 + 0.5 * y * y; }
    const prof = [[0.001, 0.36], [0.2, 0.34], [0.38, 0.25], [0.5, 0.11], [0.54, 0.0], [0.48, -0.03], [0.28, 0.03], [0.08, 0.07]];
    const cap = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y + 0.98)), 14);
    const cp = cap.attributes.position, cE = new Float32Array(cp.count), cC = new Float32Array(cp.count);
    for (let i = 0; i < cp.count; i++) {
      cp.setX(i, cp.getX(i) + 0.07);
      const rad = Math.hypot(cp.getX(i) - 0.07, cp.getZ(i)), top = (i % prof.length) < 5;
      cE[i] = top ? 0.22 + 0.55 * Math.pow(rad / 0.54, 2) : 1.0; cC[i] = top ? 1 : 0;
    }
    stem.setAttribute('aE', new THREE.BufferAttribute(sE, 1)); stem.setAttribute('aCap', new THREE.BufferAttribute(sC, 1));
    cap.setAttribute('aE', new THREE.BufferAttribute(cE, 1)); cap.setAttribute('aCap', new THREE.BufferAttribute(cC, 1));
    const g = mergeGeometries([stem.toNonIndexed(), cap.toNonIndexed()]); g.computeVertexNormals();
    return g;
  })();
  const mushMat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU() }, fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      attribute float aE; attribute float aCap;
      varying float vE; varying float vCap; varying float vGlow; varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vC;
      void main(){
        vE = aE; vCap = aCap; vL = position; vC = instanceColor;
        vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z);
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.z += oz - o.z; wp.y += ground(vec2(o.x, oz));
        float ph = hash1(o.x*12.9898 + o.z*78.233) * 6.2831;
        float f = clamp(position.y / 1.35, 0.0, 1.0);
        wp.x += sin(uTime*0.9 + ph) * 0.03 * f * f;
        vec2 dp = wp.xz - uPlayer.xz;
        float pk = smoothstep(1.8, 0.3, length(dp)) * smoothstep(2.5, 0.0, abs(wp.y - uPlayer.y)) * f * 0.35;
        wp.xz += normalize(dp + 1e-4) * pk;
        vGlow = lifeAt(vec2(o.x, oz), ph);
        vec4 mvPosition = viewMatrix * wp;
        ${BEND}
        vN = normalize(mat3(viewMatrix) * mat3(instanceMatrix) * normal); vV = -mvPosition.xyz;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      varying float vE; varying float vCap; varying float vGlow; varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vC;
      void main(){
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float spots = vCap * smoothstep(0.5, 0.8, sin(vL.x*19.0 + 1.0) * sin(vL.z*19.0 + 2.0));
        vec3 col = vC*0.04 + vC*(vE*vGlow*0.62) + vec3(1.0, 0.92, 1.0)*(vE*vE*vE*vGlow*0.1) + vC*spots*0.3*vGlow + vC*rim*0.3;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const palette = [new THREE.Color('#E82ED6'), new THREE.Color('#E82ED6'), new THREE.Color('#b048f0'), new THREE.Color('#0BDACB'), new THREE.Color('#2a8cff')];
  const clusters = [], mu = [];
  for (let i = 0; i < 64; i++) {
    const x = side() * (2.1 + 11 * Math.pow(r(), 1.6)), z = R(0, SPAN), col = palette[Math.floor(r() * palette.length)], n = 3 + Math.floor(r() * 5), big = R(0.45, 1.15);
    clusters.push([x, z, col, big]);
    for (let k = 0; k < n; k++) { const a = R(0, 6.28), d = R(0.05, 0.55) * big, h = big * R(0.35, 1.0); mu.push([x + Math.cos(a) * d, z + Math.sin(a) * d, h, h * R(0.7, 1.25), R(0, 6.28), R(-0.2, 0.2), col]); }
  }
  const mush = instanced(mushGeo, mushMat, mu.length);
  mu.forEach(([x, z, h, w, yaw, tilt, col], i) => { put(mush, i, x, -0.03, z, tilt, yaw, tilt * 0.6, w, h, w); mush.setColorAt(i, col); });
  scene.add(mush);

  // ----- Flaques de lumière au sol (sous les champignons) et décalques mobiles (pas, proies) -----
  const decalGeo = new THREE.PlaneGeometry(2, 2, 6, 6).rotateX(-Math.PI / 2);
  const decalMat = (wrap) => new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU() }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      attribute float aShape; varying vec2 vUv; varying vec3 vC; varying float vShape; varying float vK;
      void main(){
        vUv = uv; vShape = aShape; vC = instanceColor;
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        ${wrap ? `vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z); wp.z += oz - o.z;
        vK = lifeAt(vec2(o.x, oz), hash1(o.x*12.9898 + o.z*78.233) * 6.2831);` : 'vK = 1.0;'}
        wp.y = ground(wp.xz) + 0.05;
        vec4 mvPosition = viewMatrix * wp;
        ${BEND}
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec3 vC; varying float vShape; varying float vK;
      void main(){
        float rr = length(vUv - 0.5) * 2.0;
        float a = vShape < 0.5 ? pow(max(0.0, 1.0 - rr), 2.0) : smoothstep(0.1, 0.0, abs(rr - 0.85));
        vec3 col = vC * a * vK;
        ${FOG_FADE}
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const pools = instanced(decalGeo, decalMat(true), clusters.length);
  pools.geometry = decalGeo.clone();
  pools.geometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(clusters.length), 1));
  clusters.forEach(([x, z, col, big], i) => { put(pools, i, x, 0, z, 0, 0, 0, 2.4 * big + 1.2, 1, 2.4 * big + 1.2); pools.setColorAt(i, col.clone().multiplyScalar(0.3)); });
  scene.add(pools);
  const NDYN = 56;
  const dynMesh = instanced(decalGeo.clone(), decalMat(false), NDYN);
  const dynShape = new THREE.InstancedBufferAttribute(new Float32Array(NDYN), 1);
  dynMesh.geometry.setAttribute('aShape', dynShape);
  const black = new THREE.Color(0, 0, 0), tmpC = new THREE.Color();
  for (let i = 0; i < NDYN; i++) { put(dynMesh, i, 0, -50, 0, 0, 0, 0, 0.001, 1, 0.001); dynMesh.setColorAt(i, black); }
  scene.add(dynMesh);
  const dyn = {
    n: NDYN,
    set(i, x, z, radius, color, k, shape = 0) {
      put(dynMesh, i, x, 0, z, 0, 0, 0, radius, 1, radius); dynMesh.setColorAt(i, tmpC.copy(color).multiplyScalar(k)); dynShape.array[i] = shape;
      dynMesh.instanceMatrix.needsUpdate = true; dynMesh.instanceColor.needsUpdate = true; dynShape.needsUpdate = true;
    },
    hide(i) { dynMesh.setColorAt(i, black); dynMesh.instanceColor.needsUpdate = true; },
  };

  // ----- Lianes : brins qui pendent de la canopée, perles bleues, balancement -----
  const SWAY = /* glsl */`
    float d = DROP;
    wp.x += sin(uTime*0.7 + ph) * 0.011 * d * d + sin(uTime*1.9 + ph*2.0) * 0.004 * d;
    wp.z += cos(uTime*0.55 + ph*1.3) * 0.008 * d * d;`;
  const strandGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 10, true).translate(0, -0.5, 0);
  const strandMat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU() }, fog: true,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      varying float vH;
      void main(){
        vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z);
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.z += oz - o.z; float base = pathH(oz);
        float ph = hash1(o.x*12.9898 + o.z*78.233) * 6.2831;
        #define DROP (o.y - wp.y)
        ${SWAY}
        wp.y += base; vH = d;
        vec4 mvPosition = viewMatrix * wp;
        ${BEND}
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      varying float vH;
      void main(){ gl_FragColor = vec4(vec3(0.012, 0.03, 0.03) + vec3(0.0, 0.02, 0.03) * fract(vH*0.7), 1.0);
        #include <fog_fragment>
      }`,
  });
  const strandList = [], pearlList = [];
  for (let i = 0; i < 26; i++) {
    const gx = side() * R(1.2, 11), gz = R(0, SPAN), n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const x = gx + R(-0.7, 0.7), z = gz + R(-0.7, 0.7), top = R(10, 14), low = Math.abs(x) < 2.4 ? R(4.2, 7) : R(2.2, 6), len = top - low;
      strandList.push([x, top, z, len]);
      const np = 4 + Math.floor(r() * 5);
      for (let q = 0; q < np; q++) pearlList.push([x, top, z, len * (0.25 + 0.75 * (q + r() * 0.6) / np), R(0.045, 0.09)]);
    }
  }
  const strands = instanced(strandGeo, strandMat, strandList.length);
  strandList.forEach(([x, top, z, len], i) => put(strands, i, x, top, z, 0, 0, 0, 0.022, len, 0.022));
  scene.add(strands);
  const pearlGeo = new THREE.OctahedronGeometry(1, 1);
  pearlGeo.setAttribute('aDrop', new THREE.InstancedBufferAttribute(new Float32Array(pearlList.map((p) => p[3])), 1));
  const pearls = instanced(pearlGeo, new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU() }, fog: true,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      attribute float aDrop; varying float vGlow; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z);
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.z += oz - o.z; wp.y -= aDrop;
        float ph = hash1(o.x*12.9898 + o.z*78.233) * 6.2831;
        #define DROP aDrop
        ${SWAY}
        wp.y += pathH(oz);
        vGlow = lifeAt(vec2(o.x, oz), ph + aDrop*3.0);
        vec4 mvPosition = viewMatrix * wp;
        ${BEND}
        vN = normalize(mat3(viewMatrix) * normal); vV = -mvPosition.xyz;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      varying float vGlow; varying vec3 vN; varying vec3 vV;
      void main(){
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        vec3 col = vec3(0.10, 0.45, 1.0) * (0.25 + vGlow*0.75) + vec3(0.7, 0.9, 1.0) * core * vGlow * 0.45;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  }), pearlList.length);
  pearlList.forEach(([x, top, z, , rad], i) => put(pearls, i, x, top, z, 0, 0, 0, rad, rad * 1.25, rad));
  scene.add(pearls);

  // ----- Rayons de lune qui tombent entre les feuilles -----
  const rayGeo = mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)]);
  const rays = instanced(rayGeo, new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU() }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      varying vec2 vUv; varying float vP;
      void main(){
        vUv = uv; vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z);
        vec4 wp = instanceMatrix * vec4(position, 1.0); wp.z += oz - o.z; wp.y += pathH(oz);
        vP = hash1(o.x*12.9898 + o.z*78.233) * 6.2831;
        vec4 mvPosition = viewMatrix * wp;
        ${BEND}
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uVital; varying vec2 vUv; varying float vP;
      void main(){
        float a = pow(sin(vUv.x * 3.14159), 2.0) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        a *= 0.05 * (0.7 + 0.3*sin(uTime*0.35 + vP)) * (0.6 + 0.4*uVital);
        vec3 col = vec3(0.35, 0.3, 0.95) * a;
        ${FOG_FADE}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), 16);
  for (let i = 0; i < 16; i++) put(rays, i, side() * R(2.5, 14), -0.5, R(0, SPAN), R(-0.25, 0.25), R(0, 3.14), R(-0.3, 0.3), R(1.8, 4.5), R(14, 20), R(1.8, 4.5));
  scene.add(rays);

  // ----- Brume au ras du sol : grandes nappes douces, toujours face à la caméra -----
  const NM = 22, mistGeo = new THREE.PlaneGeometry(1, 1);
  mistGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: NM * 2 }, (_, i) => (i % 2 ? R(3.5, 7) : R(14, 26)))), 2));
  const mist = instanced(mistGeo, new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU() }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      attribute vec2 aSize; varying vec2 vUv; varying float vNear;
      void main(){
        vUv = uv; vec3 o = instanceMatrix[3].xyz; float oz = wrapZ(o.z);
        float ph = hash1(o.x*12.9898 + o.z*78.233) * 6.2831;
        vec3 c = vec3(o.x + sin(uTime*0.05 + ph)*3.0, o.y + ground(vec2(o.x, oz)), oz);
        vec4 mvPosition = viewMatrix * vec4(c, 1.0);
        mvPosition.xy += uBend * mvPosition.z * mvPosition.z;
        mvPosition.xy += position.xy * aSize;
        vNear = smoothstep(5.0, 16.0, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uVital; varying vec2 vUv; varying float vNear;
      void main(){
        vec2 q = (vUv - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - dot(q, q)), 2.0) * vNear;
        vec3 col = vec3(0.10, 0.075, 0.26) * a * (0.42 + 0.2*uVital);
        ${FOG_FADE}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), NM);
  for (let i = 0; i < NM; i++) put(mist, i, R(-13, 13), R(0.5, 2.4), R(0, SPAN), 0, 0, 0, 1, 1, 1);
  scene.add(mist);

  // ----- Lucioles et spores : elles dérivent, scintillent, et s'écartent quand on passe -----
  const NF = 520, fp = new Float32Array(NF * 3), fs = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { fp[i * 3] = R(-11, 11); fp[i * 3 + 1] = R(0.15, 6.5) * R(0.3, 1); fp[i * 3 + 2] = R(0, 64); fs[i] = r(); }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
  const flies = new THREE.Points(fg, new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogU(), uScale: { value: 1 } }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      ${COMMON}
      attribute float aSeed; uniform float uScale; varying vec3 vC; varying float vA;
      void main(){
        vec3 p = position; float b = uCamZ - 6.0;
        p.z = b + mod(p.z - b, 64.0);
        float s = aSeed * 6.2831;
        p.x += sin(uTime*0.23 + s*3.0) * 0.9; p.y += sin(uTime*0.31 + s*5.0) * 0.35; p.z += cos(uTime*0.19 + s*7.0) * 0.7;
        p.y += ground(vec2(p.x, p.z));
        vec3 dp = p - (uPlayer + vec3(0.0, 0.7, 0.0)); float dl = length(dp);
        p += normalize(dp + 1e-4) * smoothstep(2.0, 0.2, dl) * 1.1;        // souffle du passage
        float tw = 0.5 + 0.5*sin(uTime*(0.8 + aSeed*1.7) + s*11.0);
        vA = (0.25 + 0.75*tw*tw) * mix(0.55, 1.0, uVital);
        vC = aSeed < 0.62 ? vec3(0.05, 0.95, 0.85) : (aSeed < 0.8 ? vec3(1.0, 0.72, 0.3) : vec3(0.55, 0.35, 1.0));
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        mvPosition.xy += uBend * mvPosition.z * mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        vA *= smoothstep(1.5, 5.0, -mvPosition.z);                         // jamais de grosse boule floue devant l'objectif
        gl_PointSize = min(uScale * 0.022, uScale * (0.05 + 0.07*fract(aSeed*17.0)) / max(0.5, -mvPosition.z));
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        vec3 col = vC * vA * pow(max(0.0, 1.0 - d), 2.2) * 1.6;
        ${FOG_FADE}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  flies.frustumCulled = false; scene.add(flies);

  return {
    dyn, groundMesh, sky, flies, fronds, bushes, mush,
    resize(h) { flies.material.uniforms.uScale.value = h * 1.15; },
    follow(camPos) { groundMesh.position.set(0, 0, Math.floor(camPos.z) + 52); sky.position.copy(camPos); },
    barkMat,
  };
}
