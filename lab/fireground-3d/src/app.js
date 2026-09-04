// ============================================================================
// app.js — scene assembly, camera, loop.
//
// Exposes a small control surface on `window` so the puppeteer harness can
// drive it headlessly:  __ready · __setView(name) · __views · __stats
// The project's drawing rule is render → READ the image → fix → re-render, and
// that is only possible if the app can be posed from outside.
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SITE, BUILDING, RIG, UNITS, AERIAL, FIRE, SCENARIO, T2_NOTE, collapseZone, ridgeHeight } from './spec.js';
import { buildMaterials } from './materials.js';
import { buildWorld, buildCollapseZone } from './world.js';
import { buildScenery } from './scenery.js';
import { buildPlume, buildFireGlow } from './fire.js';
import { buildHoses } from './hose.js';
import { buildHotspots } from './hotspots.js';
import { HOTSPOTS } from './hotspot-data.js';
import { buildRoofOps, roofHotspot, slopePoint, HOLE, CUT_LABELS } from './roof-ops.js';
import { buildApparatus } from './apparatus.js';
import { makeRenderer, setupEnvironment, setupLighting, makeComposer, pickTier, buildSky } from './render-stack.js';
import { makeLabels, makePins } from './ui.js';

const qs = new URLSearchParams(location.search);
const tier = pickTier(qs.get('q'));

const canvas = document.getElementById('scene');
const renderer = makeRenderer(canvas, tier);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c4cdd4', SITE.w * 3.0, SITE.w * 7.0);

// ---------------------------------------------------------------------------
// The aerial is SOLVED, not posed. Given where the 1st Truck actually sits and
// how tall the building actually is, this computes the pitch and the extension
// that put the tip on the roof edge. Change the truck's position or the eave
// height in spec.js and the ladder re-aims itself.
//
// VERIFY: Truck Manual v3.1 §6 pp.143-144 requires the tip at the roof edge
// with both beams. This solves to the near eave (the step-off point). An
// officer must confirm the intended tip target before this publishes.
// ---------------------------------------------------------------------------
function solveAerial() {
  const u = UNITS.find((x) => x.id === 't1');
  const s = RIG.truck;
  const cx = u.x + s.l / 2, cz = u.z + s.w / 2;
  const tx = cx + (-s.l / 2 + s.turntableAft);   // rear-mount turntable, rot = 0
  const ty = s.h - 0.4;
  const tz = cz;
  // Target the eave line at the wall, 1 ft proud of the roof surface. Solving to
  // the outer edge of the soffit instead put the tip level with the gutter, where
  // it read as a ladder into the wall rather than a step-off point on the roof.
  const targetZ = BUILDING.z + BUILDING.d;                       // front wall, side A
  const targetY = BUILDING.eave + 1.0;
  const horiz = Math.abs(targetZ - tz);
  const rise = targetY - ty;
  return {
    boomLen: Math.hypot(horiz, rise),
    boomPitchDeg: (Math.atan2(rise, horiz) * 180) / Math.PI,
    boomYawDeg: 90,                        // +X rotated to face -Z, toward side A
    jacked: true,
    turntable: { x: tx, y: ty, z: tz },
  };
}
const aerial = solveAerial();

// The sky dome must follow the camera: parked at the origin its far side sat
// beyond camera.far and got clipped, which is what rendered as a black void.
const sky = buildSky(SITE.w * 4);
scene.add(sky);

const M = buildMaterials();
scene.add(buildWorld(M));
scene.add(buildScenery());
scene.add(buildHoses(SCENARIO.occupancy));
if (BUILDING.roof === 'gable') {           // the cut sequence is drawn on the gable house for now
  scene.add(buildRoofOps());
  HOTSPOTS.push(roofHotspot(HOTSPOTS.length + 1));
}
// Collapse zone is a DEFENSIVE tool — hidden on an offensive fire.
const zoneGroup = buildCollapseZone();
zoneGroup.visible = SCENARIO.mode === 'defensive';
scene.add(zoneGroup);
// T2 works side C. Its aerial is STOWED — a rear-mount stows forward over the
// cab, tip just short of the front bumper.
const stowed = { boomPitchDeg: 0, boomYawDeg: 0, boomLen: RIG.truck.l - RIG.truck.turntableAft - 3, jacked: false };
const rigs = buildApparatus({ t1: aerial, t2: stowed });
scene.add(rigs);

