// Z_est·GSD 계산 (브라우저 뷰어와 PC 자동 갱신이 같은 코드를 쓴다)
//   Z_est = 촬영 지점의 드론 GPS 고도(+보정값) − 그 위치의 DEM 고도   → 평균이 지면 위 비행고도
//   GSD   = 센서 픽셀 크기 × Z_est ÷ 초점거리
// GeoTIFF·proj4 라이브러리는 부르는 쪽에서 넘겨준다 (브라우저: vendor 전역, PC: npm).

export const FORMAT = 'gimhae-zest-v1';

const LAT = ['lat', 'latitude', 'gps_lat', 'gpslatitude', '위도', 'y_lat'];
const LON = ['lon', 'lng', 'long', 'longitude', 'gps_lon', 'gps_lng', 'gpslongitude', '경도', 'x_lon'];
const ALT = ['alt', 'altitude', 'abs_alt', 'absolute_altitude', 'absolutealtitude', 'gps_alt', 'gpsaltitude', 'height', 'ellipsoidal_height', 'ellipsoid_height', 'altitude_m', 'alt_m', 'z', '고도'];
const norm = (s) => String(s).trim().replace(/^﻿/, '').replace(/^["']|["']$/g, '').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[\s-]+/g, '_');

// CSV/TXT의 위경도·고도 열을 찾는다. 이름 있는 열을 먼저 쓰고, 없으면 값 범위로 추정(한반도 위경도).
export function parseGpsCsv(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (!lines.length) throw new Error('GPS 파일이 비어 있습니다');
  const delim = [',', '\t', ';'].map((d) => [d, lines[0].split(d).length]).sort((a, b) => b[1] - a[1])[0];
  const split = delim[1] > 1 ? (l) => l.split(delim[0]) : (l) => l.split(/\s+/);
  const head = split(lines[0]).map(norm);
  const find = (names) => head.findIndex((h) => names.includes(h));
  // 첫 줄이 열 이름인지: 아는 이름이 있거나, 둘째 줄보다 숫자 칸이 적으면
  const numeric = (l) => split(l).filter((v) => v.trim() !== '' && Number.isFinite(Number(v))).length;
  const isHeader = [...LAT, ...LON, ...ALT].some((n) => head.includes(n)) || (lines.length > 1 && numeric(lines[0]) < numeric(lines[1]));
  let iLat = find(LAT); let iLon = find(LON); let iAlt = find(ALT);
  if (iAlt < 0) iAlt = head.findIndex((h) => /alt|height|고도/.test(h) && !/rel|상대/.test(h));
  const rows = (isHeader ? lines.slice(1) : lines).map(split);
  if (iLat < 0 || iLon < 0 || iAlt < 0) {
    // 이름으로 못 찾으면: 처음 나오는 위도(33~39)·경도(124~132) 열과 그다음 숫자 열을 고도로
    const sample = rows.slice(0, 20);
    const numCol = (i, lo, hi) => sample.every((r) => { const v = Number(r[i]); return Number.isFinite(v) && v >= lo && v <= hi; });
    const width = Math.max(...sample.map((r) => r.length));
    if (iLat < 0) for (let i = 0; i < width; i++) if (numCol(i, 33, 39)) { iLat = i; break; }
    if (iLon < 0) for (let i = 0; i < width; i++) if (i !== iLat && numCol(i, 124, 132)) { iLon = i; break; }
    if (iAlt < 0) for (let i = Math.max(iLat, iLon) + 1; i < width; i++) if (numCol(i, -100, 9000)) { iAlt = i; break; }
  }
  if (iLat < 0 || iLon < 0 || iAlt < 0) throw new Error('GPS 파일에서 위도·경도·고도 열을 찾지 못했습니다 (열 이름: lat, lon, alt 권장)');
  const points = [];
  for (const r of rows) {
    const lat = Number(r[iLat]); const lon = Number(r[iLon]); const alt = Number(r[iAlt]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(alt) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) points.push({ lat, lon, alt });
  }
  if (!points.length) throw new Error('GPS 파일에 읽을 수 있는 좌표가 없습니다');
  const label = (i) => (isHeader ? head[i] : `${i + 1}번째 열`);
  return { points, rows: rows.length, columns: { lat: label(iLat), lon: label(iLon), alt: label(iAlt) } };
}

// 텍스트 인코딩: UTF-8이 아니면 한국어 Windows 기본(CP949)으로
export function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('euc-kr').decode(bytes); }
}

