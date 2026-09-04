// ============================================================================
// roof-ops.js — the vertical ventilation cut, drawn on the roof surface.
//
// Source: the double center rafter heat hole as transcribed in
// site2/roof-residential.html (built from Orem Truck Ops v3.1 §5 pp.49–51 and
// VERIFIED against truck.txt by a verifier pass, TIMELINE 2026-08-30). The SVG
// there is at 100 px = 2 ft; this file carries the same geometry in FEET.
//
// What is drawn is exactly what the manual gives: five numbered cuts, each with
// a start, a DIRECTION and a stop, on rafters at 24 in o.c., yielding a 4 × 6
// hole, fire side away from egress. Firefighter STANDING positions are NOT
// drawn here — the transcription does not state them, and a marker with no
// source would be an invention. They arrive with the manual extraction if the
// manual states them.
// ============================================================================

import * as THREE from 'three';
import { BUILDING, ridgeHeight } from './spec.js';
import { box, mesh, part, cyl, IN } from './geo.js';
import { PAINT } from './materials.js';

// Verbatim, roof-residential.html (verified transcription of Truck Ops §5).
export const CUT_SEQUENCE = [
  { n: 1, name: 'Head cut',
    verbatim: 'Plunge the saw into the roof and use the top of the bar to find your outside perimeter rafter closest to the fire. Reverse the saw, heading back towards your egress, rolling two rafters and stopping at your third outside perimeter rafter.' },
  { n: 2, name: 'Outside dice cut',
    verbatim: 'placed where you just finished your head cut. Dice cuts should be approximately 1 to 1½ lengths of your saw.' },
  { n: 3, name: 'Second dice', verbatim: 'placed in the middle of your head cut.' },
  { n: 4, name: 'Third/final dice', verbatim: 'placed on the inside of your fire-side perimeter rafter.' },
  { n: 5, name: 'Bottom final cut', verbatim: 'a skim cut back towards your egress.' },
];
export const CUT_RULE = 'Care should be taken to never place a ventilation hole between you and your egress.';
export const CUT_CITE = 'Orem Truck Ops Manual v3.1, Section 5, pp.49–51 (via the verified roof-residential transcription)';

// Where the hole goes: `u` is feet along the ridge (world x), `v` is feet up the
// front (side A) slope measured from the eave. Egress is the aerial at the west
// end, fire side is east — so the hole sits with its fire-side edge east and the
// crew works back west toward the ladder.
export const HOLE = { u0: 86, v0: 9.0, w: 6, h: 4, rafterOC: 2 };   // 24 in o.c.

// Map (u, v, lift) on the front slope to world space.
export function slopePoint(u, v, lift = 0.16) {
  const half = BUILDING.d / 2;
  const apex = (BUILDING.d / 2) * BUILDING.pitch;
  const L = Math.hypot(half, apex);
  const up = new THREE.Vector3(0, apex / L, -half / L);          // up-slope unit
  const nrm = new THREE.Vector3(0, half / L, apex / L);           // surface normal
  const eave = new THREE.Vector3(u, BUILDING.eave + 0.1, BUILDING.z + BUILDING.d);
  return eave.addScaledVector(up, v).addScaledVector(nrm, lift);
}

function cutLine(from, to, colour, label) {
  const g = new THREE.Group();
  const a = slopePoint(from[0], from[1]), b = slopePoint(to[0], to[1]);
  const len = a.distanceTo(b);
  const mid = a.clone().lerp(b, 0.5);
  const dir = b.clone().sub(a).normalize();
  // Emissive so the cut never washes out against a lit roof — at 0.4
  // roughness paint the first pass read as pastel streaks.
  const cutMat = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.55, roughness: 0.5 });
  const bar = mesh(box(len, 0.2, 0.36, 0.03), cutMat);
  bar.position.copy(mid);
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  g.add(bar);
  // arrowhead at the stop end — the DIRECTION is the teaching content
  const head = mesh(new THREE.ConeGeometry(0.42, 1.0, 10), cutMat);
  head.position.copy(b);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(head);
  g.userData.label = label;
  return g;
}

// Numbered anchors for the HTML overlay, one per cut, at its midpoint.
export const CUT_LABELS = [];

