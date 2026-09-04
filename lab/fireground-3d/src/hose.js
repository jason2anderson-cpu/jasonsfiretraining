// ============================================================================
// hose.js — hoselines, drawn from the same paths the 2D plan uses.
//
// The routes come from `render/fireground-src/data.py` HOSE, transcribed here
// unchanged, so the flat diagram and the 3D scene can never disagree about
// where a line runs. Coordinates are FEET in the shared frame (SVG x -> world
// X, SVG y -> world Z).
//
// ⛔ R-4: line SIZES are rendered at generic diameters and are NOT labelled.
//    Preconnect and hose complement are rig inventory and need verification at
//    the apparatus; nothing here asserts what Orem carries.
// ============================================================================

import * as THREE from 'three';

// Verbatim from data.py HOSE. 'sup' = supply, 'atk' = attack.
export const HOSE_PATHS = {
  res: [
    ['sup', 'M186,94 L186,99 L182,99 L182,102'],
    ['sup', 'M158,110 L156,114 L154,114 L152,110'],
    ['atk', 'M136,102 L132,95 L112,88'],
  ],
  mid: [
    ['sup', 'M186,94 L186,99 L182,99 L182,102'],
    ['sup', 'M150,110 L148,114 L142,114 L140,110'],
    ['sup', 'M120,102 L120,95 L120,90'],
    ['atk', 'M26,102 L34,95 L66,88'],
    ['sup', 'M152,13 L146,13 L142,13 L136,13'],
    ['sup', 'M104,13 L100,13 L98,13 L94,13'],
    ['atk', 'M78,17 L78,23 L78,30'],
  ],
  com: [
    ['sup', 'M186,94 L186,99 L190,99 L190,102'],
    ['sup', 'M166,110 L164,114 L60,114 L58,110'],
    ['sup', 'M140,102 L140,95 L140,90'],
    ['atk', 'M42,102 L42,95 L44,88'],
    ['sup', 'M152,13 L146,13 L142,13 L136,13'],
    ['sup', 'M104,13 L100,13 L98,13 L94,13'],
    ['atk', 'M78,17 L78,30 L78,44'],
  ],
};

const SPEC = {
  sup: { r: 0.21, color: '#d8c23a', name: 'Supply line' },
  atk: { r: 0.10, color: '#c0392b', name: 'Attack line' },
};

function parsePath(d) {
  return d.trim().split(/(?=[ML])/).map((seg) => {
    const [x, y] = seg.slice(1).trim().split(',').map(Number);
    return new THREE.Vector3(x, 0, y);
  });
}

// Hose lies on the deck. Real line does not run in straight rulered segments —
// it slacks and curves — so the corner points are rounded with a spline and a
// little lateral wander is added, which is most of what makes it read as hose
// rather than as a diagram line lifted into 3D.
function drape(points, r, seed = 3) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  const dense = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const n = Math.max(2, Math.round(a.distanceTo(b) / 3));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const p = a.clone().lerp(b, t);
      p.x += rnd() * 0.7;
      p.z += rnd() * 0.7;
      p.y = r + Math.abs(rnd()) * 0.12;
      dense.push(p);
    }
  }
  const last = points[points.length - 1].clone();
  last.y = r;
  dense.push(last);
  return new THREE.CatmullRomCurve3(dense, false, 'catmullrom', 0.4);
}

export function buildHoses(occupancy = 'res') {
  const g = new THREE.Group();
  g.name = 'hoses';
  const paths = HOSE_PATHS[occupancy] ?? [];

  paths.forEach(([kind, d], i) => {
    const sp = SPEC[kind];
    const curve = drape(parsePath(d), sp.r, 7 + i * 13);
    const geo = new THREE.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() / 1.5)), sp.r, 8, false);
    const mat = new THREE.MeshStandardMaterial({ color: sp.color, roughness: 0.72, metalness: 0.0 });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `${kind}-${i}`;
    m.userData = { kind, label: sp.name };
    g.add(m);

    // Couplings every 50 ft, which is what makes a tube read as hose.
    const len = curve.getLength();
    const n = Math.floor(len / 50);
    for (let c = 1; c <= n; c++) {
      const t = (c * 50) / len;
      const pos = curve.getPointAt(Math.min(1, t));
      const tan = curve.getTangentAt(Math.min(1, t));
      const cpl = new THREE.Mesh(
        new THREE.CylinderGeometry(sp.r * 1.45, sp.r * 1.45, sp.r * 1.6, 10),
        new THREE.MeshStandardMaterial({ color: '#b9a44a', roughness: 0.35, metalness: 0.9 }),
      );
      cpl.position.copy(pos);
      cpl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.normalize());
      cpl.castShadow = true;
      g.add(cpl);
    }
  });
  return g;
}
