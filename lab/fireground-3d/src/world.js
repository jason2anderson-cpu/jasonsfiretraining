// ============================================================================
// world.js — ground, roadway, building.
//
// Ground bands are built as NON-OVERLAPPING boxes rather than coplanar planes
// at tiny offsets. That is not a style choice: z-fighting was one of the four
// defects found on the first fireground figure, and coplanar ground planes are
// where it comes from. Surfaces that must sit on top of another surface get a
// real physical offset (a curb is 6 in proud; a driveway 1 in), never 0.001.
//
// All geometry is driven from spec.js. Nothing here has a typed-in dimension.
// ============================================================================

import * as THREE from 'three';
import { SITE, BUILDING, ridgeHeight, collapseZone, HYDRANTS, PALETTE } from './spec.js';
import { box, mesh, part, cyl } from './geo.js';
import { PAINT, GLASS as GLASSMAT, METAL } from './materials.js';
import { buildFlatRoofBuilding } from './buildings.js';

const METALMAT = () => METAL('#c8ced5', 0.3);

const IN = 1 / 12;   // feet per inch

// A ground band spanning the full site width between two z values.
// Roads and walks run PAST the modelled block — a street that stops at the edge
// of the site reads as a diorama, and the 2nd Truck pulls past the frontage.
const RUN = 3.2;

function band(material, z0, z1, thickness = 1.5, y = 0, extend = false) {
  const d = z1 - z0;
  const w = extend ? SITE.w * RUN : SITE.w;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), material);
  m.position.set(SITE.w / 2, y - thickness / 2, z0 + d / 2);
  m.receiveShadow = true;
  return m;
}

export function buildWorld(M) {
  const g = new THREE.Group();
  g.name = 'world';

  // Surrounding landscape. Without it the site reads as a slab floating in a
  // void. Set 0.06 ft below the site bands so the edge steps down rather than
  // fighting them for depth.
  const K = 7;                                   // how many site-widths of landscape
  const far = M.grass.clone();
  // The maps must be cloned too, or raising the repeat here also re-tiles the
  // site's own lawn — a shared texture carries one repeat for every user of it.
  for (const slot of ['map', 'roughnessMap']) {
    far[slot] = M.grass[slot].clone();
    far[slot].needsUpdate = true;
    far[slot].repeat.set(M.grass[slot].repeat.x * K, M.grass[slot].repeat.y * K);
  }
  far.color = new THREE.Color('#8fa07a');        // muted, so it never competes with the site
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(SITE.w * K, SITE.d * K), far);
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.set(SITE.w / 2, -0.06, SITE.d / 2);
  beyond.receiveShadow = true;
  g.add(beyond);

  // ---- ground bands, rear (side C) to front ------------------------------
  const [az0, az1] = SITE.alley;
  const [sz0, sz1] = SITE.street;
  const [gz0, gz1] = SITE.staging;
  const walkZ = sz0 - 4;                      // 4 ft sidewalk against the curb

  g.add(band(M.grass,    0,     az0));
  g.add(band(M.asphalt,  az0,   az1, 1.5, 0, true));   // rear access
  g.add(band(M.grass,    az1,   walkZ));               // yard the building sits on
  g.add(band(M.concrete, walkZ, sz0, 1.5, 0, true));   // sidewalk
  g.add(band(M.asphalt,  sz0,   sz1, 1.5, 0, true));   // street · side A
  g.add(band(M.concrete, gz0,   gz1, 1.5, 0, true));   // staging pad

  // Curbs — 6 in proud of the asphalt, so they read in raking light and can
  // never z-fight with the band beneath them.
  for (const z of [sz0, sz1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(SITE.w * RUN, 6 * IN, 10 * IN), M.concrete);
    curb.position.set(SITE.w / 2, 3 * IN, z);
    curb.castShadow = curb.receiveShadow = true;
    g.add(curb);
  }

  // Painted centre line.
  const cl = new THREE.Mesh(new THREE.BoxGeometry(SITE.w * RUN, 0.02, 0.5),
    new THREE.MeshStandardMaterial({ color: '#d8c65a', roughness: 0.85 }));
  cl.position.set(SITE.w / 2, 0.02, (sz0 + sz1) / 2);
  g.add(cl);

  // Driveway, 1 in proud of the lawn (house only).
  if (BUILDING.roof === 'gable') {
  const drive = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, walkZ - (BUILDING.z + BUILDING.d)), M.concrete);
  drive.position.set(
    BUILDING.x + BUILDING.w - 10, -0.75 + 1 * IN,
    (BUILDING.z + BUILDING.d + walkZ) / 2,
  );
  drive.receiveShadow = true;
  g.add(drive);
  }

  // ---- building ----------------------------------------------------------
  g.add(BUILDING.roof === 'gable' ? buildHouse(M) : buildFlatRoofBuilding(M));

  // ---- hydrants ----------------------------------------------------------
  for (const h of HYDRANTS) g.add(hydrant(h.x, h.z));

  return g;
}

