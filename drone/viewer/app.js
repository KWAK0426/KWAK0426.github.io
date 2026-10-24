// Desktop processing prepares the products and metadata; this viewer only reads them.
/* global ol, proj4 */
import { createSpectrumPanel } from './spectra.js?v=9';
import { bandLabel } from './bands.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KIND = { RGB: '광학', RE: '다분광', NDVI: 'NDVI' };
const kindLabel = o => o?.derivedFromMultispectral ? 'RGB 대체' : KIND[o?.kind];
const S = { catalog: null, byKey: new Map(), sel: null, layer: null, source: null, gen: 0 };

// ---- Drive 파일 읽기 --------------------------------------------------------------
// Drive는 바이트 구간 요청과 CORS를 지원하지만 Content-Range 머리글을 브라우저에 보여 주지 않는다.
// 요청한 구간·응답 길이·목록의 파일 크기로 그 머리글을 채운다 (전체 파일 내려받기는 하지 않음).
const params = new URLSearchParams(location.search);
S.band = Number(params.get('band')) || 0;
S.range = params.get('range') === 'minmax' ? 'minmax' : 'p05p95';
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
const spectrumPanel = createSpectrumPanel({map, getReference: o => S.byKey.get(`${o.date}#${o.round}`)?.RE});
const seamSource = new ol.source.Vector();
const seamLayer = new ol.layer.Vector({source:seamSource, visible:false, zIndex:8, style:[
  new ol.style.Style({stroke:new ol.style.Stroke({color:'#20282d', width:3})}),
  new ol.style.Style({stroke:new ol.style.Stroke({color:'#ffc145', width:1.5})}),
]});
map.addLayer(seamLayer);
let seamUrl = null, seamTask = null, seamGeneration = 0;
function status(text, kind = '') { const el = $('#status'); el.textContent = text; el.className = `vw-status ${kind}`; el.hidden = !text; }
function fit() {
  if (!S.sel?.bounds) return;
  view.fit(ol.proj.transformExtent(S.sel.bounds, 'EPSG:4326', 'EPSG:3857'), { padding: innerWidth <= 760 ? [80, 20, 200, 20] : [80, 60, 220, 340], duration: 400, maxZoom: 21 });
}

// ---- 목록 ------------------------------------------------------------------------
const keyOf = (o) => `${o.date}#${o.round}`;
async function syncSeamlines(o) {
  const cfg = o?.seamlines ?? S.byKey.get(o && keyOf(o))?.RE?.seamlines;
  const url = cfg?.url ?? null, checkbox = $('#show-seams'), note = $('#seam-status');
  if (url !== seamUrl) {
    seamUrl = url; seamTask = null; seamGeneration++; seamSource.clear();
  }
  checkbox.disabled = !url;
  checkbox.title = url ? '실제로 선택된 Photos가 바뀌는 경계 · 모자이크 외곽 포함' : '이 회차의 선택영상 경계 자료 미등록';
  seamLayer.setVisible(Boolean(url && checkbox.checked));
  note.hidden = true;
  if (!url || !checkbox.checked || seamSource.getFeatures().length) return;
  const seq = seamGeneration;
  note.textContent = '심라인을 읽는 중…'; note.hidden = false;
  try {
    seamTask ??= fetch(url).then(r => {
      if (!r.ok) throw new Error('심라인 자료를 읽지 못했습니다.');
      if (!url.endsWith('.gz')) return r.json();
      if (!('DecompressionStream' in window)) throw new Error('이 브라우저는 압축 심라인 읽기를 지원하지 않습니다.');
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
    });
    const doc = await seamTask;
    if (seq !== seamGeneration || seamSource.getFeatures().length) return;
    const features = new ol.format.GeoJSON().readFeatures(doc, {dataProjection:'EPSG:4326', featureProjection:view.getProjection()});
    if (!features.length) throw new Error('심라인 경계 자료가 비어 있습니다.');
    seamSource.addFeatures(features);
    note.hidden = true;
  } catch (e) {
    if (seq !== seamGeneration) return;
    seamTask = null; seamLayer.setVisible(false); checkbox.checked = false;
    note.textContent = e.message; note.hidden = false;
  }
}
const roundsFor = date => [...new Set(S.catalog.observations.filter(o => o.date === date).map(o => o.round))].sort((a, b) => a - b);
function observationFor(date, round, kind = S.sel?.kind) {
  const group = S.byKey.get(`${date}#${round}`);
  return group && (group[kind] ?? group.RGB ?? group.RE ?? group.NDVI);
}
function descriptionFor(o) {
  const cfg = o.spectral ?? S.byKey.get(keyOf(o))?.RE?.spectral;
  return o.type.replace(/\bB(\d+)\b/g, (label, n) => {
    const band = cfg?.bands.find(b => b.band === Number(n));
    return band ? bandLabel(band.wavelengthNm) : label;
  });
}
const fmt = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

