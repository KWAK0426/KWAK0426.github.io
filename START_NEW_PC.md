# 새 PC에서 시작하기

새 PC에서 순서대로 따라 하면 됩니다. 명령은 **PowerShell**에 한 블록씩 붙여넣습니다.
Claude Code 또는 Codex로 이어서 작업하려면 맨 아래 **6번 블록**을 통째로 복사해 붙여넣으세요.

---

## 0. 무엇이 어디에 있나

| 무엇 | 위치 | 다른 PC에서 |
|---|---|---|
| 통합 홈 | https://kwak0426.github.io/ · 저장소 `KWAK0426/KWAK0426.github.io` (공개) | 내려받아 고치고 올리기 가능 (2~3번) |
| 업무 게시판 보기·편집 | https://kwak0426.github.io/work-board/ | **설치 없이** 웹에서 편집 (4번) |
| 업무 게시판 앱 원본·DB·메일 연동 | **메인 PC에만** 있음 (GitHub에 원본 없음) | 메인 PC에서만 실행. 다른 PC는 웹 편집 |
| 드론 관측자료 현황판 원본·조사 기록 | **메인 PC에만** 있음 (GitHub에 원본 없음) | 메인 PC에서만. 공개본은 통합 홈 `/drone/` |
| 드론 모자이크 뷰어 | https://kwak0426.github.io/mosaic-viewer/ · 저장소 `KWAK0426/mosaic-viewer` | 그 저장소에서 관리 |
| 업데이트 기록 | [CHANGELOG.md](CHANGELOG.md) · 통합 홈 맨 아래 "최근 업데이트" | 어느 PC에서 올려도 자동 기록 |

---

## 0-1. 사용자가 승인한 추가 편집 PC

| 기록 이름 | 사용자 승인일 | 편집 범위 |
|---|---|---|
| Codex PC | 2026-10-17 | 이 저장소의 공개 사이트와 안내 문서 |

사용자가 이 대화가 실행된 PC의 Codex에서도 편집을 이어갈 수 있도록 준비하고, 승인된 편집 PC라는 사실을 공유하도록 요청했습니다.
이 PC의 로컬 `.pc-name`은 `Codex PC`로 설정하며, 변경 기록에는 `[Codex PC]`를 붙입니다. 실제 PC 이름·로컬 경로·인증 정보는 공개하지 않습니다.

이 표는 사용자 승인 사실을 공유하는 기록입니다. 실제 GitHub 쓰기 권한은 로그인 계정의 권한으로 결정됩니다.
이후 변경을 올리기 전 사용자 확인, 새 저장소 생성 전 확인, 공개 범위 변경 전 확인 규칙은 그대로 적용합니다.

---

## 1. 프로그램 설치 (처음 한 번)

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id Python.Python.3.12 -e
```

설치가 끝나면 **PowerShell 창을 닫고 새로 연 뒤** GitHub에 로그인합니다.
(GitHub.com → HTTPS → Login with a web browser 순서로 고르고, 브라우저에서 승인)

```powershell
gh auth login
gh auth setup-git
```

---

## 2. 통합 홈 내려받기

```powershell
cd $HOME\Documents
git clone https://github.com/KWAK0426/KWAK0426.github.io.git
cd KWAK0426.github.io
explorer .
```

---

## 3. 고치고 올리기

1. 파일을 고칩니다. 자주 고치는 곳:
   - `pages.json` — 첫 화면 페이지 카드 (한 항목 추가하면 카드가 생김)
   - `index.html`, `assets/hub.css`, `assets/hub.js` — 화면 구성·디자인
2. 폴더의 **`SAVE_AND_PUSH.bat`** 더블클릭
   - 먼저 다른 PC에서 올린 최신 내용을 받아 옵니다.
   - 처음 한 번 **이 PC 이름**을 묻습니다 (예: `집 노트북`). 기록에 `[집 노트북]`으로 남습니다.
   - "무엇을 바꿨나요?"에 한 줄 적으면 올라갑니다.
3. 1~2분 뒤 사이트와 [업데이트 기록](CHANGELOG.md)에 반영됩니다. 이전 화면이 보이면 `Ctrl+F5`.

- 간단한 글자 수정은 GitHub 웹에서 파일을 열고 연필(✏️) 아이콘으로 고쳐도 됩니다. 기록에는 `GitHub 웹`으로 남습니다.
- **다른 PC에서 고치기 전에** 이 PC 폴더가 오래됐다면 먼저 `SAVE_AND_PUSH.bat`를 한 번 실행(최신 받기)하고 고치는 것이 안전합니다.
- 화면을 올리기 전에 이 PC에서 미리 보려면:

```powershell
python -m http.server 8000
```

  브라우저에서 `http://localhost:8000/` (끄려면 PowerShell에서 `Ctrl+C`)

