# 새 PC에서 시작하기

새 PC에서 순서대로 따라 하면 됩니다. 명령은 **PowerShell**에 한 블록씩 붙여넣습니다.
Claude Code 또는 Codex로 이어서 작업하려면 맨 아래 **6번 블록**을 통째로 복사해 붙여넣으세요.

---

## 0. 무엇이 어디에 있나

| 무엇 | 위치 | 다른 PC에서 |
|---|---|---|
| 통합 홈 | https://kwak0426.github.io/ · 저장소 `KWAK0426/KWAK0426.github.io` (공개) | 내려받아 고치고 올리기 가능 (2~3번) |
| 업무 게시판 보기·편집 | https://kwak0426.github.io/work-board/ | **설치 없이** 웹에서 편집 (4번) |
| 업무 게시판 앱 원본 | 비공개 저장소 `KWAK0426/work-board-app` (코드만. DB·메일 계정은 메인 PC에만) | 코드는 내려받기 가능. 실행·메일 연동은 메인 PC, 다른 PC는 웹 편집 |
| 드론 관측자료 현황판 원본·조사 기록 | 비공개 저장소 `KWAK0426/gimhae-drone-dashboard` | 내려받아 미리보기·발행 가능. 드라이브 재조사는 외장드라이브가 연결된 PC에서만 |
| 김해 논 모자이크 뷰어 | https://kwak0426.github.io/drone/viewer/ (현황판 회차 칸을 누르면 열림) · 자료는 내 드라이브 `김해논_드론/` | **보기·'GSD 계산하기'는 설치 없이** 웹에서. 매일 05:00 자동 갱신은 메인 PC(메클)에서만 실행 — 다른 PC에 작업을 또 등록하지 않음 (README '회차 칸 → 모자이크 뷰어') |
| 다른 현장 모자이크 뷰어 | https://kwak0426.github.io/mosaic-viewer/ · 저장소 `KWAK0426/mosaic-viewer` | 그 저장소에서 관리 |
| 업데이트 기록 | [CHANGELOG.md](CHANGELOG.md) · 통합 홈 맨 아래 "최근 업데이트" | 어느 PC에서 올려도 자동 기록 |

---

## 0-0. 이름표 (사용자 지정, 2026-10-17)

| 부르는 이름 | 정식 이름 | 도구 | 맡은 일 | 기록 표시 |
|---|---|---|---|---|
| **메클** | 메인 클로드 | Claude Code (메인 PC) | 통합 홈·드론 현황판 코드와 발행 구조, 비공개 백업 | `[메클]` |
| **집코** | 코덱스-집 | Codex (처음 등록된 코덱스) | 공개 사이트·안내 문서 편집 | `[집코]` |
| **연코** | 코덱스-연구실 | Codex (최근 등록된 코덱스) | 드론 데이터 관리 (`codex-drone-data-manager`) | `[연코]` |

- 커밋 제목은 자기 기록 표시로 시작합니다. 각 PC의 `.pc-name`에 부르는 이름(메클·집코·연코)을 적어 두면 `SAVE_AND_PUSH.bat`가 자동으로 붙입니다.
- 이름을 정하기 전 기록(`[메인 PC]`, `[Codex PC]`)은 업데이트 기록에서 위 이름으로 바꿔 표시합니다.
  두 코덱스가 같은 `[Codex PC]`로 기록해 기술적으로는 구분되지 않아, 등록 순서·내용으로 나눴습니다:
  `f9860e0`·`c2bda7b`(01:52~01:53, 편집 PC 등록) = 집코, `a656215`(02:02, 드론 데이터 관리 담당 등록) = 연코.
- 새 에이전트·PC가 생기면 이 표에 한 줄 추가하고 `tools/make_changelog.py`의 `ALIASES`에 예전 이름을 등록합니다.

---

## 0-1. 사용자가 승인한 추가 편집 PC

| 기록 이름 | 사용자 승인일 | 편집 범위 |
|---|---|---|
| 집코 (코덱스-집, 이전 기록 이름 `Codex PC`) | 2026-10-17 | 이 저장소의 공개 사이트와 안내 문서 |

사용자가 이 대화가 실행된 PC의 Codex에서도 편집을 이어갈 수 있도록 준비하고, 승인된 편집 PC라는 사실을 공유하도록 요청했습니다.
2026-10-17 사용자가 이 코덱스(처음 등록된 코덱스)의 이름을 **집코(코덱스-집)**로 정했습니다. 그 PC의 로컬 `.pc-name`은 `집코`로 바꾸고, 변경 기록에는 `[집코]`를 붙입니다. 실제 PC 이름·로컬 경로·인증 정보는 공개하지 않습니다.

