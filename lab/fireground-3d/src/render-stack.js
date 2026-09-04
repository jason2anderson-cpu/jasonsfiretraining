// ============================================================================
// render-stack.js — renderer, lighting and post-processing.
//
// This module is the whole reason the figures stop looking cheap. The old
// render/ scenes used default renderer settings with flat hex MeshStandard
// materials and no environment: no tonemapping, no image-based lighting, no
// ambient occlusion. That reads as plastic no matter how good the geometry is.
//
// Order of visual return, highest first:
//   1. ACES filmic tonemapping + correct output colour space
//   2. Image-based lighting (an environment map) so surfaces have ambient
//      response and reflections instead of a flat fill colour
//   3. Soft, correctly-fitted shadows
//   4. Ground-truth ambient occlusion for contact grounding
//
// World units are FEET. Every radius/distance below is in feet.
// ============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// ---------------------------------------------------------------------------
// Quality tiers. This is a tablet-first field reference — a page that runs at
// 12 fps on an iPad in an apparatus bay is a page nobody uses. Tier is picked
// from the device, and can be forced with ?q=high|mid|low for verification.
// ---------------------------------------------------------------------------
export const TIERS = {
  high: { pixelRatio: 1.5, shadowMap: 4096, gtao: true,  smaa: true,  softShadow: true },
  mid:  { pixelRatio: 1.5, shadowMap: 2048, gtao: true,  smaa: true,  softShadow: true },
  low:  { pixelRatio: 1,   shadowMap: 1024, gtao: false, smaa: false, softShadow: false },
};

export function pickTier(forced) {
  if (forced && TIERS[forced]) return forced;
  const mem = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && (mem <= 4 || cores <= 4)) return 'low';
  if (coarse) return 'mid';
  return mem >= 8 && cores >= 8 ? 'high' : 'mid';
}

// ---------------------------------------------------------------------------
export function makeRenderer(canvas, tier) {
  const t = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !t.smaa,          // SMAA does the AA when it is on
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, t.pixelRatio));

  // (1) The single largest visual change. Without these two lines everything
  // is washed out and over-bright in the highlights.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = t.softShadow ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  return renderer;
}

// ---------------------------------------------------------------------------
// (2) Image-based lighting.
//
// RoomEnvironment is a procedural studio built from emissive boxes — it costs
// ZERO bytes of download, which matters on a field device. It reads as an
// overcast sky here, which is honest for a training figure and avoids the
// licensing question a downloaded HDRI raises on a public site.
//
// If an outdoor sun-and-sky HDRI is wanted later, drop a CC0 .hdr into
// assets/hdri/ and pass its path — the rest of the scene needs no change.
// ---------------------------------------------------------------------------
export async function setupEnvironment(renderer, scene, hdriUrl = null) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  if (hdriUrl) {
    const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
    const hdr = await new RGBELoader().loadAsync(hdriUrl);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
  } else {
    const env = skyEquirect();
    scene.environment = pmrem.fromEquirectangular(env).texture;
    env.dispose();
  }
  pmrem.dispose();
}