// Smoke showing from the venting opening, plus a glow at the seat.
// Everything alpha-blended goes in ONE group so it can be hidden during GTAO's
// depth/normal prepass — see the patch below.
const fx = new THREE.Group();
fx.name = 'fx';
const V = FIRE.ventingWindow;
const plume = buildPlume({ origin: [V.x, V.y + 1.0, V.z], rise: 30, drift: [-0.18, 0.26], spread: 8 });
fx.add(plume);
fx.add(buildFireGlow([V.x - 0.6, V.y, V.z], 4.2));
// A thin plume venting from the roof — from the HOLE, which is what the cut is
// for. Few, small sprites: a plume parked over the cut fogged the whole roof
// grey and the screen-filling sprites at close zoom dropped the roof view to
// 17 fps. It is a marker of where the roof is opened, not weather.
const holeC = BUILDING.roof === 'gable'
  ? slopePoint(HOLE.u0 + HOLE.w / 2, HOLE.v0 + HOLE.h / 2, 0.3)
  : new THREE.Vector3(BUILDING.x + BUILDING.w * 0.4, ridgeHeight() + 1, BUILDING.z + BUILDING.d * 0.5);
const roofPlume = buildPlume({
  origin: [holeC.x, holeC.y, holeC.z],
  count: 26, rise: 34, drift: [-0.12, 0.18], spread: 5, seed: 21,
  colorHot: '#8a8d90', colorCool: '#d9dcdf',
});
fx.add(roofPlume);
scene.add(fx);

const sun = setupLighting(scene, tier, SITE);
await setupEnvironment(renderer, scene);

// ---------------------------------------------------------------------------
// Camera + views
// ---------------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(38, 1, 1, SITE.w * 6);
const target = new THREE.Vector3(BUILDING.x + BUILDING.w / 2, 8, BUILDING.z + BUILDING.d / 2 + 8);

// Distances are sized to FRAME the 200 x 138 ft site, not guessed. The first
// pass put the camera inside the frontage and cropped two rigs off the bottom.
const VIEWS = {
  // Three-quarter over the A/D corner — the teaching view. Whole site in frame.
  command:  { pos: [268, 138, 300], look: [96, 4, 74] },
  // The view a first-due officer actually has: low, from the street, side A.
  arrival:  { pos: [214, 34, 246], look: [100, 12, 86] },
  // High and near-plan, to read positions against the collapse zone.
  overview: { pos: [102, 268, 214], look: [100, 0, 70] },
  // Side C — the rear, where the 2nd Truck works.
  sideC:    { pos: [-42, 96, -96], look: [96, 6, 62] },
  // Tight on the aerial, to check the tip actually lands on the roof edge.
  aerial:   { pos: [-46, 66, 178], look: [84, 16, 90] },
  // Straight down the front slope onto the cut, from the egress side.
  roof:     { pos: [66, 46, 108], look: [90, 22, 80] },
};

let currentView = 'command';
function setView(name) {
  currentView = VIEWS[name] ? name : 'command';
  const v = VIEWS[currentView];
  const look = new THREE.Vector3(...v.look);
  const pos = new THREE.Vector3(...v.pos);
  // Every view above is framed for a landscape viewport. On a phone held in
  // portrait the same camera crops two thirds of the site off the sides, so the
  // offset from the look-point is scaled back proportionally to the aspect.
  const a = camera.aspect || 1.6;
  if (a < 1.5) pos.sub(look).multiplyScalar(Math.min(3.2, (1.5 / a) ** 0.95)).add(look);
  camera.position.copy(pos);
  target.copy(look);
  controls.target.copy(target);
  controls.update();
}

const updateLabels = makeLabels(document.body, rigs);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.04;   // never let the camera go under grade
controls.minDistance = 24;
controls.maxDistance = SITE.w * 2.2;

