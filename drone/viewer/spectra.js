/* global ol */
import { bandLabel } from './bands.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function fieldMeanRange(means) {
  const values = means.filter(a => a?.length && a.every(Number.isFinite)).flat();
  if (!values.length) return null;
  return {min: Math.min(...values), max: Math.max(...values)};
}

export function spectrumEnvelope(spectra, scale = 1) {
  if (!Array.isArray(spectra) || !spectra.length || !Number.isFinite(scale) || scale <= 0) return null;
  const bands = spectra[0]?.length;
  if (!bands || !spectra.every(row => Array.isArray(row) && row.length === bands && row.every(Number.isFinite))) return null;
  const min = Array(bands).fill(Infinity), max = Array(bands).fill(-Infinity);
  for (const row of spectra) for (let i = 0; i < bands; i++) {
    const value = row[i] * scale;
    if (!Number.isFinite(value)) return null;
    min[i] = Math.min(min[i], value);
    max[i] = Math.max(max[i], value);
  }
  return {min, max, count: spectra.length};
}

export function compareSpectra(pixel, mean) {
  if (!pixel?.length || pixel.length !== mean?.length || ![...pixel, ...mean].every(Number.isFinite)) return null;
  const n = pixel.length;
  const referenceMean = mean.reduce((s, v) => s + v, 0) / n;
  const rmse = Math.sqrt(pixel.reduce((s, v, i) => s + (v - mean[i]) ** 2, 0) / n);
  const norm = Math.hypot(...pixel) * Math.hypot(...mean);
  const cosine = norm > 0 ? pixel.reduce((s, v, i) => s + v * mean[i], 0) / norm : null;
  return {
    n, rmse,
    samDeg: cosine === null ? null : Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI,
    rrmsePct: referenceMean > 0 ? 100 * rmse / referenceMean : null,
    biasPct: referenceMean > 0 ? 100 * pixel.reduce((s, v, i) => s + v - mean[i], 0) / n / referenceMean : null,
  };
}

