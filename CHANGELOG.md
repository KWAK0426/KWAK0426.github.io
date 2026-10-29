# 업데이트 기록

어느 PC에서 고쳤든 GitHub에 올라온 변경을 최신순으로 정리한다. GitHub Actions가 자동으로 만든다(직접 고치지 않는다).

| 표시 | 뜻 |
|---|---|
| `[PC이름]` | 그 PC에서 `SAVE_AND_PUSH.bat`·`UPDATE_DRONE.bat`로 올림 |
| GitHub 웹 | github.com에서 연필 아이콘으로 직접 고침 |
| 이전 기록 | 기록 규칙 전 커밋 |


## 2026-10-29 (목)

- **09:46** · 이전 기록 · RGB 대체 영상 표시 격자 안내 수정  
  `drone/viewer/app.js`, `drone/viewer/index.html` (3ff2a3e)
- **09:44** · 이전 기록 · RGB 밝기 조정 영상 연결과 시안 일치  
  `drone/viewer/app.js`, `drone/viewer/index.html`, `drone/viewer/rgb_1m/2026-07-16-R2-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-07-31-R3-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-07-31-R4-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-07-31-R5-MS-RGB-1m.webp` (7a70d5e)
- **09:31** · 이전 기록 · 6월 30일 RGB 대체 영상을 승인 시안과 일치  
  `drone/viewer/app.js`, `drone/viewer/index.html`, `drone/viewer/rgb_1m/2026-06-30-R1-MS-RGB-1m.webp` (5158b68)
- **09:26** · 이전 기록 · RGB 대체 영상 밝기 표시 및 캐시 갱신  
  `drone/viewer/app.js`, `drone/viewer/index.html` (7fc6142)
- **09:23** · 이전 기록 · 밝기 조정한 RGB 대체 영상 적용  
  `drone/viewer/rgb_1m/2026-05-10-R3-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-05-10-R4-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-05-10-R5-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-06-30-R1-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-07-16-R1-MS-RGB-1m.webp`, `drone/viewer/rgb_1m/2026-07-16-R2-MS-RGB-1m.webp` 외 13개 (0dbccee)

## 2026-10-26 (월)

- **02:58** · 연코 · 필지 스펙트럼 개별선을 최소최대 음영 범위로 변경  
  `drone/viewer/app.js`, `drone/viewer/index.html`, `drone/viewer/spectra.js`, `drone/viewer/viewer.css`, `tools/mosaic/PUBLISHED_VIEWS.md`, `tools/mosaic/test/spectrum-envelope.test.mjs` (7378226)
- **02:38** · 연코 · 밴드별 색상과 RGB 회차 공통 스트레치 적용  
  `README.md`, `drone/viewer/app.js`, `drone/viewer/bands/2026-05-10-R3-B01-fields-p05p95-rdylbur.webp`, `drone/viewer/bands/2026-05-10-R3-B01-minmax-rdylbur.webp`, `drone/viewer/bands/2026-05-10-R3-B02-fields-p05p95-rdylbur.webp`, `drone/viewer/bands/2026-05-10-R3-B02-minmax-rdylbur.webp` 외 316개 (f00121e)
- **00:34** · 연코 · 통합 홈에 NBAR 연구 현황 허브 바로가기 추가  
  `START_NEW_PC.md`, `pages.json` (afa05f5)

## 2026-10-25 (일)

- **04:06** · 이전 기록 · Stabilize spectrum interaction and show sampled parcel distributions  
  `drone/viewer/app.js`, `drone/viewer/catalog.json`, `drone/viewer/index.html`, `drone/viewer/spectra.js`, `drone/viewer/spectra/2026-05-10-R3/field-samples-v1.json`, `drone/viewer/spectra/2026-05-10-R4/field-samples-v1.json` 외 15개 (4e9460d)
- **03:27** · 이전 기록 · Add NDVI views and native multispectral grid resolution  
  `drone/viewer/app.js`, `drone/viewer/catalog.json`, `drone/viewer/index.html`, `drone/viewer/ndvi/2026-05-10-R3-NDVI-viridis-0-1.webp`, `drone/viewer/ndvi/2026-05-10-R4-NDVI-viridis-0-1.webp`, `drone/viewer/ndvi/2026-05-10-R5-NDVI-viridis-0-1.webp` 외 14개 (093d42b)
