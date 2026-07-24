# CORTEX WORKLOG

## 📌 현재 진행 중 / 다음 할 일
- **디자인 수정 예정**: 사용자가 UI 디자인 변경을 원함 (구체적 내용 미정)
- 모바일 워크스페이스 터미널 UI 사용자 피드백 대기 중

---

## 2026-07-23 — 모바일 반응형 UI + 자동 재시작 수정

### 완료된 작업

#### 1. Mac 재부팅 후 자동 시작 실패 수정
- **원인**: `NITRO_HOST=localhost` → IPv6(::1) 바인딩 → 포트 충돌 EADDRINUSE 무한 루프
- **수정**: `scripts/start.sh`
  - `NITRO_HOST=127.0.0.1`로 변경
  - 시작 전 `lsof -ti :7777 | xargs kill -9`로 좀비 프로세스 정리
- **launchd**: `com.scoop.brain.plist`, `com.scoop.cortex-tunnel.plist` 정상 동작 확인

#### 2. 500 Server Error 수정
- **원인 1**: SSH 터널 stale → `launchctl kickstart -k`로 해결
- **원인 2**: `.nuxt`/`.output` 빌드 불일치 → `rm -rf` 후 재빌드로 해결

#### 3. 대시보드(index.vue) 모바일 반응형
- 모바일 햄버거 메뉴 (`showMobileMenu` ref)
- 통계: 모바일 2x2 그리드 / 데스크탑 12-col 레이아웃 분리
- Brain Hub 비주얼 모바일 숨김
- 프로젝트 그리드: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- 패딩/간격 축소

#### 4. 워크스페이스(workspace.vue) 모바일 반응형
- 네비게이션 모바일 숨김 + 햄버거
- 프로젝트 정보: `flex-col sm:flex-row`, 경로 truncate
- IDE 버튼(Studio/Xcode) 모바일 숨김
- 모드 토글: 축소 텍스트 + 가로 스크롤
- 프로젝트 피커: 모바일 바텀시트 (`rounded-t-2xl`, `max-h-[80vh]`)

#### 5. RealTerminal.vue 모바일 대응
- `isMobileView` ref 추가 (768px 기준)
- 모바일 폰트: 10px / 데스크탑: 13px
- 줄간격: 모바일 1.2 / 데스크탑 1.4
- 터미널 높이: 모바일 자동계산 `Math.min(innerHeight - 180, 500)`
- 패딩: 모바일 2px / 데스크탑 8px
- 터치 리사이즈 핸들 (touchstart/touchmove/touchend)
- CSS: `.xterm`, `.xterm-screen`, `.xterm-viewport` → `width: 100% !important`
- 드래그 핸들 터치 타겟 확대 (`h-3 sm:h-2`, `w-12 sm:w-10`)

---

## 2026-07-24 — 500 에러 재발 수정
- 빌드 오래되어 꼬임 → `rm -rf .nuxt .output && npx nuxi build` → `launchctl kickstart -k` → 200 OK 확인
