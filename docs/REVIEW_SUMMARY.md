# CLSP 검토용 종합 요약

> 이 문서는 외부 AI·개발자 검토를 위한 **단일 진입점**이다.
> 이 문서 + `AGENTS.md` + `prisma/schema.prisma` 3개 파일만 읽어도
> 프로젝트 전체를 80% 파악할 수 있도록 구성했다.

---

## 1. 한 줄 요약

**동양건설산업(TONGYANG E&C)의 건설 프로젝트 라이프사이클 통합 관리 플랫폼.**
과거 공사 일보·CPM 데이터를 자산화해 신규 프로젝트의 공기·원가·품질 예측 정확도를 높이는 것이 목표.

- 프로덕트명: **CLSP** (Construction Lifecycle Solution)
- 내부 제품: **QuickPlan** (CPM 엔진 브랜드)
- 운영 주체: 동양건설산업 공정관리팀
- 상태: **MVP 운영 중** (내부 PoC · 소수 프로젝트 4개로 검증 중 · 인증 없이 운영)

---

## 2. 핵심 도메인 개념

### 라이프사이클 (4단계에서 1단계 이전 → 3단계로 재편됨)

```
┌──────────────────┐
│ 사업 초기 검토   │  ← /bid  (저장 전 ephemeral 시뮬)
│  · 개략공기      │         · 기본 정보만으로 CPM·공사비 즉시 산출
│  · 개략공사비    │         · 확정 시 프로젝트로 저장
└────────┬─────────┘
         ↓ (프로젝트 저장)
┌────────┴─────────┐
│ 1단계 프리콘     │  ← URL /stage/2  (표시 번호만 1로 변경)
│  · R&O 매트릭스  │
│  · 시나리오 비교  │
│  · 프로세스맵    │
└────────┬─────────┘
         ↓
┌────────┴─────────┐
│ 2단계 시공 관리  │  ← URL /stage/3
│  · 공사 일보      │
│  · 엑셀 일괄 임포트 (파주·상봉 포맷)
│  · 사진 업로드    │
│  · 주간 공정률    │
└────────┬─────────┘
         ↓
┌────────┴─────────┐
│ 3단계 분석·준공  │  ← URL /stage/4
│  · 공종·위치·생산성 분석
│  · 주간 리포트 · S-Curve
└──────────────────┘
```

**중요한 설계 결정** (다른 AI가 오해하기 쉬운 부분):
- URL `/stage/2·3·4`는 **기존 호환성** 때문에 유지. 사용자에겐 **1·2·3**으로 표시.
- 과거 1단계 "개략공기"는 **사업 초기 검토**(`/bid`)로 이전. 저장 후 프로젝트에선 해당 단계 없음.
- `/stage/1` URL은 `Stage1Redirect` 컴포넌트가 안내 페이지로 유도.

### 프로젝트 라이프사이클 상태 (lib/project-status.ts)

일보 입력일 기반 **자동 판정** 5단계 — DB에 상태 플래그 저장 X, 매번 계산:

| 상태 | 조건 | 색 |
|---|---|---|
| `planning` | 일보 0건 | blue |
| `active` | 최근 일보 ≤ 30일 | emerald |
| `paused` | 최근 일보 31~90일 | amber |
| `completed` | 최근 일보 > 90일 | slate |
| `archived` | 수동 플래그 (예비) | gray |

---

## 3. 기술 스택

- **프레임워크**: Next.js **16.2.4** (App Router, Turbopack)
  - ⚠️ 사용 중인 Next 16는 새 버전이라 문법 변화 있음 — Node 모듈 상 `node_modules/next/dist/docs/` 참고
- **DB**: PostgreSQL (Supabase) + Prisma 5.22
- **UI**: React 19, Tailwind v4, shadcn/ui 일부
- **AI**: `@anthropic-ai/sdk` 0.90 (Claude Sonnet 4.6) — 공사비 추정용
- **엑셀**: `xlsx` (일보 임포트)
- **PDF**: `jspdf` + `html2canvas` (보고서 출력)

