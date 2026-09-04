// ============================================================================
// hotspots.js — the manual, placed in the scene.
//
// This is the core interaction: every point on the fireground where something
// is HAPPENING carries a marker, and zooming into it shows what the manual
// actually says about that spot, verbatim, with its citation.
//
// The rule that makes this trustworthy: a hotspot may only ever display text
// that exists in a source document. There is no "explanation" field an author
// can write into. If the manual does not say it, the hotspot does not say it —
// a hotspot with no source is rendered as a declared GAP instead, which is
// itself a teaching point (the guide leaves real questions open).
// ============================================================================

import * as THREE from 'three';

const _v = new THREE.Vector3();

export const KIND_COLOR = {
  engine:   '#e0343f',
  truck:    '#e9edf1',
  hose:     '#d8c23a',
  ladder:   '#63b3ed',
  pathway:  '#7dd3a0',
  roof:     '#f0a91e',
  gap:      '#b06cd8',
};

// A small, always-legible marker: a disc on the ground or a pin in the air.
function marker(colour, gap) {
  const g = new THREE.Group();
  const c = new THREE.Color(colour);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.16, 8, 24),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthTest: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshBasicMaterial({ color: c, depthTest: false }),
  );
  g.add(ring, core);
  if (gap) {                                   // gaps get a second, offset ring
    const r2 = ring.clone();
    r2.scale.setScalar(1.5);
    g.add(r2);
  }
  g.renderOrder = 999;
  return g;
}

export function buildHotspots(list, host, camera, controls, canvas) {
  const group = new THREE.Group();
  group.name = 'hotspots';

  const layer = document.createElement('div');
  layer.className = 'hs-layer';
  host.appendChild(layer);

  const panel = document.createElement('div');
  panel.className = 'hs-panel';
  panel.hidden = true;
  host.appendChild(panel);

  const items = list.map((h) => {
    const m = marker(KIND_COLOR[h.kind] ?? '#ffffff', h.kind === 'gap');
    m.position.set(...h.at);
    group.add(m);

    const dot = document.createElement('button');
    dot.className = `hs-dot k-${h.kind}`;
    dot.type = 'button';
    dot.innerHTML = `<span>${h.n}</span>`;
    dot.title = h.title;
    layer.appendChild(dot);
    dot.addEventListener('click', () => open(h));
    return { h, m, dot };
  });

  let current = null;
  function open(h) {
    current = h;
    panel.hidden = false;
    panel.innerHTML = `
      <button class="hs-close" type="button" aria-label="Close">×</button>
      <div class="hs-kind k-${h.kind}">${h.kind === 'gap' ? 'GAP IN THE GUIDE' : h.kind}</div>
      <h2>${h.n}. ${h.title}</h2>
      ${h.verbatim ? `<blockquote>${h.verbatim}</blockquote>` : ''}
      ${h.cite ? `<p class="hs-cite">${h.cite}</p>` : ''}
      ${h.teaches ? `<p class="hs-teach">${h.teaches}</p>` : ''}
      ${h.kind === 'gap' ? '<p class="hs-gap">The manuals do not answer this. Nothing has been invented to fill it.</p>' : ''}
      <button class="hs-zoom" type="button">Zoom to this</button>`;
    panel.querySelector('.hs-close').addEventListener('click', () => { panel.hidden = true; current = null; });
    panel.querySelector('.hs-zoom').addEventListener('click', () => flyTo(h));
  }

  // Fly the camera in close enough to read the local situation.
  let fly = null;
  function flyTo(h) {
    const target = new THREE.Vector3(...h.at);
    const dist = h.zoom ?? 34;
    const dir = camera.position.clone().sub(controls.target).normalize();
    // keep a sane elevation so we do not end up under the deck
    dir.y = Math.max(dir.y, 0.35);
    dir.normalize();
    fly = {
      t: 0,
      fromPos: camera.position.clone(), toPos: target.clone().addScaledVector(dir, dist),
      fromTgt: controls.target.clone(), toTgt: target,
    };
  }

  function update(w, h2, dt) {
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 900);
      const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;  // easeInOutQuad
      camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
      controls.target.lerpVectors(fly.fromTgt, fly.toTgt, e);
      controls.update();
      if (fly.t >= 1) fly = null;
    }
    for (const { h, m, dot } of items) {
      _v.copy(m.position).project(camera);
      const behind = _v.z > 1;
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h2;
      const off = behind || x < -30 || x > w + 30 || y < -30 || y > h2 + 30;
      dot.style.display = off ? 'none' : '';
      if (!off) dot.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      const active = current && current.n === h.n;
      dot.classList.toggle('is-active', !!active);
    }
  }

  return { group, update, open, flyTo, items };
}
