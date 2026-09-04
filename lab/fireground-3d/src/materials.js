// ============================================================================
// materials.js — procedural PBR surfaces.
//
// Every texture here is GENERATED on a canvas at load time. Nothing is
// downloaded. That is deliberate:
//   · zero bytes on a field device, and no third-party image on a public site
//     (the project already carries a no-third-party-images constraint)
//   · no CC0/attribution question to answer before publishing
//   · DETERMINISTIC — a seeded RNG means the same PNG every render, which is
//     what makes the render → read → fix → re-render check meaningful
//
// A flat hex colour is what made the old figures read as plastic. Surface
// variation in albedo AND roughness is most of the fix; the environment map in
// render-stack.js does the rest.
// ============================================================================

import * as THREE from 'three';

// Mulberry32 — small, fast, seeded. Same seed ⇒ same texture, every time.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise: the lattice wraps, so the texture repeats seamlessly.
function lattice(grid, rand) {
  const a = new Float32Array(grid * grid);
  for (let i = 0; i < a.length; i++) a[i] = rand();
  return (fx, fy) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const j0 = ((x0 % grid) + grid) % grid, j1 = ((x0 + 1) % grid + grid) % grid;
    const i0 = ((y0 % grid) + grid) % grid, i1 = ((y0 + 1) % grid + grid) % grid;
    const a00 = a[i0 * grid + j0], a01 = a[i0 * grid + j1];
    const a10 = a[i1 * grid + j0], a11 = a[i1 * grid + j1];
    return (a00 + (a01 - a00) * sx) * (1 - sy) + (a10 + (a11 - a10) * sx) * sy;
  };
}

// Fractal sum of tileable octaves, normalised to 0..1.
function fbm(size, octaves, seed) {
  const rand = rng(seed);
  const layers = [];
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const grid = 4 << o;
    layers.push({ n: lattice(grid, rand), grid, amp });
    total += amp; amp *= 0.5;
  }
  return (x, y) => {
    let v = 0;
    for (const L of layers) v += L.n((x / size) * L.grid, (y / size) * L.grid) * L.amp;
    return v / total;
  };
}

const SIZE = 512;
function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