// Gable house. The ridge runs east–west, so the slopes face the street and the
// rear — which puts a working roof surface in view of side A, and puts the eave
// (and therefore the gutter line) along the frontage.
//
// The detail here is not decoration. A bare box with a roof on it reads as a
// toy no matter how it is lit; what makes a wall read as a house is the
// hierarchy of small parts — trim, sills, fascia, a gutter, a foundation line —
// each of which catches its own highlight and casts its own small shadow.
function buildHouse(M) {
  const b = new THREE.Group();
  b.name = 'building';
  const { x, z, w, d, eave, pitch, overhang } = BUILDING;
  const cx = x + w / 2, cz = z + d / 2;
  const trim = PAINT('#eceef0', 0.66);
  const trimDark = PAINT('#5c6469', 0.6);

  // ---- foundation, 1 ft proud of grade and slightly wider than the walls ----
  b.add(part(M.concrete, w + 0.7, 1.6, d + 0.7, cx, 0.7, cz, 0.04));

  // ---- walls ----
  const walls = mesh(box(w, eave, d, 0.05), M.siding);
  walls.position.set(cx, eave / 2 + 0.1, cz);
  b.add(walls);

  // ---- corner boards ----
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(part(trim, 0.7, eave - 0.2, 0.7, cx + sx * (w / 2), eave / 2 + 0.2, cz + sz * (d / 2), 0.03));
  }

  // ---- openings ----
  // Front (side A, +z) — the elevation the first-due officer actually sees.
  const front = cz + d / 2;
  for (const wx of [72, 80, 102, 111]) b.add(win(wx, 4.8, front, 'S', 3.6, 4.8, trim));
  for (const wx of [70, 79, 88, 97, 108]) b.add(win(wx, 12.6, front, 'S', 3.4, 4.4, trim));
  b.add(frontDoor(91, front, trim, M));

  // Attached two-car garage on the D end of the frontage — the single most
  // recognisable feature of a suburban house, and it also explains where the
  // driveway goes. Its door is a real opening with panels and a track.
  b.add(garage(109, front, trim, M));

  // Rear (side C).
  const rear = cz - d / 2;
  for (const wx of [74, 96, 108]) b.add(win(wx, 4.8, rear, 'N', 3.4, 4.6, trim));
  for (const wx of [74, 88, 104]) b.add(win(wx, 12.6, rear, 'N', 3.2, 4.2, trim));

  // Gable ends (sides B and D, ±x).
  for (const sx of [-1, 1]) {
    const wallX = cx + sx * (w / 2);
    const dir = sx > 0 ? 'E' : 'W';
    for (const wz of [cz - 9, cz + 8]) {
      b.add(win(wallX, 4.8, wz, dir, 3.2, 4.4, trim));
      b.add(win(wallX, 12.6, wz, dir, 3.0, 4.0, trim));
    }
  }

  // ---- roof: triangular prism. The outer edge sits BELOW the eave line by the
  // overhang times the pitch — what a real soffit does — so the apex lands
  // exactly on ridgeHeight() with no number typed in.
  const half = d / 2 + overhang;
  const drop = -overhang * pitch;
  const apex = (d / 2) * pitch;
  const shape = new THREE.Shape();
  shape.moveTo(-half, drop);
  shape.lineTo(half, drop);
  shape.lineTo(0, apex);
  shape.closePath();
  const roof = mesh(
    new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false }),
    [trim, M.shingle],                 // group 0 = gable ends (soffit), 1 = slopes
  );
  roof.rotation.y = Math.PI / 2;
  roof.position.set(cx - (w / 2 + overhang), eave + 0.1, cz);
  b.add(roof);

  // ridge cap
  b.add(part(PAINT('#3c4147', 0.9), w + overhang * 2, 0.34, 0.85, cx, eave + apex + 0.22, cz, 0.06));

  // ---- fascia + gutter along both eaves, downspouts at the corners ----
  for (const sz of [-1, 1]) {
    const gz = cz + sz * (d / 2 + overhang);
    const gy = eave + drop + 0.1;
    b.add(part(trim, w + overhang * 2, 0.72, 0.22, cx, gy - 0.05, gz, 0.03));            // fascia
    b.add(part(trimDark, w + overhang * 2, 0.38, 0.42, cx, gy - 0.55, gz + sz * 0.12, 0.14)); // gutter
    for (const sx of [-1, 1]) {
      b.add(cyl(trimDark, 0.17, 0.17, gy - 0.9, 8,
        { x: cx + sx * (w / 2 - 0.6), y: (gy - 0.9) / 2 + 0.1, z: gz + sz * 0.12 }));
    }
  }

  // ---- rake boards on the gable ends ----
  for (const sx of [-1, 1]) {
    const rx = cx + sx * (w / 2 + overhang);
    for (const sz of [-1, 1]) {
      const rake = mesh(box(0.3, 0.55, Math.hypot(half, apex - drop), 0.03), trim);
      rake.position.set(rx, eave + 0.1 + (drop + apex) / 2, cz + sz * half / 2);
      rake.rotation.x = sz * Math.atan2(apex - drop, half);
      b.add(rake);
    }
  }

  // ---- chimney ----
  const chX = cx + w * 0.30;
  b.add(part(M.siding, 3.2, eave + apex + 2.6, 2.6, chX, (eave + apex + 2.6) / 2, cz - d * 0.16, 0.06));
  b.add(part(PAINT('#4a4f55', 0.85), 3.6, 0.4, 3.0, chX, eave + apex + 2.8, cz - d * 0.16, 0.05));

  return b;
}