이 표는 사용자 승인 사실을 공유하는 기록입니다. 실제 GitHub 쓰기 권한은 로그인 계정의 권한으로 결정됩니다.
이후 변경을 올리기 전 사용자 확인, 새 저장소 생성 전 확인, 공개 범위 변경 전 확인 규칙은 그대로 적용합니다.

---

## 0-2. 협업 담당 에이전트

PC 등록과 담당 에이전트 등록은 별개입니다. 같은 PC에서 여러 채팅·도구를 사용할 수 있습니다.

| 담당 이름 | 등록일 | 담당 범위 |
|---|---|---|
| **연코** (코덱스-연구실) · 드론 데이터 관리 (`codex-drone-data-manager`) | 2026-10-17 | 김해 논 날짜·회차별 자료 현황, 관측 시간과 회차 근거, 패널·타프 ELC/Ed 검증 기록, ROI 확인, Claude Code 인수인계 |

- 이 담당은 기존 드론 데이터 관리 채팅을 이어받아 현황판과 검증 근거를 정리합니다. 새 PC에서는 이 문서를 읽은 뒤 실제 접근 가능한 자료와 최신 저장소 상태부터 확인합니다.
- 로컬 조사·원자료 처리와 공개 사이트 편집은 구분합니다. 이 공개 저장소에는 정제된 드론 현황판과 공개 가능한 설명만 반영합니다.
- 메클(Claude Code)·집코와 같은 파일을 수정할 때는 편집 직전 최신 내용과 변경 상태를 확인하며, 기존 변경·사용자 확정 회차·미확인 상태를 보존합니다.
- 이 등록은 담당 역할을 공유하는 기록이며 자동 실행이나 포괄적인 업로드 승인이 아닙니다. 원자료 이동·삭제·재처리, GitHub 업로드, 새 저장소 생성, 공개 범위 변경은 해당 작업의 사용자 승인 범위에서만 진행합니다.
- 커밋에는 `[연코]` 기록 이름을 사용하고 담당 작업을 설명합니다. 실제 PC 이름·로컬 경로·좌표·인증 정보·비공개 채팅 주소는 게시하지 않습니다.

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
- 개인 PC의 절대 파일 경로, 좌표, 개인 정보를 페이지에 넣지 않기
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
- 업무 게시판: https://kwak0426.github.io/work-board/ — 앱 코드는 비공개 저장소 KWAK0426/work-board-app, DB·메일 계정은 메인 PC에만. 다른 PC는 웹 "이 기기에서 편집하기"로 편집.
- 드론 관측자료 현황판: 원본·조사 기록은 비공개 저장소 KWAK0426/gimhae-drone-dashboard. 사용자 확정은 data/user_confirmed.json, 기준값은 data/expected_snapshot.json, 검사는 scripts/test_paddy_panel_dashboard.py.
- 드론 모자이크 뷰어: 별도 저장소 KWAK0426/mosaic-viewer.

[먼저 할 일]
1. 이 폴더의 README.md, START_NEW_PC.md, CHANGELOG.md를 읽고 지금 상태를 요약해줘.
2. git pull로 최신을 받은 상태인지 확인해줘.
3. gh auth status로 GitHub 로그인이 됐는지 확인해줘. 연결된 GitHub 도구로 작업한다면 그 계정과 이 저장소의 쓰기 권한을 확인해줘.

[지킬 것]
- 이 저장소와 사이트는 공개야. 파일 경로, 좌표, 사용자명, 토큰·비밀번호를 넣지 마.
- 원영상·Photos·TIFF·타일은 올리지 마.
- 드론 자료 표시 규칙: 실제 관측 9개 날짜 44회차, 화면은 날짜마다 6칸(초과 회차만 '없음').
  9/21 3회차 Photos 883개는 사용자 확정, Photos 합계 13,033개(2026-10-18 9/8 재저장 검증 반영: 700·716·724·620장). 근거 없이 바꾸지 마.
- 자료 미확인·접근 오류는 0개나 '없음'이 아니야. 패널/타프 반사도, 회차 대응, 보정 출처는 별도 상태로 구분해.
- 올릴 때는 SAVE_AND_PUSH.bat(또는 python -X utf8 tools/save.py "바꾼 내용")로 [PC이름]이 기록에 남게 해줘.
  연결된 GitHub 도구로 올리는 경우에도 커밋 메시지에 [PC이름]을 붙여줘.
- git push, 새 저장소 생성, 공개 범위 변경은 먼저 나에게 확인받아.

내가 하고 싶은 일: (여기에 적기)
```

