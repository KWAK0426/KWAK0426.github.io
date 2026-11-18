// 공개 뷰어 목록에 등록된 김해 논 영상만 날짜와 회차에 연결한다.
async function connectMosaicViewer() {
  const cards = [...document.querySelectorAll('.date-card[data-date]')]
    .filter((card) => (card.dataset.cover || 'farmland') === 'farmland');
  let observations;
  try {
    const response = await fetch('viewer/catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.observations)) throw new Error('invalid catalog');
    observations = catalog.observations;
  } catch (error) {
    console.warn('모자이크 목록 확인 실패:', error);
    observations = null;
  }
  const labels = { RGB: 'RGB', RE: '다분광', NDVI: 'NDVI' };
  for (const card of cards) {
    for (const row of card.querySelectorAll('.round-row:not(.nonexistent)')) {
      const n = Number(row.querySelector('summary .round')?.textContent.match(/\d+/)?.[0]);
      const verification = row.querySelector('summary .verification');
      const detail = row.querySelector(':scope > .row-detail');
      if (!n || !verification || !detail) continue;
      const kinds = observations && Object.keys(labels).filter((kind) => observations.some((o) =>
        o.project === 'gimhae-paddy' && o.date === card.dataset.date && o.round === n && o.kind === kind));
      const status = document.createElement('span');
      status.textContent = !observations ? '모자이크 뷰어: 목록 확인 불가' : kinds.length ? '모자이크 뷰어: ' + kinds.map((k) => labels[k]).join(' · ') : '모자이크 뷰어: 미등록';
      verification.append(status);
      if (!kinds?.length) continue;
      const links = document.createElement('p');
      links.append('모자이크 뷰어: ');
      for (const [i, kind] of kinds.entries()) {
        if (i) links.append(' · ');
        const link = document.createElement('a');
        const params = new URLSearchParams({ date: card.dataset.date, round: String(n), kind });
        link.href = `viewer/?${params}`;
        link.textContent = labels[kind] + ' 보기 ↗';
        links.append(link);
      }
      detail.prepend(links);
    }
  }
}
connectMosaicViewer();
