// Cartography for the course atlas.
// One Robinson projection is used for the world plate and for every regional
// plate, so a seminar frame is literally a crop of the same drawing.

const KX = 0.8487;
const KY = 1.3523;

// Robinson coefficient table: latitude, x coefficient, y coefficient.
const TABLE = [
  [0, 1.0, 0.0], [5, 0.9986, 0.062], [10, 0.9954, 0.124],
  [15, 0.99, 0.186], [20, 0.9822, 0.248], [25, 0.973, 0.31],
  [30, 0.96, 0.372], [35, 0.9427, 0.434], [40, 0.9216, 0.4958],
  [45, 0.8962, 0.5571], [50, 0.8679, 0.6176], [55, 0.835, 0.6769],
  [60, 0.7986, 0.7346], [65, 0.7597, 0.7903], [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936], [80, 0.6213, 0.9394], [85, 0.5722, 0.9761],
  [90, 0.5322, 1.0],
];

function coeff(lat) {
  const a = Math.min(90, Math.abs(lat));
  const i = Math.min(TABLE.length - 2, Math.floor(a / 5));
  const [l0, x0, y0] = TABLE[i];
  const [l1, x1, y1] = TABLE[i + 1];
  const t = (a - l0) / (l1 - l0);
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

export const WORLD_W = 1000;
const S = WORLD_W / (2 * KX * Math.PI);
export const WORLD_H = 2 * KY * S;

export function project(lon, lat) {
  const [cx, cy] = coeff(lat);
  const x = KX * (lon * Math.PI) / 180 * cx;
  const y = KY * cy * (lat < 0 ? -1 : 1);
  return {
    x: WORLD_W / 2 + x * S,
    y: WORLD_H / 2 - y * S,
  };
}

export function loadRings(geojson) {
  const rings = [];
  for (const f of geojson.features || []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      for (const ring of g.coordinates) rings.push(ring);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) for (const ring of poly) rings.push(ring);
    }
  }
  return rings;
}

const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

function pathFromPoints(pts) {
  if (!pts.length) return "";
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += `L${r1(pts[i].x)} ${r1(pts[i].y)}`;
  return d + "Z";
}

// Douglas–Peucker on projected points.
function simplify(points, tol) {
  if (points.length < 4) return points;
  const sq = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const p = points[a];
    const q = points[b];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    let best = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const r = points[i];
      const d = Math.abs(dy * (r.x - p.x) - dx * (r.y - p.y)) / len;
      const dd = d * d;
      if (dd > best) { best = dd; at = i; }
    }
    if (best > sq && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function worldLandPath(rings) {
  let d = "";
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => project(lon, lat));
    // GeoJSON rings repeat the first vertex at the end. Drop it before
    // simplification: a zero-length baseline would collapse the ring.
    if (pts.length > 2 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) {
      pts.pop();
    }
    const simple = simplify(pts, 0.5);
    if (simple.length < 3) continue;
    d += pathFromPoints(simple);
  }
  return d;
}

export function horizonPath() {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 1) pts.push(project(180, lat));
  for (let lat = 90; lat >= -90; lat -= 1) pts.push(project(-180, lat));
  return pathFromPoints(pts);
}