환경변수: `DATABASE_URL` (Supabase), `ANTHROPIC_API_KEY` (선택 — AI 기능)

---

## 4. 데이터 모델 (주요 9개)

`prisma/schema.prisma` 참고. 관계 요약:

```
Project (1) ─┬─ (N) Task                       (WBS 공종)
             ├─ (N) DailyReport                (일보)
             ├─ (N) RiskOpportunity            (R&O)
             ├─ (N) ScheduleAcceleration       (단축공법)
             ├─ (N) BaselineTask               (베이스라인)
             ├─ (N) WeeklyProgress             (주간 공정률)
             └─ (N) ProductivityProposal       (생산성 제안)

CompanyStandardProductivity   (관리자 승인된 전사 표준)
```

**Project 핵심 필드**:
- `name`, `client`, `contractor`, `location`, `type` (공동주택/DC/오피스텔…)
- **건물 규모**: `ground`, `basement`, `lowrise`, `hasTransfer`
- **면적**: `siteArea`(대지) / `bldgArea`(연면적) / `buildingArea`(건축면적=1층 footprint) / `sitePerim`, `bldgPerim`
- **지반**: `wtBottom`(풍화토 깊이), `waBottom`(풍화암 깊이)
- **결과**: `lastCpmDuration`, `industrySpecific` JSON, `processMap` JSON, **`aiCostEstimate` JSON**

---

## 5. 페이지 ↔ API 매핑

| 페이지 | 주요 API | 핵심 로직 |
|---|---|---|
| `/` 대시보드 | `/api/projects` | 상태 중심 KPI + 활발한 현장 + 오늘 할 일 |
| `/projects` 목록 | 동일 | 상태 탭·정렬·검색, status 자동 판정 |
| `/projects/[id]` 상세 | `/api/projects/[id]` + `/stage-status` | MetricTile·AI공사비·3단계 카드 |
| `/projects/[id]/stage/2` 프리콘 | `/risks`·`/accelerations`·`/baseline`·`/calculate` | R&O + 시나리오 + 프로세스맵 |
| `/projects/[id]/stage/3` 시공 | `/daily-reports`·`/weekly-progress` | 일보 입력·달력·주간 공정률 |
| `/projects/[id]/stage/4` 준공 | `/api/projects/[id]/analytics` | 실적 분석 + S-커브 |
| `/bid` 사업 초기 검토 | `/api/bid/estimate` + `/ai-estimate` | CPM + AI 공사비 추정 |
| `/standards` 생산성 DB | `/api/analytics` (공종 대분류 필터) | 공종별 평균 기간·투입 |
| `/companies` 협력사 | `/api/companies` | 협력사별 공종·프로젝트 실적 |
| `/risks` R&O | `/api/risks-library` | 전사 리스크 통합 조회 (현재 데이터 0건) |
| `/analytics` 전사 분석 | `/api/analytics` | 공종·월·요일·날씨·프로젝트 집계 |
| `/import` 엑셀 임포트 | `/api/projects/import/excel/commit` | 파주·상봉 포맷 일괄 파싱 |
| `/admin/productivity` 관리자 | `/api/admin/productivity` | 생산성 제안 검토·승인 |

---

## 6. 도메인 엔진 (lib/engine/)

### `wbs.ts` — WBS 자동 생성 + 물량 산정
- `CP_DB`: 20개 집계 공종 (토목·골조·마감) + 생산성/표준일수
- `computeQuantities(input)`: 입력값 → 물량 계산
  - **건축면적 기반** (2026-04 수정): 터파기·부지정지가 `buildingArea` 사용 (과거 연면적 `bldgArea` 오용으로 151개월 버그)
  - 굴착 깊이 풍화토/풍화암/연암 3단 분류
- `generateWBS(input)`: 물량 0인 공종 skip (과거 `unit==='층'` fallback으로 유령 20층 생성 버그 수정)

### `cpm.ts` — Critical Path Method
- 순차 선후행 기반 ES/EF/LS/LF/TF/FF/isCritical 계산

