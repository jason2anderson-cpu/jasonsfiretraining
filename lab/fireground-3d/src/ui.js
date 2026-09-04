// ============================================================================
// ui.js — callouts as HTML over the canvas.
//
// Per the project's standing research finding, NOTHING is baked into the
// render. Unit labels are DOM nodes positioned each frame from the projected
// 3D anchor: they stay crisp at any zoom, are selectable and screen-readable,
// cost ~0 bytes, and are corrected by editing text rather than re-rendering.
// ============================================================================

import * as THREE from 'three';

const _v = new THREE.Vector3();

export function makeLabels(host, rigs) {
  const layer = document.createElement('div');
  layer.className = 'labels';
  host.appendChild(layer);

  const items = rigs.userData.placed.map((rig) => {
    const el = document.createElement('div');
    el.className = `lbl k-${rig.userData.unit.kind}`;
    el.innerHTML = `<b>${rig.userData.unit.short}</b><span>${rig.userData.unit.label}</span>`;
    layer.appendChild(el);
    return { el, rig };
  });

  return function update(camera, w, h) {
    for (const { el, rig } of items) {
      rig.getWorldPosition(_v);
      _v.y += 13;                                   // float above the light bar
      _v.project(camera);
      const behind = _v.z > 1;
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      const off = behind || x < -40 || x > w + 40 || y < -20 || y > h + 20;
      el.style.display = off ? 'none' : '';
      if (!off) el.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
  };
}

// Small numbered pins for any list of {n, at:[x,y,z], text} — used for the cut
// sequence. Same rule as unit labels: DOM, never baked into the render.
export function makePins(host, pins, cls = 'pin') {
  const layer = document.createElement('div');
  layer.className = 'labels';
  host.appendChild(layer);
  const items = pins.map((p) => {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = `<b>${p.n}</b><span>${p.text}</span>`;
    layer.appendChild(el);
    return { el, p };
  });
  return function update(camera, w, h, maxDist = 70, textDist = 26) {
    for (const { el, p } of items) {
      _v.set(...p.at);
      const d = _v.distanceTo(camera.position);
      el.classList.toggle('near', d < textDist);
      _v.project(camera);
      const x = (_v.x * 0.5 + 0.5) * w, y = (-_v.y * 0.5 + 0.5) * h;
      const off = _v.z > 1 || d > maxDist || x < -40 || x > w + 40 || y < -20 || y > h + 20;
      el.style.display = off ? 'none' : '';
      if (!off) el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
  };
}
