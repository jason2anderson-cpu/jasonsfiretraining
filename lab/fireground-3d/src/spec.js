// ============================================================================
// spec.js — EVERY DIMENSION IN THE SCENE, IN FEET, IN ONE FILE.
//
// This file is the officer review surface. Correcting the figure means
// correcting a NUMBER here, not redrawing anything. Nothing in this scene is
// drawn by hand; every position and size below is read by the geometry code.
//
// ⚠️ VERIFY — nothing here publishes as fact until an officer checks it.
//    Each block carries its own VERIFY note naming what must be confirmed.
//
// ⛔ R-4: no tank capacity, pump rating, preconnect, ladder complement or
//    nozzle inventory appears anywhere in this app. Position and geometry only.
//
// COORDINATE SYSTEM (matches render/fireground-src/data.py exactly, so the 2D
// plan diagram and this 3D scene stay in agreement):
//    x  0 → 200 ft   west → east, across the frontage
//    z  0 → 138 ft   rear (side C, top of the plan) → front (staging, bottom)
//    y  up, height above grade
// Side A is ALWAYS the street side (high z). Side C is the rear alley (low z).
// ============================================================================

// ⛔ REAR APPARATUS ACCESS — a scenario condition, not a constant.
//
// OFD Quick Reference Guide (May 2024), 2nd Truck Company row, reads across its
// three columns:
//     Residential  "Position to cover side Charlie WHEN POSSIBLE."
//     Mid-rise     "Position to cover side Charlie."
//     Commercial   "Position to cover side Charlie."
// The qualifier appears ONLY on residential. Source:
// `source-extracts/quick-response-guide.txt` line 24.
//
// On a typical single-family lot there is no apparatus access to the back yard,
// so a truck cannot position on side C at all — which is what "when possible"
// is doing in that sentence. Drawing a truck parked behind a house presents a
// modelling convenience as doctrine.
//
// ⚠️ OPEN — AWAITING JASON'S RULING. The guide states the qualifier but gives no
// alternate position for the 2nd Truck when side C cannot be reached. That is a
// genuine gap in the source, like the residential 3rd Engine gap. Until it is
// ruled on, `rearAccess: false` parks T2 on side A at the D end and the app says
// plainly that the position is not given by the guide. NOTHING IS INVENTED.
const _q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new Map();
const _occ = ['res', 'mid', 'com'].includes(_q.get('occ')) ? _q.get('occ') : 'res';

export const SCENARIO = {
  occupancy: _occ,
  // Rear apparatus access: false on a typical single-family lot; the plan
  // diagram gives mid-rise and commercial an alley with rear hydrants
  // (data.py REAR_HYD), so it is true there.
  rearAccess: _occ !== 'res',
  // ⛔ OFFENSIVE by default, and the collapse zone is hidden with it.
  // The collapse zone is a DEFENSIVE tool — it is the standoff you take when
  // you have given up the building. Drawing it on an offensive fire implies a
  // constraint that is not operating and clutters the thing the scene is
  // actually for. It is taught separately. Flip to 'defensive' to show it.
  mode: 'offensive',
};

export const SITE = {
  w: 200, d: 138,              // the modelled block, ft
  // bands running east–west across the site, [zStart, zEnd] in ft
  alley:   [2, 25],            // rear access · side C
  street:  [96, 123],          // side A frontage
  staging: [123, 138],
  // VERIFY: band widths are the plan-diagram values, not a survey of a real
  // Orem block. A 27 ft street = two 11 ft lanes + parking. Confirm typical
  // residential frontage with an officer before this publishes.
};

// ---------------------------------------------------------------------------
// BUILDING — residential, 1–3 floors (data.py occupancy 'res')
// ---------------------------------------------------------------------------
// Footprints are data.py BLD, verbatim. Heights are typical values and carry
// VERIFY notes — nothing here is measured off Orem's building stock.
const BUILDINGS = {
  res: { x: 64, z: 52, w: 54,  d: 36, eave: 18, floors: 2, roof: 'gable', pitch: 6 / 12, overhang: 1.5, name: 'HOUSE',      note: '1–3 floors' },
  // VERIFY: 5 storeys at 11 ft is a common mid-rise floor height, not a survey.
  mid: { x: 52, z: 30, w: 76,  d: 58, eave: 55, floors: 5, roof: 'flat',  pitch: 0,      overhang: 0,   name: 'MID-RISE',   note: '4 floors and above' },
  // VERIFY: single-storey commercial, 20 ft parapet, long-span flat roof.
  com: { x: 26, z: 44, w: 130, d: 44, eave: 20, floors: 1, roof: 'flat',  pitch: 0,      overhang: 0,   name: 'COMMERCIAL', note: 'wide frontage, long span roof' },
};
export const BUILDING = BUILDINGS[SCENARIO.occupancy];