### `resource-plan.ts` — 자원 계획
- 회사 표준(`CompanyStandardProductivity`) 기반 공종별 일평균 투입 인원
- 피크·월별 총합·미커버 공종 반환

### `monte-carlo.ts` — 몬테카를로 시뮬
- 공종별 기간 분포 (beta) → 전체 공기 확률 분포

---

## 7. 공통 컴포넌트 (components/common/)

디자인 토큰처럼 취급되는 재사용 컴포넌트:

- `PageHeader` — accent 7색 프리셋 (다크 slate 배경)
- `StatusBadge` — 5상태 배지 (size, variant)
- `EmptyState` — 그라디언트 글로우 아이콘
- `Skeleton` (+ List/Card/Table/KpiGrid 프리셋)
- `Toast` + `useToast`
- `CommandPalette` (⌘K 전역 검색)
- `Breadcrumb` (URL 기반 자동)
- `GlobalShortcuts` (`g+p`/`g+d`/`?` 등 Gmail 스타일)
- `ProjectSwitcher` (상단바 드롭다운)
- `MobileNotice` (데스크톱 권장 배너)

**CSS 유틸리티** (globals.css):
- `.card-elevated` — 3단 shadow + 1px border (Linear 풍 카드)
- `.sidebar-scroll`, `.thin-scroll` — 호버 시만 노출

---

## 8. 정규화·상태 (lib/)

- `normalizers/aliases.ts`:
  - `normalizeTrade()`, `normalizeCompany()` — 표기 오염·오타 통일
  - `getTradeCategory()` — 공종명 → 8개 대분류 (골조/토목/마감/설비/전기·통신/가설·관리/외부·조경/기타)
- `project-status.ts`: 라이프사이클 자동 판정 + `STATUS_META` 색 정의
- `project-context/ProjectContext.tsx`: 전역 선택된 프로젝트 (URL 우선 · localStorage 복원)

---

## 9. 자동화 루프 (docs/)

내부 개발은 2개 루프로 운영:

1. **`LOOP_PROMPT.md`**: 기능 백로그 소화 (`IMPROVEMENT_BACKLOG.md` Tier 0~5)
2. **`LOOP_POLISH.md`**: 19개 대상 순회 · 10개 체크리스트로 UI 완성도 다듬기 (신설)

---

## 10. 알려진 한계 / 미완 영역

| 영역 | 현황 | 영향 |
|---|---|---|
| **인증·권한** | 없음 (Tier 0 블로커) | 내부 PoC라 괜찮지만 외부 배포 시 필수 |
| **프로젝트 멤버십** | 없음 | role 기반 접근 제어 불가 |
| **R&O 실제 데이터** | 0건 | 라이브러리 페이지 비어있음 |
| **실적 공사비 DB** | 없음 | AI 추정만 있고 실측 단가표 부재 |
| **모바일 UX** | 일보·분석·DB는 OK. Stage1·Stage2·임포트는 데스크톱 권장 배너 | |
| **공종 별칭** | 키워드 매핑 기반 (70%+) | `관리`·`직영`은 공종 아닌데 집계에 섞임 |
| **테스트** | 자동 테스트 없음 · `scripts/` 밑 mjs 수동 검증만 | |
| **Prisma Dev 잠금** | Windows에서 `prisma generate` 시 dev 서버 EPERM 발생 간헐 | 종료 후 재생성 필요 |

---

## 11. 최근 주요 결정 (타임라인 역순)

- **2026-04-19**: 단계 체크 표시 제거 (판정 기준 모호성)
- **2026-04-19**: 공종 대분류 필터 + 공종별 월 sparkline + AI 공사비 Project 저장
- **2026-04-19**: 협력사 페이지 공종 중심 재구성 (일수·days 필드 추가)
- **2026-04-19**: 생산성 DB 전면 개편 (인일 → 일수·명 기준)
- **2026-04-18**: PageHeader 다크 톤 + card-elevated 전역 적용
- **2026-04-18**: 사이드바 CLSP 로고 재설계 + 주황 CTA + 단계별 accent
- **2026-04-18**: 1단계(개략공기) → 사업 초기 검토로 이전 (라이프사이클 재편)
- **2026-04-18**: 프로젝트 상태 자동 분류 시스템 + StatusBadge 도입
- **2026-04-18**: AI 공사비 추정 (Claude tool_use 기반) 도입
- **2026-04-18**: buildingArea 신설 + 터파기 물량 오류 수정 (151개월 → 24개월)

