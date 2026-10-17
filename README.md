# 연구 현황 통합 페이지

`https://kwak0426.github.io/` — 일정·업무와 드론 관측자료 처리 현황을 한 화면에서 본다.

| 경로 | 내용 | 자료 |
|---|---|---|
| `/` | 통합 요약 (이 저장소) | 아래 두 자료를 브라우저에서 읽어 요약 |
| `/work-board/` | 업무 게시판 (별도 저장소 `work-board`) | `work-board/data.json` · 게시판 앱이 게시 |
| `/drone/` | 피복·장소별 드론 관측자료 현황판 공개본 (기본: 김해 농지) | `drone/summary.json` · 이 저장소에 복사 |
| `/drone/viewer/` | 김해 논 모자이크 뷰어 (광학·다분광, Z_est·GSD) | `drone/viewer/catalog.json`·`results.json` · 매일 05:00 자동 갱신 |
| `/mosaic-viewer/` | 다른 현장 모자이크 뷰어 (별도 저장소 `mosaic-viewer`) | 그 저장소에서 관리 |

**새 PC에서 시작:** [START_NEW_PC.md](START_NEW_PC.md) · **업데이트 기록:** [CHANGELOG.md](CHANGELOG.md) (어느 PC·GitHub 웹에서 고쳐도 자동 기록)

## 고치고 올리기

파일을 고친 뒤 `SAVE_AND_PUSH.bat` → 최신 받기, 바꾼 내용 한 줄 입력, `[PC이름]`을 붙여 올림.
GitHub Actions(`.github/workflows/changelog.yml`)가 git 기록으로 `CHANGELOG.md`·`changelog.json`을 다시 만들고, 통합 홈 맨 아래 "최근 업데이트"에 표시된다.

## 페이지 추가

첫 화면의 페이지 카드는 `pages.json`에서 관리한다. 항목 하나(제목·설명·주소·아이콘·색)를 넣으면 카드가 생긴다. GitHub 웹에서 연필 아이콘으로 바로 고칠 수 있다.

## 회차 칸 → 모자이크 뷰어 (`/drone/viewer/`)

통합 홈의 "날짜 · 회차별 자료" 칸을 누르면 그 회차의 모자이크 뷰어(`/drone/viewer/?date=YYYY-MM-DD&round=N`)가 열린다.
모자이크가 없는 회차는 눌러도 이동하지 않는다(툴팁에 '미등록').

**Drive에 넣는 양식** — 내 드라이브 `김해논_드론/<날짜 YYYY-MM-DD>/` (폴더 안 `_넣는 방법.txt`에도 있음)

| 파일 | 내용 |
|---|---|
| `YYMMDD_R<회차>_RGB.tif` | 광학 모자이크 (좌표 있는 GeoTIFF) |
| `YYMMDD_R<회차>_RE.tif` | 다분광 모자이크 |
| `YYMMDD_DEM.tif` | 그날 DEM (회차마다 다르면 `YYMMDD_R<회차>_DEM.tif`) |
| `YYMMDD_R<회차>_GPS.csv` | 드론 GPS (열: lat·lon·alt / 광학·다분광이 따로면 `…_R1_RGB_GPS.csv`) |

`김해논_드론` 폴더는 '링크가 있는 모든 사용자: 뷰어'로 공유해야 웹 뷰어에서 열린다. `_뷰어용(자동)/`은 표시용 파일(JPEG COG, 웹 지도 좌표계)이 자동으로 생기는 곳이니 손대지 않는다.

**자동 갱신** — 작업 스케줄러 `GimhaeMosaicViewerUpdate`가 매일 05:00 `tools/mosaic/run_daily.cmd` 실행(PC가 꺼져 있었으면 켜질 때).
지금 바로: `UPDATE_MOSAICS.bat`. 기록: `tools/mosaic/update.log`. 새 PC에서는 Node.js·anaconda(GDAL)가 있어야 하고, 작업 등록은 README 아래 명령으로 한다.

**Z_est·GSD** — 평균 Z_est = 촬영 지점마다 (GPS 고도 + 보정값) − DEM, 이착륙처럼 중앙값에서 max(5 m, 20%) 넘게 벗어난 점은 뺀다.
GSD = 픽셀 크기 × Z_est ÷ 초점거리. 카메라 값·고도 보정은 `tools/mosaic/config.json`(기본값은 '값 확인 필요'로 표시).
입력 파일(이름·크기·수정 시각)·카메라 값이 같으면 다시 계산하지 않는다. 뷰어의 'GSD 계산하기'·'일괄 계산하기'는 같은 코드(`drone/viewer/zest.js`)로 브라우저에서 계산해 그 기기에 보관하고, PC 결과가 올라오면 그 값을 쓴다.
시험: `cd tools/mosaic && npm install && npm test`

```powershell
# 새 PC에서 05:00 작업 등록 (저장소 위치에 맞게 경로 수정)
$dir = "<저장소>	ools\mosaic"
Register-ScheduledTask -TaskName GimhaeMosaicViewerUpdate -Action (New-ScheduledTaskAction -Execute cmd.exe -Argument "/c `"$dirun_daily.cmd`"" -WorkingDirectory $dir) -Trigger (New-ScheduledTaskTrigger -Daily -At 5:00am) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun)
```

## 갱신

- **일정·업무**: 업무 게시판에서 게시하면 통합 페이지에 바로 반영된다. 이 저장소는 손대지 않는다.
- **드론 데이터**: 드론 저장소(비공개)에서 `BUILD_PREVIEW.bat` 또는 `PROMOTE.bat` 실행 → 여기서 `UPDATE_DRONE.bat`
  (`tools/sync_drone.py`로 복사 + 비공개 정보 재검사 → `tools/save.py`로 기록·올리기).

## 공개 원칙

- 원자료·파일 경로·사용자명은 올리지 않는다. 좌표는 모자이크 뷰어(지도 위치)에만 있고 현황판 공개본에는 없다. 드론 공개본은 생성 단계와 복사 단계에서 두 번 검사한다.
- 자료 미확인·접근 오류는 0개나 자료 없음이 아니다. Photos 수는 회차 기준 폴더의 파일 수이며 보정 완료 수량이 아니다.
- `robots.txt`는 이 주소 아래 전체(업무 게시판 포함)의 검색 수집을 막는다. 링크를 아는 사람은 볼 수 있으므로 비밀 정보는 두지 않는다.

## 구조

정적 HTML·CSS·JS만 쓴다(빌드 도구 없음). `assets/hub.js`는 업무 게시판의 마감 계산 규칙(`work-board/shared.js`)을 그대로 불러 쓴다.
로컬 확인: `python -m http.server 8000` 후 `http://localhost:8000/` (업무 게시판 자료는 공개 주소에서 읽음).

### 피복·장소 분류 (2026-10-17)

농지(기본), 밭, 산림, 나지, 갯벌, 연안, 기타를 선택합니다. 농과원 합동필드 2026-06-10 자료는 나지 1~6회차로 별도 등록했습니다. Photos 수량과 촬영시간은 기존 기록 기준이며 패널 보정 출처 검증 여부와 분리해 표시합니다. 현황판에는 원자료 경로·좌표를 게시하지 않습니다.
