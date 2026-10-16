// 연구 현황 통합 페이지: 업무 게시판(data.json)과 드론 현황판(summary.json)을 읽어 요약한다.
// 두 자료는 따로 불러오며, 하나가 실패해도 다른 쪽은 그대로 보여 준다.

const LIVE_HOST = 'kwak0426.github.io';
const BASE = location.hostname === LIVE_HOST ? '' : 'https://kwak0426.github.io';
const BOARD = `${BASE}/work-board/`;
const DRONE = 'drone/';
const HORIZON_DAYS = 14;
const STALE_DAYS = 7;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const EVENT_KIND = { trip: '출장', conference: '학회·행사', meeting: '회의', personal: '개인', other: '기타' };
const DRONE_STATE = { complete: '3종 있음', partial: '일부 있음', empty: '자료 미확인' };
const TIME_STATES = [
  ['기존 기록 확정', '기존 기록 확정', '--t1'],
  ['기존 기록 · 회차 대응 재확인', '회차 대응 재확인', '--t2'],
  ['원영상 표본 · UTC 가정', '원영상 표본 (UTC 가정)', '--t3'],
  ['시간 미확인', '시간 미확인', '--t4'],
];

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => Number(n).toLocaleString('ko-KR');
const kstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const dayMs = (d) => Date.parse(d + 'T00:00:00Z');
const diffDays = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 86400000);
const addDays = (d, n) => new Date(dayMs(d) + n * 86400000).toISOString().slice(0, 10);
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const weekday = (d) => WEEK[new Date(dayMs(d)).getUTCDay()];
const stamp = (iso) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return String(iso ?? '');
  const p = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(t);
  const g = (k) => p.find((x) => x.type === k)?.value;
  return `${g('month')}/${g('day')} ${g('hour')}:${g('minute')}`;
};
const ddayText = (left) => (left === 0 ? '오늘' : left > 0 ? `D-${left}` : `${-left}일 지남`);

const today = kstToday();
const state = { board: null, drone: null };

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// ---- 일정·업무 ---------------------------------------------------------------
async function loadBoard() {
  const [site, rules] = await Promise.all([getJson(BOARD + 'data.json'), import(BOARD + 'shared.js')]);
  const t0 = rules.todayKst();
  const tasks = (site.tasks ?? []).map((t) => ({ ...t, derived: rules.derive(t, t.latest_review ?? null, t0) }));
  const active = tasks.filter((t) => rules.ACTIVE_STATUSES.includes(t.status));
  const until = addDays(t0, HORIZON_DAYS);
  const items = [];
  for (const e of site.events ?? []) {
    const start = e.start_date ?? e.date;
    const end = e.end_date ?? start;
    if (!start || end < t0 || start > until) continue;
    const ongoing = start < t0;
    items.push({ date: ongoing ? t0 : start, title: e.title, tag: EVENT_KIND[e.kind] ?? '일정', task: false,
      meta: [ongoing || end !== start ? `${md(start)}~${md(end)}` : '', e.all_day ? '' : e.start_time, e.location].filter(Boolean).join(' · ') });
  }
  const projects = new Map((site.projects ?? []).map((p) => [p.id, p]));
  for (const t of active) {
    const due = t.derived.effective_due;
    if (!due || due.date > until) continue;
    items.push({ date: due.date, title: t.title, tag: due.label, task: true,
      meta: [t.task_code, projects.get(t.project_id)?.title, rules.STATUS[t.status]].filter(Boolean).join(' · ') });
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.task - b.task));
  return {
    site, rules, items,
    owner: site.owner_name,
    generated: site.generated_at,
    active: active.length,
    inProgress: active.filter((t) => t.status === 'in_progress').length,
    overdue: active.filter((t) => t.derived.due_flag === 'overdue').length,
    soon: active.filter((t) => t.derived.due_flag === 'upcoming').length,
    unseenMail: (site.mails ?? []).filter((m) => !m.hidden && !m.seen).length,
    projects: (site.projects ?? []).filter((p) => p.status === 'active'),
    events: site.events ?? [],
  };
}

