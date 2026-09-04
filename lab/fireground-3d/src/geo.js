// ============================================================================
// geo.js — geometry helpers.
//
// THE SINGLE MOST IMPORTANT ONE IS `box()`.
//
// Nothing in the physical world has a razor-sharp 90 degree edge. Every real
// edge has a small radius, and that radius catches a bright highlight line when
// light rakes across it. Sharp-edged primitives have no highlight, so the eye
// reads them as untextured toy blocks — that is the whole "old Lego" signal,
// and no amount of lighting or ray tracing fixes it.
//
// So: `box()` replaces BoxGeometry everywhere, with a bevel radius in FEET
// scaled to the part. A 1-inch bevel on a truck panel is what a real steel
// panel has, and it changes the read completely.
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const IN = 1 / 12;

// Bevelled box. `r` is the edge radius in feet; it is clamped so it can never
// exceed half the smallest dimension (which would collapse the geometry).
export function box(w, h, d, r = 1.2 * IN, seg = 2) {
  const rr = Math.min(r, Math.min(w, h, d) * 0.48);
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

// A bevelled slab positioned in one call — most parts are exactly this.
export function part(mat, w, h, d, x, y, z, r = 1.2 * IN) {
  const m = mesh(box(w, h, d, r), mat);
  m.position.set(x, y, z);
  return m;
}

export function cyl(mat, rTop, rBot, h, seg, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

// A real ladder: two side rails and rungs. Modelling the aerial as a grey slab
// is one of the loudest toy cues in the scene — a ladder has to read as a
// ladder, with light passing between the rungs.
export function ladderSection(matRail, matRung, len, width, depth, rungGap) {
  const g = new THREE.Group();
  const railH = depth, railW = 0.16;
  for (const s of [-1, 1]) {
    // top and bottom chords of the truss, plus a thin web between them
    for (const yy of [railH / 2 - 0.09, -railH / 2 + 0.09]) {
      g.add(part(matRail, len, 0.18, railW, len / 2, yy, s * (width / 2), 0.03));
    }
    const web = part(matRail, len, railH * 0.62, 0.06, len / 2, 0, s * (width / 2), 0.02);
    g.add(web);
  }
  const n = Math.max(2, Math.floor(len / rungGap));
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * len;
    g.add(cyl(matRung, 0.055, 0.055, width, 8, { x, y: -railH / 2 + 0.09, rx: Math.PI / 2 }));
  }
  return g;
}

// NFPA-style rear chevron panel, drawn to a canvas so the diagonals are crisp.
export function chevronTexture(a = '#c8102e', b = '#f2f2f2', bands = 7) {
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = b; x.fillRect(0, 0, W, H);
  x.fillStyle = a;
  const step = W / bands;
  x.lineWidth = 0;
  for (let i = -2; i < bands + 2; i++) {
    x.beginPath();
    const o = i * step * 2;
    x.moveTo(o, H); x.lineTo(o + step, H); x.lineTo(o + step + H, 0); x.lineTo(o + H, 0);
    x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { IN };
