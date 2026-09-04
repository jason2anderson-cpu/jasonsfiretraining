// ============================================================================
// hotspot-data.js — PROVISIONAL. Every entry below was read verbatim out of the
// source this session and carries its citation. The full set is being generated
// from a systematic pass over the Engine manual, Truck manual and QRG; this file
// is the seed that proves the plumbing.
//
// ⛔ Rule: `verbatim` must be text that exists in a source document. If there is
// no source, the entry's kind is 'gap' and it says so — it never gets filled in.
// ============================================================================

import { BUILDING, UNITS, RIG, SCENARIO } from './spec.js';

const t1 = UNITS.find((u) => u.id === 't1');
const t1cx = t1.x + RIG.truck.l / 2;
const front = BUILDING.z + BUILDING.d;

const ALL = [
  {
    n: 1, kind: 'ladder', title: 'Tip placement — kiss the roof with both beams',
    at: [t1cx - RIG.truck.l / 2 + RIG.truck.turntableAft, BUILDING.eave + 2, front - 1],
    zoom: 30,
    verbatim: 'The tip of the ladder should “kiss” the roof with both beams. This takes the bounce out of '
      + 'the ladder and is much safer to maneuver up and down with tools. Stay away from placing the egress '
      + 'section on the roof and opt to place the beams on instead.',
    cite: 'Orem Truck Ops Manual v3.1, Section 6, p.143',
    teaches: 'Why the aerial in this scene is solved to the roof edge rather than parked at an angle.',
  },
  {
    n: 2, kind: 'ladder', title: 'The offside corner — two ways on and off',
    at: [BUILDING.x + 2, BUILDING.eave + 1, front + 2], zoom: 34,
    verbatim: 'The “offside” corner is where we aim to place our aerial ladder when going to the roof. By '
      + 'placing the ladder just a few feet off the corner this would allow for two ways on and off the '
      + 'ladder. This can come in handy if crews need to exit the roof in a hurry.',
    cite: 'Orem Truck Ops Manual v3.1, Section 6, p.143',
    teaches: 'The corner is chosen for egress, not for reach.',
  },
  {
    n: 3, kind: 'truck', title: 'Inside vs outside spot',
    at: [t1cx, 12, t1.z - 6], zoom: 40,
    verbatim: 'By taking an inside spot we would be needing our aerial for a longer throw... An outside spot '
      + 'allows Engine companies to position closer to the building underneath the Trucks ladder. This allows '
      + 'the waterway to get out of the way and produces a better climbing angle for crews going to the roof.',
    cite: 'Orem Truck Ops Manual v3.1, Section 6, p.143',
    teaches: 'The truck’s spot decides whether an engine can still get in under the ladder.',
  },
  {
    n: 4, kind: 'truck', title: 'Pull past or stop short',
    at: [t1cx + 26, 10, t1.z + 5], zoom: 44,
    verbatim: 'Pulling past a structure could allow us to place our aerial ladder where needed. This also '
      + 'allows ground ladders to be pulled out right in front of the structure in a quick manner, whether '
      + 'for primary or secondary access/egress.',
    cite: 'Orem Truck Ops Manual v3.1, Section 6, pp.143–144',
    teaches: 'Position is a choice made on approach, not on arrival.',
  },
  {
    n: 5, kind: 'gap', title: '2nd Truck on a residential — the guide stops short',
    at: [196 + RIG.truck.l / 2, 14, 106], zoom: 46,
    verbatim: 'Residential: “Position to cover side Charlie when possible.”  ·  Mid-rise and Commercial: '
      + '“Position to cover side Charlie.”  The qualifier appears on residential only.',
    cite: 'OFD Quick Reference Guide (May 2024), 2nd Truck Company row',
    teaches: 'The Truck Manual (§6 p.144) defines the task as placing the ladder to the OPPOSITE offside '
      + 'corner — but neither document says where the rig goes when side C cannot be reached, and the '
      + 'reviewed residential layout leaves no frontage for it.',
  },
  {
    n: 6, kind: 'hose', title: 'Close as possible — cut the number of lengths',
    at: [BUILDING.x + BUILDING.w - 6, 3, front + 9], zoom: 30,
    verbatim: 'Close as possible to cut the number of lengths — but the front stays open for the Truck’s aerial.',
    cite: 'Engine Company Operations 2023 V-1, p.1-9',
    teaches: 'The 1st Engine trades its own convenience for the truck’s working room.',
  },
];

// The 2nd-Truck gap is a residential finding; on mid-rise and commercial the
// QRG assigns side C without qualification and the rear alley exists.
export const HOTSPOTS = ALL.filter((h) => !(h.n === 5 && SCENARIO.occupancy !== 'res'))
  .map((h, i) => ({ ...h, n: i + 1 }));
