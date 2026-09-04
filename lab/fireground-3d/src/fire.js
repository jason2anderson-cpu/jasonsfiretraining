// ============================================================================
// fire.js — smoke showing.
//
// Billboarded sprite plumes, not a volumetric solve. A real volumetric sim is
// not affordable in a browser on a field tablet, and for a positioning diagram
// what matters is READING the fire: which side, which floor, how far it has
// gone. The plume therefore originates from a declared opening in spec.js, so
// "fire on the Bravo side, second floor" is a data change, not a redraw.
//
// ⚠️ Smoke colour and volume here are ILLUSTRATIVE. Reading smoke is a taught
// skill with real meaning (velocity, density, colour, thickness) and nothing in
// this plume should be read as a smoke-reading exercise. It marks the fire
// location. Orem's own reading-smoke material governs that subject.
// ============================================================================

import * as THREE from 'three';

function puffTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  let seed = 99;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // Offset lobes so the puff is not a disc, each with a GAUSSIAN falloff.
  // The first pass used a linear (1 - r/R) ramp, which stays near-opaque across
  // most of the quad and then drops — so every sprite showed its own hard
  // rectangular edge and the plume rendered as a blocky column.
  const lobes = Array.from({ length: 5 }, () => ({
    cx: 0.5 + (rnd() - 0.5) * 0.26,
    cy: 0.5 + (rnd() - 0.5) * 0.26,
    s: 0.10 + rnd() * 0.07,
  }));
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size - 0.0, v = py / size;
      let a = 0;
      for (const L of lobes) {
        const d2 = ((u - L.cx) ** 2 + (v - L.cy) ** 2) / (L.s * L.s);
        a += Math.exp(-d2);
      }
      a = 1 - Math.exp(-a);                       // union of the lobes, still smooth
      // Hard vignette to guarantee alpha is exactly 0 at the quad boundary.
      const r = Math.hypot(u - 0.5, v - 0.5) / 0.5;
      a *= Math.exp(-(r * r) * 3.2) * Math.max(0, 1 - Math.pow(r, 3));
      const i = (py * size + px) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * Math.min(1, a));
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

// A plume: N sprites on a shared lifetime, drifting up and downwind, growing
// and fading. Seeded, so a still frame is identical every render.
export function buildPlume({ origin, count = 120, rise = 34, drift = [0.42, 0.16], spread = 9,
                             colorHot = '#33363a', colorCool = '#b9bec4', seed = 7 } = {}) {
  const tex = puffTexture();
  const g = new THREE.Group();
  g.name = 'plume';
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const hot = new THREE.Color(colorHot), cool = new THREE.Color(colorCool);
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false,
      color: 0xffffff, opacity: 0, rotation: rnd() * Math.PI * 2,
    });
    const sp = new THREE.Sprite(mat);
    g.add(sp);
    items.push({
      sp, mat,
      t: i / count,                              // evenly seeded along the plume
      speed: 0.05 + rnd() * 0.03,
      az: rnd() * Math.PI * 2,                   // each puff gets its own azimuth
      rad: 0.25 + rnd() * 0.85,                  // ...and its own cone radius
      wobble: rnd() * Math.PI * 2,
      s0: 1.6 + rnd() * 1.0,          // small at the opening: close zoom must stay readable
      s1: 14 + rnd() * 8,
      rot: (rnd() - 0.5) * 0.5,
    });
  }
  g.position.set(...origin);

  // Sprites that drift through the camera fill the screen with a grey wash and
  // hide whatever the user zoomed in to read. Fade them out inside ~16 ft.
  const _w = new THREE.Vector3();
  g.userData.step = (dt, camera) => {
    for (const it of items) {
      it.t += it.speed * dt;
      if (it.t > 1) it.t -= 1;
      const t = it.t;
      const y = t * rise;
      // Widen into a CONE. The first pass moved every puff along one line, which
      // stacked 90 sprites on top of each other and rendered as a solid black
      // column instead of smoke.
      const spreadR = spread * it.rad * Math.pow(t, 0.7);
      const wob = Math.sin(it.wobble + t * 4.0) * 0.5;
      it.sp.position.set(
        drift[0] * y + Math.cos(it.az + wob) * spreadR,
        y,
        drift[1] * y + Math.sin(it.az + wob) * spreadR,
      );
      const sc = it.s0 + (it.s1 - it.s0) * Math.pow(t, 1.35);   // grows late, not at the window
      it.sp.scale.set(sc, sc, 1);
      it.mat.rotation += it.rot * dt;
      it.mat.color.copy(hot).lerp(cool, Math.min(1, t * 1.35));
      // Low per-sprite alpha: density comes from OVERLAP, not from opacity. At
      // 0.42 the stack saturated to pure black.
      let op = Math.sin(Math.PI * Math.min(1, t * 1.02)) * 0.26;
      if (camera) {
        it.sp.getWorldPosition(_w);
        const d = _w.distanceTo(camera.position);
        // fully visible beyond 34 ft, gone inside 12 — a plume sitting between
        // the camera and the roof at ~20 ft was still hazing the whole surface
        op *= Math.min(1, Math.max(0, (d - 12) / 22));
      }
      it.mat.opacity = op;
    }
  };
  g.userData.step(0);
  return g;
}

// Glow at the seat of the fire, seen through the opening it vents from.
export function buildFireGlow(origin, size = 3.4) {
  const g = new THREE.Group();
  const tex = puffTexture(64);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.5,
      color: new THREE.Color(['#ff7a1a', '#ff9c2e', '#e8531a', '#ffb545', '#ff8a24'][i]),
      blending: THREE.AdditiveBlending,
    });
    const sp = new THREE.Sprite(m);
    const sc = size * (0.55 + i * 0.16);
    sp.scale.set(sc, sc * 1.15, 1);
    sp.position.set((i - 2) * 0.35, (i % 2) * 0.4, 0);
    g.add(sp);
  }
  g.position.set(...origin);
  return g;
}
