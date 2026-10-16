"""git 기록으로 업데이트 기록(CHANGELOG.md, changelog.json)을 만든다.

GitHub Actions가 push 때마다 실행한다(.github/workflows/changelog.yml).
커밋 제목의 [PC이름] 머리말로 어느 PC에서 고쳤는지 표시하고, GitHub 웹에서 고친 것은 'GitHub 웹'으로 표시한다.
"""
import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KST = timezone(timedelta(hours=9), 'KST')
SKIP = ('업데이트 기록 갱신',)
# 기록 이름을 바꾼 PC·담당: 예전 이름으로 남은 커밋도 새 이름으로 표시 (START_NEW_PC.md 0-0 이름표)
ALIASES = {'메인 PC': '메클', '코덱스-집': '집코', '코덱스-연구실': '연코'}
# 같은 예전 이름([Codex PC])을 두 에이전트가 썼던 커밋은 커밋별로 지정
ALIASES_BY_COMMIT = {'f9860e0': '집코', 'c2bda7b': '집코', 'a656215': '연코'}
GENERATED = {'CHANGELOG.md', 'changelog.json'}
WEEK = '월화수목금토일'


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout


def entries():
    out = git('log', '--no-merges', '--format=%H%x1f%aI%x1f%cn%x1f%s%x1e')
    for rec in out.split('\x1e'):
        if not rec.strip():
            continue
        sha, when, committer, subject = rec.strip().split('\x1f')
        if subject.startswith(SKIP):
            continue
        m = re.match(r'^\[([^\]]+)\]\s*(.*)$', subject)
        place, title = (m[1], m[2]) if m else ('GitHub 웹' if committer == 'GitHub' else '이전 기록', subject)
        place = ALIASES_BY_COMMIT.get(sha[:7]) or ALIASES.get(place, place)
        files = [f for f in git('show', '--format=', '--name-only', sha).split('\n') if f and f not in GENERATED]
        t = datetime.fromisoformat(when).astimezone(KST)
        yield {'sha': sha[:7], 'time': t.strftime('%Y-%m-%d %H:%M'), 'date': t.strftime('%Y-%m-%d'),
               'weekday': WEEK[t.weekday()], 'pc': place, 'title': title, 'files': files}


def main():
    items = list(entries())
    md = ['# 업데이트 기록', '',
          '어느 PC에서 고쳤든 GitHub에 올라온 변경을 최신순으로 정리한다. GitHub Actions가 자동으로 만든다(직접 고치지 않는다).', '',
          '| 표시 | 뜻 |', '|---|---|', '| `[PC이름]` | 그 PC에서 `SAVE_AND_PUSH.bat`·`UPDATE_DRONE.bat`로 올림 |',
          '| GitHub 웹 | github.com에서 연필 아이콘으로 직접 고침 |', '| 이전 기록 | 기록 규칙 전 커밋 |', '']
    day = None
    for e in items:
        if e['date'] != day:
            day = e['date']
            md += ['', f'## {day} ({e["weekday"]})', '']
        files = ', '.join(f'`{f}`' for f in e['files'][:6]) + (f' 외 {len(e["files"]) - 6}개' if len(e['files']) > 6 else '')
        md.append(f'- **{e["time"][11:]}** · {e["pc"]} · {e["title"]}' + (f'  \n  {files}' if files else '') + f' ({e["sha"]})')
    (ROOT / 'CHANGELOG.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    (ROOT / 'changelog.json').write_text(json.dumps({'format': 'hub-changelog-v1', 'entries': items[:30]}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(items)}건')


if __name__ == '__main__':
    main()