// DEM에서 각 점의 고도를 읽는다 (가장 가까운 픽셀). 범위 밖·nodata는 NaN.
export async function sampleDem(tiff, proj4, demProj4, points, onProgress = null) {
  const image = await tiff.getImage();
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();
  const w = image.getWidth(); const h = image.getHeight();
  const nodata = image.getGDALNoData?.();
  const toDem = demProj4 ? proj4('EPSG:4326', demProj4).forward : (p) => p;
  const cells = points.map((p, i) => {
    const [x, y] = toDem([p.lon, p.lat]);
    return { i, col: Math.floor((x - ox) / rx), row: Math.floor((y - oy) / ry) };
  });
  // 같은 블록을 이어서 읽도록 행·열 순서로
  cells.sort((a, b) => a.row - b.row || a.col - b.col);
  const out = new Array(points.length).fill(NaN);
  let done = 0;
  for (const c of cells) {
    if (c.col >= 0 && c.row >= 0 && c.col < w && c.row < h) {
      const r = await image.readRasters({ window: [c.col, c.row, c.col + 1, c.row + 1], samples: [0], interleave: true });
      const v = Number(r[0]);
      if (Number.isFinite(v) && v !== nodata && v > -1000 && v < 9000) out[c.i] = v;
    }
    if (onProgress && ++done % 50 === 0) onProgress(done / points.length);
  }
  return out;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = (v, d) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

// 이륙·착륙처럼 비행고도에서 크게 벗어난 점(중앙값에서 max(5 m, 20%) 이상)은 평균에서 뺀다
export function summarize(points, dem, { altOffset = 0 } = {}) {
  const z = [];
  let outside = 0;
  points.forEach((p, i) => { if (Number.isFinite(dem[i])) z.push(p.alt + altOffset - dem[i]); else outside++; });
  if (!z.length) throw new Error('GPS 점이 DEM 범위 밖이거나 DEM 값이 없습니다 (좌표계·파일 확인)');
  const med = median(z);
  const tol = Math.max(5, Math.abs(med) * 0.2);
  const used = z.filter((v) => Math.abs(v - med) <= tol);
  const mean = used.reduce((s, v) => s + v, 0) / used.length;
  const sd = Math.sqrt(used.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, used.length - 1));
  return { z_mean_m: round(mean, 2), z_median_m: round(med, 2), z_sd_m: round(sd, 2), n_total: points.length, n_used: used.length, n_outside: outside, n_outlier: z.length - used.length };
}

export function gsdCm(zMeters, camera) {
  if (!camera?.focal_mm || !camera?.pixel_um || !Number.isFinite(zMeters)) return null;
  return round((camera.pixel_um * 1e-6 * zMeters) / (camera.focal_mm * 1e-3) * 100, 3);
}

// 같은 입력이면 다시 계산하지 않도록 쓰는 서명 (파일 이름·크기·수정 시각 + 카메라 값 + 보정값)
export function signature(obs, camera, altOffset) {
  const f = (x) => (x ? `${x.name}:${x.sizeBytes}:${x.modified ?? ''}` : '-');
  return [f(obs.dem), f(obs.gps), camera?.focal_mm, camera?.pixel_um, altOffset ?? 0].join('|');
}

export function warnings(r) {
  const w = [];
  if (r.z_mean_m < 5) w.push('Z_est가 5 m보다 낮습니다. GPS 고도와 DEM의 고도 기준(타원체고·정표고)이 다른지 확인하세요');
  if (r.z_mean_m > 500) w.push('Z_est가 500 m보다 높습니다. 고도 기준이나 열 선택을 확인하세요');
  if (r.n_used < r.n_total * 0.5) w.push('절반 이상의 점이 계산에서 빠졌습니다');
  return w;
}

// 한 모자이크의 Z_est·GSD 계산
//   openDem(): GeoTIFF 객체, readGps(): 텍스트
export async function computeZest({ obs, camera, altOffset = 0, openDem, readGps, proj4, onProgress = null }) {
  if (!obs.dem) throw new Error('이 회차의 DEM이 없습니다');
  if (!obs.gps) throw new Error('이 회차의 GPS가 없습니다');
  const gps = parseGpsCsv(await readGps());
  const tiff = await openDem();
  const dem = await sampleDem(tiff, proj4, obs.dem.proj4, gps.points, onProgress);
  const s = summarize(gps.points, dem, { altOffset });
  const result = {
    ...s,
    gsd_cm: gsdCm(s.z_mean_m, camera),
    mosaic_px_cm: obs.mosaic_px_cm ?? null,
    camera: camera ? { name: camera.name ?? null, focal_mm: camera.focal_mm, pixel_um: camera.pixel_um, confirmed: !!camera.confirmed } : null,
    alt_offset_m: altOffset,
    gps_columns: gps.columns,
    inputs: { dem: obs.dem.name, gps: obs.gps.name },
    signature: signature(obs, camera, altOffset),
    computed_at: new Date().toISOString(),
  };
  result.warnings = warnings(result);
  return result;
}