function renderBoard(b) {
  $('#board-link').href = BOARD;
  $('#board-tiles').innerHTML = [
    tile('진행 중 업무', b.active, '건', `작업 중 ${b.inProgress}건`),
    tile('기한 경과', b.overdue, '건', '내 마감·확인된 기한 기준', b.overdue ? 'alert' : ''),
    tile(`${b.rules.UPCOMING_DAYS}일 안 마감`, b.soon, '건', '진행 중 업무', b.soon ? 'soon' : ''),
    tile('확인 안 한 메일', b.unseenMail, '건', '게시된 목록 기준'),
  ].join('');
  $('#agenda').innerHTML = b.items.length
    ? b.items.slice(0, 8).map((it) => {
      const left = diffDays(today, it.date);
      return `<li><div class="when"><b>${md(it.date)}</b><span>${weekday(it.date)}요일</span></div>
        <div class="what"><div class="title">${esc(it.title)}</div><div class="meta"><span class="tag ${it.task ? 'task' : ''}">${esc(it.tag)}</span>${esc(it.meta)}</div></div>
        <span class="dday ${left === 0 ? 'today' : left < 0 ? 'late' : ''}">${ddayText(left)}</span></li>`;
    }).join('') + (b.items.length > 8 ? `<li class="empty"><a href="${BOARD}#/calendar">${b.items.length - 8}건 더 보기</a></li>` : '')
    : `<li class="empty"><b>${HORIZON_DAYS}일 안에 등록된 일정·마감이 없습니다</b>업무 게시판에서 일정을 게시하면 여기에 함께 표시됩니다.</li>`;
  $('#projects').innerHTML = b.projects.map((p) => `<span class="chip"><b>${esc(p.code ?? '')}</b>${esc(p.title)}</span>`).join('');
}

// ---- 드론 데이터 ---------------------------------------------------------------
// 현황판 아래 모자이크 뷰어(drone/viewer/catalog.json)에서 김해 논 회차 항목을 찾는다: project "gimhae-paddy" + date + round
// 광학(RGB)·다분광(RE) 중 하나라도 있으면 그 칸을 누를 수 있다. PC가 매일 05:00 Drive를 확인해 목록을 갱신한다.
const MOSAIC = `${DRONE}viewer/`;
async function loadMosaics() {
  try {
    const catalog = await getJson(MOSAIC + 'catalog.json');
    const map = new Map();
    for (const o of catalog.observations ?? []) {
      if (o.project === 'gimhae-paddy' && o.date && Number.isInteger(o.round)) {
        const key = `${o.date}#${o.round}`;
        map.set(key, [...(map.get(key) ?? []), o]);
      }
    }
    return map;
  } catch (e) {
    console.warn('모자이크 뷰어 목록을 읽지 못함', e);
    return null;
  }
}
const mosaicUrl = (o) => `${MOSAIC}?date=${o.date}&round=${o.round}&kind=${o.kind ?? 'RGB'}`;

async function loadDrone() {
  const s = await getJson(DRONE + 'summary.json');
  s.mosaics = await loadMosaics();
  if (s.format !== 'gimhae-drone-summary-v1') throw new Error('알 수 없는 요약 형식');
  return s;
}

function renderDrone(s) {
  const t = s.totals;
  const drive = s.drive.entries ? `${s.drive.confirmed}/${s.drive.entries}` : '업로드 전';
  $('#drone-tiles').innerHTML = [
    tile('관측 회차', t.rounds, '회차', `${s.dates.length}개 날짜 · 사용자 확정`, 'hero-tile'),
    tile('Photos', num(t.photos_total ?? t.photo_candidates), '장', '회차 기준 폴더 · 보정 완료 수량 아님'),
    tile('구글 드라이브', drive, '', 'DEM·모자이크·GPS·분석 결과', '', !s.drive.entries),
  ].join('');
  const STATUS_PARTS = [['complete', '3종 있음', 'Photos·DEM·GPS'], ['partial', '일부 있음', '누락 자료 확인'], ['empty', '자료 미확인', '0개·없음 아님']];
  $('#status-total').textContent = `패널 반사도 기준 · ${t.rounds}회차`;
  $('#status-meter').innerHTML = `<div class="meter" role="img" aria-label="${STATUS_PARTS.map(([k, l]) => `${l} ${t[k]}회차`).join(', ')}">`
    + STATUS_PARTS.filter(([k]) => t[k]).map(([k]) => `<i style="flex:${t[k]};background:var(--st-${k})"></i>`).join('')
    + '</div><div class="meter-legend three">'
    + STATUS_PARTS.map(([k, l, sub]) => `<span><i style="background:var(--st-${k})"></i>${l}<small>${sub}</small><b>${t[k]}</b></span>`).join('') + '</div>';

  renderMatrix(s, 'panel');
  document.querySelectorAll('#ref-switch button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#ref-switch button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    hideTip();
    renderMatrix(s, b.dataset.mode);
  }));

  const total = TIME_STATES.reduce((n, [k]) => n + (s.time_counts[k] ?? 0), 0);
  $('#time-total').textContent = `${total}회차`;
  $('#time-meter').outerHTML = `<div class="meter" id="time-meter" role="img" aria-label="관측 시간 근거 ${TIME_STATES.map(([k, l]) => `${l} ${s.time_counts[k] ?? 0}회차`).join(', ')}">`
    + TIME_STATES.filter(([k]) => s.time_counts[k]).map(([k, , c]) => `<i style="flex:${s.time_counts[k]};background:var(${c})"></i>`).join('')
    + '</div><div class="meter-legend">'
    + TIME_STATES.map(([k, l, c]) => `<span><i style="background:var(${c})"></i>${l}<b>${s.time_counts[k] ?? 0}</b></span>`).join('') + '</div>';
  $('#drone-notes').innerHTML = s.notes.map((n) => `<li>${esc(n)}</li>`).join('');
}

