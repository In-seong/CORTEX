# CORTEX WORKLOG

## 📌 현재 진행 중 / 다음 할 일
- **UI 개편 방향 확정 중**: 커스텀 JARVIS 네온 → "익숙한 UI"(GPT/Claude/orca식 좌측 사이드바 + 우측 메인) 전환 검토. 디자인 분석 진행 중
- **orca 흡수 로드맵** (분석 완료, 착수 대기): Phase 1 에이전트 상태 시스템(hook→POST /api/agent-hook, 4-state, unread) → 2 터미널 생존성(WS+링버퍼+seq replay) → 3 사용량 추적(.jsonl 스캔) → 4 알림/모바일(WS seq catch-up) → 5 병렬 worktree → 6 diff리뷰/자동화
- **미해결**: CORTEX.app(Electron)이 `::1:7777` 점유 → localhost 500 유발. 앱 종료/포트 분리/Electron 폐기 중 결정 필요
- 앞으로 작업은 feature 브랜치로 (git 사용 시작됨)

---

## 2026-07-24 — orca 분석 + GitHub 저장소 개설

**한 일**
- 프로젝트 전체 코드 리뷰(요청: 읽고 확인만). 500 재발의 진짜 원인 발견: 빌드 꼬임이 아니라 **CORTEX.app(Electron)이 구버전 번들 서버를 `::1:7777`(IPv6)에 바인딩** → localhost가 IPv6로 풀리면 500. launchd 서버(127.0.0.1)는 정상 200
- `/Users/scoop/Downloads/orca-main` (stablyai orca, MIT, 병렬 에이전트 IDE) 심층 분석 — 탐색 에이전트 3개 병렬 (메인프로세스/렌더러UX/원격·모바일·자동화)
- git init + GitHub 연결: `https://github.com/In-seong/CORTEX.git`, 첫 커밋 `6aef65c`(52파일) 푸시. .gitignore 보강(dist-electron 636MB, logs, *.db-wal, .claude-tmp 등)

**orca 분석 핵심 (재사용할 설계)**
- 단일 RPC 서버 + 다중 클라이언트(웹/모바일/CLI 동일 WS RPC). `orca serve` = 헤드리스 서버+웹번들 셀프서빙
- 에이전트 상태는 터미널 파싱 아닌 **CLI native hook → HTTP POST**로만: `working/blocked/waiting/done` 4-state (`src/shared/agent-hook-listener.ts` 이식 가치 최고)
- 알림: FCM 없이 **WS 스트림 + 단조증가 seq + getMissedSince() catch-up** (`mobile-notification-replay.ts`)
- 터미널: 서버가 bounded 출력 모델 소유, 클라이언트는 스냅샷+seq로 재동기화 (`docs/terminal-main-owned-state.md`)
- 사용량: `~/.claude/projects/**/*.jsonl` 스캔+dedupe(messageId:requestId)+cwd귀속+가격표 (`src/main/claude-usage/` 거의 그대로 이식 가능)
- worktree: create/list/remove + "미머지 커밋 절대 유실 금지" 방어 로직 (`src/main/git/worktree.ts`)
- UX: 3열 셸(좌 프로젝트→worktree→에이전트 트리 / 중앙 activeView / 우 탐색기·소스컨트롤), Cmd+K 통합 팔레트, diff 인라인 "AI에게 메모"→에이전트 일괄 전송, 상태색 관례(emerald=완료, amber=needs attention)
- 스택: Tailwind v4 CSS-first + shadcn(new-york-v4) CSS 변수 테마, zustand 슬라이스 ~40개 단일 스토어

**결정/맥락**
- orca는 상용급 대형(React19+Electron+Expo모바일+relay) → 코드 통이식 불가, **설계·파서·알고리즘 단위 이식**. 단 `src/shared`는 Electron 무의존 순수 TS라 거의 복사 가능
- CORTEX 우위 영역(홈스캔·관계그래프·TODO·카테고리)은 유지 — "orca 복제"가 아니라 "CORTEX 대시보드 + orca 오케스트레이션"
- 코드 리뷰 소견: prompt.post.ts abort 시 controller closed 예외 누적, upload-image .claude-tmp 미정리, scanner.ts iOS 감지(glob 불가), 4페이지 헤더 중복(레이아웃 추출 필요)

**다음 할 일**
- 디자인/UI 분석 → 익숙한 레이아웃(좌 사이드바+우 메인)으로 개편안 확정
- CORTEX.app ::1:7777 점유 문제 정리
- Phase 1 (에이전트 상태 시스템) 착수

**상태**: 진행중

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