- **01:33** · 이전 기록 · Complete spectra for all multispectral rounds and align RGB sources  
  `drone/viewer/app.js`, `drone/viewer/bands/2026-05-10-R3-RGB-canonical-p05p95.webp`, `drone/viewer/bands/2026-05-10-R4-RGB-canonical-p05p95.webp`, `drone/viewer/bands/2026-05-10-R5-RGB-canonical-p05p95.webp`, `drone/viewer/bands/2026-07-16-R1-RGB-canonical-p05p95.webp`, `drone/viewer/bands/2026-07-31-R1-RGB-canonical-p05p95.webp` 외 352개 (5da63b9)
- **00:50** · 연코 · 전 날짜 공통 필지와 반사도 RdYlBu_r·필지 대비 적용  
  `README.md`, `drone/updates/20261024_verified_release.html`, `drone/viewer/app.js`, `drone/viewer/bands/2026-05-10-R3-B01-fields-p05p95-rdylbur.webp`, `drone/viewer/bands/2026-05-10-R3-B01-minmax-rdylbur.webp`, `drone/viewer/bands/2026-05-10-R3-B02-fields-p05p95-rdylbur.webp` 외 285개 (3fe0036)
- **00:02** · 연코 · 업로드된 다분광 13회차를 밴드별 뷰어에 연결  
  `README.md`, `drone/updates/20261024_verified_release.html`, `drone/viewer/app.js`, `drone/viewer/bands/2026-05-10-R3-B01-minmax.webp`, `drone/viewer/bands/2026-05-10-R3-B01-p05p95.webp`, `drone/viewer/bands/2026-05-10-R3-B02-minmax.webp` 외 276개 (fa9b4d0)

## 2026-10-24 (토)

- **18:25** · 연코 · 느린 첫 화소 다운로드 중 로딩 상태 유지  
  `drone/viewer/app.js`, `drone/viewer/index.html`, `drone/viewer/spectra.js` (c36def3)
- **18:20** · 연코 · 검증된 모자이크·스펙트럼 공개 및 농과원 보류 근거 갱신  
  `README.md`, `START_NEW_PC.md`, `drone/index.html`, `drone/updates/20261024_verified_release.html`, `drone/viewer/app.js`, `drone/viewer/bands.js` 외 75개 (4fda09c)

## 2026-10-22 (목)

- **17:35** · 연코 · Add approved wavelength-ordered band views and P05/P95 colorbars  
  `drone/viewer/app.js`, `drone/viewer/bands/2026-10-07-R1-B01-minmax.webp`, `drone/viewer/bands/2026-10-07-R1-B01-p05p95.webp`, `drone/viewer/bands/2026-10-07-R1-B02-minmax.webp`, `drone/viewer/bands/2026-10-07-R1-B02-p05p95.webp`, `drone/viewer/bands/2026-10-07-R1-B03-minmax.webp` 외 21개 (57d90e4)
- **16:33** · 연코 · Keep mobile mosaic status clear of map controls  
  `drone/viewer/index.html`, `drone/viewer/viewer.css` (f1b3713)
- **16:28** · 연코 · Publish approved 10/7 R1 reflectance and NDVI viewer  
  `drone/viewer/app.js`, `drone/viewer/catalog.json`, `drone/viewer/index.html`, `drone/viewer/thumbs/2026-10-07-R1-NDVI.webp`, `drone/viewer/thumbs/2026-10-07-R1-RE.webp`, `drone/viewer/viewer.css` 외 4개 (bdaacf8)

## 2026-10-21 (수)

- **09:23** · 연코 · 10/7 1회차 Photos689장 GPS DEM 현황 반영  
  `drone/index.html`, `drone/summary.json` (b9c1291)
- **07:38** · 연코 · 9/23 배치 현황 반영: 476·641·664장 및 1차124장 부족 표시  
  `drone/index.html`, `drone/summary.json` (3caf80b)

## 2026-10-20 (화)

- **17:32** · 연코 · 9/21 처리 자료 현황 반영: Photos 883·839장 GPS DEM 확인  
  `drone/index.html`, `drone/summary.json` (6d8d911)

## 2026-10-18 (일)

- **12:36** · 연코 · 9/8 재저장 4회차 현황 갱신 및 공개 출처 정제  
  `START_NEW_PC.md`, `drone/index.html`, `drone/summary.json` (904b2c2)