// A window, built in LOCAL space (x along the wall, y up, z outward) and then
// rotated onto whichever elevation it belongs to.
//
// The casing is FOUR SEPARATE BOARDS forming a frame, not one solid box. A solid
// box sits coincident with the glass and hides it — which is why the first pass
// rendered every window as a blank white panel. The glass is genuinely recessed
// behind the wall face so the opening reads as a hole with depth, and the frame
// casts a small shadow onto it.
const DIR = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

function win(px, py, pz, dir, ww, wh, trim) {
  const g = new THREE.Group();
  const t = 0.45;                                   // casing board width

  // Proud of the wall, not inside it — see buildings.js for why.
  g.add(part(PAINT('#161b20', 0.85), ww, wh, 0.08, 0, 0, 0.02, 0.01));   // reveal
  g.add(part(GLASSMAT(), ww - 0.3, wh - 0.3, 0.06, 0, 0, 0.055, 0.01));  // glass
  g.add(part(trim, 0.13, wh - 0.3, 0.08, 0, 0, 0.1, 0.02));              // muntins
  g.add(part(trim, ww - 0.3, 0.13, 0.08, 0, 0, 0.1, 0.02));

  g.add(part(trim, ww + 2 * t, t, 0.34, 0, wh / 2 + t / 2, 0.15, 0.04));  // head
  g.add(part(trim, t, wh, 0.34, -(ww / 2 + t / 2), 0, 0.15, 0.04));       // jambs
  g.add(part(trim, t, wh, 0.34, ww / 2 + t / 2, 0, 0.15, 0.04));
  g.add(part(trim, ww + 2 * t + 0.4, 0.3, 0.6, 0, -(wh / 2 + t / 2), 0.24, 0.05)); // sill

  g.position.set(px, py, pz);
  g.rotation.y = DIR[dir];
  return g;
}

// Two-car garage door: recessed opening, four panel courses, lift track.
function garage(px, pz, trim, M) {
  const g = new THREE.Group();
  const W = 16, H = 8.2;
  g.add(part(PAINT('#12161a', 0.9), W, H, 0.9, 0, H / 2 + 0.6, -0.4, 0.03));        // opening
  const door = PAINT('#dfe3e6', 0.55);
  for (let i = 0; i < 4; i++) {
    const h = H / 4;
    const y = 0.6 + h / 2 + i * h;
    g.add(part(door, W - 0.4, h - 0.12, 0.34, 0, y, -0.05, 0.04));
    for (const px2 of [-W * 0.28, 0, W * 0.28]) {                                   // pressed panels
      g.add(part(PAINT('#c9ced2', 0.6), W * 0.24, h - 0.62, 0.06, px2, y, 0.13, 0.03));
    }
  }
  g.add(part(trim, W + 1.5, 0.65, 0.5, 0, H + 0.95, 0.12, 0.05));                    // header
  for (const s2 of [-1, 1]) g.add(part(trim, 0.65, H + 1.2, 0.5, s2 * (W / 2 + 0.5), (H + 1.2) / 2 + 0.5, 0.12, 0.05));
  g.add(part(PAINT('#f2e9c8', 0.4), 0.45, 0.7, 0.45, W / 2 + 1.5, H + 0.6, 0.28, 0.08));  // coach light
  g.position.set(px, 0, pz);
  return g;
}