// From data.py: only where "entrance closest to fire" applies, and FDCs.
export const ENTRY = { res: null, mid: { x: 66, z: 88 }, com: { x: 44, z: 88 } }[SCENARIO.occupancy];
export const FDC   = { res: null, mid: { x: 120, z: 88 }, com: { x: 140, z: 88 } }[SCENARIO.occupancy];
export const REAR_HYDRANT = { res: false, mid: true, com: true }[SCENARIO.occupancy];

// Ridge height falls out of the footprint and pitch — it is never typed in.
export const ridgeHeight = () => BUILDING.roof === 'gable' ? BUILDING.eave + (BUILDING.d / 2) * BUILDING.pitch : BUILDING.eave;

// ---------------------------------------------------------------------------
// COLLAPSE ZONE
// ---------------------------------------------------------------------------
export const COLLAPSE = {
  showOn: 'defensive',       // see SCENARIO.mode
  mult: 1.5,                   // × height of the tallest exterior wall
  // VERIFY: Engine Company Operations 2023 V-1, pp.133–134 (worked example
  // uses a 20 ft wall → 30 ft zone). Confirm the multiplier and that it is
  // measured off the WALL height, not the ridge.
};
// Measured off the eave (top of the exterior wall), not the ridge.
export const collapseZone = () => BUILDING.eave * COLLAPSE.mult;

// ---------------------------------------------------------------------------
// APPARATUS — footprints from data.py, heights added here
// ---------------------------------------------------------------------------
export const RIG = {
  engine: { l: 32, w: 8, h: 10.0, cabL: 9.5, cabH: 9.2 },
  truck:  { l: 45, w: 8, h: 11.5, cabL: 10.5, cabH: 9.8, turntableAft: 6 },
  cmd:    { l: 20, w: 8, h: 8.4,  cabL: 8.0,  cabH: 8.0 },
  // `turntableAft` = ft from the tailboard to the turntable centre. 6 ft puts it
  // at the REAR, which is the configuration Orem runs (Ladder 32 is a rear-mount
  // quint) — a rear-mount stows the ladder forward over the cab, and that changes
  // both the stowed silhouette and where the aerial pivots from.
  // VERIFY: lengths and widths are the plan diagram's. Heights are typical
  // apparatus values and are NOT taken from Ladder 32 or any Orem rig.
  // ⚠️ These are GENERIC apparatus. Not a model of a specific Orem unit.
};

export const LANE = { street: 102, rear: 9, staging: 125 };

