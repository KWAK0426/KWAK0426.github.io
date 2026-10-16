// 김해 논 모자이크 뷰어: 날짜·회차별 광학(RGB)·다분광(RE) 모자이크를 위성지도 위에 보여 주고
// 'GSD 계산하기'로 평균 Z_est(GPS 고도 − DEM)와 GSD를 계산한다.
// 계산 결과는 PC가 매일 05:00 계산해 results.json으로 올리고(모두에게 유지),
// 이 화면에서 직접 계산한 결과는 PC 결과가 올라오기 전까지 이 기기에 보관한다.
/* global ol, GeoTIFF, proj4 */
import { computeZest, signature, decodeText } from './zest.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND = { RGB: '광학', RE: '다분광' };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(`mv.${k}`)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`mv.${k}`, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};
const S = { catalog: null, results: {}, byKey: new Map(), sel: null, layer: null, source: null, gen: 0, busy: new Set() };

// ---- Drive 파일 읽기 --------------------------------------------------------------
// Drive는 바이트 구간 요청과 CORS를 지원하지만 Content-Range 머리글을 브라우저에 보여 주지 않는다.
// 요청한 구간·응답 길이·목록의 파일 크기로 그 머리글을 채운다 (전체 파일 내려받기는 하지 않음).
const params = new URLSearchParams(location.search);
const localTest = ['127.0.0.1', 'localhost'].includes(location.hostname) && params.get('drive');
const DRIVE = localTest || 'https://drive.usercontent.google.com/download';
const driveUrl = (id) => `${DRIVE}?id=${encodeURIComponent(id)}&export=download&confirm=t`;
const sizes = new Map();
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const ours = sizes.has(url);
  const res = await nativeFetch(input, ours ? { ...init, credentials: 'omit', referrerPolicy: 'no-referrer' } : init);
  if (!ours || res.status !== 206 || res.headers.has('content-range')) return res;
  const m = /^bytes=(\d+)-(\d+)$/i.exec(new Headers(init?.headers || (input instanceof Request ? input.headers : undefined)).get('range') || '');
  const len = Number(res.headers.get('content-length'));
  const total = sizes.get(url);
  if (!m || !(len > 0) || !(total > 0) || Number(m[1]) + len > total) return res;
  const headers = new Headers(res.headers);
  headers.set('Content-Range', `bytes ${m[1]}-${Number(m[1]) + len - 1}/${total}`);
  return new Response(res.body, { status: 206, statusText: res.statusText, headers });
};
const driveFile = (f) => { const u = driveUrl(f.driveFileId); sizes.set(u, f.sizeBytes); return u; };

// ---- 지도 ------------------------------------------------------------------------
const sat = new ol.layer.Tile({ source: new ol.source.XYZ({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, crossOrigin: 'anonymous',
  attributions: 'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
}) });
const osm = new ol.layer.Tile({ visible: false, source: new ol.source.OSM({ maxZoom: 19 }) });
const map = new ol.Map({
  target: 'map', layers: [sat, osm],
  controls: [new ol.control.Attribution({ collapsible: true, collapsed: true }), new ol.control.ScaleLine({ units: 'metric' }), new ol.control.Zoom()],
  view: new ol.View({ center: ol.proj.fromLonLat([128.88, 35.2]), zoom: 13, maxZoom: 24 }),
});
const view = map.getView();
function status(text, kind = '') { const el = $('#status'); el.textContent = text; el.className = `vw-status ${kind}`; el.hidden = !text; }
function fit() {
  if (!S.sel?.bounds) return;
  view.fit(ol.proj.transformExtent(S.sel.bounds, 'EPSG:4326', 'EPSG:3857'), { padding: innerWidth <= 760 ? [80, 20, 200, 20] : [80, 60, 220, 340], duration: 400, maxZoom: 21 });
}