export function buildRoofOps() {
  CUT_LABELS.length = 0;
  const g = new THREE.Group();
  g.name = 'roof-ops';
  const { u0, v0, w, h, rafterOC } = HOLE;
  const uFire = u0 + w, uEgress = u0;              // fire side east, egress west
  const vTop = v0 + h, vBot = v0;

  // Rafters under the deck, shown as faint guides on the surface so "rolling
  // two rafters and stopping at your third" can be counted.
  const guide = PAINT('#5b6168', 0.9);
  for (let k = -2; k <= 5; k++) {
    const u = u0 + k * rafterOC;
    const a = slopePoint(u, v0 - 3, 0.05), b = slopePoint(u, vTop + 3, 0.05);
    const m = mesh(box(0.08, 0.06, a.distanceTo(b), 0.01), guide);
    m.position.copy(a.clone().lerp(b, 0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
    g.add(m);
  }

  // The two removable panels, each carried by ONE center rafter.
  const panel = new THREE.MeshBasicMaterial({ color: '#f0a91e', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  for (const [ua, ub] of [[u0 + 0.1, u0 + w / 2 - 0.1], [u0 + w / 2 + 0.1, uFire - 0.1]]) {
    const p = mesh(new THREE.PlaneGeometry(ub - ua, h), panel, { cast: false, receive: false });
    const c = slopePoint((ua + ub) / 2, (vTop + vBot) / 2, 0.08);
    p.position.copy(c);
    const n = slopePoint(0, 0, 1).sub(slopePoint(0, 0, 0)).normalize();
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    g.add(p);
  }

  // Five cuts, in order, each with its direction. Colours step so the order
  // reads at a glance; the numbers live in the HTML overlay, never baked.
  const col = ['#ff3b2f', '#ff6d1f', '#ff9a1a', '#ffc21a', '#ffe81a'];
  const cuts = [
    [[uFire - 0.1, vTop], [uEgress + 0.1, vTop], 'Head cut → toward egress, roll two rafters, stop at the third'],
    [[uEgress, vTop - 0.1], [uEgress, vBot + 0.1], 'Outside dice — where the head cut finished'],
    [[u0 + w / 2, vTop - 0.1], [u0 + w / 2, vBot + 0.1], 'Second dice — middle of the head cut'],
    [[uFire, vTop - 0.1], [uFire, vBot + 0.1], 'Third dice — inside the fire-side perimeter rafter'],
    [[uFire - 0.1, vBot], [uEgress + 0.1, vBot], 'Bottom skim cut → back toward egress'],
  ];
  cuts.forEach(([a, b, label], i) => {
    g.add(cutLine(a, b, col[i], `${i + 1} ${label}`));
    const m = slopePoint((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.5);
    CUT_LABELS.push({ n: i + 1, at: [m.x, m.y, m.z], text: label });
  });

  // Flame marker on the fire side, so "fire side" is unambiguous on the roof.
  const flame = mesh(new THREE.ConeGeometry(0.45, 1.4, 8), PAINT('#ff6a1a', 0.3), { cast: false });
  flame.position.copy(slopePoint(uFire + 2.2, (vTop + vBot) / 2, 0.8));
  g.add(flame);

  g.userData.cuts = CUT_SEQUENCE;
  return g;
}

// Hotspot anchor + zoom for the roof sequence.
export function roofHotspot(n) {
  const c = slopePoint(HOLE.u0 + HOLE.w / 2, HOLE.v0 + HOLE.h + 2.2, 0.6);   // above the hole, off the cuts
  return {
    n, kind: 'roof', title: 'Double center rafter heat hole — five cuts, in order',
    at: [c.x, c.y, c.z], zoom: 22,
    verbatim: CUT_SEQUENCE.map((s) => `${s.n}. ${s.name}. ${s.verbatim}`).join('  ')
      + `  “${CUT_RULE}”`,
    cite: CUT_CITE,
    teaches: 'Orem’s primary cut sequence. Yields an initial 4 × 6 hole; expanded with or against construction, always working back toward egress. Fire side is east (the flame), egress is the aerial to the west.',
  };
}
