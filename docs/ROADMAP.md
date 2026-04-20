# CLSP 고도화 로드맵

_2026-04-20 기준, 글로벌·국내 PMIS 6종 벤치마크 분석으로부터 도출_

**참고 시스템**: Procore · Autodesk Construction Cloud · RIB(iTWO·CostX·MTWO) · Smart PMIS(로이테크원) · 한국씨엠씨 PMIS · BCMP PMIS

**원칙**: 모든 기능은 **Add-on** 방식. 기존 `generateWBS` / `cpm.ts` / `CP_DB` / `CP_DB_TOPDOWN` / `guideline.ts` 엔진 본체는 **절대 수정하지 않음**. 전처리/후처리 훅과 옵셔널 인자만 추가.

**차별화 포지션**: 실시간 의사결정 플랫폼 — (a) CP 변동 추적, (b) 국토부 참조 ↔ 자사 실적 이중 루프, (c) 생산성 DB 자동 성장.

---

## 🏆 TOP 5 우선순위 (구현 순서)

| 순위 | 코드 | 기능명 | 왜 이 순서인가 |
|---|---|---|---|
| 1 | **F1** | CPM Intelligence Timeline | 모든 다른 분석 기능이 `CpmSnapshot` 테이블에 의존. 기반 공사. |
| 2 | **F4** | Productivity Variance Dashboard | CompanyStandardProductivity 수확 속도 10배 가속. 일보 등록 즉시 편차 계산 → 자동 제안. |
| 3 | **F3** | Delay Root-Cause Attribution | F1+F4+F5 결합으로 지연 원인 분해. "법정 vs 실측" 이중 트랙 = CLSP 유일. |
| 4 | **F8** | Scenario Comparator | 기존 method-recommender + multiplier + acceleration을 한 화면에서 5개 비교. |
| 5 | **F18** | Internal Regression Calibration | 자사 프로젝트 실적으로 회귀식 재학습. 누적이 해자가 되는 유일 기능. |

---

## 📋 전체 기능 18개

### 🥇 Quick Win (Low 난이도)

#### F1. CPM Intelligence Timeline
- **출처**: Procore Scheduling(Deadline Variance) + ACC Build(5 버전 stack)
- **설명**: 매 이벤트마다 CPM 결과 영속화 → 변동 히스토리 시각화
- **적용**: `/projects/[id]` 분석 탭
- **DB**: `CpmSnapshot { id, projectId, capturedAt, totalDuration, criticalTaskIds Json, tasksSnapshot Json, triggerEvent, triggerRef? } @@index([projectId, capturedAt])`
- **API**:
  - `POST /api/projects/[id]/cpm-snapshots` — `{ trigger, triggerRef? }`
  - `GET /api/projects/[id]/cpm-snapshots?since=YYYY-MM-DD`
  - `GET /api/projects/[id]/cpm-snapshots/diff?from=<id>&to=<id>`
- **UI**: `components/analytics/CpmTimeline.tsx`, `CpmDiffView.tsx`

#### F4. Productivity Variance Dashboard
- **출처**: Procore Daily Logs Productivity + Analytics Productivity Report
- **설명**: CompanyStandardProductivity 대비 일보 관측치 z-score → ProductivityProposal 자동 생성
- **적용**: `/projects/[id]` 분석 탭, `CompanyStandardsPanel` 보강
- **DB**: `ProductivityObservation { id, projectId, dailyReportId, trade, date, observedValue, unit, quantity, manDays, zScore?, status }`
- **API**: observe(hook), variance, auto-from-variance
- **UI**: `ProductivityPanel.tsx` "최근 30일 편차 TOP 5"

#### F5. Weather Non-Work Auto-Ingestion
- **출처**: Procore Daily Log Weather + ACC 주간 보고
- **설명**: 기상청 API → 국토부 참조값 vs 실측 이중 트랙
- **DB**: `WeatherLog { projectId, date, precipMm?, windMs?, isNonWork, reason, source } @@unique([projectId, date])`
- **API**: `POST /weather/sync` (cron), `GET /weather/non-work-summary`
- **UI**: `components/analytics/WeatherVsGuideline.tsx`

#### F9. Monte-Carlo Confidence Fan Chart
- **출처**: Procore Forensic Schedule Analysis
- **설명**: 기존 monte-carlo 엔진 UI 교체, P10/P50/P80/P95 fan chart
- **DB**: Task에 `productivityDist Json?` 추가
- **UI**: `MonteCarloPanel.tsx` recharts AreaChart

#### F11. Baseline Revision 비교
- **출처**: ACC Build "visually stack up to 5 versions"
- **DB**: BaselineTask에 `revision Int @default(0)`, `importedAt`
- **API**: `GET /baseline/compare?revA=0&revB=1`
- **UI**: `BaselineDiffView.tsx`

#### F13. Portfolio Executive Dashboard
- **출처**: ACC Forma Insight Builder + Procore Analytics + Outbuild
- **UI**: `/dashboard` 또는 `/projects` 상단
- **API**: `GET /api/portfolio/health`

#### F14. AI 리스크 자동 순위
- **출처**: ACC Construction IQ
- **API**: `POST /api/projects/[id]/risks/auto-rank` (Claude API 프롬프트 추가)
- **UI**: `RiskPanel.tsx` 상단 배너