---

## 4. 업무 게시판 편집 (설치 없음)

1. https://kwak0426.github.io/work-board/ 왼쪽 아래 **✏️ 이 기기에서 편집하기**
2. GitHub 키를 한 번 붙여넣습니다. 키 만들기:
   GitHub › Settings › Developer settings › **Fine-grained tokens** › Generate new token
   - Repository access: **Only select repositories → `KWAK0426/work-board-data`**
   - Permissions: **Contents: Read and write**
3. 고친 내용은 화면에 바로 보이고, 메인 PC의 게시판 앱이 켜져 있을 때 반영됩니다 ("PC 반영 대기 N건").

키는 그 기기 브라우저에만 저장됩니다. **공용 PC에서는 쓰지 마세요.**

---

## 5. 하지 말 것

- 토큰·비밀번호·메일 계정 정보를 파일, 채팅, 저장소에 붙여넣지 않기
- 원영상·Photos·TIFF·모자이크 타일을 이 저장소에 올리지 않기 (이 저장소와 사이트는 **공개**)
- 파일 경로(`C:\…`, `J:\…`), 좌표, 개인 정보를 페이지에 넣지 않기
- `CHANGELOG.md`, `changelog.json`은 자동 생성 파일이라 직접 고치지 않기

---

## 6. Claude Code 또는 Codex에 붙여넣을 시작 메시지

새 PC에서 Claude Code 또는 Codex를 열고, 2번에서 내려받은 `KWAK0426.github.io` 폴더에서 아래를 그대로 붙여넣습니다.

```text
새 PC에서 내 통합 연구 현황 사이트 작업을 이어서 할 거야. 모든 답변은 한국어로 해줘.

[현재 구성]
- 통합 홈: https://kwak0426.github.io/ (저장소 KWAK0426/KWAK0426.github.io, 공개). 정적 HTML·CSS·JS, 프레임워크 없음.
  - 첫 화면 페이지 카드는 pages.json, 일정 요약은 /work-board/data.json과 /work-board/shared.js를 읽음,
    드론 요약은 drone/summary.json(드론 현황판 공개본 복사본).
  - 업데이트 기록은 GitHub Actions가 git 기록으로 CHANGELOG.md·changelog.json을 자동 생성.
- 업무 게시판: https://kwak0426.github.io/work-board/ — 앱 원본·DB는 메인 PC에만 있음. 다른 PC는 웹 "이 기기에서 편집하기"로 편집.
- 드론 관측자료 현황판: 원본·조사 기록은 메인 PC에만 있음. 이 PC에서는 drone/ 공개본만 다룸.
- 드론 모자이크 뷰어: 별도 저장소 KWAK0426/mosaic-viewer.

[먼저 할 일]
1. 이 폴더의 README.md, START_NEW_PC.md, CHANGELOG.md를 읽고 지금 상태를 요약해줘.
2. git pull로 최신을 받은 상태인지 확인해줘.
3. gh auth status로 GitHub 로그인이 됐는지 확인해줘. 연결된 GitHub 도구로 작업한다면 그 계정과 이 저장소의 쓰기 권한을 확인해줘.

[지킬 것]
- 이 저장소와 사이트는 공개야. 파일 경로, 좌표, 사용자명, 토큰·비밀번호를 넣지 마.
- 원영상·Photos·TIFF·타일은 올리지 마.
- 드론 자료 표시 규칙: 실제 관측 9개 날짜 44회차, 화면은 날짜마다 6칸(초과 회차만 '없음').
  9/21 3회차 Photos 883개는 사용자 확정, Photos 후보 합계 11,756개. 근거 없이 바꾸지 마.
- 자료 미확인·접근 오류는 0개나 '없음'이 아니야. 패널/타프 반사도, 회차 대응, 보정 출처는 별도 상태로 구분해.
- 올릴 때는 SAVE_AND_PUSH.bat(또는 python -X utf8 tools/save.py "바꾼 내용")로 [PC이름]이 기록에 남게 해줘.
  연결된 GitHub 도구로 올리는 경우에도 커밋 메시지에 [PC이름]을 붙여줘.
- git push, 새 저장소 생성, 공개 범위 변경은 먼저 나에게 확인받아.

내가 하고 싶은 일: (여기에 적기)
```
