// 모자이크 자동 갱신: 시험용 자료(한글 폴더 이름 포함)로 표시용 파일·Z_est·GSD·목록을 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../update.mjs';
import { parseGpsCsv, summarize, gsdCm } from '../../../drone/viewer/zest.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONDA = path.join(os.homedir(), 'anaconda3');
const PY = process.env.PYTHON || path.join(CONDA, 'python.exe');
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config.json'), 'utf8'));

test('GPS CSV 읽기: 이름 있는 열·이름 없는 열', () => {
  const a = parseGpsCsv('Image,Latitude,Longitude,Altitude (m),Relative Altitude\nI1,35.2,128.8,100.5,80\n');
  assert.deepEqual(a.points[0], { lat: 35.2, lon: 128.8, alt: 100.5 });
  assert.equal(a.columns.alt, 'altitude');
  const b = parseGpsCsv('IMG_1 35.21 128.81 101.2 3\nIMG_2 35.22 128.82 102.0 3\n');
  assert.equal(b.points.length, 2);
  assert.equal(b.points[1].alt, 102.0);
  assert.throws(() => parseGpsCsv('a,b\n1,2\n'), /열을 찾지/);
});

test('Z_est 요약: 이륙 점 제외, GSD', () => {
  const pts = [...Array(10)].map(() => ({ alt: 110 })).concat([{ alt: 32 }]);
  const s = summarize(pts, pts.map(() => 30));
  assert.equal(s.z_mean_m, 80);
  assert.equal(s.n_outlier, 1);
  assert.equal(gsdCm(80, { focal_mm: 5.4, pixel_um: 3.75 }), 5.556);
});

test('Drive 폴더 → 표시용 파일 · 목록 · Z_est (한 번 계산하면 유지)', { timeout: 300000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-test-'));
  const root = path.join(tmp, '김해논_드론');
  const out = path.join(tmp, 'site');
  const r = spawnSync(PY, ['-I', '-X', 'utf8', path.join(HERE, 'make_fixture.py'), root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const ids = new Map();
  const lookup = (paths) => paths.map((p) => {
    if (p[0] === '\u0000') return null;
    const k = p.join('/');
    if (!ids.has(k)) ids.set(k, `id${ids.size}_${'x'.repeat(20)}`);
    return ids.get(k);
  });
  const opts = { root, outDir: out, cfg, stateFile: path.join(tmp, 'state.json'), lookup, wait: false, log: () => {} };
  const s1 = await run(opts);
  assert.equal(s1.mosaics, 2);
  assert.equal(s1.converted, 2);
  assert.equal(s1.computed, 2);
  const cat = JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8'));
  assert.deepEqual(cat.observations.map((o) => o.id).sort(), ['2026-07-16-R1-RE', '2026-07-16-R1-RGB']);
  const rgb = cat.observations.find((o) => o.kind === 'RGB');
  assert.equal(rgb.title, '7/16 1차 · 광학');
  assert.equal(rgb.mosaic_px_cm, 50);
  assert.ok(rgb.bounds[0] > 128 && rgb.bounds[0] < 129 && rgb.bounds[1] > 35 && rgb.bounds[1] < 35.3, `bounds ${rgb.bounds}`);
  assert.match(rgb.dem.proj4, /zone=52/);
  assert.ok(rgb.gps.driveFileId && rgb.dem.driveFileId && rgb.driveFileId);
  assert.ok(cat.notices.some((n) => /memo\.txt.*이름 양식/.test(n)), cat.notices.join('\n'));
  assert.ok(cat.notices.some((n) => /260717_R2_RGB.*날짜/.test(n)));
  assert.ok(!JSON.stringify(cat).includes('Temp') && !JSON.stringify(cat).includes(os.userInfo().username), '목록에 PC 경로 없음');
  // 표시용 파일: COG, 3밴드 JPEG + 마스크, 웹 지도 좌표계
  const view = path.join(root, cfg.viewer_folder, '260716_R1_RE_view.tif');
  const info = JSON.parse(spawnSync(path.join(CONDA, 'Library', 'bin', 'gdalinfo.exe'), ['-json', view],
    { encoding: 'utf8', env: { ...process.env, PROJ_DATA: path.join(CONDA, 'Library', 'share', 'proj') } }).stdout);
  assert.equal(info.metadata?.IMAGE_STRUCTURE?.LAYOUT, 'COG');
  assert.match(info.metadata?.IMAGE_STRUCTURE?.COMPRESSION ?? '', /JPEG/);
  assert.equal(info.bands.length, 3);
  assert.ok(info.bands[0].mask.flags.includes('PER_DATASET'), '투명 영역 마스크');
  assert.match(info.coordinateSystem.wkt, /Pseudo-Mercator/);
  assert.ok(fs.existsSync(path.join(out, 'thumbs', '2026-07-16-R1-RE.jpg')));
  assert.ok(!fs.readdirSync(path.join(root, '2026-07-16')).some((f) => f.endsWith('.aux.xml')), '원본 폴더에 부산물 없음');
  // Z_est = 80 m (이륙 3점 제외), GSD
  const res = JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8')).results;
  const re = res['2026-07-16-R1-RE'];
  assert.ok(Math.abs(re.z_mean_m - 80) < 0.05, `z ${JSON.stringify(re)}`);
  assert.equal(re.n_outlier, 3);
  assert.equal(re.n_total, 123);
  assert.ok(Math.abs(re.gsd_cm - 5.556) < 0.01, `gsd ${re.gsd_cm}`);
  assert.equal(re.gps_columns.alt, 'altitude');
  assert.ok(Math.abs(res['2026-07-16-R1-RGB'].gsd_cm - (80 * 4.4e-6) / 35e-3 * 100) < 0.01);
  // 두 번째 실행: 바뀐 게 없으면 다시 만들거나 계산하지 않음
  const s2 = await run(opts);
  assert.deepEqual([s2.converted, s2.computed, s2.changed], [0, 0, false]);
  // 카메라 값을 바꾸면 그 종류만 다시 계산
  const s3 = await run({ ...opts, cfg: { ...cfg, cameras: { ...cfg.cameras, RE: { ...cfg.cameras.RE, focal_mm: 5.5 } } } });
  assert.deepEqual([s3.converted, s3.computed], [0, 1]);
  fs.rmSync(tmp, { recursive: true, force: true });
});