// A sky-and-ground gradient, matching the dome in buildSky().
//
// ⚠️ Do NOT use RoomEnvironment here. It is a studio interior built from bright
// emissive panels: it floods the scene with omnidirectional light and fills in
// every cast shadow completely, so the sun stops reading as a direction and the
// scene renders shadowless no matter how the DirectionalLight is configured.
// It is also simply wrong for an outdoor site.
//
// Brightness is baked into the texture itself rather than left to
// scene.environmentIntensity, which did not attenuate the IBL here.
export function skyEquirect(gain = 0.48) {
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  const dim = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * gain);
    const g = Math.round(((n >> 8) & 255) * gain);
    const b = Math.round((n & 255) * gain);
    return `rgb(${r},${g},${b})`;
  };
  grd.addColorStop(0.00, dim('#5b86b8'));   // zenith
  grd.addColorStop(0.48, dim('#a8c2da'));
  grd.addColorStop(0.52, dim('#b9bfae'));   // horizon -> ground bounce
  grd.addColorStop(1.00, dim('#6d7358'));   // turf below
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// (3) Sun + sky. The shadow camera is fitted to the SITE, not left at the
// default 5-unit box — an unfitted shadow camera at this scale produces either
// no shadows at all or a blurry smear, which is what "flat lighting" looked
// like in the old truss render.
// ---------------------------------------------------------------------------
export function setupLighting(scene, tier, site) {
  const t = TIERS[tier];

  // Aim at the BUILDING, not the site centroid: the shadow camera is sized
  // around its target, and the shadows that matter are the ones cast by and
  // onto the structure and the rigs working it.
  const cx = site.w * 0.455, cz = site.d * 0.507;

  // Late-morning sun from the south-east, ~44 deg elevation. Rakes across side A
  // so the frontage reads, and throws apparatus shadows into the street.
  const sun = new THREE.DirectionalLight('#fff2d8', 3.5);
  sun.target.position.set(cx, 0, cz);
  sun.position.set(cx + 49, 90, cz + 80);

  sun.castShadow = t.shadowMap > 0;
  sun.shadow.mapSize.set(t.shadowMap, t.shadowMap);

  const sc = sun.shadow.camera;
  sc.left = -135; sc.right = 135; sc.top = 135; sc.bottom = -135;
  sc.near = 1; sc.far = 400;
  // ⚠️ REQUIRED. LightShadow.updateMatrices() reads shadowCamera.projectionMatrix
  // but never rebuilds it, so assigning the ortho bounds above does nothing on
  // its own — the camera stays the default 10 x 10 unit box and a 200 ft site
  // renders with no shadows at all.
  sc.updateProjectionMatrix();

  // Left at zero deliberately. At this scale (ortho depth range 399 ft) a bias
  // of even -0.0006 is ~0.24 ft of depth offset, and together with a normalBias
  // in feet it lifts the shadow clear of every receiver. Peter-panning here is
  // far worse than the acne it would prevent; the geometry is all flat-faced
  // boxes, which barely acne at all.
  sun.shadow.bias = 0;
  sun.shadow.normalBias = 0;
  sun.shadow.radius = t.softShadow ? 2 : 1;

  scene.add(sun, sun.target);
  // The target's world matrix must exist before the shadow pass reads it.
  sun.target.updateMatrixWorld();

  // Sky/ground bounce, kept low: the environment map already supplies ambient,
  // and doubling up fills the shadow side back in and flattens the scene.
  scene.add(new THREE.HemisphereLight('#bcd4ee', '#6b6257', 0.30));
  return sun;
}

// ---------------------------------------------------------------------------
// (4) Composer. GTAO (ground-truth ambient occlusion) is what visually welds
// the apparatus and the building to the ground plane. Without it everything
// appears to hover, which is the other half of the "cheap" read.
// ---------------------------------------------------------------------------
export function makeComposer(renderer, scene, camera, tier, size) {
  const t = TIERS[tier];
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, t.pixelRatio));
  composer.setSize(size.w, size.h);
  composer.addPass(new RenderPass(scene, camera));

  let gtao = null;
  if (t.gtao) {
    gtao = new GTAOPass(scene, camera, size.w, size.h);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.75;
    // SCREEN-SPACE radius, deliberately. With a world-space radius (5 ft) the
    // kernel balloons to hundreds of pixels the moment the camera gets close —
    // the roof view ran at 17 fps while the wide shots ran at 34, and the
    // bisect showed sprites and scenery changed nothing; post-processing was the
    // whole cost. A fixed pixel radius makes GTAO cost the same at every zoom.
    gtao.updateGtaoMaterial({
      radius: 18,                 // px
      distanceExponent: 1.0,
      thickness: 1.0,
      scale: 1.0,
      samples: 12,
      screenSpaceRadius: true,
    });
    composer.addPass(gtao);
  }

  composer.addPass(new OutputPass());
  if (t.smaa) composer.addPass(new SMAAPass());
  return { composer, gtao };
}

// ---------------------------------------------------------------------------
// Sky. A flat scene.background reads as a void behind the site and gives the
// horizon nothing to sit against. A gradient dome costs one draw call and is
// what makes the ground plane feel like it is outdoors.
// ---------------------------------------------------------------------------
export function buildSky(radius) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top:    { value: new THREE.Color('#5b86b8') },
      mid:    { value: new THREE.Color('#a8c2da') },
      bottom: { value: new THREE.Color('#cbd3d8') },
    },
    vertexShader: `
      varying float vH;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vH = normalize(wp.xyz).y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 top, mid, bottom;
      varying float vH;
      void main() {
        float h = clamp(vH, -1.0, 1.0);
        vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bottom, pow(-h, 0.6));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.name = 'sky';
  return sky;
}
