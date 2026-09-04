// ============================================================================
// buildings.js — mid-rise and commercial structures.
//
// Footprints are data.py BLD verbatim; heights carry VERIFY notes in spec.js.
// Both are flat-roofed with a parapet, which is what makes the Truck Manual's
// commercial-roof doctrine ("ladder the aerial as the primary ladder", parapet
// and long-span cautions) something the scene can actually show.
// ============================================================================

import * as THREE from 'three';
import { BUILDING, ENTRY, FDC } from './spec.js';
import { box, mesh, part, cyl, IN } from './geo.js';
import { PAINT, GLASS, METAL } from './materials.js';

function openingsOn(g, wallX0, wallX1, dir, floors, floorH, trim, glassMat, count, sill = 3.2, wh = 5.4, ww = 4.2) {
  const [nx, nz] = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[dir];
  const along = dir === 'S' || dir === 'N';
  const span = wallX1 - wallX0;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const u = wallX0 + t * span;
      const y = f * floorH + sill + wh / 2;
      const wg = new THREE.Group();
      wg.add(part(PAINT('#12171c', 0.9), ww, wh, 0.08, 0, 0, 0.02, 0.01));            // reveal: reads as the hole
      wg.add(part(glassMat, ww - 0.36, wh - 0.36, 0.06, 0, 0, 0.055, 0.01));            // glass, just proud of it
      wg.add(part(trim, ww + 0.6, 0.35, 0.34, 0, wh / 2 + 0.2, 0.14, 0.03));             // head casing
      wg.add(part(trim, 0.3, wh + 0.4, 0.34, -(ww / 2 + 0.15), 0, 0.14, 0.03));          // jambs
      wg.add(part(trim, 0.3, wh + 0.4, 0.34, ww / 2 + 0.15, 0, 0.14, 0.03));
      wg.add(part(trim, ww + 0.6, 0.35, 0.5, 0, -(wh / 2 + 0.2), 0.2, 0.03));            // sill
      wg.rotation.y = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[dir];
      wg.position.set(along ? u : g.userData.faceX[dir], y, along ? g.userData.faceZ[dir] : u);
      g.add(wg);
    }
  }
}

function fdcMarker(x, z) {
  const g = new THREE.Group();
  const brass = METAL('#b08d3a', 0.35);
  g.add(cyl(brass, 0.22, 0.22, 1.8, 10, { x: 0, y: 0.9, z: 0.5 }));
  for (const s of [-1, 1]) g.add(cyl(brass, 0.32, 0.32, 0.5, 12, { x: s * 0.42, y: 1.9, z: 0.55, rx: Math.PI / 2 }));
  g.add(part(PAINT('#c8102e', 0.5), 1.6, 0.9, 0.12, 0, 2.9, 0.4, 0.03));    // FDC sign plate
  g.position.set(x, 0, z);
  return g;
}

