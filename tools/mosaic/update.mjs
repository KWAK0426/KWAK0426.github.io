// 김해 논 모자이크 뷰어 자동 갱신
//   node update.mjs            → 확인·계산만 (GitHub에 올리지 않음)
//   node update.mjs --push     → 바뀐 게 있으면 GitHub에 올림 (매일 05:00 작업이 이렇게 실행)
//   옵션: --no-wait (Drive 업로드를 기다리지 않음) --recompute (계산 결과를 버리고 다시 계산)
//
// 1) 내 드라이브/김해논_드론/<날짜>/ 의 파일을 이름 양식으로 찾는다
//      YYMMDD_R<회차>_RGB.tif (광학) · YYMMDD_R<회차>_RE.tif (다분광) · YYMMDD_DEM.tif · YYMMDD_R<회차>_GPS.csv
// 2) 모자이크마다 화면 표시용 파일(JPEG COG, 웹 지도 좌표계)을 _뷰어용(자동)/ 에 만든다 (원본은 건드리지 않음)
// 3) Drive 데스크톱 앱의 목록에서 Drive ID를 찾는다 (업로드가 끝날 때까지 최대 wait_upload_min분 기다림)
// 4) Z_est·GSD를 계산한다. 입력 파일·카메라 값이 같으면 이전 결과를 그대로 쓴다
// 5) drone/viewer/catalog.json · results.json 을 고친다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as GeoTIFF from 'geotiff';
import proj4 from 'proj4';
import { computeZest, signature, decodeText, FORMAT as RESULT_FORMAT } from '../../drone/viewer/zest.js';
import { desktopDriveDir, lookupDriveIds } from './drivefs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.resolve(HERE, '..', '..');
export const CATALOG_FORMAT = 'gimhae-mosaic-catalog-v1';
const KIND_LABEL = { RGB: '광학', RE: '다분광' };
const DATE_DIR = /^(\d{4})-(\d{2})-(\d{2})$/;
const RX = {
  mosaic: /^(\d{6})_R(\d{1,2})_(RGB|RE)\.tiff?$/i,
  dem: /^(\d{6})(?:_R(\d{1,2}))?_DEM\.tiff?$/i,
  gps: /^(\d{6})_R(\d{1,2})(?:_(RGB|RE))?_GPS\.(?:csv|txt)$/i,
};
const GUIDE = `김해 논 드론 자료 폴더 (모자이크 뷰어 자동 갱신이 매일 05:00에 읽습니다)

날짜 폴더(YYYY-MM-DD) 안에 아래 이름으로 넣으세요. YYMMDD는 촬영 날짜, R 뒤 숫자는 회차입니다.
  2026-07-16/
    260716_DEM.tif        그날 DEM (회차마다 다르면 260716_R1_DEM.tif)
    260716_R1_RGB.tif     1회차 광학 모자이크 (좌표가 있는 GeoTIFF)
    260716_R1_RE.tif      1회차 다분광 모자이크
    260716_R1_GPS.csv     1회차 드론 GPS (열: lat, lon, alt / 광학·다분광이 따로면 260716_R1_RGB_GPS.csv)

_뷰어용(자동)/ 폴더는 화면 표시용으로 자동으로 만들어집니다. 직접 고치거나 지우지 마세요.
이 폴더는 '링크가 있는 모든 사용자: 뷰어'로 공유해야 웹 뷰어에서 열립니다.
`;

