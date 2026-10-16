"""드론 현황판 공개본(GIMHAE_DASHBOARD/build/web)을 drone/ 에 복사한다.

    python -I -X utf8 tools/sync_drone.py [공개본 폴더]

복사 전에 경로·좌표·사용자명이 남아 있으면 중단한다(드론 발행 코드의 검사와 별도로 한 번 더).
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
    target.mkdir(exist_ok=True)
    for name in FILES:
        shutil.copyfile(source / name, target / name)
    t = summary['totals']
    print(f'drone/ 갱신: {summary["published_at"]} 발행 · {t["rounds"]}회차 · Photos {t.get("photos_total", t.get("photo_candidates")):,}')


if __name__ == '__main__':
    main()