export function buildFlatRoofBuilding(M) {
  const b = new THREE.Group();
  b.name = 'building';
  const { x, z, w, d, eave, floors } = BUILDING;
  const cx = x + w / 2, cz = z + d / 2;
  const floorH = eave / floors;
  const trim = PAINT('#d9dde0', 0.7);
  const glassMat = GLASS();
  const isCom = BUILDING.name === 'COMMERCIAL';
  const wallMat = isCom ? PAINT('#b9aa92', 0.85) : PAINT('#8f9aa3', 0.75);   // block vs precast

  b.userData.faceZ = { S: z + d, N: z };
  b.userData.faceX = { E: x + w, W: x };

  // massing
  b.add(part(M.concrete, w + 1.0, 1.4, d + 1.0, cx, 0.6, cz, 0.05));
  const walls = mesh(box(w, eave, d, 0.08), wallMat);
  walls.position.set(cx, eave / 2 + 0.1, cz);
  b.add(walls);

  // floor bands — the storey lines an officer counts from the street
  for (let f = 1; f < floors; f++) {
    b.add(part(trim, w + 0.3, 0.5, d + 0.3, cx, f * floorH + 0.1, cz, 0.05));
  }

  // parapet, 3 ft
  const pH = isCom ? 3.0 : 3.5;
  for (const [sx, sz, pw, pd] of [[0, 1, w + 0.6, 1.0], [0, -1, w + 0.6, 1.0], [1, 0, 1.0, d + 0.6], [-1, 0, 1.0, d + 0.6]]) {
    b.add(part(wallMat, pw, pH, pd, cx + sx * (w / 2 + 0.2), eave + pH / 2 + 0.1, cz + sz * (d / 2 + 0.2), 0.05));
  }
  b.add(part(PAINT('#3d4248', 0.9), w, 0.35, d, cx, eave + 0.28, cz, 0.04));   // membrane roof

  // rooftop: stair bulkhead + mechanical
  b.add(part(wallMat, 12, 9, 10, cx - w * 0.3, eave + 4.6, cz - d * 0.2, 0.08));
  b.add(part(PAINT('#3d4248', 0.9), 12.6, 0.4, 10.6, cx - w * 0.3, eave + 9.3, cz - d * 0.2, 0.04));
  b.add(part(METAL('#9aa2aa', 0.6), 8, 4.5, 6, cx + w * 0.25, eave + 2.4, cz + d * 0.15, 0.1));
  if (!isCom) for (let i = 0; i < 2; i++) b.add(cyl(METAL('#7f868e', 0.5), 1.3, 1.3, 3.2, 16, { x: cx + w * 0.05 + i * 5, y: eave + 1.7, z: cz - d * 0.3 }));

  // openings
  const perFloor = isCom ? 0 : Math.max(5, Math.round(w / 10.5));
  if (!isCom) {
    openingsOn(b, x + 3, x + w - 3, 'S', floors, floorH, trim, glassMat, perFloor, 2.8, 6.2, 6.2);
    openingsOn(b, x + 3, x + w - 3, 'N', floors, floorH, trim, glassMat, perFloor, 2.8, 6.2, 6.2);
    openingsOn(b, z + 3, z + d - 3, 'E', floors, floorH, trim, glassMat, Math.max(4, Math.round(d / 11)), 2.8, 6.2, 5.6);
    openingsOn(b, z + 3, z + d - 3, 'W', floors, floorH, trim, glassMat, Math.max(4, Math.round(d / 11)), 2.8, 6.2, 5.6);
  } else {
    // storefront glazing along side A, high windows elsewhere
    for (let i = 0; i < Math.round(w / 14); i++) {
      const u = x + 6 + i * 14;
      const wg = new THREE.Group();
      wg.add(part(PAINT('#12171c', 0.9), 10, 9, 0.08, 0, 0, 0.02, 0.01));
      wg.add(part(glassMat, 9.6, 8.6, 0.06, 0, 0, 0.055, 0.01));
      wg.add(part(METAL('#2b3036', 0.5), 10.4, 0.3, 0.3, 0, 4.6, 0.05, 0.02));
      wg.position.set(u, 5.6, z + d);
      b.add(wg);
    }
    b.add(part(PAINT('#3d4248', 0.8), w, 2.2, 1.8, cx, eave - 1.4, z + d + 0.9, 0.06));   // canopy/sign band
  }

  // entrance closest to the fire (data.py ENTRY), when the guide names one
  if (ENTRY) {
    const door = new THREE.Group();
    door.add(part(PAINT('#12171c', 0.9), 8, 9.5, 0.08, 0, 4.9, 0.02, 0.01));
    door.add(part(glassMat, 6.8, 8.4, 0.06, 0, 4.4, 0.06, 0.01));
    door.add(part(trim, 8.6, 0.4, 0.4, 0, 9.85, 0.14, 0.04));
    for (const s2 of [-1, 1]) door.add(part(trim, 0.4, 9.8, 0.4, s2 * 4.2, 4.9, 0.14, 0.04));
    door.add(part(METAL('#2b3036', 0.5), 0.2, 8.4, 0.3, 0, 4.4, 0.32, 0.02));
    door.add(part(M.concrete, 10, 0.4, 3.5, 0, 0.3, 1.8, 0.05));
    door.position.set(ENTRY.x, 0, ENTRY.z);
    b.add(door);
  }
  if (FDC) b.add(fdcMarker(FDC.x, FDC.z + 0.6));

  return b;
}