#### F15. 공종 표준 Library 포털
- **출처**: Smart PMIS 통합 DB + Procore Cost Code Library
- **UI**: `/standards` 전역 페이지, 시계열 변화 시각화

### 🥈 중기 핵심

#### F2. Constraint-linked Activity
- **출처**: ACC Build Issues→activity link + Procore Submittal
- **DB**: `TaskConstraint { taskId, kind, refId?, dueDate?, status, bufferDays? }`
- **엔진**: `applyConstraintBuffers` 전처리 훅 (cpm.ts 본체 불변)

#### F3. Delay Root-Cause Attribution
- **출처**: Procore Analytics Root Cause Analysis
- **DB**: `DelayAttribution { projectId, taskId, periodFrom, periodTo, cause, days, evidence Json }`
- **엔진**: `lib/engine/delay-attribution.ts` 신설
- **UI**: `DelayCauseChart.tsx` (Sankey/stacked bar)

#### F6. 5D Model Map (Takeoff ↔ Task 링크)
- **출처**: RIB CostX Model Maps + iTWO 5D
- **DB**: `QuantityTakeoff { trade, category, quantity, source, version }`, Task.quantitySourceId
- **UI**: `TakeoffPanel.tsx`

#### F7. Look-Ahead + PPC
- **출처**: Procore Lookahead + Last Planner System
- **DB**: `WeeklyCommitment { projectId, weekStart, taskId, plannedQty?, actualQty?, reasonNotDone? }`
- **UI**: `PullPlanBoard.tsx` 확장

#### F8. Scenario Comparator
- **출처**: MTWO 5D what-if + ACC Build version stack
- **DB**: `Scenario { projectId, name, params Json, result Json, baseline }`
- **API**: evaluate, compare
- **UI**: `ScenarioDashboard.tsx` 최대 5 col

#### F10. EVM Mini
- **출처**: Procore Deadline Variance + ACC Cost/Schedule
- **엔진**: `lib/engine/evm.ts` (read-only 계산)
- **UI**: `BaselineCompare.tsx`에 SPI/CPI 카드

#### F12. RFI/Submittal Board
- **출처**: Procore Submittal log + ACC Issues
- **DB**: `Rfi`, `Submittal` 별도 엔터티
- **UI**: `RfiBoard.tsx`, `SubmittalLog.tsx`

#### F17. Subcontractor Scorecard
- **출처**: ACC Subcontractor scorecards
- **DB**: `ContractorScorecard { contractorName, trade, avgProductivity, avgPpc, delayContribution }`
- **UI**: `components/standards/ContractorScorecard.tsx`

#### F18. Internal Regression Calibration
- **출처**: RIB iTWO "as-planned vs as-built" + Procore forecast
- **DB**: Project.actualCompletionDate/actualDuration, `InternalRegression { projectType, coefficients, sampleSize, rSquared }`
- **엔진**: computeGuidelineRegression 옵셔널 `internalCoefficients` 인자
- **UI**: `RegressionCompare.tsx` (국토부 vs 자사 overlay)

### 🥉 장기 투자

#### F16. IFC 파서
- **출처**: RIB CostX Model Map + iTWO 5D
- **난이도**: High (web-ifc 복잡)
- **DB**: QuantityTakeoff에 `floorIndex?`, `zone?`

---

## 🛡️ 안전장치 · 롤백 정책

- **엔진 불변**: `generateWBS` / `cpm.ts` / `CP_DB*` / `guideline.ts` 본체는 절대 수정하지 않는다. 필요 시 전처리/후처리 훅 또는 옵셔널 파라미터만 추가.
- **기능 단위 커밋**: 각 F#는 독립 커밋 + GitHub push. `git revert <sha>` 또는 `git reset --hard <prior-sha>`로 임의 시점 복귀.
- **DB 변경**: Prisma migration 대신 `prisma db push`. 기존 Supabase 공유 스키마와 충돌 시 별도 테이블로 분리.
- **참고값 엄수**: 국토부 2026 가이드라인 수치는 `lib/engine/guideline-data/` 내부 값만 사용. 직접 하드코딩 금지.

---

## 📊 참고 출처

- Procore: [Scheduling Lookahead](https://support.procore.com/products/online/user-guide/project-level/schedule/tutorials/view-lookahead-schedules), [Root Cause Analysis](https://support.procore.com/integrations/procore-analytics/reports/project-management-report/root-cause-analysis), [Forensic Schedule Analysis](https://www.procore.com/library/forensic-schedule-analysis)
- Autodesk Construction Cloud: [Build Schedule Tool](https://www.autodesk.com/blogs/construction/autodesk-build-schedule-tool/), [Forma Dashboards Insight Builder](https://www.autodesk.com/blogs/construction/simplify-custom-dashboard-creation-with-insight-builder-in-autodesk-construction-cloud/)
- RIB Software: [iTWO 5D BIM](https://www.rib-software.com/en/solutions/cad-civil-engineering/rib-itwo-5d-and-itwo-civil), [CostX BIM](https://www.rib-software.com/en/rib-costx/bim)
- MTWO: [5D What-if Scenarios](https://www.ironpros.com/project-management-software/article/22908498/softwareone-mtwo-delivers-5d-bim-project-management-software)
- Smart PMIS: [로이테크원](https://www.mescius.co.kr/reference-saas-pmis)
- BCMP PMIS: [Main Function](https://www.bcmpkorea.com/en/main-function/)
