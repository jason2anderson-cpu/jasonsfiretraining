// ============================================================================
// scenery.js — trees, shrubs, fence, walkway, background housing.
//
// ⚠️ THIS IS SCENERY. It carries NO doctrinal meaning.
// The background houses are visual context so the site does not read as a
// diorama floating in an empty field. They are deliberately kept OFF the
// modelled block and set back, so nothing here should be read as a B or D
// exposure or used to reason about exposure protection. Exposure geometry is a
// real fireground question and it is not being answered here.
//
// Everything is seeded, so the scene is identical every render — which is what
// makes the render → read → fix loop meaningful.
// ============================================================================

import * as THREE from 'three';
import { SITE, BUILDING } from './spec.js';
import { box, mesh, part, cyl, IN } from './geo.js';
import { PAINT } from './materials.js';

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BARK = PAINT('#4a3b2e', 0.95);
const LEAF = [PAINT('#3d6b31', 0.92), PAINT('#4a7a38', 0.92), PAINT('#345c2b', 0.92)];

// Deciduous tree: tapered trunk, a few limbs, and overlapping deformed canopy
// blobs. Three offset spheres read as foliage far better than one, because the
// silhouette stops being a circle.
function tree(rand, h) {
  const g = new THREE.Group();
  const trunkH = h * 0.42;
  const r = 0.34 + rand() * 0.16;
  g.add(cyl(BARK, r * 0.62, r, trunkH, 9, { y: trunkH / 2 }));

  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const limb = cyl(BARK, 0.09, 0.2, h * 0.3, 6, {
      x: Math.cos(a) * h * 0.06, y: trunkH + h * 0.1, z: Math.sin(a) * h * 0.06,
      rz: Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5,
    });
    g.add(limb);
  }

  const leaf = LEAF[Math.floor(rand() * LEAF.length)];
  const blobs = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < blobs; i++) {
    const rad = h * (0.24 + rand() * 0.12);
    const geo = new THREE.IcosahedronGeometry(rad, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {          // rough up the silhouette
      const k = 1 + (rand() - 0.5) * 0.34;
      pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k * 0.86, pos.getZ(v) * k);
    }
    geo.computeVertexNormals();
    const m = mesh(geo, leaf);
    m.position.set((rand() - 0.5) * h * 0.28, trunkH + h * 0.26 + (rand() - 0.2) * h * 0.16,
                   (rand() - 0.5) * h * 0.28);
    g.add(m);
  }
  return g;
}

function shrub(rand, size) {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const k = 1 + (rand() - 0.5) * 0.4;
    pos.setXYZ(v, pos.getX(v) * k, Math.max(0, pos.getY(v)) * k * 1.15, pos.getZ(v) * k);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, LEAF[Math.floor(rand() * LEAF.length)]);
  m.position.y = size * 0.55;
  return m;
}

// Picket fence along a run, posts + two rails.
function fence(x0, z0, x1, z1, h = 4) {
  const g = new THREE.Group();
  const mat = PAINT('#cdd2d6', 0.72);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.floor(len / 7);
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.add(part(mat, 0.35, h, 0.35, x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t, 0.03));
  }
  for (const y of [h * 0.68, h * 0.3]) {
    const rail = mesh(box(len, 0.3, 0.16, 0.03), mat);
    rail.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    rail.rotation.y = -ang;
    g.add(rail);
  }
  return g;
}

// Distant background housing — massing and a roof only. See the header note.
function backgroundHouse(rand, x, z, w, d, rot) {
  const g = new THREE.Group();
  const wallMat = PAINT(['#c9c2b4', '#b9a894', '#cfd3d6', '#a8b0a4'][Math.floor(rand() * 4)], 0.8);
  const roofMat = PAINT(['#4a4f55', '#5b4a42', '#3f464c'][Math.floor(rand() * 3)], 0.9);
  const eave = 15 + rand() * 4;
  g.add(part(wallMat, w, eave, d, 0, eave / 2, 0, 0.1));
  // Simple openings. Blank boxes at this size read as packing crates and undo
  // the realism the foreground just gained.
  const glass = PAINT('#2b3138', 0.35);
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const wx = -w / 2 + (i + 0.5) * (w / 4);
      g.add(part(glass, w * 0.13, 3.4, 0.3, wx, 4.6, sz * (d / 2), 0.05));
      g.add(part(glass, w * 0.13, 3.0, 0.3, wx, 11.0, sz * (d / 2), 0.05));
    }
  }
  g.add(part(PAINT('#6b4a3a', 0.6), 3.4, 6.8, 0.3, w * 0.22, 3.4, d / 2, 0.05));
  const half = d / 2 + 1.2;
  const apex = (d / 2) * 0.5;
  const sh = new THREE.Shape();
  sh.moveTo(-half, -0.6); sh.lineTo(half, -0.6); sh.lineTo(0, apex); sh.closePath();
  const roof = mesh(new THREE.ExtrudeGeometry(sh, { depth: w + 2.4, bevelEnabled: false }), roofMat);
  roof.rotation.y = Math.PI / 2;
  roof.position.set(-(w / 2 + 1.2), eave, 0);
  g.add(roof);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

