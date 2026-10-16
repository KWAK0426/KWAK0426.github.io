# 업데이트 기록

어느 PC에서 고쳤든 GitHub에 올라온 변경을 최신순으로 정리한다. GitHub Actions가 자동으로 만든다(직접 고치지 않는다).

| 표시 | 뜻 |
|---|---|
| `[PC이름]` | 그 PC에서 `SAVE_AND_PUSH.bat`·`UPDATE_DRONE.bat`로 올림 |
| GitHub 웹 | github.com에서 연필 아이콘으로 직접 고침 |
| 이전 기록 | 기록 규칙 전 커밋 |


## 2026-10-17 (토)

- **02:05** · 메인 PC · 'Photos 후보' 표기를 'Photos'로 변경, 드론 공개본 갱신  
  `README.md`, `START_NEW_PC.md`, `assets/hub.js`, `index.html`, `tools/sync_drone.py` (ee5b93d)
- **02:02** · Codex PC · 드론 데이터 관리 Codex 담당 등록  
  `START_NEW_PC.md` (a656215)
- **02:01** · 메인 PC · 새 PC 안내: 드론·업무 게시판 원본 비공개 백업 저장소 반영  
  `START_NEW_PC.md` (44c19fc)
- **01:53** · Codex PC · 시작 안내 문서 줄바꿈 정리  
  `START_NEW_PC.md` (c2bda7b)
- **01:52** · Codex PC · 사용자 승인 편집 PC 등록 및 Codex 시작 안내 추가  
  `START_NEW_PC.md` (f9860e0)
- **01:52** · 메인 PC · 회차 칸을 누르면 그 회차의 모자이크 뷰어로 이동(등록된 회차만), 미등록은 이동 안 함  
  `README.md`, `assets/hub.css`, `assets/hub.js`, `index.html` (b5392ab)
- **01:40** · 메인 PC · 업데이트 기록 자동화: 사이트 배포 뒤에 기록을 올려 배포 취소(실패 표시) 방지  
  `.github/workflows/changelog.yml` (3f5bf02)
- **01:38** · 메인 PC · 업데이트 기록(자동 CHANGELOG)·새 PC 시작 안내·SAVE_AND_PUSH 추가  
  `.github/workflows/changelog.yml`, `.gitignore`, `README.md`, `SAVE_AND_PUSH.bat`, `START_NEW_PC.md`, `UPDATE_DRONE.bat` 외 5개 (4264727)
- **01:26** · 이전 기록 · 첫 화면에 페이지 입구 카드(pages.json): 업무 게시판·드론 현황판·모자이크 뷰어  
  `README.md`, `assets/hub.css`, `assets/hub.js`, `index.html`, `pages.json` (bc447e4)

## 2026-10-15 (목)

- **23:46** · 이전 기록 · 회차 행렬에 패널/타프 반사도 전환 스위치 추가, 없음 칸 정렬, 자산 캐시 버전  
  `.gitignore`, `assets/hub.css`, `assets/hub.js`, `drone/index.html`, `drone/summary.json`, `index.html` (5b73420)
- **20:03** · 이전 기록 · 연구 현황 통합 페이지: 일정·업무 + 드론 관측자료 요약  
  `.gitignore`, `.nojekyll`, `README.md`, `UPDATE_DRONE.bat`, `assets/hub.css`, `assets/hub.js` 외 5개 (b2b6022)
