// ============================================================================
// apparatus.js — TIER 1 apparatus: declared geometry, built in code.
//
// ⚠️ THESE ARE GENERIC APPARATUS. They are a readable engine and a readable
//    quint. They are NOT models of Orem's rigs and must never be captioned as
//    Ladder 32 or any specific unit.
//
// ⛔ R-4 / "generate geometry, photograph hardware": the pump bay is modelled as
//    a plain recessed bay with NO gauges, valves, levers or labels. A generated
//    pump panel would be a guess about equipment Jason owns, which is the exact
//    failure this project rules out. That surface gets a photograph or nothing.
//
// Every panel is a BEVELLED box (see geo.js). Sharp 90 degree edges are what
// made the first pass read as Lego.
//
// Local build space: length along +X (nose east), width along Z, Y up.
// ============================================================================

import * as THREE from 'three';
import { RIG, UNITS, PALETTE } from './spec.js';
import { rigPaint, METAL, GLASS, RUBBER, CHROME, PLATE, LENS } from './materials.js';
import { box, mesh, part, cyl, ladderSection, chevronTexture, IN } from './geo.js';

// ---------------------------------------------------------------------------
// Wheel: sidewall, tread band, dished rim, hub. Not a flat cylinder.
// ---------------------------------------------------------------------------
function wheel(r, w) {
  const g = new THREE.Group();
  const tread = mesh(new THREE.CylinderGeometry(r, r, w, 28), RUBBER());
  tread.rotation.x = Math.PI / 2; g.add(tread);
  for (const s of [-1, 1]) {
    const wall = mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.82, w * 0.16, 24), RUBBER());
    wall.rotation.x = Math.PI / 2; wall.position.z = s * w * 0.44; g.add(wall);
    const rim = mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 0.1, 22), CHROME());
    rim.rotation.x = Math.PI / 2; rim.position.z = s * (w * 0.5 + 0.01); g.add(rim);
    const hub = mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.22, w * 0.14, 14), METAL('#8d949c', 0.5));
    hub.rotation.x = Math.PI / 2; hub.position.z = s * (w * 0.54); g.add(hub);
  }
  return g;
}

// A compartment: recessed opening + roll-up shutter face + handle.
function compartment(g, x, y, z, w, h, side) {
  const bay = part(METAL('#1b1e22', 0.9), w, h, 0.16, x, y, z - side * 0.06, 0.02);
  g.add(bay);
  const shutter = part(PLATE(), w * 0.94, h * 0.9, 0.1, x, y, z, 0.02);
  g.add(shutter);
  for (let i = 0; i < 7; i++) {                       // roll-up slat lines
    const yy = y - h * 0.45 + (i + 0.5) * (h * 0.9 / 7);
    g.add(part(METAL('#8b929a', 0.55), w * 0.94, 0.035, 0.03, x, yy, z + side * 0.055, 0.01));
  }
  g.add(part(CHROME(), w * 0.3, 0.09, 0.09, x, y - h * 0.42, z + side * 0.08, 0.03));
}