function texture(draw, { repeat = 1, srgb = false } = {}) {
  const c = canvas();
  draw(c.getContext('2d', { willReadFrequently: true }), c);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Paint an fbm field through a colour ramp. `mix` maps noise 0..1 -> [r,g,b].
function noiseFill(ctx, seed, octaves, mix) {
  const f = fbm(SIZE, octaves, seed);
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = mix(f(x, y), x, y);
      const i = (y * SIZE + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const lerp = (a, b, t) => a + (b - a) * t;
const gray = (v) => [v, v, v];

// ---------------------------------------------------------------------------
// Surfaces. Roughness maps matter as much as colour — a uniform roughness is
// what makes a surface look like a screenshot of a colour swatch.
// ---------------------------------------------------------------------------
export function buildMaterials() {
  const M = {};

  // Asphalt — dark, coarse aggregate, slightly polished in the wheel tracks.
  M.asphalt = new THREE.MeshStandardMaterial({
    map: texture((c) => noiseFill(c, 1337, 6, (n) => {
      const g = lerp(38, 74, n * n);                 // squared -> more dark, few light chips
      return [g, g + 1, g + 3];
    }), { repeat: 14, srgb: true }),
    roughnessMap: texture((c) => noiseFill(c, 1337, 6, (n) => gray(lerp(215, 152, n))), { repeat: 14 }),
    roughness: 1.0, metalness: 0.0,
  });

  // Concrete — sidewalk, staging pad, driveway.
  M.concrete = new THREE.MeshStandardMaterial({
    map: texture((c) => noiseFill(c, 4242, 5, (n) => {
      const g = lerp(150, 186, n);
      return [g, g - 1, g - 5];
    }), { repeat: 10, srgb: true }),
    roughnessMap: texture((c) => noiseFill(c, 4242, 5, (n) => gray(lerp(200, 168, n))), { repeat: 10 }),
    roughness: 0.95, metalness: 0.0,
  });

  // Turf — front lawn and parking strip.
  M.grass = new THREE.MeshStandardMaterial({
    // 7 octaves and a larger tile: at 6 octaves / repeat 22 the smoothstep
    // lattice lined up into visible axis-aligned ridges — it read as corduroy.
    map: texture((c) => noiseFill(c, 909, 7, (n) => [
      lerp(74, 122, n), lerp(99, 152, n), lerp(53, 78, n),
    ]), { repeat: 9, srgb: true }),
    roughnessMap: texture((c) => noiseFill(c, 909, 7, (n) => gray(lerp(238, 202, n))), { repeat: 9 }),
    roughness: 1.0, metalness: 0.0,
  });

  // Lap siding — horizontal courses, 8 in exposure. The shadow line under each
  // course is what makes a wall read as a wall instead of a coloured box.
  M.siding = new THREE.MeshStandardMaterial({
    map: texture((c) => {
      noiseFill(c, 77, 5, (n) => {
        const g = lerp(196, 214, n);
        return [g, g - 3, g - 12];
      });
      const courses = 16;                            // 512px / 16 = 32px per course
      c.globalCompositeOperation = 'multiply';
      for (let i = 0; i < courses; i++) {
        const y = (i + 1) * (SIZE / courses);
        const grd = c.createLinearGradient(0, y - 7, 0, y);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(1, 'rgba(120,120,120,1)');
        c.fillStyle = grd; c.fillRect(0, y - 7, SIZE, 7);
      }
      c.globalCompositeOperation = 'source-over';
    }, { repeat: 3, srgb: true }),
    roughness: 0.82, metalness: 0.0,
  });

  // Asphalt shingle — the roof. Staggered tabs, not a flat plane of colour.
  M.shingle = new THREE.MeshStandardMaterial({
    map: texture((c) => {
      noiseFill(c, 5150, 6, (n) => gray(lerp(44, 104, n)));
      c.globalCompositeOperation = 'multiply';
      const rows = 20, tab = SIZE / 8;
      for (let r = 0; r < rows; r++) {
        const y = (r + 1) * (SIZE / rows);
        c.fillStyle = 'rgba(62,62,62,1)';
        c.fillRect(0, y - 3, SIZE, 3);               // course shadow line
        const off = (r % 2) * (tab / 2);
        for (let t = 0; t < 9; t++) {
          c.fillRect(off + t * tab, y - (SIZE / rows), 1.5, SIZE / rows);
        }
      }
      c.globalCompositeOperation = 'source-over';
    }, { repeat: 5, srgb: true }),
    roughness: 0.93, metalness: 0.0,
  });

  return M;
}

// Painted apparatus bodywork — automotive clearcoat, so it picks up the
// environment. This is the material that most obviously benefits from IBL.
// Cached: one material per colour, shared across every rig that uses it.
const _paint = new Map();
export function rigPaint(colour) {
  if (!_paint.has(colour)) {
    _paint.set(colour, new THREE.MeshPhysicalMaterial({
      color: colour, roughness: 0.28, metalness: 0.0,
      clearcoat: 1.0, clearcoatRoughness: 0.08,
    }));
  }
  return _paint.get(colour);
}

const _metal = new Map();
export const METAL = (colour, rough = 0.4) => {
  const k = colour + '|' + rough;
  if (!_metal.has(k)) _metal.set(k, new THREE.MeshStandardMaterial({
    color: colour, roughness: rough, metalness: 0.85,
  }));
  return _metal.get(k);
};

let _glass, _rubber, _chrome, _plate;
const _lens = new Map();

export const GLASS = () => (_glass ??= new THREE.MeshPhysicalMaterial({
  color: '#131c26', roughness: 0.05, metalness: 0.0, reflectivity: 0.85,
  clearcoat: 1.0, clearcoatRoughness: 0.03,
}));

export const RUBBER = () => (_rubber ??= new THREE.MeshStandardMaterial({
  color: '#15171b', roughness: 0.95, metalness: 0.0,
}));

export const CHROME = () => (_chrome ??= new THREE.MeshStandardMaterial({
  color: '#dfe4ea', roughness: 0.12, metalness: 1.0,
}));

// Brushed aluminium diamond plate — running boards, tailboard, shutters.
export const PLATE = () => (_plate ??= new THREE.MeshStandardMaterial({
  color: '#b9c0c8', roughness: 0.34, metalness: 0.92,
  roughnessMap: texture((c) => noiseFill(c, 8081, 4, (n) => gray(lerp(70, 130, n))), { repeat: 5 }),
}));

// Flat painted joinery — trim boards, fascia, door. Wood paint, not car paint:
// low sheen, no clearcoat.
const _pt = new Map();
export const PAINT = (colour, rough = 0.62) => {
  const k = colour + '|' + rough;
  if (!_pt.has(k)) _pt.set(k, new THREE.MeshStandardMaterial({
    color: colour, roughness: rough, metalness: 0.0,
  }));
  return _pt.get(k);
};

// Warning-light and headlamp lenses: emissive so they read at any exposure.
export const LENS = (colour) => {
  if (!_lens.has(colour)) _lens.set(colour, new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.16, metalness: 0.0,
    emissive: colour, emissiveIntensity: 0.55,
  }));
  return _lens.get(colour);
};