function renderList() {
  const dates = [...new Set(S.catalog.observations.map(o => o.date))].sort().reverse();
  $('#list').innerHTML = dates.length ? dates.map(d => `<button type="button" class="vw-date" data-date="${esc(d)}" aria-pressed="${S.sel?.date === d}">${esc(d)}</button>`).join('')
    : '<div class="vw-empty"><b>아직 등록된 모자이크가 없습니다</b></div>';
  const pending = S.catalog.pending?.length ?? 0;
  const t = new Date(S.catalog.updated_at);
  $('#updated').textContent = `모자이크 ${S.catalog.observations.length}개${pending ? ` · Drive 업로드 대기 ${pending}개` : ''} · ${Number.isNaN(t.getTime()) ? '' : `${t.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 갱신`}`;
  const notes = S.catalog.notices ?? [];
  $('#notices').hidden = !notes.length;
  $('#notices summary').textContent = `확인 필요 ${notes.length}건 (파일 이름·빠진 자료)`;
  $('#notices ul').innerHTML = notes.map((n) => `<li>${esc(n)}</li>`).join('');
}

// ---- 모자이크 열기 -------------------------------------------------------------------
function spectralControls(o) {
  const cfg = o.kind === 'RE' ? o.spectral : null;
  $('#spectral-controls').hidden = !cfg;
  $('#band-legend').hidden = true;
  if (!cfg) return null;
  const bands = [...cfg.bands].sort((a, b) => a.wavelengthNm - b.wavelengthNm);
  if (!bands.some(b => b.band === S.band)) S.band = 0;
  $('#band-select').innerHTML = '<option value="0">RGB 합성</option>' + bands.map(b => `<option value="${b.band}">${bandLabel(b.wavelengthNm)}</option>`).join('');
  $('#band-select').value = String(S.band);
  $('#band-range').hidden = S.band === 0;
  for (const b of document.querySelectorAll('#band-range button')) b.setAttribute('aria-pressed', String(b.dataset.range === S.range));
  const band = bands.find(b => b.band === S.band);
  if (!band) return null;
  const [lo, hi] = (S.range === 'minmax' ? ['min', 'max'] : ['p05', 'p95']).map(k => band.stats[k]);
  $('#band-legend').hidden = false;
  $('#band-legend-title').textContent = `${bandLabel(band.wavelengthNm)} · ${S.range === 'minmax' ? 'Min–Max' : 'P05–P95'}`;
  $('#band-ramp').style.background = `linear-gradient(90deg,${cfg.palette.map((c, i) => `${c} ${100 * i / (cfg.palette.length - 1)}%`).join(',')})`;
  $('#band-ticks').innerHTML = [lo, (lo + hi) / 2, hi].map(v => `<span>${v.toFixed(4)}</span>`).join('');
  return band;
}

function showBand(o, band, gen) {
  const cfg = o.spectral;
  const source = new ol.source.ImageStatic({ url: band.images[S.range], projection: cfg.projection, imageExtent: cfg.extent, interpolate: false });
  const layer = new ol.layer.Image({source, opacity: Number($('#opacity').value) / 100, visible: $('#show').checked});
  S.source = source; S.layer = layer;
  $('#sel-info').textContent = `${bandLabel(band.wavelengthNm)} · 축소 표시 ${cfg.displayWidth} × ${cfg.displayHeight} px`;
  source.on('imageloadend', () => { if (gen === S.gen) status('밴드별 축소 표시 · 전체 유효 화소 기준 컬러바', 'preview'); });
  source.on('imageloaderror', () => { if (gen === S.gen) status('밴드 영상을 읽지 못했습니다. 새로고침해 주세요.', 'error'); });
  map.addLayer(layer);
}

function showStaticMosaic(o, gen, image = o.staticImage) {
  const preview = o.kind === 'RE' && image.displayOnly;
  if (preview) $('#sel-info').textContent = `${descriptionFor(o)} · 축소 표시 ${image.width} × ${image.height} px · 원본 ${o.width.toLocaleString()} × ${o.height.toLocaleString()} px`;
  if (image.projection === 'EPSG:32652') {
    proj4.defs('EPSG:32652', '+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs');
    ol.proj.proj4.register(proj4);
  }
  const source = new ol.source.ImageStatic({url:image.url, projection:image.projection, imageExtent:image.extent, interpolate:false});
  S.source = source;
  S.layer = new ol.layer.Image({source, opacity:Number($('#opacity').value)/100, visible:$('#show').checked});
  source.on('imageloadend', () => {if (gen === S.gen) status(preview ? '다분광 축소 표시 · 원본 분석 TIFF는 비공개 보존' : '', preview ? 'preview' : '');});
  source.on('imageloaderror', () => {if (gen === S.gen) status('모자이크 영상을 불러오지 못했습니다.', 'error');});
  map.addLayer(S.layer);
}

async function select(o, { fitView = true } = {}) {
  const gen = ++S.gen;
  S.sel = o;
  void syncSeamlines(o);
  $('#round-select').innerHTML = roundsFor(o.date).map(n => `<option value="${n}">${n}회차</option>`).join('');
  $('#round-select').value = String(o.round);
  $('#round-select').disabled = false;
  void spectrumPanel.setObservation(o);
  if (S.layer) { map.removeLayer(S.layer); S.layer.dispose(); S.layer = null; }
  if (S.source) { S.source.dispose(); S.source = null; }
  $('#sel-title').textContent = o.title;
  $('#sel-info').textContent = `${descriptionFor(o)}${o.width ? ` · ${o.width.toLocaleString()} × ${o.height.toLocaleString()} px` : ''}${o.mosaic_px_cm ? ` · 픽셀 ${o.mosaic_px_cm >= 100 ? `${fmt(o.mosaic_px_cm/100,2)} m` : `${fmt(o.mosaic_px_cm,2)} cm`}` : ''}`;
  $('#ndvi-legend').hidden = o.kind !== 'NDVI';
  if (o.ndviDisplay) $('#ndvi-ramp').style.background = `linear-gradient(90deg,${o.ndviDisplay.palette.join(',')})`;
  const band = spectralControls(o);
  const sib = S.byKey.get(keyOf(o)) ?? {};
  const metadataCsv = o.metadataCsv ?? sib.RE?.metadataCsv;
  $('#round-metadata').hidden = !metadataCsv;
  if (metadataCsv) $('#round-metadata').href = metadataCsv;
  else $('#round-metadata').removeAttribute('href');
  for (const b of document.querySelectorAll('#kind-seg button')) {
    b.textContent = sib[b.dataset.kind] ? kindLabel(sib[b.dataset.kind]) : KIND[b.dataset.kind];
    b.disabled = !sib[b.dataset.kind];
    b.setAttribute('aria-pressed', String(b.dataset.kind === o.kind));
    b.title = sib[b.dataset.kind] ? '' : `이 뷰어에 해당 회차의 ${KIND[b.dataset.kind]} 모자이크가 아직 등록되지 않았습니다`;
  }
  const p = new URLSearchParams(location.search);
  p.set('date', o.date); p.set('round', o.round); p.set('kind', o.kind); p.delete('id');
  if (band) { p.set('band', band.band); p.set('range', S.range); }
  else { p.delete('band'); p.delete('range'); }
  history.replaceState(null, '', `${location.pathname}?${p}`);
  renderList();
  closeSide();
  if (fitView) fit();
  status('모자이크를 불러오는 중…');
  if (band) { showBand(o, band, gen); return; }
  // The old Drive NDVI COG is already colorized with a different range.
  if (o.kind === 'NDVI' && o.ndviDisplay) {
    $('#sel-info').textContent = `NDVI · viridis · 0–1 · 축소 표시 ${o.ndviDisplay.width} × ${o.ndviDisplay.height} px`;
    showStaticMosaic(o, gen, o.ndviDisplay);
    return;
  }
  if (o.staticImage) {showStaticMosaic(o, gen); return;}
  const source = new ol.source.GeoTIFF({
    sources: [{ url: driveFile(o), min: 0, max: 255 }], normalize: true, convertToRGB: 'auto', interpolate: true,
    sourceOptions: { allowFullFile: false, maxRanges: 1, blockSize: 65536, cacheSize: 100 },
  });
  const layer = new ol.layer.WebGLTile({ source, opacity: Number($('#opacity').value) / 100, visible: $('#show').checked, cacheSize: 256 });
  S.source = source; S.layer = layer;
  let pending = 0; let loaded = false;
  let fallback = false;
  const fail = () => {
    if (gen !== S.gen || fallback) return;
    if (!o.thumbnail) {
      status('모자이크를 불러오지 못했습니다. Drive 공유와 인터넷 연결을 확인하세요.', 'error');
      return;
    }
    fallback = true;
    if (S.layer) { map.removeLayer(S.layer); S.layer.dispose(); }
    const preview = new ol.source.ImageStatic({
      url: o.thumbnail, projection: 'EPSG:4326', imageExtent: o.bounds, interpolate: true,
    });
    source.dispose();
    S.source = preview;
    preview.on('imageloaderror', () => { if (gen === S.gen) status('미리보기도 불러오지 못했습니다. 연결을 확인하세요.', 'error'); });
    const previewLayer = new ol.layer.Image({ source: preview, opacity: Number($('#opacity').value) / 100, visible: $('#show').checked });
    S.layer = previewLayer;
    map.addLayer(previewLayer);
    $('#sel-info').textContent = `${descriptionFor(o)} · 축소 미리보기 · 원본 ${o.width.toLocaleString()} × ${o.height.toLocaleString()} px`;
    status('축소 미리보기 · 고해상도 Drive 연결 확인 필요', 'preview');
  };
  source.on('tileloadstart', () => { if (gen === S.gen) pending++; });
  source.on('tileloadend', () => { if (gen !== S.gen || fallback) return; pending = Math.max(0, pending - 1); loaded = true; if (!pending) status(''); });
  source.on('tileloaderror', fail);
  setTimeout(() => { if (gen === S.gen && !loaded) fail(); }, 12000);
  try {
    await source.getView();
    if (gen !== S.gen || fallback) return;
    map.addLayer(layer);
  } catch (e) { console.error(e); fail(); }
}

// ---- 시작 ------------------------------------------------------------------------
async function load() {
  const get = (f) => nativeFetch(`${f}?t=${Date.now()}`, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
  try {
    S.catalog = await get('catalog.json');
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
    : observationFor(params.get('date'), params.has('round') ? Number(params.get('round')) : roundsFor(params.get('date'))[0], params.get('kind'));
  const latest = [...new Set(S.catalog.observations.map(o => o.date))].sort().at(-1);
  const first = want ?? observationFor(latest, roundsFor(latest)[0], params.get('kind'));
  if (first) select(first);
  else if (params.get('date')) status('이 회차의 모자이크는 아직 없습니다', 'error');
}

function closeSide() { $('#side').classList.remove('open'); $('#list-btn').setAttribute('aria-expanded', 'false'); }
$('#list-btn').addEventListener('click', () => { const open = $('#side').classList.toggle('open'); $('#list-btn').setAttribute('aria-expanded', String(open)); });
$('#list').addEventListener('click', e => {
  const b = e.target.closest('button[data-date]');
  if (b) select(observationFor(b.dataset.date, roundsFor(b.dataset.date)[0]));
});
$('#round-select').addEventListener('change', () => {
  if (S.sel) select(observationFor(S.sel.date, Number($('#round-select').value)));
});
$('#kind-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-kind]');
  const o = b && S.sel && S.byKey.get(keyOf(S.sel))?.[b.dataset.kind];
  if (o && o.id !== S.sel.id) select(o, { fitView: false });
});
$('#band-select').addEventListener('change', () => {
  S.band = Number($('#band-select').value);
  if (S.sel) select(S.sel, {fitView: false});
});
$('#band-range').addEventListener('click', e => {
  const button = e.target.closest('button[data-range]');
  if (!button || button.dataset.range === S.range) return;
  S.range = button.dataset.range;
  if (S.sel) select(S.sel, {fitView: false});
});
new ResizeObserver(() => $('#map-wrap').style.setProperty('--head-height', `${$('#head').getBoundingClientRect().height}px`)).observe($('#head'));
$('#fit').addEventListener('click', fit);
$('#opacity').addEventListener('input', () => S.layer?.setOpacity(Number($('#opacity').value) / 100));
$('#show').addEventListener('change', () => S.layer?.setVisible($('#show').checked));
$('#show-seams').addEventListener('change', () => {void syncSeamlines(S.sel);});
const bg = (isSat) => { sat.setVisible(isSat); osm.setVisible(!isSat); $('#bg-sat').setAttribute('aria-pressed', String(isSat)); $('#bg-osm').setAttribute('aria-pressed', String(!isSat)); };
$('#bg-sat').addEventListener('click', () => bg(true));
$('#bg-osm').addEventListener('click', () => bg(false));
map.on('pointermove', (e) => { const p = ol.proj.toLonLat(e.coordinate); $('#coord').textContent = `${p[1].toFixed(6)}° N ${p[0].toFixed(6)}° E`; });
view.on('change:resolution', () => { const c = view.getCenter(); if (!c) return; const r = ol.proj.getPointResolution('EPSG:3857', view.getResolution(), c); $('#res').textContent = `화면 ${r < 1 ? `${(r * 100).toFixed(1)} cm` : `${r.toFixed(1)} m`}/px`; });
map.on('singleclick', () => { if (innerWidth <= 760) closeSide(); });
load();