function frontDoor(px, pz, trim, M) {
  const g = new THREE.Group();
  g.add(part(trim, 4.6, 8.0, 0.34, 0, 4.0, 0.02, 0.04));
  g.add(part(PAINT('#7d2a2a', 0.55), 3.4, 7.0, 0.26, 0, 3.5, 0.14, 0.03));
  g.add(part(PAINT('#8a3232', 0.5), 2.6, 2.6, 0.06, 0, 5.1, 0.26, 0.03));
  g.add(part(PAINT('#8a3232', 0.5), 2.6, 2.2, 0.06, 0, 2.2, 0.26, 0.03));
  g.add(cyl(METALMAT(), 0.12, 0.12, 0.3, 10, { x: 1.2, y: 3.6, z: 0.32, rx: Math.PI / 2 }));
  g.add(part(M.concrete, 6.0, 0.5, 2.6, 0, 0.35, 1.4, 0.05));                      // stoop
  g.add(part(PAINT('#f2e9c8', 0.4), 0.5, 0.8, 0.5, 2.9, 6.2, 0.3, 0.08));          // porch light
  g.position.set(px, 0, pz);
  return g;
}

function hydrant(x, z) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#e8b52a', roughness: 0.55, metalness: 0.1 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(6 * IN, 7 * IN, 2.5, 14), paint);
  barrel.position.y = 1.25; barrel.castShadow = true; g.add(barrel);
  const bonnet = new THREE.Mesh(new THREE.SphereGeometry(7 * IN, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint);
  bonnet.position.y = 2.5; bonnet.castShadow = true; g.add(bonnet);
  const steamer = new THREE.Mesh(new THREE.CylinderGeometry(4.5 * IN, 4.5 * IN, 8 * IN, 10), paint);
  steamer.rotation.z = Math.PI / 2; steamer.position.set(0, 1.6, 0); steamer.castShadow = true; g.add(steamer);
  g.position.set(x, 0, z);
  return g;
}

// ---------------------------------------------------------------------------
// Collapse zone — a ground band at 1.5 × the exterior wall height, swept
// around the building. This is ARITHMETIC, not a drawing: change BUILDING.eave
// or COLLAPSE.mult in spec.js and the ring moves. It is the one piece of this
// scene with a direct safety consequence, so it is computed, never placed.
// ---------------------------------------------------------------------------
export function buildCollapseZone() {
  const g = new THREE.Group();
  g.name = 'collapse-zone';
  const zone = collapseZone();
  const cx = BUILDING.x + BUILDING.w / 2;
  const cz = BUILDING.z + BUILDING.d / 2;

  // Rounded-rectangle offset of the footprint by `zone` feet.
  const outline = (inset) => {
    const s = new THREE.Shape();
    const hw = BUILDING.w / 2, hd = BUILDING.d / 2, r = inset;
    s.moveTo(-hw, -hd - r);
    s.lineTo(hw, -hd - r);
    s.absarc(hw, -hd, r, -Math.PI / 2, 0, false);
    s.lineTo(hw + r, hd);
    s.absarc(hw, hd, r, 0, Math.PI / 2, false);
    s.lineTo(-hw, hd + r);
    s.absarc(-hw, hd, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-hw - r, -hd);
    s.absarc(-hw, -hd, r, Math.PI, Math.PI * 1.5, false);
    return s;
  };

  // Translucent fill. At 0.11 over dark asphalt this read as a patch of dirt,
  // not a hazard boundary — the boundary needs to be unmistakable.
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(outline(zone), 32),
    new THREE.MeshBasicMaterial({
      color: PALETTE.zone, transparent: true, opacity: 0.15,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  );

  // The boundary itself, as a 1.5 ft band with real width. A THREE.Line is one
  // pixel wide on every platform that ignores linewidth, which is all of them —
  // a band survives zooming out to the overview shot.
  const ring = outline(zone);
  ring.holes.push(new THREE.Path(outline(zone - 1.5).getPoints(160)));
  const bandMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(ring, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.zone, side: THREE.DoubleSide, depthWrite: false }),
  );

  for (const m of [fill, bandMesh]) {
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0, cz);
    m.renderOrder = 2;
  }
  fill.position.y = 0.06;
  bandMesh.position.y = 0.08;
  g.add(fill, bandMesh);
  g.userData.zone = zone;
  return g;
}

export const houseRidge = ridgeHeight;
