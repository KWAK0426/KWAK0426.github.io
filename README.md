# 연구 현황 통합 페이지

`https://kwak0426.github.io/` — 일정·업무와 드론 관측자료 처리 현황을 한 화면에서 본다.

| 경로 | 내용 | 자료 |
|---|---|---|
| `/` | 통합 요약 (이 저장소) | 아래 두 자료를 브라우저에서 읽어 요약 |
| `/work-board/` | 업무 게시판 (별도 저장소 `work-board`) | `work-board/data.json` · 게시판 앱이 게시 |
| `/drone/` | 김해 논 드론 관측자료 현황판 공개본 | `drone/summary.json` · 이 저장소에 복사 |
| `/mosaic-viewer/` | 드론 모자이크 뷰어 (별도 저장소 `mosaic-viewer`) | 그 저장소에서 관리 |

**새 PC에서 시작:** [START_NEW_PC.md](START_NEW_PC.md) · **업데이트 기록:** [CHANGELOG.md](CHANGELOG.md) (어느 PC·GitHub 웹에서 고쳐도 자동 기록)

## 고치고 올리기

파일을 고친 뒤 `SAVE_AND_PUSH.bat` → 최신 받기, 바꾼 내용 한 줄 입력, `[PC이름]`을 붙여 올림.
GitHub Actions(`.github/workflows/changelog.yml`)가 git 기록으로 `CHANGELOG.md`·`changelog.json`을 다시 만들고, 통합 홈 맨 아래 "최근 업데이트"에 표시된다.

## 페이지 추가

첫 화면의 페이지 카드는 `pages.json`에서 관리한다. 항목 하나(제목·설명·주소·아이콘·색)를 넣으면 카드가 생긴다. GitHub 웹에서 연필 아이콘으로 바로 고칠 수 있다.

## 회차 칸 → 모자이크 뷰어

통합 홈의 "날짜 · 회차별 자료" 칸을 누르면 그 회차의 모자이크 뷰어(`/mosaic-viewer/?observation=<id>`)가 열린다.
모자이크 뷰어 `catalog.json`의 항목에 `"project": "gimhae-paddy"`, `"date": "YYYY-MM-DD"`, `"round": 회차번호`가 있으면 자동으로 연결되고,
없는 회차는 눌러도 이동하지 않는다(툴팁에 '미등록').

## 갱신

- **일정·업무**: 업무 게시판에서 게시하면 통합 페이지에 바로 반영된다. 이 저장소는 손대지 않는다.
- **드론 데이터**: 드론 저장소(비공개)에서 `BUILD_PREVIEW.bat` 또는 `PROMOTE.bat` 실행 → 여기서 `UPDATE_DRONE.bat`
  (`tools/sync_drone.py`로 복사 + 비공개 정보 재검사 → `tools/save.py`로 기록·올리기).

## 공개 원칙

- 원자료·파일 경로·좌표·사용자명은 올리지 않는다. 드론 공개본은 생성 단계와 복사 단계에서 두 번 검사한다.
- 자료 미확인·접근 오류는 0개나 자료 없음이 아니다. Photos 수는 회차 기준 폴더의 파일 수이며 보정 완료 수량이 아니다.
- `robots.txt`는 이 주소 아래 전체(업무 게시판 포함)의 검색 수집을 막는다. 링크를 아는 사람은 볼 수 있으므로 비밀 정보는 두지 않는다.

## 구조

정적 HTML·CSS·JS만 쓴다(빌드 도구 없음). `assets/hub.js`는 업무 게시판의 마감 계산 규칙(`work-board/shared.js`)을 그대로 불러 쓴다.
로컬 확인: `python -m http.server 8000` 후 `http://localhost:8000/` (업무 게시판 자료는 공개 주소에서 읽음).
