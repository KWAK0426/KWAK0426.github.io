"""고친 내용을 GitHub에 올린다: 최신 받기 → 무엇을 바꿨는지 입력 → [PC이름] 붙여 기록 → 올리기.

    python -X utf8 tools/save.py ["바꾼 내용"]

PC 이름은 처음 한 번 물어보고 .pc-name(이 PC에만 있음, git 제외)에 저장한다.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PC_FILE = ROOT / '.pc-name'


def git(*args, check=True):
    print('>', 'git', *args)
    return subprocess.run(['git', *args], cwd=ROOT, check=check)


def pc_name():
    if PC_FILE.is_file() and PC_FILE.read_text(encoding='utf-8').strip():
        return PC_FILE.read_text(encoding='utf-8').strip()
    default = os.environ.get('COMPUTERNAME', 'PC')
    name = input(f'기록에 표시할 이름은? (START_NEW_PC.md 0-0 이름표: 메클·집코·연코 등) [{default}]: ').strip() or default
    PC_FILE.write_text(name, encoding='utf-8')
    return name


def main():
    name = pc_name()
    git('pull', '--rebase', '--autostash')
    status = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8').stdout
    if not status.strip():
        print('바뀐 파일이 없습니다. 최신 상태로 맞췄습니다.')
        return
    print(status)
    message = ' '.join(sys.argv[1:]).strip() or input('무엇을 바꿨나요? (한 줄): ').strip()
    if not message:
        raise SystemExit('내용을 적어야 올립니다. 아무것도 올리지 않았습니다.')
    git('add', '-A')
    git('commit', '-m', f'[{name}] {message}')
    git('push')
    print(f'올렸습니다. 1~2분 뒤 사이트와 업데이트 기록(CHANGELOG.md)에 반영됩니다. 기록 표시: [{name}] {message}')


if __name__ == '__main__':
    main()
