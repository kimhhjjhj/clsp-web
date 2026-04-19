# CLSP (QuickPlan) — Claude 대화 컨텍스트

> 다른 PC에서 Claude Code 시작 시 이 파일을 참고하세요.
> 마지막 업데이트: 2026-04-16 (DWG 지원 + 폴리곤 직접 선택 방식 반영)

---

## 프로젝트 개요

**QuickPlan (CLSP) — Construction Lifecycle Scheduling Platform**
- (주)동양 건설부문 건설 프로젝트 전주기 공정관리 웹 플랫폼
- Python 데스크탑 앱(claude1.py) → Next.js 웹앱 마이그레이션
- 기술스택: Next.js (App Router) + Prisma + PostgreSQL + Tailwind CSS + shadcn/ui

## 4 Phases 구조

| Phase | 명칭 | 상태 |
|-------|------|------|
| Phase 1 | 개략공기 산정 (사업초기검토) | ✅ 완료 |
| Phase 2 | 프리콘/MSP (실시설계 연동) | 미착수 |
| Phase 3 | 시공 실적 관리 | 미착수 |
| Phase 4 | 데이터 환류 (AI 피드백) | 미착수 |

## Phase 1 구현 완료 기능

### 핵심 엔진
- **CPM 엔진** (`lib/engine/cpm.ts`): Kahn's topological sort, forward/backward pass, Total/Free Float
- **WBS 생성** (`lib/engine/wbs-*.ts`): 개략(CP) 20개 공종 / 상세(Full) 층별 전개
- **DXF 파서** (`lib/engine/dxf-parser.ts`): 모든 닫힌 폴리곤(1m²↑) 반환, 면적 큰 순 정렬 — 사용자가 직접 선택. 텍스트 엔티티(TEXT/MTEXT)에서 설계개요(프로젝트명·위치·층수) 자동 추출
- **몬테카를로** (`lib/engine/monte-carlo.ts`): Triangular/Normal/Uniform 분포, P10~P95
- **생산성 조정** (`lib/engine/productivity.ts`): 공종별 multiplier, CPM 재계산
- **PDF 보고서** (`lib/engine/report-pdf.ts`): jsPDF, 표지→요약→WBS→CP→몬테카를로

### UI 컴포넌트
- **프로젝트 생성** (`app/(dashboard)/projects/new/page.tsx`): 4단계 위저드, DXF 업로드, 시추공 API, 지도, 단면도, 리사이즈 가능 패널
- **프로젝트 상세** (`app/(dashboard)/projects/[id]/page.tsx`): Gantt 차트, WBS 테이블, 크리티컬 패스, 몬테카를로 패널, 생산성 조정, PDF 출력 버튼
- **DXF 미리보기** (`components/diagram/DxfPreview.tsx`): Canvas 2D 인터랙티브 — 도면 전체 표시, "대지경계 선택"/"건물외곽 선택" 버튼, 호버 시 면적+레이어 툴팁, 클릭으로 폴리곤 선택 → 폼 자동입력. 선택된 폴리곤: 대지=빨간 점선, 건물=노란 실선
- **단면도** (`components/diagram/BuildingDiagram.tsx`): SVG 건물 단면
- **Gantt 차트** (`components/gantt/GanttChart.tsx`)
- **몬테카를로** (`components/analysis/MonteCarloPanel.tsx`): 히스토그램, KPI
- **생산성** (`components/analysis/ProductivityPanel.tsx`): 슬라이더, 비교 차트

### API 라우트
- `POST /api/cad-parse` — DXF/DWG 파일 파싱 (DWG는 `scripts/dwg2dxf.py`로 변환 후 처리)
- `POST /api/projects/[id]/calculate` — WBS+CPM 계산
- `POST /api/projects/[id]/monte-carlo` — 몬테카를로 시뮬레이션
- `POST /api/projects/[id]/productivity` — 생산성 조정
- `POST /api/ground-info` — 인근 시추공 검색
- `GET /api/geocode` — 주소→좌표 변환

### 디자인
- 사이드바: 다크(#1e293b), QuickPlan 로고, 그라데이션 활성 메뉴
- 상단헤더: 아이콘+텍스트 탭, 검색바, 프로필
- 전체 라운드: rounded-2xl 카드, 그라데이션 아이콘, shadow-sm
- 새 프로젝트: 왼쪽 컨텍스트 패널(진행률+입력현황+TIP) + 폼 + 드래그 리사이즈 우측 패널

## DXF/DWG 업로드 흐름

1. 사용자가 DXF 또는 DWG 파일 업로드
2. DWG → `scripts/dwg2dxf.py` (ezdxf 라이브러리, base64 stdin → DXF stdout) → DXF 텍스트
3. `parseDxf()` 실행:
   - TEXT/MTEXT 엔티티에서 설계개요(프로젝트명·위치·층수) 추출 → 폼 자동입력
   - 모든 닫힌 폴리곤(1m²↑) 수집, 면적 큰 순 정렬
   - 전체 세그먼트 반환 (필터링 없음)
4. DxfPreview에 전체 도면 표시
5. 사용자가 "대지경계 선택" 버튼 → 폴리곤 클릭 → `siteArea`/`sitePerim` 자동입력
6. 사용자가 "건물외곽 선택" 버튼 → 폴리곤 클릭 → `bldgArea`/`bldgPerim` 자동입력

## 중요 참고사항

1. **claude1.py를 참고** (클로드2.py 아님) — 원본 파싱 로직 레퍼런스
2. **Next.js 버전 주의** — `node_modules/next/dist/docs/` 가이드 먼저 확인
3. **Prisma 스키마** — `prisma/schema.prisma` (Project, Task 모델)
4. **DB** — PostgreSQL, `.env`에 DATABASE_URL
5. **DWG 변환** — Python + ezdxf 필요, `scripts/dwg2dxf.py`

## 마지막 작업 상태

- Phase 1 전체 기능 구현 완료
- UI 리디자인 완료 (사이드바, 헤더, 새 프로젝트 페이지)
- PDF 보고서 다운로드 버튼 추가 완료
- 리사이즈 가능 우측 패널 추가 완료
- DWG 파일 지원 추가 + TEXT/MTEXT 설계개요 자동추출
- DXF 도면 전체 표시 + 폴리곤 클릭 직접 선택 방식으로 변경
- GitHub 푸시 완료

## 다음 작업 후보

- Phase 2 (프리콘/MSP) 기능 설계 및 구현
- 대시보드 페이지 리디자인 (현재 기본 상태)
- 프로젝트 목록 페이지 구현
- 모바일 반응형 대응
- GitHub Codespaces 설정 (모바일 코딩용)