## 2026-10-17 (토)

- **17:49** · 연코 · 김해 현황 유지, 피복 선택과 농과원 나지 6회차 공개  
  `README.md`, `drone/index.html`, `drone/summary.json` (a4925a1)
- **17:32** · 메클 · 새 PC 안내: 김해 논 모자이크 뷰어(/drone/viewer/) 항목, 자동 갱신은 메인 PC에서만  
  `START_NEW_PC.md` (b0a3b2a)
- **02:28** · 메클 · 현황판 아래 모자이크 뷰어(/drone/viewer/): 회차 칸 → 광학·다분광, Z_est·GSD 계산, 매일 05:00 자동 갱신  
  `.gitignore`, `README.md`, `UPDATE_MOSAICS.bat`, `assets/hub.js`, `drone/viewer/app.js`, `drone/viewer/catalog.json` 외 20개 (5f7c84f)
- **02:14** · 메클 · 이름표 추가: 메클(메인 클로드)·집코(코덱스-집)·연코(코덱스-연구실), 예전 기록도 새 이름으로 표시  
  `START_NEW_PC.md`, `tools/make_changelog.py`, `tools/save.py` (3017b96)
- **02:10** · 메클 · 코덱스 이름을 '코덱스-연구실'로 등록, 예전 [Codex PC] 기록도 새 이름으로 표시  
  `START_NEW_PC.md`, `tools/make_changelog.py` (38cbb40)
- **02:05** · 메클 · 드론 공개본 갱신('Photos' 표기)  
  `drone/index.html`, `drone/summary.json` (2bfbda4)
- **02:05** · 메클 · 'Photos 후보' 표기를 'Photos'로 변경, 드론 공개본 갱신  
  `README.md`, `START_NEW_PC.md`, `assets/hub.js`, `index.html`, `tools/sync_drone.py` (ee5b93d)
- **02:02** · 연코 · 드론 데이터 관리 Codex 담당 등록  
  `START_NEW_PC.md` (a656215)
- **02:01** · 메클 · 새 PC 안내: 드론·업무 게시판 원본 비공개 백업 저장소 반영  
  `START_NEW_PC.md` (44c19fc)
- **01:53** · 집코 · 시작 안내 문서 줄바꿈 정리  
  `START_NEW_PC.md` (c2bda7b)
- **01:52** · 집코 · 사용자 승인 편집 PC 등록 및 Codex 시작 안내 추가  
  `START_NEW_PC.md` (f9860e0)
- **01:52** · 메클 · 회차 칸을 누르면 그 회차의 모자이크 뷰어로 이동(등록된 회차만), 미등록은 이동 안 함  
  `README.md`, `assets/hub.css`, `assets/hub.js`, `index.html` (b5392ab)
- **01:40** · 메클 · 업데이트 기록 자동화: 사이트 배포 뒤에 기록을 올려 배포 취소(실패 표시) 방지  
  `.github/workflows/changelog.yml` (3f5bf02)
- **01:38** · 메클 · 업데이트 기록(자동 CHANGELOG)·새 PC 시작 안내·SAVE_AND_PUSH 추가  
  `.github/workflows/changelog.yml`, `.gitignore`, `README.md`, `SAVE_AND_PUSH.bat`, `START_NEW_PC.md`, `UPDATE_DRONE.bat` 외 5개 (4264727)
- **01:26** · 이전 기록 · 첫 화면에 페이지 입구 카드(pages.json): 업무 게시판·드론 현황판·모자이크 뷰어  
  `README.md`, `assets/hub.css`, `assets/hub.js`, `index.html`, `pages.json` (bc447e4)

## 2026-10-15 (목)

- **23:46** · 이전 기록 · 회차 행렬에 패널/타프 반사도 전환 스위치 추가, 없음 칸 정렬, 자산 캐시 버전  
  `.gitignore`, `assets/hub.css`, `assets/hub.js`, `drone/index.html`, `drone/summary.json`, `index.html` (5b73420)
- **20:03** · 이전 기록 · 연구 현황 통합 페이지: 일정·업무 + 드론 관측자료 요약  
  `.gitignore`, `.nojekyll`, `README.md`, `UPDATE_DRONE.bat`, `assets/hub.css`, `assets/hub.js` 외 5개 (b2b6022)