// ---------------------------------------------------------------------------
// Shared chassis. Cab forward, body aft, real bumper / grille / mirrors.
// ---------------------------------------------------------------------------
function chassis(spec, colour, { tandem = true, chevrons = true } = {}) {
  const g = new THREE.Group();
  const { l, w, h, cabL, cabH } = spec;
  const paint = rigPaint(colour);
  const deck = 3.4;
  const wr = 1.85;
  const nose = l / 2;

  // ---- frame rails + fuel/air tanks under the body ----
  g.add(part(METAL('#23272d', 0.7), l - 1, 0.85, w * 0.8, 0, deck - 0.5, 0, 0.05));
  for (const s of [-1, 1]) {
    g.add(cyl(CHROME(), 0.62, 0.62, 3.0, 18,
      { x: -l * 0.06, y: 2.5, z: s * (w / 2 - 0.55), rz: Math.PI / 2 }));
  }

  // ---- front bumper, extended, with a chrome face ----
  g.add(part(CHROME(), 1.5, 0.85, w + 0.5, nose + 0.55, 1.75, 0, 0.14));
  g.add(part(METAL('#2b3036', 0.8), 0.5, 0.5, w * 0.8, nose + 0.9, 1.2, 0, 0.08));

  // ---- cab ----
  const cabD = cabH - deck;
  const cab = part(paint, cabL, cabD, w, nose - cabL / 2, deck + cabD / 2, 0, 3.5 * IN);
  g.add(cab);

  // raked windscreen, inset
  const wsH = cabD * 0.42;
  const ws = mesh(box(0.3, wsH, w * 0.88, 0.04), GLASS());
  ws.position.set(nose - 0.42, deck + cabD * 0.72, 0);
  ws.rotation.z = -0.16;
  g.add(ws);

  // side glass + door cut-lines + handles + steps
  for (const s of [-1, 1]) {
    const sg = part(GLASS(), cabL * 0.34, cabD * 0.34, 0.16, nose - cabL * 0.36, deck + cabD * 0.7, s * (w / 2 - 0.02), 0.05);
    g.add(sg);
    const sg2 = part(GLASS(), cabL * 0.26, cabD * 0.28, 0.16, nose - cabL * 0.72, deck + cabD * 0.68, s * (w / 2 - 0.02), 0.05);
    g.add(sg2);
    // door seam
    g.add(part(METAL('#3a3f45', 0.8), 0.05, cabD * 0.86, 0.05, nose - cabL * 0.55, deck + cabD * 0.5, s * (w / 2 + 0.02), 0.01));
    g.add(part(CHROME(), 0.5, 0.08, 0.1, nose - cabL * 0.42, deck + cabD * 0.4, s * (w / 2 + 0.06), 0.03));
    // mirror on an arm
    g.add(cyl(METAL('#2c3138', 0.6), 0.05, 0.05, 1.5, 8, { x: nose - 0.5, y: deck + cabD * 0.86, z: s * (w / 2 + 0.35), rx: Math.PI / 2 }));
    g.add(part(METAL('#2c3138', 0.55), 0.12, 1.15, 0.42, nose - 0.5, deck + cabD * 0.62, s * (w / 2 + 0.62), 0.05));
    // crew step under the door
    g.add(part(PLATE(), cabL * 0.42, 0.12, 0.75, nose - cabL * 0.5, 1.55, s * (w / 2 - 0.1), 0.03));
    // grab rail
    g.add(cyl(CHROME(), 0.045, 0.045, cabD * 0.72, 8, { x: nose - cabL * 0.9, y: deck + cabD * 0.5, z: s * (w / 2 + 0.06) }));
  }

  // grille + headlights
  g.add(part(METAL('#1a1d21', 0.85), 0.2, cabD * 0.36, w * 0.62, nose - 0.02, deck + cabD * 0.28, 0, 0.04));
  for (let i = 0; i < 5; i++) {
    g.add(part(CHROME(), 0.1, 0.07, w * 0.58, nose + 0.06, deck + cabD * 0.14 + i * (cabD * 0.07), 0, 0.02));
  }
  for (const s of [-1, 1]) {
    g.add(part(LENS('#fff8e8'), 0.14, 0.4, 0.72, nose + 0.02, deck + 0.35, s * (w * 0.32), 0.05));
  }

  // ---- warning bar: individual lens modules, not one red slab ----
  const barW = cabL * 0.66;
  g.add(part(METAL('#15181c', 0.6), barW, 0.14, w * 0.8, nose - cabL / 2, cabH + 0.07, 0, 0.03));
  const lensCols = ['#d8232f', '#f3f5f7', '#d8232f', '#f0a91e', '#d8232f', '#f3f5f7', '#d8232f'];
  lensCols.forEach((c, i) => {
    const x = nose - cabL / 2 - barW / 2 + (i + 0.5) * (barW / lensCols.length);
    g.add(part(LENS(c), barW / lensCols.length - 0.06, 0.42, w * 0.78, x, cabH + 0.35, 0, 0.05));
  });

  // ---- body ----
  const bodyL = l - cabL;
  const bodyH = h - deck - 1.2;
  const bodyX = -cabL / 2;
  g.add(part(paint, bodyL, bodyH, w, bodyX, deck + bodyH / 2, 0, 3 * IN));

  // running board along each side
  for (const s of [-1, 1]) {
    g.add(part(PLATE(), bodyL, 0.14, 0.7, bodyX, deck - 0.05, s * (w / 2 + 0.2), 0.03));
  }

  // compartments + a BLANK pump bay (see the R-4 note at the top of this file)
  for (const s of [-1, 1]) {
    const z = s * (w / 2 + 0.03);
    const cw = bodyL * 0.26, ch = bodyH * 0.66;
    compartment(g, bodyX + bodyL * 0.30, deck + bodyH * 0.5, z, cw, ch, s);
    compartment(g, bodyX - bodyL * 0.02, deck + bodyH * 0.5, z, cw, ch, s);
    compartment(g, bodyX - bodyL * 0.34, deck + bodyH * 0.5, z, cw, ch, s);
    // reflective stripe
    g.add(part(METAL('#e9edf1', 0.35), bodyL * 0.98, 0.34, 0.06, bodyX, deck + bodyH * 0.14, z + s * 0.05, 0.02));
  }

  // hose bed: visible flaked hose, not a closed lid
  const bedW = w * 0.78, bedL = bodyL * 0.5;
  const bedX = bodyX - bodyL * 0.2;
  g.add(part(METAL('#9aa2aa', 0.6), bedL, 0.5, bedW, bedX, deck + bodyH + 0.1, 0, 0.04));
  const hoseMat = [rigPaint('#d8dee5'), rigPaint('#c9a227'), rigPaint('#e8e2d6')];
  for (let i = 0; i < 9; i++) {
    const z = -bedW / 2 + 0.28 + i * ((bedW - 0.5) / 8);
    g.add(part(hoseMat[i % 3], bedL * 0.94, 0.34, (bedW - 0.5) / 8 - 0.05, bedX, deck + bodyH + 0.5, z, 0.05));
  }

  // rear chevrons + tail lights
  const chev = new THREE.MeshStandardMaterial({ map: chevronTexture(), roughness: 0.45 });
  g.add(part(chev, 0.12, bodyH * 0.62, w * 0.94, bodyX - bodyL / 2 - 0.02, deck + bodyH * 0.42, 0, 0.02));
  for (const s of [-1, 1]) {
    g.add(part(LENS('#c8102e'), 0.14, 0.5, 0.34, bodyX - bodyL / 2 - 0.08, deck + bodyH * 0.86, s * (w * 0.36), 0.05));
  }
  g.add(part(PLATE(), 0.6, 0.14, w * 0.9, bodyX - bodyL / 2 - 0.3, 2.1, 0, 0.03));   // tailboard

  // ---- axles ----
  const axles = tandem ? [nose - cabL * 0.72, -l / 2 + 8.2, -l / 2 + 3.4]
                       : [nose - cabL * 0.72, -l / 2 + 5.4];
  for (const ax of axles) for (const s of [-1, 1]) {
    const wh = wheel(wr, 1.15);
    wh.position.set(ax, wr, s * (w / 2 - 0.45));
    g.add(wh);
    g.add(part(RUBBER(), 0.1, 1.1, 1.0, ax - 1.5, 1.0, s * (w / 2 - 0.4), 0.02));    // mudflap
  }
  return g;
}