export function worldGraticule(step = 30) {
  let d = "";
  for (let lon = -180; lon < 180; lon += step) {
    d += `M`;
    for (let lat = -88; lat <= 88; lat += 2) {
      const p = project(lon, lat);
      d += `${lat === -88 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }
  for (let lat = -60; lat <= 60; lat += step) {
    d += `M`;
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = project(lon, lat);
      d += `${lon === -180 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }
  return d;
}

// Clip a lon/lat ring against a geographic rectangle (Sutherland–Hodgman).
function clipRing(ring, [w, s, e, n]) {
  const edges = [
    [(p) => p[0] >= w, (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= e, (a, b) => [e, a[1] + ((b[1] - a[1]) * (e - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= s, (a, b) => [a[0] + ((b[0] - a[0]) * (s - a[1])) / (b[1] - a[1]), s]],
    [(p) => p[1] <= n, (a, b) => [a[0] + ((b[0] - a[0]) * (n - a[1])) / (b[1] - a[1]), n]],
  ];
  let out = ring.slice();
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    if (!input.length) break;
    let prev = input[input.length - 1];
    let prevIn = inside(prev);
    for (const cur of input) {
      const curIn = inside(cur);
      if (curIn) {
        if (!prevIn) out.push(cut(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(cut(prev, cur));
      }
      prev = cur;
      prevIn = curIn;
    }
  }
  return out;
}

function framePoints([w, s, e, n]) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const lon = w + ((e - w) * i) / steps;
    pts.push(project(lon, s));
  }
  for (let i = 1; i <= steps; i++) {
    const lat = s + ((n - s) * i) / steps;
    pts.push(project(e, lat));
  }
  for (let i = 1; i <= steps; i++) {
    const lon = e - ((e - w) * i) / steps;
    pts.push(project(lon, n));
  }
  for (let i = 1; i <= steps; i++) {
    const lat = n - ((n - s) * i) / steps;
    pts.push(project(w, lat));
  }
  return pts;
}

function niceStep(span, target = 5) {
  const raw = span / target;
  const steps = [1, 2, 5, 10, 15, 20, 30, 45, 60];
  for (const s of steps) if (s >= raw) return s;
  return 60;
}

export function normalizeBbox(seminar) {
  let [w, s, e, n] = seminar.bbox;
  const [lon, lat] = seminar.marker;
  const ok = (a, b, c, d) => a < c && b < d && lon >= a && lon <= c && lat >= b && lat <= d;
  if (ok(w, s, e, n)) return { bbox: [w, s, e, n], fixed: false };
  // content.json has one frame whose west and south values are transposed.
  // The marker is the authority: swap them rather than invent a new frame.
  if (ok(s, w, e, n)) return { bbox: [s, w, e, n], fixed: true };
  return {
    bbox: [Math.min(w, lon), Math.min(s, lat), Math.max(e, lon), Math.max(n, lat)],
    fixed: true,
  };
}

export function regionalPlate(rings, bbox, marker) {
  const [w, s, e, n] = bbox;
  const fp = framePoints(bbox);
  const minX = Math.min(...fp.map((p) => p.x));
  const maxX = Math.max(...fp.map((p) => p.x));
  const minY = Math.min(...fp.map((p) => p.y));
  const maxY = Math.max(...fp.map((p) => p.y));
  const width = maxX - minX;
  const height = maxY - minY;

  let land = "";
  for (const ring of rings) {
    const clipped = clipRing(ring, bbox);
    if (clipped.length < 3) continue;
    if (clipped[0][0] === clipped[clipped.length - 1][0] && clipped[0][1] === clipped[clipped.length - 1][1]) {
      clipped.pop();
    }
    const pts = clipped.map(([lon, lat]) => project(lon, lat));
    const simple = simplify(pts, 0.7);
    if (simple.length < 3) continue;
    land += pathFromPoints(simple);
  }

  const lonStep = niceStep(e - w, 5);
  const latStep = niceStep(n - s, 5);
  let grat = "";
  for (let lon = Math.ceil(w / lonStep) * lonStep; lon <= e; lon += lonStep) {
    grat += "M";
    for (let i = 0; i <= 24; i++) {
      const p = project(lon, s + ((n - s) * i) / 24);
      grat += `${i === 0 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }
  for (let lat = Math.ceil(s / latStep) * latStep; lat <= n; lat += latStep) {
    grat += "M";
    for (let i = 0; i <= 48; i++) {
      const p = project(w + ((e - w) * i) / 48, lat);
      grat += `${i === 0 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }

  const frame = pathFromPoints(fp);
  const mp = project(marker[0], marker[1]);
  return {
    land,
    grat,
    frame,
    viewBox: `${r1(minX)} ${r1(minY)} ${r1(width)} ${r1(height)}`,
    ratio: width / height,
    marker: {
      x: ((mp.x - minX) / width) * 100,
      y: ((mp.y - minY) / height) * 100,
    },
    lonStep,
    latStep,
  };
}

export function worldMarkers(seminars) {
  return seminars.map((s) => {
    const p = project(s.marker[0], s.marker[1]);
    return {
      n: s.n,
      slug: s.slug,
      x: (p.x / WORLD_W) * 100,
      y: (p.y / WORLD_H) * 100,
    };
  });
}

const hemi = (value, pos, neg) => (Math.abs(value) < 0.05 ? "" : value > 0 ? pos : neg);

function range(a, b, pos, neg) {
  const ha = hemi(a, pos, neg);
  const hb = hemi(b, pos, neg);
  if (Math.abs(a) < 0.05) return `0° – ${Math.abs(b)}° ${hb}`;
  if (ha === hb) return `${Math.abs(a)}°–${Math.abs(b)}° ${hb}`;
  return `${Math.abs(a)}° ${ha} – ${Math.abs(b)}° ${hb}`;
}

export function formatBounds([w, s, e, n]) {
  return `${range(w, e, "в.д.", "з.д.")} · ${range(s, n, "с.ш.", "ю.ш.")}`;
}