export function createSpectrumPanel({map, getReference, getFieldMask = () => null}) {
  const boundaries = new ol.source.Vector(), marker = new ol.source.Vector();
  const fields = new ol.layer.Vector({source: boundaries, zIndex: 10, style: feature => {
    const selectedName = mode === 'pixel' ? selectedPixel?.field?.get('name') : $('#field-select').value;
    const active = feature.get('name') === selectedName;
    const geometry = feature.getGeometry();
    const polygon = geometry.getType() === 'MultiPolygon'
      ? geometry.getPolygons().reduce((a, b) => a.getArea() >= b.getArea() ? a : b)
      : geometry;
    return [new ol.style.Style({
      stroke: new ol.style.Stroke({color: active ? '#e54278' : '#ffffff', width: active ? 3 : 2}),
      fill: new ol.style.Fill({color: active ? 'rgba(229,66,120,0.12)' : 'rgba(0,0,0,0)'}),
    }), new ol.style.Style({
      geometry: polygon.getInteriorPoint(),
      text: new ol.style.Text({text: feature.get('name'), font: '600 13px sans-serif', fill: new ol.style.Fill({color: '#15282a'}), stroke: new ol.style.Stroke({color: '#ffffff', width: 4})}),
    })];
  }});
  const point = new ol.layer.Vector({source: marker, zIndex: 20, style: new ol.style.Style({image: new ol.style.Circle({radius: 6, fill: new ol.style.Fill({color: '#e54278'}), stroke: new ol.style.Stroke({color: '#ffffff', width: 2})})})});
  map.addLayer(fields); map.addLayer(point);
  const tileCache = new Map();
  const jsonCache = new Map();
  let sampleDocument = null, backgroundKey = null, cacheProgress = '';
  let reference = null, key = null, mode = 'pixel', yScope = 'fields', generation = 0, clickGeneration = 0, selectedPixel = null, pixelLoading = false;
  $('#spectrum-panel').dataset.mode = mode;
  function cacheStatus() {
    $('#spectrum-cache-status').textContent = pixelLoading ? '새 화소 읽는 중' : cacheProgress;
    $('#spectrum-chart').setAttribute('aria-busy', String(pixelLoading));
  }
  function loadJson(url) {
    if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error('스펙트럼 자료를 읽지 못했습니다.');
      return r.json();
    }).catch(e => {jsonCache.delete(url); throw e;}));
    return jsonCache.get(url);
  }
  function open(value) {
    if ($('#spectrum-panel').hidden === !value) return;
    $('#spectrum-panel').hidden = !value;
    $('#spectrum-toggle').setAttribute('aria-expanded', String(value));
    map.updateSize();
  }
  function empty(message) {
    $('#spectrum-chart').innerHTML = '<div class="spec-empty">스펙트럼 대기</div>';
    backgroundKey = null;
    $('#spectrum-values').innerHTML = '';
    $('#spectrum-message').textContent = message;
    $('#spectrum-provenance').textContent = '';
    $('#spectrum-sample-info').textContent = '';
    $('#spectrum-heading').textContent = mode === 'field' ? '필지 평균' : '선택 대표화소';
    $('#spectrum-series-legend').innerHTML = '';
    $('#spectrum-comparison').hidden = true;
    $('#pixel-mean-wrap').hidden = mode !== 'pixel';
    $('#pixel-show-mean').disabled = true;
  }
  function draw(values, heading, provenance, field = null) {
    $('#spectrum-heading').textContent = heading;
    $('#spectrum-provenance').textContent = provenance;
    const nm = reference.spectrum.wavelengthsNm;
    const width = Math.max(280, Math.floor($('#spectrum-chart').clientWidth));
    const left = 54, right = width - 20;
    const xmin = 400, xmax = 900;
    const x = wavelength => left + (wavelength - xmin) / (xmax - xmin) * (right - left);
    const mean = field?.get('mean');
    const range = yScope === 'fields'
      ? fieldMeanRange(boundaries.getFeatures().map(f => f.get('mean')))
      : reference.spectrum.yRanges?.all;
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {empty('회차 공통 Y축 범위 미확인');return;}
    const ymax = yScope === 'fields' ? Math.max(0.01, range.max * 1.1) : Math.max(0.1, Math.ceil(range.max * 1.05 * 10) / 10);
    const ymin = Math.min(0, Math.floor(range.min * 10) / 10);
    const outside = [...values, ...(mean ?? [])].some(v => v < ymin || v > ymax);
    $('#spectrum-message').textContent = outside ? '선택값 일부가 필지 공통 Y축 범위 밖입니다. 전체 범위에서 확인하세요.' : '';
    const y = v => 186 - (v - ymin) / (ymax - ymin) * 162;
    const grid = Array.from({length: 5}, (_, i) => {
      const v = ymin + (ymax - ymin) * i / 4;
      return `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" class="spec-grid"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${v.toFixed(2)}</text>`;
    }).join('');
    const ticks = Array.from({length: (xmax-xmin)/50+1}, (_, i) => xmin+i*50).map(n => `<line x1="${x(n)}" x2="${x(n)}" y1="24" y2="192" class="spec-grid"/><text data-xtick="${n}" x="${x(n)}" y="207" text-anchor="middle">${n}</text>`).join('');
    const series = [{id: mode, values, color: mode === 'field' ? '#cf2861' : '#087f88', label: mode === 'field' ? heading : '선택 화소', dashed: mode === 'pixel'}];
    const showMean = mode === 'pixel' && mean && $('#pixel-show-mean').checked;
    if (showMean) series.unshift({id:'mean', values:mean, color:'#cf2861', label:`필지 ${field.get('name')} 평균`});
    const curves = series.map(s => `<g data-series="${s.id}" clip-path="url(#spectrum-plot-clip)"><polyline fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed ? 'stroke-dasharray="6 4"' : ''} points="${s.values.map((v, i) => `${x(nm[i])},${y(v)}`).join(' ')}"/>${s.values.map((v, i) => `<circle data-wavelength="${nm[i]}" cx="${x(nm[i])}" cy="${y(v)}" r="${s.dashed ? 2.5 : 3.5}" fill="${s.color}"><title>${esc(s.label)} · ${bandLabel(nm[i])}: ${v.toFixed(5)}</title></circle>`).join('')}</g>`).join('');
    const axisKey = [width,ymin,ymax,yScope].join(':');
    if ($('#spectrum-chart svg')?.dataset.axisKey !== axisKey) {
      $('#spectrum-chart').innerHTML = `<svg viewBox="0 0 ${width} 250" data-axis-key="${axisKey}" data-xmin="${xmin}" data-xmax="${xmax}" data-ymin="${ymin}" data-ymax="${ymax}" data-scope="${yScope}" role="img"><title></title><defs><clipPath id="spectrum-plot-clip"><rect x="${left-4}" y="20" width="${right-left+8}" height="170"/></clipPath></defs>${grid}${ticks}<text x="${(left+right)/2}" y="240" text-anchor="middle">파장 (nm)</text><text x="14" y="108" text-anchor="middle" transform="rotate(-90 14 108)">반사도 (비율)</text><g id="spectrum-background" clip-path="url(#spectrum-plot-clip)"></g><g id="spectrum-curves"></g></svg>`;
      backgroundKey = null;
    }
    $('#spectrum-chart svg').setAttribute('aria-label', `${heading} 반사도 스펙트럼`);
    $('#spectrum-chart svg title').textContent = heading;
    $('#spectrum-curves').innerHTML = curves;
    const fieldName = field?.get('name');
    const samples = sampleDocument?.fields[fieldName];
    const envelope = samples?.count ? spectrumEnvelope(samples.spectra, sampleDocument.scale) : null;
    const showDistribution = envelope?.min.length === nm.length && $('#show-field-distribution').checked;
    const nextBackgroundKey = `${axisKey}:${fieldName}:${Boolean(showDistribution)}:${samples?.count ?? 0}`;
    if (backgroundKey !== nextBackgroundKey) {
      const upper = showDistribution ? envelope.max.map((v,i) => `${x(nm[i]).toFixed(2)},${y(v).toFixed(2)}`) : [];
      const lower = showDistribution ? envelope.min.map((v,i) => `${x(nm[i]).toFixed(2)},${y(v).toFixed(2)}`).reverse() : [];
      $('#spectrum-background').innerHTML = showDistribution ? `<path data-distribution-range d="M${upper.join(' L')} L${lower.join(' L')} Z" fill="#cf2861" fill-opacity="0.18" stroke="none"/>` : '';
      backgroundKey = nextBackgroundKey;
    }
    const distributionOutside = showDistribution && (envelope.min.some(v => v < ymin) || envelope.max.some(v => v > ymax));
    $('#spectrum-sample-info').textContent = showDistribution
      ? `필지 내 표본 ${envelope.count}개 · 밴드별 최소–최대(전체 화소 범위 아님)${distributionOutside ? ' · 축 밖 값 포함' : ''}` : '';
    $('#spectrum-series-legend').innerHTML = series.map(s => `<span class="spec-series ${s.dashed ? 'dashed' : ''}" style="--series-color:${s.color}">${esc(s.label)}</span>`).join('') + (showDistribution ? '<span class="spec-series distribution" style="--series-color:#cf2861">필지 내 표본 범위</span>' : '');
    $('#spectrum-values').innerHTML = `<thead><tr><th>대역 · nm</th><th>${mode === 'field' ? '필지 평균' : '선택 화소'}</th>${showMean ? '<th>필지 평균</th>' : ''}</tr></thead><tbody>${values.map((v, i) => `<tr><td><span class="spec-band-name">${bandLabel(nm[i])}</span></td><td data-col="value">${v.toFixed(5)}</td>${showMean ? `<td data-col="mean">${mean[i].toFixed(5)}</td>` : ''}</tr>`).join('')}</tbody>`;
    $('#pixel-mean-wrap').hidden = mode !== 'pixel';
    $('#pixel-show-mean').disabled = !mean;
    $('#spectrum-comparison').hidden = mode !== 'pixel' || !mean;
    if (mode === 'pixel' && mean) {
      const metrics = compareSpectra(values, mean);
      $('#spectrum-comparison-title').textContent = `필지 ${field.get('name')} 평균 대비`;
      for (const [id, key] of [['sam','samDeg'],['rrmse','rrmsePct'],['bias','biasPct']]) {
        const v = metrics?.[key];
        $(`[data-metric="${id}"]`).textContent = v == null ? '계산 불가' : `${id === 'bias' && v > 0 ? '+' : ''}${v.toFixed(2)}`;
      }
    }
  }
  function containingField(coordinate) {
    const matches = boundaries.getFeatures().filter(f => f.getGeometry().intersectsCoordinate(coordinate));
    return {field: matches.length === 1 && matches[0].get('mean') ? matches[0] : null, ambiguous: matches.length > 1};
  }
  function drawPixel() {
    marker.clear();
    if (!selectedPixel) {empty(pixelLoading ? '화소 값을 읽는 중…' : '선택한 화소 없음');fields.changed();return;}
    const p = selectedPixel;
    marker.addFeature(new ol.Feature(new ol.geom.Point(p.coordinate)));
    const note = p.field ? ` · 필지 ${p.field.get('name')}` : p.ambiguous ? ' · 경계 중복: 평균 비교 보류' : ' · 필지 밖: 평균 비교 없음';
    draw(p.values, '선택 대표화소', p.provenance + note, p.field);
    fields.changed();
  }
  function selectField(name) {
    const f = boundaries.getFeatures().find(f => f.get('name') === name);
    $('#field-select').value = f ? name : '';
    fields.changed(); marker.clear();
    if (!f || !f.get('mean')) { empty(f ? '이 회차의 필지 평균 자료 없음' : '선택한 필지 없음'); return; }
    const p = f.getProperties();
    draw(p.mean, `필지 ${name} 평균`, `평균: 원해상도 유효 ${p.validPixels.toLocaleString()}화소 · 마스크 포함률 ${(p.coverage * 100).toFixed(1)}%`, f);
  }
  function setMode(value) {
    mode = value; clickGeneration++;
    pixelLoading = false; cacheStatus();
    $('#spectrum-panel').dataset.mode = mode;
    for (const b of document.querySelectorAll('#spectrum-mode button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    $('#field-select-wrap').hidden = mode !== 'field';
    if (mode === 'field') {
      const name = $('#field-select').value || selectedPixel?.field?.get('name') || '';
      selectField(name);
    } else drawPixel();
  }
  async function loadTile(index, cfg = reference.spectrum.pixel) {
    const url = cfg.tileTemplate.replace('{tile}', String(index).padStart(3, '0'));
    if (!tileCache.has(url)) {
      const task = (async () => {
        if (!('DecompressionStream' in window)) throw new Error('이 브라우저는 gzip 스펙트럼 읽기를 지원하지 않습니다.');
        const response = await fetch(url);
        if (!response.ok) throw new Error('화소 자료를 읽지 못했습니다.');
        const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
        const bytes = await new Response(stream).arrayBuffer();
        const rows = Math.min(cfg.tileRows, cfg.height - index * cfg.tileRows);
        if (bytes.byteLength !== rows * cfg.width * cfg.channels * 2) throw new Error('화소 자료 길이 오류');
        return {data: new DataView(bytes), rows};
      })().catch(e => {tileCache.delete(url); throw e;});
      tileCache.set(url, task);
      // At most about three round grids remain decoded; never grow with every visited date.
      if (tileCache.size > 64) tileCache.delete(tileCache.keys().next().value);
    }
    return tileCache.get(url);
  }
  async function warmTiles(cfg, seq) {
    const total = Math.ceil(cfg.height/cfg.tileRows);
    let index = 0, complete = 0, failed = false;
    cacheProgress = `자료 준비 0/${total}`; cacheStatus();
    async function worker() {
      while (seq === generation && index < total) {
        const next = index++;
        try {await loadTile(next,cfg);} catch {failed = true;}
        if (seq !== generation) return;
        complete++;
        cacheProgress = complete === total ? failed ? '일부 자료 재시도 필요' : '자료 준비 완료' : `자료 준비 ${complete}/${total}`;
        cacheStatus();
      }
    }
    await Promise.all([worker(),worker()]);
  }
  async function selectPixel(coordinate) {
    const cfg = reference.spectrum.pixel, scale = reference.spectrum.scale;
    const [xmin, ymin, xmax, ymax] = cfg.extent;
    const [x, y] = ol.proj.transform(coordinate, map.getView().getProjection(), cfg.projection);
    const col = Math.floor((x - xmin) / (xmax - xmin) * cfg.width);
    const row = Math.floor((ymax - y) / (ymax - ymin) * cfg.height);
    const seq = ++clickGeneration;
    if (col < 0 || row < 0 || col >= cfg.width || row >= cfg.height) {
      pixelLoading = false; cacheStatus();
      $('#spectrum-message').textContent = '표시 범위 밖입니다. 이전 그래프를 유지합니다.'; return;
    }
    pixelLoading = true;
    cacheStatus();
    try {
      const tile = await loadTile(Math.floor(row / cfg.tileRows));
      if (seq !== clickGeneration) return;
      const localRow = row % cfg.tileRows;
      const get = b => tile.data.getUint16(((b * tile.rows + localRow) * cfg.width + col) * 2, true);
      if (!get(cfg.alphaBand)) { $('#spectrum-message').textContent = '유효 관측 없는 화소입니다. 이전 그래프를 유지합니다.'; return; }
      const center = [xmin + (col + 0.5) / cfg.width * (xmax - xmin), ymax - (row + 0.5) / cfg.height * (ymax - ymin)];
      const coordinate = ol.proj.transform(center, cfg.projection, map.getView().getProjection());
      selectedPixel = {values:Array.from({length:10},(_,b)=>get(b)*scale), coordinate, ...containingField(coordinate), provenance:`${cfg.width} × ${cfg.height} 표시 격자 (${col+1}, ${row+1}) · 최근접 원본 화소 · 영역 평균 아님`};
      pixelLoading = false;
      drawPixel();
    } catch (e) { if (seq === clickGeneration) $('#spectrum-message').textContent = `${e.message} 이전 그래프를 유지합니다.`; }
    finally { if (seq === clickGeneration) {pixelLoading = false; cacheStatus();} }
  }
  async function setObservation(o) {
    const next = getReference(o) ?? o;
    if (key === next?.id && reference) return;
    key = next?.id ?? null; reference = next; clickGeneration++; pixelLoading = false;
    const seq = ++generation;
    boundaries.clear(); marker.clear(); selectedPixel = null; sampleDocument = null; backgroundKey = null;
    cacheProgress = next?.spectrum ? '필지 자료 준비 중' : '표시 영상만 제공'; cacheStatus();
    if (next?.spectrum) void warmTiles(next.spectrum.pixel, seq);
    $('#field-select').innerHTML = '<option value="">필지 선택</option>';
    $('#spectrum-toggle').disabled = !next;
    $('#show-field-distribution').disabled = !next?.spectrum?.fieldSamples;
    const sharedMask = getFieldMask();
    const fieldsUrl = sharedMask?.url ?? next?.spectrum?.fields;
    $('#show-fields').disabled = !fieldsUrl;
    empty(next?.spectrum ? '선택한 화소 없음' : '스펙트럼 자료 없음');
    if (!fieldsUrl) return;
    try {
      const [shared, stats, samples] = await Promise.all([
        loadJson(fieldsUrl),
        next?.spectrum && fieldsUrl !== next.spectrum.fields ? loadJson(next.spectrum.fields).catch(() => null) : null,
        next?.spectrum?.fieldSamples ? loadJson(next.spectrum.fieldSamples.url).catch(() => null) : null,
      ]);
      const doc = structuredClone(shared);
      if (seq !== generation) return;
      sampleDocument = samples;
      $('#show-field-distribution').disabled = !sampleDocument;
      // Boundaries are common; spectral means must still belong to this round.
      if (next?.spectrum && fieldsUrl !== next.spectrum.fields && stats) {
        try {
          if (seq !== generation) return;
          const byName = new Map(stats.features.map(f => [f.properties.name, f]));
          for (const field of doc.features) {
            const dated = byName.get(field.properties.name);
            if (dated && JSON.stringify(dated.geometry) === JSON.stringify(field.geometry))
              field.properties = {...field.properties, ...dated.properties};
          }
        } catch (e) { if (seq === generation) empty(e.message); }
      }
      if (seq !== generation) return;
      const features = new ol.format.GeoJSON().readFeatures(doc, {dataProjection: 'EPSG:4326', featureProjection: map.getView().getProjection()});
      const names = features.map(f => f.get('name'));
      if (new Set(names).size !== names.length) throw new Error('필지 번호 중복: 경계 자료를 확인해 주세요.');
      boundaries.addFeatures(features);
      fields.setVisible($('#show-fields').checked);
      $('#field-select').innerHTML += features.map(f => `<option value="${esc(f.get('name'))}">필지 ${esc(f.get('name'))}</option>`).join('');
      if (selectedPixel && mode === 'pixel') {Object.assign(selectedPixel, containingField(selectedPixel.coordinate));drawPixel();}
    } catch (e) { if (seq === generation) empty(e.message); }
  }
  $('#spectrum-toggle').addEventListener('click', () => open($('#spectrum-panel').hidden));
  $('#spectrum-close').addEventListener('click', () => open(false));
  $('#spectrum-mode').addEventListener('click', e => {const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode);});
  $('#field-select').addEventListener('change', () => selectField($('#field-select').value));
  $('#show-fields').addEventListener('change', () => fields.setVisible($('#show-fields').checked));
  $('#pixel-show-mean').addEventListener('change', drawPixel);
  $('#show-field-distribution').addEventListener('change', () => {
    if (mode === 'field') selectField($('#field-select').value); else drawPixel();
  });
  $('#spectrum-y-scope').addEventListener('click', e => {
    const b = e.target.closest('button[data-scope]');
    if (!b || b.dataset.scope === yScope) return;
    yScope = b.dataset.scope;
    for (const button of document.querySelectorAll('#spectrum-y-scope button')) button.setAttribute('aria-pressed', String(button.dataset.scope === yScope));
    if (mode === 'field') selectField($('#field-select').value);
    else drawPixel();
  });
  map.on('singleclick', async e => {
    if (!reference?.spectrum) {
      open(true);
      empty('이 회차는 표시 영상만 제공됩니다. 10밴드 화소 스펙트럼 자료가 없습니다.');
      return;
    }
    open(true);
    if (mode === 'field') {
      const feature = boundaries.getFeatures().find(f => f.getGeometry().intersectsCoordinate(e.coordinate));
      selectField(feature?.get('name') ?? '');
    } else await selectPixel(e.coordinate);
  });
  new ResizeObserver(() => map.updateSize()).observe($('#map-wrap'));
  let chartWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.floor(entry.contentRect.width);
    if (width === chartWidth) return;
    chartWidth = width;
    if (width <= 0 || !reference?.spectrum) return;
    if (mode === 'field') selectField($('#field-select').value);
    else drawPixel();
  }).observe($('#spectrum-chart'));
  return {setObservation};
}