function engine(colour = PALETTE.engine) {
  return chassis(RIG.engine, colour, { tandem: false });
}

// Quint. Rear-mount turntable; the aerial is a real ladder, rails and rungs.
function truck(colour = PALETTE.truck, { boomPitchDeg = 0, boomYawDeg = 0, boomLen = 42, jacked = false } = {}) {
  const g = chassis(RIG.truck, colour, { tandem: true });
  const { l, w, h, turntableAft } = RIG.truck;
  const tx = -l / 2 + turntableAft;

  const rail = METAL('#c9ced5', 0.42);
  const rung = METAL('#aeb5bd', 0.5);

  g.add(cyl(METAL('#7f868e', 0.5), 2.7, 3.0, 0.9, 24, { x: tx, y: h - 1.5, z: 0 }));
  g.add(cyl(METAL('#9aa1a9', 0.45), 2.1, 2.1, 0.7, 20, { x: tx, y: h - 0.85, z: 0 }));
  // pedestal the ladder pivots from
  for (const s of [-1, 1]) {
    g.add(part(METAL('#8e959d', 0.5), 1.3, 1.5, 0.3, tx, h - 0.1, s * 0.95, 0.05));
  }

  // three telescoping ladder sections, each stepped down in section
  const boom = new THREE.Group();
  const secs = 3;
  for (let i = 0; i < secs; i++) {
    const t = i / (secs - 1);
    const segLen = (boomLen / secs) * 1.02;
    const sec = ladderSection(rail, rung, segLen, 2.5 - t * 0.55, 1.5 - t * 0.35, 1.15);
    sec.position.x = (boomLen / secs) * i;
    boom.add(sec);
  }
  const tip = part(METAL('#d7dce2', 0.4), 0.7, 0.9, 2.2, boomLen, 0, 0, 0.06);
  boom.add(tip);
  boom.position.set(tx, h + 0.35, 0);
  boom.rotation.order = 'YZX';
  boom.rotation.y = boomYawDeg * Math.PI / 180;
  boom.rotation.z = boomPitchDeg * Math.PI / 180;
  g.add(boom);
  g.userData.boom = boom;
  g.userData.boomLen = boomLen;

  if (jacked) {
    for (const ax of [-l / 2 + 17, -l / 2 + 3.5]) for (const s of [-1, 1]) {
      g.add(part(METAL('#a7aeb6', 0.45), 1.6, 0.75, 5.6, ax, 2.5, s * (w / 2 + 2.5), 0.06));
      g.add(cyl(METAL('#868d95', 0.5), 0.44, 0.44, 2.6, 14, { x: ax, y: 1.3, z: s * (w / 2 + 4.9) }));
      g.add(cyl(METAL('#c2c8cf', 0.55), 1.55, 1.55, 0.28, 20, { x: ax, y: 0.16, z: s * (w / 2 + 4.9) }));
    }
  }
  return g;
}

function command() {
  return chassis(RIG.cmd, PALETTE.cmd, { tandem: false });
}

const MAKE = { engine, truck, cmd: command };

// ---------------------------------------------------------------------------
// Place every unit from spec.js. `x` is the WEST edge and `z` the near edge of
// the plan-diagram rectangle, so both convert to a centre here — that keeps
// spec.js identical to data.py and the two diagrams in agreement.
// ---------------------------------------------------------------------------
export function buildApparatus(opts = {}) {
  const g = new THREE.Group();
  g.name = 'apparatus';
  const placed = [];
  for (const u of UNITS) {
    const spec = RIG[u.kind];
    const extra = opts[u.id] ?? {};
    const rig = MAKE[u.kind](extra.colour ?? PALETTE[u.kind], extra);
    rig.position.set(u.x + spec.l / 2, 0, u.z + spec.w / 2);
    rig.rotation.y = (u.rot * Math.PI) / 180;
    rig.name = u.id;
    rig.userData.unit = u;
    g.add(rig);
    placed.push(rig);
  }
  g.userData.placed = placed;
  return g;
}