export function buildScenery() {
  const g = new THREE.Group();
  g.name = 'scenery';
  const rand = rng(20260902);
  const [, alleyZ] = SITE.alley;
  const [streetZ] = SITE.street;
  const walkZ = streetZ - 4;

  // Walkway from the front door to the sidewalk.
  const doorX = 91;
  g.add(part(PAINT('#b8bcbe', 0.9), 4.0, 0.3, walkZ - (BUILDING.z + BUILDING.d) - 1.5,
    doorX, 0.16, (BUILDING.z + BUILDING.d + 1.5 + walkZ) / 2, 0.04));

  // Foundation planting along the front elevation, skipping door and driveway (house only).
  for (let x = 67; x < (BUILDING.roof === 'gable' ? 116 : 0); x += 4.2) {
    if (Math.abs(x - doorX) < 5 || x > 104) continue;
    const s = shrub(rand, 1.5 + rand() * 0.8);
    s.position.x = x; s.position.z = BUILDING.z + BUILDING.d + 2.2;
    g.add(s);
  }

  // Yard trees. Kept clear of the collapse zone and the aerial's working arc so
  // they never obstruct the thing the scene exists to show.
  const yardTrees = [
    [40, 60, 26], [26, 78, 22], [140, 62, 28], [156, 80, 24],
    [50, 34, 20], [150, 34, 22], [178, 66, 25], [12, 46, 21],
  ];
  const inside = (x, z) => x > BUILDING.x - 4 && x < BUILDING.x + BUILDING.w + 4 && z > BUILDING.z - 4 && z < BUILDING.z + BUILDING.d + 4;
  for (const [x, z, h] of yardTrees) {
    if (inside(x, z)) continue;
    const t = tree(rand, h);
    t.position.set(x, 0, z);
    t.rotation.y = rand() * Math.PI * 2;
    g.add(t);
  }

  // Street trees in the parking strip, both sides of the block.
  for (const x of [22, 62, 128, 168]) {
    const t = tree(rand, 18 + rand() * 5);
    t.position.set(x, 0, walkZ - 2.5);
    g.add(t);
  }

  // Property-line fences either side of the fire building.
  if (BUILDING.roof === 'gable') { g.add(fence(58, 30, 58, walkZ - 8)); g.add(fence(124, 30, 124, walkZ - 8)); }

  // Background housing, set well back beyond the modelled block. Scenery only.
  // Pushed well back and scaled down. The first pass put 46 ft houses close
  // enough that they towered over the fire building and stole the frame.
  const bg = [
    [-84, 62, 36, 26, 0], [-96, 116, 32, 24, 0], [-150, 74, 34, 26, 0],
    [286, 62, 36, 26, 0], [300, 112, 34, 24, 0], [352, 78, 32, 24, 0],
    [10, -104, 34, 26, 0], [96, -112, 38, 26, 0], [190, -102, 34, 24, 0], [270, -118, 32, 24, 0],
    [4, 250, 34, 26, 0], [98, 262, 38, 26, 0], [196, 252, 34, 24, 0], [-80, 244, 32, 24, 0],
  ];
  for (const [x, z, w, d, r] of bg) g.add(backgroundHouse(rand, x, z, w, d, r));

  // Trees around the background housing, to break the horizon line.
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 190 + rand() * 260;
    const x = SITE.w / 2 + Math.cos(a) * rad;
    const z = SITE.d / 2 + Math.sin(a) * rad * 0.8;
    if (x > -30 && x < 230 && z > -30 && z < 170) continue;   // keep the block clear
    const t = tree(rand, 20 + rand() * 12);
    t.position.set(x, 0, z);
    g.add(t);
  }
  return g;
}