// Residential assignment — data.py P.res, verbatim (re-synced 2026-09-02 after
// TIMELINE #19 deepened it: Heavy Rescue is no longer assigned on residential,
// Paramedic Squad and Transport Ambulance are).
//   x = west edge of the rig, z = the lane it is in, rot = heading in degrees
//   (0 = nose east). Rigs on the street face east; rear-alley rigs face west.
const RES_UNITS = [
  { id: 'e3', kind: 'engine', x: 14,  z: LANE.street,  rot: 0,   label: '3rd Engine',          short: 'E3' },
  { id: 't1', kind: 'truck',  x: 68,  z: LANE.street,  rot: 0,   label: '1st Truck',           short: 'T1' },
  { id: 'e1', kind: 'engine', x: 120, z: LANE.street,  rot: 0,   label: '1st Engine',          short: 'E1' },
  { id: 'e2', kind: 'engine', x: 158, z: LANE.street,  rot: 0,   label: '2nd Engine',          short: 'E2' },
  { id: 'e4', kind: 'engine', x: 10,  z: LANE.staging, rot: 0,   label: '4th Engine · RIC',    short: 'E4' },
  { id: 'sq', kind: 'engine', x: 46,  z: LANE.staging, rot: 0,   label: 'Paramedic Squad',     short: 'SQ' },
  { id: 'cp', kind: 'cmd',    x: 150, z: LANE.staging, rot: 90,  label: 'Chief Officers',      short: 'CP' },
  { id: 'am', kind: 'cmd',    x: 174, z: LANE.staging, rot: 0,   label: 'Transport Ambulance', short: 'AM' },
];
// data.py P.mid, verbatim (CP turned to face the structure, as on residential).
const MID_UNITS = [
  { id: 'e1', kind: 'engine', x: 10,  z: LANE.street,  rot: 0,   label: '1st Engine',          short: 'E1' },
  { id: 't1', kind: 'truck',  x: 56,  z: LANE.street,  rot: 0,   label: '1st Truck',           short: 'T1' },
  { id: 'e2', kind: 'engine', x: 108, z: LANE.street,  rot: 0,   label: '2nd Engine · FDC',    short: 'E2' },
  { id: 'e3', kind: 'engine', x: 150, z: LANE.street,  rot: 0,   label: '3rd Engine',          short: 'E3' },
  { id: 't2', kind: 'truck',  x: 6,   z: LANE.rear,    rot: 180, label: '2nd Truck · side C',  short: 'T2' },
  { id: 'e4', kind: 'engine', x: 62,  z: LANE.rear,    rot: 180, label: '4th Engine',          short: 'E4' },
  { id: 'e5', kind: 'engine', x: 104, z: LANE.rear,    rot: 180, label: '5th Engine',          short: 'E5' },
  { id: 'hr', kind: 'engine', x: 52,  z: LANE.staging, rot: 0,   label: 'Heavy Rescue 21 · RIC', short: 'HR' },
  { id: 'sq', kind: 'engine', x: 10,  z: LANE.staging, rot: 0,   label: 'Paramedic Squad',     short: 'SQ' },
  { id: 'cp', kind: 'cmd',    x: 150, z: LANE.staging, rot: 90,  label: 'Chief Officers',      short: 'CP' },
  { id: 'am', kind: 'cmd',    x: 174, z: LANE.staging, rot: 0,   label: 'Transport Ambulance', short: 'AM' },
];
// data.py P.com, verbatim.
const COM_UNITS = [
  { id: 'e1', kind: 'engine', x: 26,  z: LANE.street,  rot: 0,   label: '1st Engine',          short: 'E1' },
  { id: 't1', kind: 'truck',  x: 60,  z: LANE.street,  rot: 0,   label: '1st Truck',           short: 'T1' },
  { id: 'e3', kind: 'engine', x: 128, z: LANE.street,  rot: 0,   label: '3rd Engine · FDC',    short: 'E3' },
  { id: 'e2', kind: 'engine', x: 166, z: LANE.street,  rot: 0,   label: '2nd Engine',          short: 'E2' },
  { id: 't2', kind: 'truck',  x: 6,   z: LANE.rear,    rot: 180, label: '2nd Truck · side C',  short: 'T2' },
  { id: 'e4', kind: 'engine', x: 62,  z: LANE.rear,    rot: 180, label: '4th Engine',          short: 'E4' },
  { id: 'e5', kind: 'engine', x: 104, z: LANE.rear,    rot: 180, label: '5th Engine',          short: 'E5' },
  { id: 'hr', kind: 'engine', x: 52,  z: LANE.staging, rot: 0,   label: 'Heavy Rescue 21 · RIC', short: 'HR' },
  { id: 'sq', kind: 'engine', x: 10,  z: LANE.staging, rot: 0,   label: 'Paramedic Squad',     short: 'SQ' },
  { id: 'cp', kind: 'cmd',    x: 150, z: LANE.staging, rot: 90,  label: 'Chief Officers',      short: 'CP' },
  { id: 'am', kind: 'cmd',    x: 174, z: LANE.staging, rot: 0,   label: 'Transport Ambulance', short: 'AM' },
];

// The 2nd Truck's position on a RESIDENTIAL depends entirely on whether side C
// can be reached (see the scenario note at the top of this file).
//
// TRUCK MANUAL v3.1, Section 6, p.144 — "Second Due Trucks", verbatim:
//   "Second arriving Trucks should be placing their ladders to the roof if the
//    first arriving Truck is performing roof operations... Second due Trucks
//    should attempt to place their ladder on the opposite 'offside' corner.
//    Secondary ladders should be placed on their side of the building."
// (Citation checked against the footer rule: this text sits between footers 143
//  and 144, so it is page 144.)
//
// So the 2nd Truck's task is defined by WHERE ITS LADDER GOES — the offside
// corner opposite the 1st Truck's — not by parking on side C. Side C is simply
// where that corner usually is on a mid-rise or commercial.
const T2_REAR = {
  id: 't2', kind: 'truck', x: 68, z: LANE.rear, rot: 180,
  label: '2nd Truck · side C', short: 'T2',
};
// Pulled past to the east end of the frontage — "Pulling past a structure could
// allow us to place our aerial ladder where needed" (Truck Manual p.143) — to
// reach the A/B corner, opposite the 1st Truck's A/D corner.
//
// ⚠️ FINDING FOR OFFICER REVIEW: the reviewed residential layout in data.py
// assumes rear access for T2. Without it there is NO street frontage left on
// side A — E3 14–46, T1 68–113, E1 120–152, E2 158–190 — so a second 45 ft truck
// physically does not fit on the block. The spot below is DERIVED from the
// manual's "pull past" guidance, not given by any source. It is not a ruling.
const T2_NO_REAR = {
  id: 't2', kind: 'truck', x: 196, z: LANE.street, rot: 0,
  label: '2nd Truck · ladder to opposite offside corner', short: 'T2',
};

