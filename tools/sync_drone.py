"""드론 현황판 공개본(GIMHAE_DASHBOARD/build/web)을 drone/ 에 복사한다.

    python -I -X utf8 tools/sync_drone.py [공개본 폴더]

비공개 정보 및 기존 공개 현황의 누락 여부를 확인한 후 복사한다.
"""
import argparse
import json
import re
import shutil
from pathlib import Path

HUB = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = HUB.parent / 'GIMHAE_DASHBOARD' / 'build' / 'web'
FILES = ['index.html', 'summary.json']
FORBIDDEN = [r'file:', r'\b[A-Za-z]:[\\/]', re.escape(Path.home().name), r'Users[\\/]', r'\b3[3-8]\.\d{4,}', r'\b12[4-9]\.\d{4,}']


def regressions(existing, incoming):
    """잠재적인 이전 현황 복원을 발행 전에 알려준다."""
    new_rows = {(r['date'], r['round']): r for r in incoming['rounds']}
    issues = []
    for old in existing['rounds']:
        key = (old['date'], old['round'])
        new = new_rows.get(key)
        if new is None:
            issues.append(f'{key}: 회차 누락')
            continue
        for name in ('photos', 'additional_photos', 'mosaics'):
            before, after = old.get(name), new.get(name)
            if isinstance(before, int) and before > 0 and (not isinstance(after, int) or after < before):
                issues.append(f'{key}: {name} {before} -> {after}')
        for name in ('dem', 'gps', 'photo_start_kst', 'photo_end_kst'):
            if old.get(name) and not new.get(name):
                issues.append(f'{key}: {name} 누락')
        if old.get('drive') and not new.get('drive'):
            issues.append(f'{key}: Drive 링크 누락')
    if existing.get('additional_datasets') and not incoming.get('additional_datasets'):
        issues.append('다른 피복·장소 자료 누락')
    r1 = new_rows.get(('2026-08-24', 1), {})
    r2 = new_rows.get(('2026-08-24', 2), {})
    if r1.get('photos') == 643 and r2.get('photos') == 643:
        issues.append('2026-08-24: 1·2회차 모두 643장으로 표기됨; 자료 확인 필요')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('source', nargs='?', default=str(DEFAULT_SOURCE))
    source = Path(parser.parse_args().source)
    texts = {}
    for name in FILES:
        path = source / name
        if not path.is_file():
            raise SystemExit(f'중단: {path} 없음. 드론 저장소에서 BUILD_PREVIEW.bat 를 먼저 실행하세요.')
        text = path.read_text(encoding='utf-8')
        for pattern in FORBIDDEN:
            if re.search(pattern, text):
                raise SystemExit(f'중단: {name} 에 비공개 정보 패턴 {pattern!r}. 복사하지 않았습니다.')
        texts[name] = text
    summary = json.loads(texts['summary.json'])
    if summary.get('format') != 'gimhae-drone-summary-v1' or len(summary['rounds']) != summary['totals']['rounds']:
        raise SystemExit('중단: summary.json 형식이 예상과 다릅니다.')
    target = HUB / 'drone'
    previous = target / 'summary.json'
    if previous.is_file():
        try:
            existing = json.loads(previous.read_text(encoding='utf-8'))
            if existing.get('format') != 'gimhae-drone-summary-v1':
                raise ValueError('기존 summary 형식이 다릅니다')
            issues = regressions(existing, summary)
        except (ValueError, KeyError, TypeError) as exc:
            raise SystemExit(f'중단: 기존 현황을 비교할 수 없습니다: {exc}. 복사하지 않았습니다.') from exc
        if issues:
            raise SystemExit('중단: 기존 현황의 누락 또는 과거 값 복원 가능성이 있습니다. 복사하지 않았습니다.\n' + '\n'.join(issues))
    target.mkdir(exist_ok=True)
    for name in FILES:
        shutil.copyfile(source / name, target / name)
    t = summary['totals']
    print(f'drone/ 갱신: {summary["published_at"]} 발행 · {t["rounds"]}회차 · Photos {t.get("photos_total", t.get("photo_candidates")):,}')


if __name__ == '__main__':
    main()