// ---- 목록 ------------------------------------------------------------------------
const keyOf = (o) => `${o.date}#${o.round}`;
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
function resultFor(o) {
  const cam = S.catalog.cameras?.[o.kind];
  const sig = signature(o, cam, S.catalog.alt_offset_m ?? 0);
  const pc = S.results[o.id];
  if (pc && pc.signature === sig) return pc;
  const local = store.get(`zest.${o.id}`);
  if (local && local.signature === sig) return { ...local, source: 'local' };
  return null;
}
const canCompute = (o) => !!(o.dem?.driveFileId && o.gps?.driveFileId && o.dem?.proj4 !== undefined);
const fmt = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

function renderList() {
  const groups = new Map();
  for (const o of S.catalog.observations) {
    if (!groups.has(o.date)) groups.set(o.date, new Map());
    const g = groups.get(o.date);
    g.set(o.round, { ...(g.get(o.round) ?? {}), [o.kind]: o });
  }
  const dates = [...groups.keys()].sort().reverse();
  $('#list').innerHTML = dates.length ? dates.map((d) => `<div class="vw-date">${md(d)} <span class="muted">(${d})</span></div>`
    + [...groups.get(d).entries()].sort((a, b) => a[0] - b[0]).map(([n, kinds]) => {
      const on = S.sel && keyOf(S.sel) === `${d}#${n}`;
      const res = ['RGB', 'RE'].map((k) => kinds[k] && resultFor(kinds[k])).map((r, i) => (r && !r.error ? `${KIND[['RGB', 'RE'][i]]} Z ${fmt(r.z_mean_m)} m · GSD ${fmt(r.gsd_cm, 2)} cm${r.warnings?.length ? ' <span class="warn">⚠</span>' : ''}` : null)).filter(Boolean);
      return `<div class="vw-round ${on ? 'on' : ''}"><b>${n}차</b><div class="vw-chips">${['RGB', 'RE'].map((k) => (kinds[k]
        ? `<button type="button" class="vw-chip" data-id="${esc(kinds[k].id)}" aria-pressed="${S.sel?.id === kinds[k].id}">${KIND[k]}</button>`
        : `<span class="vw-chip none" title="${KIND[k]} 모자이크 없음">${KIND[k]} 없음</span>`)).join('')}</div>
        ${res.length ? `<div class="vw-res">${res.join('<br>')}</div>` : ''}</div>`;
    }).join('')).join('')
    : `<div class="vw-empty"><b>아직 등록된 모자이크가 없습니다</b><p>내 드라이브 <code>김해논_드론/날짜/</code> 폴더에 <code>YYMMDD_R1_RGB.tif</code>, <code>YYMMDD_R1_RE.tif</code>, <code>YYMMDD_DEM.tif</code>, <code>YYMMDD_R1_GPS.csv</code> 이름으로 넣으면 다음 날 오전 5시에 자동으로 나타납니다.</p></div>`;
  const pending = S.catalog.pending?.length ?? 0;
  const t = new Date(S.catalog.updated_at);
  $('#updated').textContent = `모자이크 ${S.catalog.observations.length}개${pending ? ` · Drive 업로드 대기 ${pending}개` : ''} · ${Number.isNaN(t.getTime()) ? '' : `${t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 갱신`}`;
  const notes = S.catalog.notices ?? [];
  $('#notices').hidden = !notes.length;
  $('#notices summary').textContent = `확인 필요 ${notes.length}건 (파일 이름·빠진 자료)`;
  $('#notices ul').innerHTML = notes.map((n) => `<li>${esc(n)}</li>`).join('');
  const todo = S.catalog.observations.filter((o) => !resultFor(o) && canCompute(o));
  $('#batch').disabled = !todo.length || S.busy.size > 0;
  $('#batch').title = todo.length ? `계산 안 된 모자이크 ${todo.length}개를 계산합니다` : '계산할 모자이크가 없습니다 (모두 계산됨)';
}

// ---- 모자이크 열기 -------------------------------------------------------------------
async function select(o, { fitView = true } = {}) {
  const gen = ++S.gen;
  S.sel = o;
  if (S.layer) { map.removeLayer(S.layer); S.layer.dispose(); S.layer = null; }
  if (S.source) { S.source.dispose(); S.source = null; }
  $('#sel-title').textContent = o.title;
  $('#sel-info').textContent = `${o.type}${o.width ? ` · ${o.width.toLocaleString()} × ${o.height.toLocaleString()} px` : ''}${o.mosaic_px_cm ? ` · 픽셀 ${fmt(o.mosaic_px_cm, 2)} cm` : ''}`;
  const sib = S.byKey.get(keyOf(o)) ?? {};
  for (const b of document.querySelectorAll('#kind-seg button')) {
    b.disabled = !sib[b.dataset.kind];
    b.setAttribute('aria-pressed', String(b.dataset.kind === o.kind));
    b.title = sib[b.dataset.kind] ? '' : `이 회차에는 ${KIND[b.dataset.kind]} 모자이크가 없습니다`;
  }
  const p = new URLSearchParams(location.search);
  p.set('date', o.date); p.set('round', o.round); p.set('kind', o.kind); p.delete('id');
  history.replaceState(null, '', `${location.pathname}?${p}`);
  renderList();
  renderCalc();
  closeSide();
  if (fitView) fit();
  status('모자이크를 불러오는 중…');
  const source = new ol.source.GeoTIFF({
    sources: [{ url: driveFile(o), min: 0, max: 255 }], normalize: true, convertToRGB: 'auto', interpolate: true,
    sourceOptions: { allowFullFile: false, maxRanges: 1, blockSize: 65536, cacheSize: 100 },
  });
  const layer = new ol.layer.WebGLTile({ source, opacity: Number($('#opacity').value) / 100, visible: $('#show').checked, cacheSize: 256 });
  S.source = source; S.layer = layer;
  let pending = 0; let loaded = false;
  const fail = () => { if (gen === S.gen) status('모자이크를 불러오지 못했습니다. Drive 공유(링크가 있는 모든 사용자)와 인터넷 연결을 확인하세요.', 'error'); };
  source.on('tileloadstart', () => { if (gen === S.gen) pending++; });
  source.on('tileloadend', () => { if (gen !== S.gen) return; pending = Math.max(0, pending - 1); loaded = true; if (!pending) status(''); });
  source.on('tileloaderror', fail);
  setTimeout(() => { if (gen === S.gen && !loaded) fail(); }, 45000);
  try {
    await source.getView();
    if (gen !== S.gen) return;
    map.addLayer(layer);
  } catch (e) { console.error(e); fail(); }
}

// ---- Z_est·GSD -----------------------------------------------------------------------
function renderCalc(progress = null, error = null) {
  const o = S.sel;
  const box = $('#calc');
  if (!o) { box.hidden = true; return; }
  box.hidden = false;
  const r = resultFor(o);
  const cam = S.catalog.cameras?.[o.kind];
  const busy = S.busy.has(o.id);
  const head = `<h2><span>${KIND[o.kind]} · Z_est·GSD</span>${r && !busy ? '<button type="button" class="vw-link" id="recalc" title="입력이 같아도 다시 계산">다시 계산</button>' : ''}</h2>`;
  if (busy) {
    box.innerHTML = `${head}<p>계산 중… GPS 점마다 DEM 고도를 읽고 있습니다</p><div class="vw-progress"><i style="width:${Math.round((progress ?? 0) * 100)}%"></i></div>`;
    return;
  }
  if (!r || r.error) {
    const why = !o.dem ? '이 회차의 DEM이 없습니다' : !o.gps ? '이 회차의 GPS가 없습니다' : !canCompute(o) ? 'DEM·GPS가 아직 Drive에 올라가지 않았습니다' : '';
    box.innerHTML = `${head}${why ? `<p class="muted">${why}</p>` : `<button type="button" class="vw-btn solid" id="calc-btn">GSD 계산하기</button>
      <p class="vw-src">평균 Z_est = GPS 고도 − DEM (촬영 지점마다) · GSD = 픽셀 ${cam?.pixel_um ?? '?'} µm × Z_est ÷ 초점거리 ${cam?.focal_mm ?? '?'} mm</p>`}
      ${r?.error || error ? `<p class="vw-err">계산 실패: ${esc(error ?? r.error)}</p>` : ''}`;
    $('#calc-btn')?.addEventListener('click', () => calc(o));
    return;
  }
  const when = new Date(r.computed_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `${head}<dl class="vw-kv">
      <dt>평균 Z_est</dt><dd class="big">${fmt(r.z_mean_m, 2)} m</dd>
      <dt>GSD (Z_est 기준)</dt><dd class="big">${fmt(r.gsd_cm, 2)} cm</dd>
      <dt>중앙값 · 표준편차</dt><dd>${fmt(r.z_median_m, 2)} · ${fmt(r.z_sd_m, 2)} m</dd>
      <dt>사용한 GPS 점</dt><dd>${r.n_used} / ${r.n_total}${r.n_outlier ? ` (이착륙 등 ${r.n_outlier} 제외)` : ''}${r.n_outside ? ` · DEM 밖 ${r.n_outside}` : ''}</dd>
      <dt>모자이크 픽셀</dt><dd>${fmt(r.mosaic_px_cm ?? o.mosaic_px_cm, 2)} cm</dd>
      <dt>카메라</dt><dd>${esc(r.camera?.name ?? '—')}${r.camera ? ` · ${r.camera.focal_mm} mm · ${r.camera.pixel_um} µm` : ''}</dd>
    </dl>
    ${r.camera && !r.camera.confirmed ? '<div class="vw-warn">카메라 초점거리·픽셀 크기는 기본값입니다. 실제 값으로 고치면 GSD가 다시 계산됩니다.</div>' : ''}
    ${(r.warnings ?? []).map((w) => `<div class="vw-warn">${esc(w)}</div>`).join('')}
    <p class="vw-src">${r.source === 'local' ? '이 기기에서 계산 · PC 자동 계산(매일 05:00)이 올라오면 그 값으로 바뀝니다' : 'PC 자동 계산 (매일 05:00 갱신, 입력이 바뀔 때만 다시 계산)'} · ${when}<br>
      GPS 열: ${esc(r.gps_columns?.lat)} · ${esc(r.gps_columns?.lon)} · ${esc(r.gps_columns?.alt)}${r.alt_offset_m ? ` · 고도 보정 ${r.alt_offset_m} m` : ''}</p>`;
  $('#recalc')?.addEventListener('click', () => calc(o, { force: true }));
}

async function calc(o, { force = false } = {}) {
  if (S.busy.has(o.id) || (!force && resultFor(o))) return resultFor(o);
  S.busy.add(o.id);
  if (S.sel?.id === o.id) renderCalc(0);
  renderList();
  try {
    const r = await computeZest({
      obs: o, camera: S.catalog.cameras?.[o.kind], altOffset: S.catalog.alt_offset_m ?? 0, proj4,
      openDem: () => GeoTIFF.fromUrl(driveFile(o.dem), { allowFullFile: false, maxRanges: 1, blockSize: 65536, cacheSize: 200 }),
      readGps: async () => {
        const res = await fetch(driveUrl(o.gps.driveFileId), { credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!res.ok) throw new Error(`GPS 파일을 읽지 못했습니다 (${res.status})`);
        return decodeText(new Uint8Array(await res.arrayBuffer()));
      },
      onProgress: (p) => { if (S.sel?.id === o.id) renderCalc(p); },
    });
    store.set(`zest.${o.id}`, r);
    return r;
  } catch (e) {
    console.error(e);
    if (S.sel?.id === o.id) { S.busy.delete(o.id); renderCalc(null, e.message); }
    throw e;
  } finally {
    S.busy.delete(o.id);
    if (S.sel?.id === o.id && !$('#calc .vw-err')) renderCalc();
    renderList();
  }
}

async function batch() {
  const todo = S.catalog.observations.filter((o) => !resultFor(o) && canCompute(o));
  if (!todo.length) return;
  const box = $('#batch-status');
  box.hidden = false;
  $('#batch').disabled = true;
  let ok = 0; let bad = 0;
  for (const [i, o] of todo.entries()) {
    box.textContent = `일괄 계산 중 ${i + 1}/${todo.length} · ${o.title}`;
    try { await calc(o); ok++; } catch { bad++; }
  }
  box.textContent = `일괄 계산 끝: ${ok}개 완료${bad ? ` · ${bad}개 실패 (해당 회차를 눌러 이유 확인)` : ''}`;
  renderList();
}

// ---- 시작 ------------------------------------------------------------------------
async function load() {
  const get = (f) => nativeFetch(`${f}?t=${Date.now()}`, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  try {
    const [catalog, results] = await Promise.all([get('catalog.json'), get('results.json').catch(() => ({ results: {} }))]);
    S.catalog = catalog; S.results = results.results ?? {};
  } catch (e) {
    console.error(e);
    $('#updated').textContent = '목록을 읽지 못했습니다. 새로고침해 주세요.';
    S.catalog = { observations: [], cameras: {} };
  }
  S.byKey = new Map();
  for (const o of S.catalog.observations) S.byKey.set(keyOf(o), { ...(S.byKey.get(keyOf(o)) ?? {}), [o.kind]: o });
  renderList();
  const id = params.get('id');
  const want = id ? S.catalog.observations.find((o) => o.id === id)
    : (() => { const g = S.byKey.get(`${params.get('date')}#${Number(params.get('round'))}`); return g ? (g[params.get('kind')] ?? g.RGB ?? g.RE) : null; })();
  const first = want ?? [...S.catalog.observations].sort((a, b) => (a.date < b.date ? 1 : -1) || a.round - b.round)[0];
  if (first) select(first);
  else if (params.get('date')) status('이 회차의 모자이크는 아직 없습니다', 'error');
}

function closeSide() { $('#side').classList.remove('open'); $('#list-btn').setAttribute('aria-expanded', 'false'); }
$('#list-btn').addEventListener('click', () => { const open = $('#side').classList.toggle('open'); $('#list-btn').setAttribute('aria-expanded', String(open)); });
$('#list').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) select(S.catalog.observations.find((o) => o.id === b.dataset.id)); });
$('#kind-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-kind]');
  const o = b && S.sel && S.byKey.get(keyOf(S.sel))?.[b.dataset.kind];
  if (o && o.id !== S.sel.id) select(o, { fitView: false });
});
$('#batch').addEventListener('click', batch);
$('#fit').addEventListener('click', fit);
$('#opacity').addEventListener('input', () => S.layer?.setOpacity(Number($('#opacity').value) / 100));
$('#show').addEventListener('change', () => S.layer?.setVisible($('#show').checked));
const bg = (isSat) => { sat.setVisible(isSat); osm.setVisible(!isSat); $('#bg-sat').setAttribute('aria-pressed', String(isSat)); $('#bg-osm').setAttribute('aria-pressed', String(!isSat)); };
$('#bg-sat').addEventListener('click', () => bg(true));
$('#bg-osm').addEventListener('click', () => bg(false));
map.on('pointermove', (e) => { const p = ol.proj.toLonLat(e.coordinate); $('#coord').textContent = `${p[1].toFixed(6)}° N ${p[0].toFixed(6)}° E`; });
view.on('change:resolution', () => { const c = view.getCenter(); if (!c) return; const r = ol.proj.getPointResolution('EPSG:3857', view.getResolution(), c); $('#res').textContent = `화면 ${r < 1 ? `${(r * 100).toFixed(1)} cm` : `${r.toFixed(1)} m`}/px`; });
map.on('singleclick', () => { if (innerWidth <= 760) closeSide(); });
load();