// ---------------------------------------------------------------------------
let composer, gtao;
function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  else {
    ({ composer, gtao } = makeComposer(renderer, scene, camera, tier, { w, h }));

    // ⚠️ GTAOPass._renderOverride() sets scene.overrideMaterial and re-renders
    // the whole scene into its normal/depth buffer. An override material has no
    // alpha map, so every smoke sprite is drawn as a SOLID QUAD — and GTAO then
    // shades those quads, which is why the plume rendered as hard-edged dark
    // rectangles floating in the sky. Hiding the fx group for just that prepass
    // fixes it; the beauty pass still draws the smoke with correct depth
    // testing against the building.
    if (gtao) {
      const inner = gtao._renderOverride.bind(gtao);
      gtao._renderOverride = (r, mat, rt, cc, ca) => {
        fx.visible = false;
        inner(r, mat, rt, cc, ca);
        fx.visible = true;
      };
    }
  }
}
addEventListener('resize', () => { resize(); setView(currentView); });
resize();
setView(qs.get('view') ?? 'command');   // after resize: framing depends on aspect

const hs = buildHotspots(HOTSPOTS, document.body, camera, controls, canvas);
const updatePins = makePins(document.body, CUT_LABELS);
scene.add(hs.group);

// ---------------------------------------------------------------------------
let frames = 0, acc = 0, fps = 0, last = performance.now();
function loop(now) {
  const dt = now - last; last = now;
  acc += dt; frames++;
  if (acc >= 500) { fps = Math.round((frames * 1000) / acc); acc = 0; frames = 0; }
  controls.update();
  plume.userData.step(dt / 1000, camera);
  roofPlume.userData.step(dt / 1000, camera);
  sky.position.copy(camera.position);
  composer.render();
  updateLabels(camera, canvas.clientWidth, canvas.clientHeight);
  hs.update(canvas.clientWidth, canvas.clientHeight, dt);
  updatePins(camera, canvas.clientWidth, canvas.clientHeight);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------------------
// Harness surface
// ---------------------------------------------------------------------------
Object.assign(window, {
  __views: Object.keys(VIEWS),
  __setView: (n) => { setView(n); sky.position.copy(camera.position); composer.render(); updateLabels(camera, canvas.clientWidth, canvas.clientHeight); },
  __stats: () => ({
    fps, tier,
    renderer: renderer.getContext().getParameter(
      renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? 0x1F01),
    calls: renderer.info.render.calls,
    tris: renderer.info.render.triangles,
    zone: collapseZone(),
    ridge: +ridgeHeight().toFixed(2),
    aerial: { len: +aerial.boomLen.toFixed(2), pitch: +aerial.boomPitchDeg.toFixed(2) },
  }),
  __scene: scene, __camera: camera, __three: THREE, __hotspots: hs, __openHotspot: (n) => hs.open(HOTSPOTS.find(h => h.n === n)), __renderer: renderer, __composer: () => composer, __sun: sun,
});

// Report the numbers into the overlay so they can be read off a screenshot.
document.getElementById('verify').innerHTML =
  '⚠ UNVERIFIED — illustrative dimensions, awaiting officer review. Generic apparatus, not Orem units.'
  + (T2_NOTE ? '<br><br><b>2nd Truck:</b> ' + T2_NOTE : '');

document.querySelectorAll('#occ a').forEach((a) => a.classList.toggle('is-on', a.dataset.occ === SCENARIO.occupancy));
document.querySelector('#title h1').textContent =
  { res: 'Residential fireground — apparatus positioning',
    mid: 'Mid-rise fireground — 4 floors and above',
    com: 'Commercial fireground — wide frontage, long-span roof' }[SCENARIO.occupancy];

document.getElementById('readout').textContent =
  `${SCENARIO.mode} · ridge ${ridgeHeight().toFixed(1)} ft · ` +
  `aerial ${aerial.boomLen.toFixed(1)} ft @ ${aerial.boomPitchDeg.toFixed(0)}° · ${tier}`;

await new Promise((r) => requestAnimationFrame(r));
window.__ready = true;