export const UNITS = SCENARIO.occupancy === 'res'
  ? [...RES_UNITS, SCENARIO.rearAccess ? T2_REAR : T2_NO_REAR]
  : SCENARIO.occupancy === 'mid' ? MID_UNITS : COM_UNITS;

// Surfaced in the app so the qualifier is read, not buried in a comment.
export const T2_NOTE = SCENARIO.occupancy !== 'res' ? '' : SCENARIO.rearAccess
  ? '2nd Truck to side C — rear access available on this lot. Ladder to the offside corner '
  + 'opposite the 1st Truck (Truck Manual v3.1 §6 p.144).'
  : 'No rear apparatus access on this lot. The QRG qualifies side C with "when possible" on '
  + 'residential only; the Truck Manual (§6 p.144) defines the task as placing the ladder to the '
  + 'OPPOSITE OFFSIDE CORNER, so the 2nd Truck pulls past on side A to reach the A/B corner. '
  + '⚠️ Exact spot is derived, not given — and the reviewed layout leaves no frontage for it.';

// Where the 2nd Truck's aerial is aimed. Derived from the 1st Truck's corner, so
// it is always the OPPOSITE one — the manual's rule expressed as arithmetic.
export const T2_TARGET_CORNER = 'AB';   // T1 works A/D, so T2 works A/B

// VERIFY: positions are OFD Quick Reference Guide (May 2024) as transcribed into
// data.py for the 2D plan. On a residential fire the guide gives no position for
// the 3rd engine — E3 here follows Engine Company Operations 2023 V-1 p.1-9
// ("out of the way of the direct fire scene").
// ⚠️ Orem and Kaysville run the same unit numbers. These are OREM positions.

// ---------------------------------------------------------------------------
// AERIAL — 1st Truck, offensive spot
// ---------------------------------------------------------------------------
export const AERIAL = {
  cornerStandoff: 4,           // ft off the offside corner
  boomPitchDeg: 44,            // set so the tip lands at the roof edge
  turntableH: 9.0,             // ft above grade
  // VERIFY: Truck Manual v3.1, Section 6, pp.143–144 — "uninvolved to
  // involved, offside corner a few feet off it, tip kissing the roof with
  // both beams." Pitch is derived to hit the eave, not a manual figure.
};

// ---------------------------------------------------------------------------
// HYDRANTS
// ---------------------------------------------------------------------------
export const HYDRANTS = [
  { x: 186, z: 94 },
  { x: 40,  z: 94 },
];
// VERIFY: hydrant spots are the plan diagram's illustrative positions.
// Real spacing is set by the water system, not by this file.

// ---------------------------------------------------------------------------
// THE FIRE — declared, so "second floor, Bravo side" is a data change.
// ⚠️ ILLUSTRATIVE. Smoke colour/volume here mark the fire's LOCATION. Reading
//    smoke is a taught skill with real meaning and this plume is not a
//    smoke-reading exercise — Orem's own material governs that subject.
// ---------------------------------------------------------------------------
export const FIRE = {
  side: 'A',          // A street · B flank · C rear · D other flank
  floor: 2,
  // An upper front window, so the smoke reads from the street — which is the
  // view the first-due officer actually has.
  ventingWindow: {
    res: { x: 79, y: 12.6, z: 88.6 },
    mid: { x: 66 + 12, y: 11 * 2 + 5.5, z: 88.6 },     // floor 3, near the fire-side stair entrance
    com: { x: 44 + 30, y: 14, z: 88.6 },                // high front window
  }[SCENARIO.occupancy],
};

export const PALETTE = {
  engine: '#c1121f',
  truck:  '#e5e5e5',
  cmd:    '#1d3557',
  zone:   '#f5a524',
  ok:     '#3ec46d',
};
