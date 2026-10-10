// The splash plane's flight, as Hanh mapped and timed it in the approved
// mockup. Points are pixels on the hero illustration (1536 × 1024). It takes
// off as a paper plane and turns into the jet late in the flight (Hanh's
// flight-path editor, session 2), using the same fade values as the landing.

export const HERO_W = 1536
export const HERO_H = 1024

export const ROUTE: [number, number][] = [
  [192, 685], [289, 792], [360, 852], [426, 898], [493, 921], [575, 933], [660, 853], [711, 788],
  [737, 682], [698, 608], [627, 622], [558, 666], [560, 704], [590, 723], [628, 697], [617, 659],
  [529, 597], [457, 619], [420, 683], [453, 738], [493, 795], [545, 841], [599, 880], [656, 916],
  [726, 918], [806, 897], [883, 866], [944, 835], [998, 812], [1072, 772], [1156, 725], [1203, 671],
  [1140, 613], [1079, 656], [1096, 719], [1242, 748], [1385, 708], [1441, 629], [1462, 549], [1481, 457],
  [1477, 404], [1389, 342], [1305, 373], [1228, 381], [1186, 375], [1136, 333], [1124, 271], [1160, 231],
  [1220, 247], [1231, 299], [1211, 344], [1163, 400], [1103, 430], [1041, 451], [977, 470], [914, 475],
  [862, 475], [803, 470], [698, 453], [626, 445], [532, 418], [463, 383], [408, 336], [343, 286],
  [278, 246], [212, 236], [156, 266], [131, 309], [131, 364], [158, 403], [217, 420], [279, 426],
  [347, 403], [377, 359], [420, 305], [463, 281], [535, 230], [556, 177], [536, 134], [473, 111],
  [410, 132], [398, 187], [415, 249], [497, 297], [577, 302], [935, 233]
]

// Timeline, as fractions of the scroll through the hero (0 = top of the
// page, 1 = the end of the pinned picture).
const FLIGHT_END = 0.8 // the plane reaches the end of the route
const PAINTED_IN = { from: 0.76, length: 0.08 } // the plane in the picture fades in
const FLYING_OUT = { from: 0.78, length: 0.11 } // the flying plane fades out
export const LANDED_AT = 0.94 // the Wanderlog / Savorlog panels come up
// The paper plane turns into the jet, with the same fades as the landing:
// the incoming plane fades in over 0.08, the outgoing one fades out over
// 0.11 starting 0.02 later.
const PAPER_TO_JET = 0.68
const JET_IN = { from: PAPER_TO_JET, length: PAINTED_IN.length }
const PAPER_OUT = { from: PAPER_TO_JET + (FLYING_OUT.from - PAINTED_IN.from), length: FLYING_OUT.length }

// Flying sizes in hero pixels (width) and which way each picture's nose
// points when unrotated (degrees, 0 = right, negative = up).
export const PAPER_PLANE = { width: 150, height: 150 * (223 / 275), nose: -46 }
export const JET = { width: 400, height: 400 * (147 / 404), nose: -16 }

// Where the jet comes to rest in the picture (the route's last point), its
// size and tilt (degrees, added to the picture's own angle). Hanh's editor.
export const LANDED_JET = { x: 935, y: 233, width: 400, height: 400 * (147 / 404), tilt: 4.75 }

interface Path {
  pts: [number, number][]
  len: number[]
  total: number
}

// Smooth the points (Catmull-Rom) and index them by distance travelled, so
// the plane moves at an even speed however the dots are spaced.
function buildPath(route: [number, number][]): Path {
  const P = [route[0], ...route, route[route.length - 1]]
  const pts: [number, number][] = []
  for (let i = 0; i < P.length - 3; i++) {
    for (let s = 0; s < 12; s++) {
      const t = s / 12
      const t2 = t * t
      const t3 = t2 * t
      const q: [number, number] = [0, 0]
      for (let k = 0; k < 2; k++) {
        q[k] =
          0.5 *
          (2 * P[i + 1][k] +
            (-P[i][k] + P[i + 2][k]) * t +
            (2 * P[i][k] - 5 * P[i + 1][k] + 4 * P[i + 2][k] - P[i + 3][k]) * t2 +
            (-P[i][k] + 3 * P[i + 1][k] - 3 * P[i + 2][k] + P[i + 3][k]) * t3)
      }
      pts.push(q)
    }
  }
  pts.push(route[route.length - 1])
  const len = [0]
  for (let j = 1; j < pts.length; j++) {
    len.push(len[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]))
  }
  return { pts, len, total: len[len.length - 1] }
}

const PATH = buildPath(ROUTE)

function positionAt(distance: number): [number, number] {
  const { pts, len, total } = PATH
  const d = Math.max(0, Math.min(total, distance))
  let i = 1
  while (i < len.length - 1 && len[i] < d) i++
  const a = pts[i - 1]
  const b = pts[i]
  const u = (d - len[i - 1]) / (len[i] - len[i - 1] || 1)
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeInOut = (f: number) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2)

export interface Frame {
  x: number
  y: number
  angle: number // degrees; direction of travel (0 = right)
  paperOpacity: number
  jetOpacity: number
  paintedOpacity: number
  landed: boolean
}

// Everything the splash draws at progress p (0 = take-off, 1 = done).
export function frameAt(p: number): Frame {
  const d = easeInOut(clamp01(p / FLIGHT_END)) * PATH.total
  const [x, y] = positionAt(d)
  // Heading from a little behind to a little ahead, so the nose turns smoothly.
  const back = positionAt(d - 14)
  const ahead = positionAt(d + 14)
  return {
    x,
    y,
    angle: (Math.atan2(ahead[1] - back[1], ahead[0] - back[0]) * 180) / Math.PI,
    paperOpacity: 1 - clamp01((p - PAPER_OUT.from) / PAPER_OUT.length),
    jetOpacity: clamp01((p - JET_IN.from) / JET_IN.length) * (1 - clamp01((p - FLYING_OUT.from) / FLYING_OUT.length)),
    paintedOpacity: clamp01((p - PAINTED_IN.from) / PAINTED_IN.length),
    landed: p >= LANDED_AT
  }
}
