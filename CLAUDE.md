# CORTEX - 개발자 대시보드 & 워크스페이스

## 프로젝트 개요
Mac 로컬의 전체 프로젝트를 관리하는 개인 개발 대시보드.
프로젝트 스캔, 터미널(Claude Code), TODO, 프로젝트 관계 그래프 등을 제공.

## 기술 스택
- **프론트**: Nuxt 3.17 (SPA, SSR off) + Vue 3 + Tailwind CSS 3
- **백엔드**: Nitro (Nuxt 내장) + better-sqlite3
- **터미널**: node-pty (서버) + xterm.js (클라이언트)
- **데스크탑**: Electron (선택적)
- **배포**: launchd 서비스 (Mac) + SSH 리버스 터널 → nginx HTTPS

## 아키텍처

### 로컬 실행
```
Mac 부팅 → launchd (com.scoop.brain)
  → scripts/start.sh
  → NITRO_PORT=7777 NITRO_HOST=127.0.0.1 node .output/server/index.mjs
```

### 외부 접속 (SSH 리버스 터널)
```
Mac localhost:7777
  → SSH -R 7780:localhost:7777 root@49.247.173.220
  → nginx (cortex.revuplan.com:443) → proxy_pass localhost:7780
```

### launchd 서비스
- `~/Library/LaunchAgents/com.scoop.brain.plist` — Nuxt 서버 (RunAtLoad + KeepAlive)
- `~/Library/LaunchAgents/com.scoop.cortex-tunnel.plist` — SSH 터널 (sshpass + KeepAlive)

## 디렉토리 구조
```
scoop-brain/
├── app/
│   ├── app.vue                          # 루트
│   ├── assets/css/main.css              # 글로벌 CSS
│   ├── components/
│   │   ├── ClaudePrompt.vue             # Claude 프롬프트 입력
│   │   ├── DashboardProjectCard.vue     # 대시보드 프로젝트 카드
│   │   ├── DashboardStatCard.vue        # 통계 카드
│   │   ├── RealTerminal.vue             # xterm.js 터미널 (모바일 대응 완료)
│   │   └── TodoPanel.vue                # TODO 패널
│   ├── composables/
│   │   └── useWorkspace.ts              # 워크스페이스 상태 관리
│   └── pages/
│       ├── index.vue                    # 대시보드 (모바일 반응형)
│       ├── workspace.vue                # 워크스페이스 (모바일 반응형)
│       ├── graph.vue                    # 프로젝트 관계 그래프
│       ├── projects/[id].vue            # 프로젝트 상세
│       └── settings.vue                 # 설정
├── server/
│   ├── db/
│   │   ├── index.ts                     # SQLite 연결
│   │   └── schema.ts                    # 테이블 스키마
│   ├── api/
│   │   ├── projects/                    # 프로젝트 CRUD + 스캔 + 관계
│   │   ├── terminal/                    # PTY spawn/input/output + 이미지 업로드
│   │   ├── claude/                      # Claude 세션/프롬프트
│   │   ├── todos/                       # TODO CRUD
│   │   └── system/                      # 시스템 통계, 앱 실행
│   └── utils/
│       └── scanner.ts                   # 프로젝트 디렉토리 스캐너
├── electron/                            # Electron 메인 프로세스
├── scripts/
│   └── start.sh                         # launchd 실행 스크립트
├── nuxt.config.ts                       # Nuxt 설정 (SPA, 커스텀 테마)
├── scoop-brain.db                       # SQLite DB (git 미추적)
└── package.json
```

## 빌드 & 배포
```bash
# 빌드
npx nuxi build

# 로컬 재시작
launchctl kickstart -k gui/$(id -u)/com.scoop.brain

# 터널 재시작
launchctl kickstart -k gui/$(id -u)/com.scoop.cortex-tunnel

# 상태 확인
curl -s -o /dev/null -w "%{http_code}" http://localhost:7777/
```

## 디자인 시스템
- **다크 테마 전용** (class="dark" 고정)
- 배경: `brain-bg` (#08080f), 카드: `brain-card` (#141425)
- 액센트: `neon-indigo` (#818cf8), `neon-cyan` (#22d3ee), `neon-emerald` (#34d399)
- 폰트: Pretendard (본문) + JetBrains Mono (코드/터미널)
- 네온 글로우 효과: `shadow-neon`, `shadow-neon-lg`

## 주의사항
- `NITRO_HOST`는 반드시 `127.0.0.1` (localhost 쓰면 IPv6 충돌로 EADDRINUSE)
- 빌드 후 반드시 `launchctl kickstart -k`로 재시작
- `.nuxt`/`.output` 꼬이면 `rm -rf .nuxt .output && npx nuxi build`
- DB 파일(scoop-brain.db)은 git 미추적
- node-pty는 Nitro rollupConfig에서 external 처리 필수

## 모바일 반응형 (완료)
- 대시보드(index.vue): 모바일 햄버거 메뉴, 2x2 스탯 그리드, 1열 프로젝트 카드
- 워크스페이스(workspace.vue): 바텀시트 프로젝트 피커, 축소 모드 토글, 스크롤 가능
- RealTerminal.vue: 모바일 폰트 10px, 자동 높이, 터치 리사이즈, CSS overflow 제한