// ---- 회차 행렬: 패널/타프 반사도 전환. 회차 구성(1~6차, 초과 칸 없음)은 두 모드가 같다 ----
const MODE_CAP = {
  panel: '패널 반사도 Photos 기준 · 칸 숫자 = Photos 수',
  tarp: '타프 반사도 Photos 기준 · 옛 기록(9/30·10/6) · 드라이브 재조사 전',
};
const TARP_STATE = { present: '타프 Photos 있음', notmade: '미생성 (확인됨)', unknown: '미확인' };
const MODE_LEGEND = {
  panel: [['var(--st-complete)', '3종 있음'], ['var(--st-partial)', '일부 있음'], ['var(--st-empty)', '자료 미확인']],
  tarp: [['var(--drone)', '타프 Photos 있음'], ['outline', '미생성 (확인됨)'], ['var(--st-empty)', '미확인']],
};
const srcLabel = (k) => (k ? ` (${+k.slice(0, 2)}/${+k.slice(2)} 기록)` : '');

function cellFor(r, mode) {
  if (mode === 'panel') {
    const partialRead = r.photo_label.startsWith('일부 읽기');
    return {
      cls: r.state, flag: partialRead, sel: false, tip: roundTip(r),
      text: partialRead ? '일부' : r.photos ? num(r.photos) : r.state === 'empty' ? '미확인' : '—',
      label: `패널 · ${DRONE_STATE[r.state]} · Photos ${r.photo_label} · DEM ${r.dem ? '있음' : '미발견'} · GPS ${r.gps ? '있음' : '미발견'} · 관측 ${r.time_label}`,
    };
  }
  const t = r.tarp;
  return {
    cls: { present: 'tarp-present', notmade: 'notmade', unknown: 'empty' }[t.state], flag: false, sel: t.selection > 0, tip: tarpTip(r),
    text: t.state === 'present' ? num(t.photos) : t.state === 'notmade' ? '미생성' : '미확인',
    label: `타프 · ${TARP_STATE[t.state]}${t.selection ? ` · 선정 기록 ${t.selection}개` : ''}`,
  };
}

function tarpTip(r) {
  const t = r.tarp;
  const lines = [t.state === 'unknown' ? '타프 Photos: 미확인 · 기록 없음 (0개 아님)' : `타프 Photos: ${num(t.photos)}장${srcLabel(t.photos_source)}`];
  if (t.elc_images_total) lines.push(`참고 · 타프 ELC 영상 ${num(t.elc_images_done)} / ${num(t.elc_images_total)}장${srcLabel(t.elc_source)}`);
  if (t.selection) lines.push(`타프 선정 기록 ${t.selection}개${srcLabel(t.selection_source)}`);
  if (t.note) lines.push(t.note);
  return `<b>${md(r.date)} ${r.round}차 · 타프 반사도</b>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}`;
}