Git log (`git log --oneline -30`)로 전체 히스토리 확인.

---

## 12. 검토 포인트 제안 (외부 AI용)

검토자가 집중해주면 좋은 영역:

### 🎯 도메인 로직
- `lib/engine/wbs.ts`의 물량 공식이 현실 적합한가?
  - 특히 터파기·부지정지의 건축면적 사용이 맞는지
  - 작업률(`getWorkRate`) 값이 타당한지 (공사준비·토목 0.666, 골조 0.632)
- `cpm.ts`의 CPM 계산이 표준 PMBOK와 일치하는가?
- `resource-plan.ts`의 자원 평탄화 방식이 현장 관행에 맞는가?

### 🎨 UX/UI
- `/bid` 5섹션 입력 폼의 순서가 자연스러운가? (위치·지반 → 유형·규모 → 면적·둘레 → 메타)
- 프로젝트 상세의 3카드(프리콘·시공·준공) 표시 방식이 적절한가?
- 상태 뱃지 색·라벨이 현장 사용자에게 직관적인가?

### 📊 데이터 활용
- 공종별 "평균 기간·하루평균 투입" 표기가 실무자에게 유용한가?
- 협력사 페이지의 "주력 공종 TOP 5 + 참여 프로젝트" 구성이 의사결정에 도움되는가?
- AI 공사비 추정(Claude)의 프롬프트 설계가 한국 건설 시세에 적합한가? (`app/api/bid/ai-estimate/route.ts`)

### 🔒 확장성
- 인증·권한 도입 시 기존 페이지 영향 범위는?
- 프로젝트 수 100개 이상일 때 집계 API 성능 (현재 상봉동 909일보로도 <1초)
- 다국어·다크모드 도입 여지

### ⚠️ 잠재 위험
- `DailyReport.manpower` JSON 파싱 일관성 (파주·상봉 포맷 혼재)
- 정규화 미흡으로 집계에 섞이는 비공종 (`관리`, `직영`)
- Prisma 스키마 nullable 필드 범람 (필수성 재검토 필요)

---

## 13. 실행 방법

```bash
# 1. 의존성
npm install

# 2. Prisma Client
npx prisma generate

# 3. DB 스키마 반영 (초기 1회)
npx prisma db push

# 4. 환경변수 (.env.local)
DATABASE_URL="postgres://..."
ANTHROPIC_API_KEY="sk-ant-..."  # 선택 - AI 공사비 기능용

# 5. 개발 서버
npm run dev
# → http://localhost:3000
```

---

## 14. 저장소

- GitHub: `kimhhjjhj/clsp-web`
- 기본 브랜치: `master`
- 커밋 규칙: `feat/fix/style/refactor/polish/docs:` 접두사 + 한국어 제목

## 15. 함께 보면 좋은 파일

검토 우선순위 순:
1. `AGENTS.md` — 엔지니어 마인드셋 + 도메인 맥락
2. `prisma/schema.prisma` — 데이터 모델 전체
3. `docs/IMPROVEMENT_BACKLOG.md` — 진행 상태
4. `lib/engine/wbs.ts` + `cpm.ts` + `resource-plan.ts` — 도메인 엔진
5. `app/(dashboard)/bid/page.tsx` — 가장 큰 페이지 (입력 폼 + 공기/공사비 탭)
6. `components/layout/Sidebar.tsx` — 네비게이션 구조
7. `lib/project-status.ts` — 상태 시스템
8. `app/api/analytics/route.ts` — 집계 로직
9. `components/bid/AiCostEstimate.tsx` — Claude tool_use 활용 예제
10. `docs/LOOP_POLISH.md` — 개발 방식

---

*최종 갱신: 2026-04-19*