// ---- GDAL (anaconda에 들어 있는 것을 쓴다) -------------------------------------------
const CONDA = process.env.CONDA_ROOT || path.join(os.homedir(), 'anaconda3');
const GDAL_BIN = process.env.GDAL_BIN || path.join(CONDA, 'Library', 'bin');
const gdalEnv = {
  ...process.env,
  PATH: GDAL_BIN + path.delimiter + (process.env.PATH ?? ''),
  PROJ_DATA: process.env.PROJ_DATA || path.join(CONDA, 'Library', 'share', 'proj'),
  PROJ_LIB: process.env.PROJ_LIB || path.join(CONDA, 'Library', 'share', 'proj'),
  GDAL_DATA: process.env.GDAL_DATA || path.join(CONDA, 'Library', 'share', 'gdal'),
  GDAL_PAM_ENABLED: 'NO', // 원본 옆에 .aux.xml 을 만들지 않는다
};
function gdal(cmd, args) {
  const exe = path.join(GDAL_BIN, process.platform === 'win32' ? `${cmd}.exe` : cmd);
  const r = spawnSync(fs.existsSync(exe) ? exe : cmd, args, { env: gdalEnv, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0) throw new Error(`${cmd} 실패: ${(r.stderr || r.error?.message || '').trim().split(/\r?\n/).slice(-3).join(' / ')}`);
  return r.stdout;
}
const gdalJson = (file, extra = []) => JSON.parse(gdal('gdalinfo', ['-json', ...extra, file]));

const isGeographic = (info) => /^\s*(GEOGCRS|GEOGCS|GEODCRS)/.test(info.coordinateSystem?.wkt ?? '');
function bboxOf(info) {
  const ring = info.wgs84Extent?.coordinates?.[0];
  if (!ring) return null;
  const xs = ring.map((p) => p[0]); const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
// 다분광: 화면에는 근적외·빨강·초록(가색 합성)으로
function pickReBands(bands) {
  const find = (re) => bands.find((b) => re.test(`${b.description ?? ''} ${Object.values(b.metadata?.[''] ?? {}).join(' ')}`))?.band;
  const nir = find(/nir|near.?infra|84\d|8[0-9]{2}\s*nm/i);
  const red = find(/\bred\b(?!.?edge)|66[0-9]|650/i);
  const green = find(/green|56[0-9]|53[0-9]/i);
  if (nir && red && green) return [nir, red, green];
  // MicaSense 순서(1 Blue, 2 Green, 3 Red, 4 NIR, 5 RedEdge …)
  return bands.length >= 4 ? [4, 3, 2] : [1, Math.min(2, bands.length), Math.min(3, bands.length)];
}

function makeView(srcPath, kind, outPath, thumbPath, cfg) {
  const info = gdalJson(srcPath);
  if (!info.coordinateSystem?.wkt) throw new Error('좌표 정보가 없는 모자이크입니다 (GeoTIFF로 내보내세요)');
  const alpha = info.bands.find((b) => b.colorInterpretation === 'Alpha')?.band;
  const data = info.bands.filter((b) => b.band !== alpha);
  const sel = kind === 'RE' ? (cfg.re_view_bands ?? pickReBands(data)) : data.length >= 3 ? [1, 2, 3] : [1, 1, 1];
  const scale = [];
  if (data[0].type !== 'Byte') {
    const st = gdalJson(srcPath, ['-approx_stats']);
    sel.forEach((b, i) => {
      const s = st.bands[b - 1];
      const lo = Math.max(s.minimum, s.mean - 2.5 * s.stdDev);
      const hi = Math.min(s.maximum, s.mean + 2.5 * s.stdDev);
      scale.push(`-scale_${i + 1}`, String(lo), String(hi > lo ? hi : lo + 1), '0', '255');
    });
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-view-'));
  try {
    const vrt = path.join(tmp, 'sel.vrt');
    const noNodata = data[0].noDataValue === undefined && !alpha;
    gdal('gdal_translate', ['-of', 'VRT', ...sel.flatMap((b) => ['-b', String(b)]), ...(alpha ? ['-b', String(alpha)] : []),
      ...(noNodata && kind === 'RE' ? ['-a_nodata', '0'] : []), srcPath, vrt]);
    const warped = path.join(tmp, 'warped.tif');
    gdal('gdalwarp', ['-t_srs', 'EPSG:3857', '-r', 'bilinear', '-dstalpha', '-multi', '-wo', 'NUM_THREADS=ALL_CPUS',
      '-co', 'TILED=YES', '-co', 'COMPRESS=DEFLATE', '-co', 'BIGTIFF=IF_SAFER', '-overwrite', vrt, warped]);
    const cog = path.join(tmp, 'view.tif');
    gdal('gdal_translate', ['-of', 'COG', '-b', '1', '-b', '2', '-b', '3', '-mask', '4', ...scale, '-ot', 'Byte',
      '-co', 'COMPRESS=JPEG', '-co', `QUALITY=${cfg.jpeg_quality ?? 90}`, '-co', 'BLOCKSIZE=512', '-co', 'OVERVIEW_RESAMPLING=AVERAGE',
      '-co', 'BIGTIFF=IF_SAFER', '-co', 'NUM_THREADS=ALL_CPUS', warped, cog]);
    const thumb = path.join(tmp, 'thumb.jpg');
    gdal('gdal_translate', ['-of', 'JPEG', '-outsize', '360', '0', '-r', 'average', '-co', 'QUALITY=80', cog, thumb]);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.copyFileSync(cog, outPath); // Drive 폴더에는 완성된 파일만 넣는다
    fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
    fs.copyFileSync(thumb, thumbPath);
    const out = gdalJson(outPath);
    const gt = info.geoTransform;
    const box = bboxOf(info) ?? bboxOf(out);
    const px = isGeographic(info) ? Math.abs(gt[1]) * 111320 * Math.cos((((box[1] + box[3]) / 2) * Math.PI) / 180) : Math.abs(gt[1]);
    return { width: info.size[0], height: info.size[1], mosaic_px_cm: Math.round(px * 100 * 1000) / 1000, bounds: bboxOf(out), view_size: fs.statSync(outPath).size, bands: sel };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- 폴더 찾기 -----------------------------------------------------------------------
const fileMeta = (dir, name) => { const st = fs.statSync(path.join(dir, name)); return { name, path: path.join(dir, name), sizeBytes: st.size, modified: new Date(Math.floor(st.mtimeMs / 1000) * 1000).toISOString() }; };
export function scan(root) {
  const items = [];
  const problems = [];
  for (const d of fs.readdirSync(root).sort()) {
    const dir = path.join(root, d);
    if (!DATE_DIR.test(d) || !fs.statSync(dir).isDirectory()) continue;
    const yymmdd = d.slice(2).replaceAll('-', '');
    const dems = {}; const gpss = {}; const mosaics = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!fs.statSync(path.join(dir, f)).isFile()) continue;
      let m;
      const check = () => { if (m[1] !== yymmdd) { problems.push(`${d}/${f}: 파일 이름의 날짜(${m[1]})가 폴더(${d})와 다름 · 건너뜀`); return false; } return true; };
      if ((m = f.match(RX.mosaic))) { if (check()) mosaics.push({ date: d, round: Number(m[2]), kind: m[3].toUpperCase(), name: f }); }
      else if ((m = f.match(RX.dem))) { if (check()) dems[m[2] ? Number(m[2]) : 'date'] = f; }
      else if ((m = f.match(RX.gps))) { if (check()) gpss[`${Number(m[2])}#${(m[3] ?? '').toUpperCase()}`] = f; }
      else if (/\.(tiff?|csv|txt)$/i.test(f)) problems.push(`${d}/${f}: 이름 양식이 아님 · 건너뜀`);
    }
    for (const mo of mosaics) {
      const demName = dems[mo.round] ?? dems.date ?? null;
      const gpsName = gpss[`${mo.round}#${mo.kind}`] ?? gpss[`${mo.round}#`] ?? null;
      items.push({ ...mo, dir, src: fileMeta(dir, mo.name), dem: demName ? fileMeta(dir, demName) : null, gps: gpsName ? fileMeta(dir, gpsName) : null });
      if (!demName) problems.push(`${d}/${mo.name}: DEM 없음 → Z_est 계산 불가`);
      if (!gpsName) problems.push(`${d}/${mo.name}: GPS 없음 → Z_est 계산 불가`);
    }
  }
  return { items, problems };
}

// ---- 실행 ------------------------------------------------------------------------------
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const sameExcept = (a, b, key) => JSON.stringify({ ...a, [key]: null }) === JSON.stringify({ ...b, [key]: null });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kstNow = () => new Date(Date.now() + 9 * 3600000).toISOString().replace('T', ' ').slice(0, 19);

export async function run({
  root = null, outDir = path.join(HUB, 'drone', 'viewer'), cfg = readJson(path.join(HERE, 'config.json')),
  stateFile = path.join(HERE, '.state.json'), lookup = lookupDriveIds, wait = true, recompute = false, log = console.log,
  publishedFile = path.join(HERE, 'published_views.json'),
} = {}) {
  const driveRoot = root ?? (desktopDriveDir() ? path.join(desktopDriveDir(), ...cfg.drive_folder) : null);
  if (!driveRoot) throw new Error('Google Drive 데스크톱 앱 폴더(내 드라이브)를 찾지 못했습니다');
  if (!fs.existsSync(driveRoot)) { fs.mkdirSync(driveRoot, { recursive: true }); log(`폴더 만듦: ${cfg.drive_folder.join('/')}`); }
  const guide = path.join(driveRoot, '_넣는 방법.txt');
  if (!fs.existsSync(guide)) fs.writeFileSync(guide, '﻿' + GUIDE.replace(/\n/g, '\r\n'));
  const viewerDir = path.join(driveRoot, cfg.viewer_folder);
  fs.mkdirSync(viewerDir, { recursive: true });
  const thumbDir = path.join(outDir, 'thumbs');

  const { items, problems } = scan(driveRoot);
  const state = readJson(stateFile, {}) ?? {};
  state.views ??= {}; state.proj4 ??= {};
  const saveState = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));
  let converted = 0;
  for (const it of items) {
    it.id = `${it.date}-R${it.round}-${it.kind}`;
    const key = `${it.date}/${it.name}`;
    const sig = `${it.src.sizeBytes}:${it.src.modified}`;
    const viewName = it.name.replace(/\.tiff?$/i, '_view.tif');
    const viewPath = path.join(viewerDir, viewName);
    const thumbPath = path.join(thumbDir, `${it.id}.jpg`);
    let v = state.views[key];
    if (recompute || !v || v.sig !== sig || !fs.existsSync(viewPath) || !fs.existsSync(thumbPath)) {
      log(`표시용 파일 만드는 중: ${key}`);
      try {
        v = { ...makeView(it.src.path, it.kind, viewPath, thumbPath, cfg), sig };
        state.views[key] = v;
        saveState();
        converted++;
      } catch (e) { problems.push(`${key}: 표시용 파일 만들기 실패 — ${e.message}`); continue; }
    }
    it.view = { name: viewName, ...v };
  }
  for (const it of items) {
    if (!it.dem) continue;
    const k = `${it.date}/${it.dem.name}:${it.dem.sizeBytes}:${it.dem.modified}`;
    if (!(k in state.proj4)) {
      try { state.proj4[k] = gdal('gdalsrsinfo', ['-o', 'proj4', '--single-line', it.dem.path]).trim() || null; } catch (e) { state.proj4[k] = null; problems.push(`${it.date}/${it.dem.name}: 좌표계를 읽지 못함 — ${e.message}`); }
      saveState();
    }
    it.dem.proj4 = state.proj4[k];
  }

  // Drive ID (업로드가 끝나야 생긴다)
  const ready = items.filter((it) => it.view);
  const rel = (it, name) => (root ? [it.date, name] : [...cfg.drive_folder, it.date, name]);
  const viewRel = (it) => (root ? [cfg.viewer_folder, it.view.name] : [...cfg.drive_folder, cfg.viewer_folder, it.view.name]);
  const resolveIds = () => {
    const paths = ready.flatMap((it) => [viewRel(it), it.dem ? rel(it, it.dem.name) : null, it.gps ? rel(it, it.gps.name) : null]);
    const ids = lookup(paths.map((p) => p ?? ['\u0000']));
    ready.forEach((it, i) => { it.viewId = ids[i * 3]; if (it.dem) it.dem.driveFileId = ids[i * 3 + 1]; if (it.gps) it.gps.driveFileId = ids[i * 3 + 2]; });
    return ready.filter((it) => !it.viewId).length;
  };
  const started = Date.now();
  let missing = resolveIds();
  while (missing && wait && converted && Date.now() - started < (cfg.wait_upload_min ?? 40) * 60000) {
    log(`Drive 업로드 기다리는 중: ${missing}개`);
    await sleep(60000);
    missing = resolveIds();
  }

  const camOf = (kind) => cfg.cameras?.[kind] ?? null;
  const pub = (f) => (f ? { name: f.name, driveFileId: f.driveFileId ?? null, sizeBytes: f.sizeBytes, modified: f.modified, ...(f.proj4 !== undefined ? { proj4: f.proj4 } : {}) } : null);
  const generated = ready.filter((it) => it.viewId).map((it) => ({
    id: it.id, project: 'gimhae-paddy', date: it.date, round: it.round, kind: it.kind,
    title: `${Number(it.date.slice(5, 7))}/${Number(it.date.slice(8))} ${it.round}차 · ${KIND_LABEL[it.kind]}`,
    type: `${KIND_LABEL[it.kind]} 모자이크`,
    driveFileId: it.viewId, sizeBytes: it.view.view_size, width: it.view.width, height: it.view.height, bounds: it.view.bounds,
    mosaic_px_cm: it.view.mosaic_px_cm, thumbnail: `thumbs/${it.id}.jpg`,
    dem: pub(it.dem), gps: pub(it.gps),
  }));
  // Explicitly published display products survive scans on PCs without their analytical sources.
  const publishedDoc = readJson(publishedFile, { observations: [] });
  const published = publishedDoc.observations ?? [];
  const fieldMask = publishedDoc.fieldMask;
    const displayPolicy = publishedDoc.displayPolicy;
  if (fieldMask && (!/^fields\/[A-Za-z0-9_-]+\.geojson$/.test(fieldMask.url)
      || fieldMask.projection !== 'EPSG:4326' || !Number.isInteger(fieldMask.count) || fieldMask.count < 1))
    throw new Error('공통 필지 경계 등록 형식 오류');
  for (const o of published) {
    if (!o.id || (!o.driveFileId && !o.staticImage) || !['RGB', 'RE', 'NDVI'].includes(o.kind)
        || !Array.isArray(o.bounds) || o.bounds.length !== 4 || !o.bounds.every(Number.isFinite)) {
      throw new Error('공개 표시용 영상 등록 형식 오류');
    }
    if (o.staticImage) {
      const image = o.staticImage;
      const rgb = o.kind === 'RGB' && /^rgb_1m\/[A-Za-z0-9_-]+\.webp$/.test(image.url)
        && image.projection === 'EPSG:32652' && o.derivedFromMultispectral && o.isOptical === false && o.mosaic_px_cm === 100;
      const spectral = o.kind === 'RE' && /^bands\/[A-Za-z0-9_-]+\.webp$/.test(image.url)
        && image.projection === 'EPSG:3857' && image.displayOnly === true && o.displayOnly === true && o.analysisPrivate === true
        && image.width === o.spectral?.displayWidth && image.height === o.spectral?.displayHeight
        && Number.isInteger(image.width) && image.width > 0 && Number.isInteger(image.height) && image.height > 0
        && JSON.stringify(image.extent) === JSON.stringify(o.spectral?.extent)
        && o.spectral?.bands?.length === 10;
      const ndvi = o.kind === 'NDVI' && /^ndvi\/[A-Za-z0-9_-]+\.webp$/.test(image.url)
        && image.projection === 'EPSG:3857' && image.displayOnly === true && o.displayOnly === true && o.analysisPrivate === true
        && image.url === o.ndviDisplay?.url && image.width === o.ndviDisplay?.width && image.height === o.ndviDisplay?.height
        && Number.isInteger(image.width) && image.width > 0 && Number.isInteger(image.height) && image.height > 0
        && JSON.stringify(image.extent) === JSON.stringify(o.ndviDisplay?.extent)
        && o.ndviDisplay?.colorMap === 'viridis' && JSON.stringify(o.ndviDisplay?.range) === '[0,1]';
      if ((!rgb && !spectral && !ndvi) || !Array.isArray(image.extent) || image.extent.length !== 4 || !image.extent.every(Number.isFinite)) {
        throw new Error('공개 축소 표시 영상 등록 형식 오류');
      }
    }
    if (o.dem || o.gps || /[A-Za-z]:[\\/]|Users[\\/]/.test(JSON.stringify(o))) throw new Error('공개 표시 목록에 원본 참조 금지');
  }
  const registered = new Map(generated.map(o => [o.id,o]));
  for (const o of published) {
    const existing = registered.get(o.id);
    if (o.derivedFromMultispectral && existing?.kind === 'RGB' && !existing.derivedFromMultispectral) continue;
    registered.set(o.id,o);
  }
  const observations = [...registered.values()];
  const pending = ready.filter((it) => !it.viewId).map((it) => it.id);

  // Z_est·GSD (입력이 같으면 이전 결과 유지)
  const resultsFile = path.join(outDir, 'results.json');
  const prevResults = readJson(resultsFile, {})?.results ?? {};
  const results = {};
  let computed = 0;
  for (const it of items) {
    const obs = { dem: pub(it.dem), gps: pub(it.gps), mosaic_px_cm: it.view?.mosaic_px_cm ?? null };
    const sig = signature(obs, camOf(it.kind), cfg.alt_offset_m ?? 0);
    if (!recompute && prevResults[it.id]?.signature === sig) { results[it.id] = prevResults[it.id]; continue; }
    if (!it.dem || !it.gps) continue;
    log(`Z_est 계산: ${it.id}`);
    try {
      results[it.id] = await computeZest({
        obs: { ...obs, dem: { ...obs.dem, proj4: it.dem.proj4 } }, camera: camOf(it.kind), altOffset: cfg.alt_offset_m ?? 0, proj4,
        openDem: () => GeoTIFF.fromFile(it.dem.path), readGps: () => decodeText(fs.readFileSync(it.gps.path)),
      });
      results[it.id].source = 'pc';
    } catch (e) { results[it.id] = { error: e.message, signature: sig, computed_at: new Date().toISOString(), source: 'pc' }; }
    computed++;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const catalogFile = path.join(outDir, 'catalog.json');
  const catalog = {
    format: CATALOG_FORMAT, title: '김해 논 드론 모자이크', updated_at: new Date().toISOString(),
    cameras: cfg.cameras, alt_offset_m: cfg.alt_offset_m ?? 0, observations, pending, notices: problems,
    ...(fieldMask ? {fieldMask} : {}),
      ...(displayPolicy ? {displayPolicy} : {}),
  };
  const resultsDoc = { format: RESULT_FORMAT, updated_at: new Date().toISOString(), results };
  const oldCatalog = readJson(catalogFile);
  const oldResults = readJson(resultsFile);
  const catalogChanged = !oldCatalog || !sameExcept(oldCatalog, catalog, 'updated_at');
  const resultsChanged = !oldResults || !sameExcept(oldResults, resultsDoc, 'updated_at');
  if (catalogChanged) fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 1) + '\n');
  if (resultsChanged) fs.writeFileSync(resultsFile, JSON.stringify(resultsDoc, null, 1) + '\n');
  // 목록에서 빠진 썸네일 정리
  if (fs.existsSync(thumbDir)) for (const f of fs.readdirSync(thumbDir)) if (!observations.some((o) => o.thumbnail === `thumbs/${f}`)) fs.rmSync(path.join(thumbDir, f));
  for (const p of problems) log(`확인 필요: ${p}`);
  const summary = { mosaics: new Set([...items.map((it) => it.id), ...published.map((o) => o.id)]).size, shown: observations.length, pending: pending.length, converted, computed, changed: catalogChanged || resultsChanged };
  log(`완료: 모자이크 ${summary.mosaics}개 (뷰어 ${summary.shown}개, 업로드 대기 ${summary.pending}개) · 새 표시용 파일 ${converted}개 · 새 계산 ${computed}개`);
  return summary;
}