function renderMatrix(s, mode) {
  const byKey = new Map(s.rounds.map((r) => [`${r.date}#${r.round}`, r]));
  const cells = ['<div class="mx-h"></div>', ...[1, 2, 3, 4, 5, 6].map((n) => `<div class="mx-h">${n}차</div>`)];
  for (const date of s.dates) {
    const count = s.fixed_round_counts[date];
    cells.push(`<div class="mx-date">${md(date)}<small>${count}회차</small></div>`);
    for (let n = 1; n <= 6; n++) {
      const r = byKey.get(`${date}#${n}`);
      if (!r) { cells.push(`<div class="cell none" aria-label="${md(date)} ${n}차: 회차 없음">없음</div>`); continue; }
      const c = cellFor(r, mode);
      const mosaics = s.mosaics?.get(`${date}#${n}`) ?? [];
      c.tip += mosaicTipLine(mosaics, s.mosaics);
      if (mosaics.length) c.cls += ' has-mosaic';
      cells.push(`<button type="button" class="cell ${c.cls}" data-key="${date}#${n}" aria-label="${esc(`${md(date)} ${n}차 · ${c.label}${mosaics.length ? ' · 누르면 모자이크 뷰어 열림' : ''}`)}">${esc(c.text)}`
        + `${c.flag ? '<span class="flag" aria-hidden="true"></span>' : ''}${c.sel ? '<span class="sel" aria-hidden="true"></span>' : ''}${mosaics.length ? '<span class="mz" aria-hidden="true">◩</span>' : ''}</button>`);
    }
  }
  const mx = $('#matrix');
  mx.innerHTML = cells.join('');
  mx.querySelectorAll('button.cell').forEach((el) => {
    const r = byKey.get(el.dataset.key);
    const mosaics = s.mosaics?.get(el.dataset.key) ?? [];
    const show = () => showTip(el, cellFor(r, mode).tip + mosaicTipLine(mosaics, s.mosaics));
    el.addEventListener('pointerenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('blur', hideTip);
    if (mosaics.length) el.addEventListener('click', () => { location.href = mosaicUrl(mosaics.find((o) => o.kind === 'RGB') ?? mosaics[0]); });
    else el.classList.add('no-link');
  });
  $('#mode-cap').textContent = MODE_CAP[mode];
  $('#matrix-legend').innerHTML = MODE_LEGEND[mode].map(([c, l]) => `<span><i ${c === 'outline' ? 'class="outline"' : `style="background:${c}"`}></i>${l}</span>`).join('')
    + '<span><i class="cell none" style="height:11px;border-radius:3px"></i>회차 없음</span>'
    + `<span><b class="mz-key" aria-hidden="true">◩</b>모자이크 뷰어 있음 · 누르면 열림${s.mosaics && !s.mosaics.size ? ' (아직 등록된 회차 없음)' : ''}</span>`
    + (mode === 'panel'
      ? '<span><i style="background:var(--bad);border-radius:50%;width:7px;height:7px"></i>접근 오류 · 일부만 읽힘</span>'
      : '<span><i style="background:var(--drone);width:7px;height:7px;border-radius:2px"></i>타프 선정 기록 있음</span>');
}

function mosaicTipLine(list, all) {
  if (all === null) return '<span>모자이크 뷰어 목록을 읽지 못함</span>';
  if (!list.length) return '<span>모자이크 뷰어: 미등록</span>';
  const kinds = ['RGB', 'RE'].filter((k) => list.some((o) => o.kind === k)).map((k) => ({ RGB: '광학', RE: '다분광' })[k]);
  return `<span>◩ 누르면 모자이크 뷰어로 이동 (${kinds.join('·') || '모자이크'})</span>`;
}

function roundTip(r) {
  const lines = [
    `Photos ${r.photo_label}${r.additional_photos ? ` (+ 하위 ${num(r.additional_photos)})` : ''}`,
    `DEM ${r.dem ? '있음' : '미발견'} · GPS ${r.gps ? '있음' : '미발견'} · 모자이크 후보 ${r.mosaics}`,
    `관측 ${r.time_label} · ${r.time_status}`,
    `패널 보정 출처: ${r.calibration_status}`,
  ];
  if (r.drive?.length) lines.push(`드라이브: ${r.drive.map((d) => `${d.role} ${d.status}`).join(', ')}`);
  return `<b>${md(r.date)} ${r.round}차 · ${DRONE_STATE[r.state]}</b>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}`;
}

// ---- 공통 표시 ---------------------------------------------------------------
function tile(label, value, unit, sub, cls = '', textValue = false) {
  return `<div class="tile ${cls}"><div class="label">${label}</div><div class="value${textValue ? ' text' : ''}">${value}${unit ? `<small>${unit}</small>` : ''}</div><div class="sub">${esc(sub)}</div></div>`;
}

const tip = $('#tip');
function showTip(el, htmlText) {
  tip.innerHTML = htmlText;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  const y = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
function hideTip() { tip.hidden = true; }
addEventListener('scroll', hideTip, { passive: true });

function failCard(where, what, err) {
  console.error(what, err);
  $(where).innerHTML = `<div class="error">${esc(what)}을(를) 불러오지 못했습니다. 잠시 후 새로고침해 주세요. 0건으로 간주하지 않습니다.</div>`;
}

function renderHero() {
  const parts = [];
  const b = state.board, s = state.drone;
  if (b) {
    parts.push(`진행 중 업무 <b>${b.active}건</b>${b.overdue ? `, 기한 경과 <b>${b.overdue}건</b>` : ''}`);
    const week = b.items.filter((it) => !it.task && diffDays(today, it.date) <= 7).length;
    parts.push(`이번 주 일정 <b>${week}건</b>`);
  }
  if (s) parts.push(`드론 관측 <b>${s.totals.rounds}회차</b> 중 3종 자료 <b>${s.totals.complete}회차</b>`);
  $('#hero-sum').innerHTML = parts.length ? parts.join(' · ') + '.' : '현황 자료를 불러오지 못했습니다.';
  if (b?.owner) {
    $('#owner').textContent = `${b.owner} · 연구 현황`;
    document.title = `${b.owner} · 연구 현황`;
  }
  const chip = (name, iso, verb, ok) => {
    if (!ok) return `<span class="chip err"><i></i>${name} · 불러오기 실패</span>`;
    const age = diffDays(new Date(iso).toISOString().slice(0, 10), today);
    return `<span class="chip ${age > STALE_DAYS ? 'stale' : ''}"><i></i>${name} · ${stamp(iso)} ${verb}${age > STALE_DAYS ? ` · ${age}일 전` : ''}</span>`;
  };
  $('#sources').innerHTML = chip('업무 게시판', b?.generated, '게시', !!b) + chip('드론 현황판', s?.published_at_iso, '발행', !!s);
}

// ---- 타임라인 ---------------------------------------------------------------
function renderTimeline() {
  const s = state.drone, b = state.board;
  const droneDates = s ? s.dates.map((d) => ({ date: d, n: s.fixed_round_counts[d] })) : [];
  const events = (b?.events ?? []).map((e) => ({ date: e.start_date ?? e.date, title: e.title, kind: EVENT_KIND[e.kind] ?? '일정' })).filter((e) => e.date);
  const all = [...droneDates.map((x) => x.date), ...events.map((x) => x.date), today];
  const first = all.reduce((a, c) => (c < a ? c : a)).slice(0, 7) + '-01';
  const lastDay = all.reduce((a, c) => (c > a ? c : a), addDays(today, 45));
  const end = addDays(addDays(lastDay.slice(0, 7) + '-01', 32).slice(0, 7) + '-01', -1);
  const span = diffDays(first, end);
  const pos = (d) => (diffDays(first, d) / span) * 100;
  const out = ['<div class="tl-axis"></div>'];
  for (let m = first; m <= end; m = addDays(m, 32).slice(0, 7) + '-01') {
    out.push(`<div class="tl-tick" style="left:${pos(m)}%"></div><div class="tl-month" style="left:${pos(addDays(m, 14))}%">${+m.slice(5, 7)}월</div>`);
  }
  out.push(`<div class="tl-today" style="left:${pos(today)}%"><span>오늘</span></div>`);
  let prev = -100, level = 0;
  for (const x of droneDates) {
    const p = pos(x.date);
    level = p - prev < 4 ? 1 - level : 0;
    prev = p;
    out.push(`<div class="tl-pin drone" style="left:${p}%;--n:${x.n};--lv:${level}" data-tip="${esc(`<b>${md(x.date)} 드론 관측</b><span>${x.n}회차</span>`)}" tabindex="0"><b>${md(x.date)}</b><i></i></div>`);
  }
  prev = -100; level = 0;
  for (const e of events) {
    const p = pos(e.date);
    level = p - prev < 6 ? 1 - level : 0;
    prev = p;
    out.push(`<div class="tl-pin event" style="left:${p}%;top:${level ? 112 : 102}px" data-tip="${esc(`<b>${md(e.date)} ${esc(e.title)}</b><span>${esc(e.kind)}</span>`)}" tabindex="0"><i></i></div>`);
  }
  const tl = $('#tl');
  tl.classList.toggle('no-events', !events.length);
  tl.innerHTML = out.join('');
  tl.querySelectorAll('[data-tip]').forEach((el) => {
    const show = () => showTip(el, el.dataset.tip);
    el.addEventListener('pointerenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('blur', hideTip);
  });
  $('#timeline-legend').innerHTML = '<span><i style="background:var(--drone);border-radius:50%"></i>드론 관측일 (크기 = 회차 수)</span>'
    + (events.length ? '<span><i style="background:var(--accent)"></i>게시판 일정</span>' : '<span class="muted">게시판 일정 없음</span>');
}

function renderLinks() {
  const links = [
    ['board', '☑', '오늘 할 일', '업무 게시판 · 오늘', `${BOARD}#/today`],
    ['board', '▦', '달력', '업무 게시판 · 일정·마감', `${BOARD}#/calendar`],
    ['board', '≡', '전체 업무', '업무 게시판 · 진행 상태', `${BOARD}#/tasks`],
    ['board', '✉', '받은 메일', '업무 게시판 · 회신 상태', `${BOARD}#/mail`],
    ['drone', '◫', '드론 관측자료 현황판', '날짜·회차별 상세 (공개본)', DRONE],
    ['drone', '{ }', '드론 요약 자료', 'summary.json · 경로·좌표 없음', DRONE + 'summary.json'],
  ];
  $('#links').innerHTML = links.map(([k, ic, t, s, href]) => `<a class="link-card ${k}" href="${href}"><span class="ic" aria-hidden="true">${ic}</span><b>${t}</b><span>${s}</span></a>`).join('');
}

async function renderPages() {
  const { pages } = await getJson('pages.json');
  const url = (href) => (href.startsWith('/') && href !== '/drone/' ? BASE + href : href.startsWith('/') ? '.' + href : href);
  $('#pages').innerHTML = pages.map((p) => `<a class="page-card ${esc(p.color ?? 'gray')}" href="${esc(url(p.href))}">
    <span class="ic" aria-hidden="true">${esc(p.icon ?? '→')}</span><span><b>${esc(p.title)}</b><span class="d">${esc(p.desc ?? '')}</span></span><span class="go" aria-hidden="true">→</span></a>`).join('');
}

async function renderUpdates() {
  const { entries } = await getJson('changelog.json');
  $('#updates-list').innerHTML = entries.slice(0, 6).map((e) => `<li><time datetime="${esc(e.time)}">${md(e.date)} (${esc(e.weekday)}) ${esc(e.time.slice(11))}</time>`
    + `<span class="pc ${e.pc === 'GitHub 웹' || e.pc === '이전 기록' ? 'web' : ''}">${esc(e.pc)}</span><span class="t" title="${esc(e.title)}">${esc(e.title)}</span></li>`).join('');
}

// ---- 시작 ---------------------------------------------------------------
renderLinks();
renderPages().catch((e) => { console.error(e); $('#pages').hidden = true; });
renderUpdates().catch(() => { $('#updates-list').innerHTML = '<li class="muted small">업데이트 기록이 아직 없습니다. 첫 업로드 후 1~2분 뒤 표시됩니다.</li>'; });
$('#today-date').textContent = `${today.slice(0, 4)}년 ${+today.slice(5, 7)}월 ${+today.slice(8, 10)}일 ${weekday(today)}요일`;
$('#theme-btn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('hub-theme', next); } catch (e) { /* 저장 불가해도 화면은 바뀜 */ }
});

const [board, drone] = await Promise.allSettled([loadBoard(), loadDrone()]);
if (board.status === 'fulfilled') { state.board = board.value; renderBoard(state.board); } else { failCard('#board-tiles', '업무 게시판 자료', board.reason); $('#agenda').innerHTML = ''; }
if (drone.status === 'fulfilled') { state.drone = drone.value; renderDrone(state.drone); } else { failCard('#drone-tiles', '드론 현황 요약', drone.reason); }
renderHero();
renderTimeline();