function git(args) {
  const r = spawnSync('git', args, { cwd: HUB, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args[0]} 실패: ${(r.stderr || '').trim().split(/\r?\n/).slice(-2).join(' / ')}`);
  return r.stdout;
}
// 이 작업이 만든 파일만 올린다 (다른 편집 중인 파일은 건드리지 않음)
function push(summary, log) {
  const name = (fs.existsSync(path.join(HUB, '.pc-name')) && fs.readFileSync(path.join(HUB, '.pc-name'), 'utf8').trim()) || os.hostname();
  const files = ['drone/viewer/catalog.json', 'drone/viewer/results.json', 'drone/viewer/thumbs'];
  git(['pull', '--rebase', '--autostash']);
  git(['add', '-A', '--', ...files]);
  if (!git(['diff', '--cached', '--name-only', '--', ...files]).trim()) { log('올릴 변경 없음'); return; }
  git(['commit', '-m', `[${name}] 모자이크 뷰어 자동 갱신: 뷰어 ${summary.shown}개 · 새 표시용 ${summary.converted}개 · 새 계산 ${summary.computed}개`, '--', ...files]);
  git(['push']);
  log('GitHub에 올림');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  const logFile = path.join(HERE, 'update.log');
  const log = (...a) => { const line = `[${kstNow()} KST] ${a.join(' ')}`; console.log(line); fs.appendFileSync(logFile, line + '\n'); };
  try {
    const summary = await run({ wait: !args.has('--no-wait'), recompute: args.has('--recompute'), log });
    if (args.has('--push') && summary.changed) push(summary, log);
  } catch (e) {
    log(`실패: ${e.message}`);
    process.exitCode = 1;
  }
}
