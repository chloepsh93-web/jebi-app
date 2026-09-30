# 제비 — 마음을 기억하는 집

받은 마음도, 전할 마음도 놓치지 않게.
경조사 소식을 기록하면 제비가 지붕 위 박으로 키워주고, 갚을 때가 되면 먼저 알려주는 앱.

- 스택: **Next.js (App Router) + Supabase + Vercel**
- 디자인 기준: `~/workspace/user/files/jebi-mockup-v3.1_2.html`
- 온보딩 기준: `~/workspace/user/files/jebi-onboarding-interactive.html`

## 시작하기

### 1. Supabase 프로젝트 준비

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `schema.sql` 전체 실행 (테이블 `yeons`, `maeums`, 인덱스, RLS 정책 생성)
3. **Authentication → Sign In / Sign Up → Anonymous Sign-ins 활성화**
   - 이 앱은 로그인 화면 없이 익명 세션으로 사용자를 식별합니다.

### 2. 환경변수

`.env.example`을 복사해 `.env.local` 생성:

```
cp .env.example .env.local
```

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(public) 키 |

> 실서비스 키가 아닌 anon 키만 사용합니다. RLS로 본인 데이터만 읽고 쓸 수 있습니다.

### 3. 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 접속. 환경변수가 없으면 설정 안내 화면이 나옵니다.

### 4. Vercel 배포

1. 이 디렉터리를 Git 저장소로 푸시
2. Vercel에서 Import → Framework: Next.js
3. Environment Variables에 위 두 변수 등록
4. Deploy

## 백업 · 복원 (P2-1)

- 모든 기록(인연·마음)은 **Supabase 서버에 저장**됩니다.
  브라우저 localStorage에만 두지 않으므로, 기기를 바꾸거나 앱을 지워도 데이터가 유지됩니다.
- 온보딩 완료 여부만 기기에 저장되는 가벼운 플래그입니다.
- 서버 데이터는 Supabase 대시보드 → Database → Backups에서 백업/복원할 수 있습니다.

## 용어 정리

- **인연**: 주고받는 상대 (사람). `id` 기준으로 관리되며, 동명이인도 각각 구분됩니다.
- **마음**: 주고받은 한 건의 기록 (받은 마음 / 보낸 마음).
- **박**: 받은 마음이 지붕 위에서 자라는 상태 표현.
  `심음 → 자람 → 익음 → (다녀왔어요) 열림`, 오래 두면 `오래 익음`.
- CTA 정리: 받은 마음은 **"지붕에 심기"**, 보낸 마음은 **"제비 편에 보내기"**,
  일반 진입은 **"소식 기록하기"**.

## 결함 리스트 해결 체크리스트 (Definition of Done)

- [x] **P0 — 온보딩**: 인터랙티브 온보딩(첫 박 심기·파싱 체험·세계관)이 앱 진입점에 통합.
      첫 사용자(`onboarded=false`)는 빈 화면 대신 온보딩을 봅니다.
- [x] **P1-1 — 갚기**: 받은 마음마다 갚기(다녀왔음) 액션.
      홈의 "갚을 때가 온 박" 카드, 타임라인 항목, 마음 상세 시트에 배치.
- [x] **P1-2 — 인연 타임라인**: 인연 목록에서 항목을 누르면 타임라인 화면으로 이동.
- [x] **P1-3 — 범위 외 소식**: 파서가 "기타"로 분류하면
      "제비가 아직 배우지 못한 소식이에요 (개업·집들이 등)" 안내 표시 후 저장.
- [x] **P2-1 — 백업·복원**: Supabase 서버 저장. README와 "나" 탭에 명시.
- [x] **P2-2 — 날짜 입력**: 모든 날짜 입력은 달력 피커(`<input type="date">`).
      연도를 모르면 "연도를 몰라요" 토글로 월/일만 입력 (`????-MM-DD` 저장).
- [x] **P2-3 — 빈 상태**: 첫 화면/빈 목록에 가치 설득 카피 포함.
- [x] **P2-4 — 동명이인**: 인연을 이름이 아닌 `id` 기준으로 관리.
      같은 이름이 여러 명이면 기록 시 선택 UI, 목록에서는 관계·첫 기록일로 구분 표시.
- [x] **P3-1 — 폰트**: `next/font/local`로 Pretendard Variable·Noto Serif KR 셀프호스팅
      (`public/fonts/`). 외부 CDN 미사용.
- [x] **P3-2 — 입력 폰트**: 모든 입력 필드 `font-size: 16px` 이상 (iOS 확대 방지).

## 이전 UX 감사 반영 (요약)

- 감지 화면 진입 경로 불명확 → 소식 기록 플로우에 통합
- 인연 추가·수정, 마음 추가·수정 화면 부재 → 목업 언어로 신규 폼 작성
- 결산 진입 경로 부재 → "나" 탭에서 진입
- 알림 데모 화면 → 데이터 기반 알림 센터 (행사 D+1 확인, 3일 넛지, 1·3·5년 리마인드)
- 빈 상태·로딩·설정 누락·파싱 실패·저장 중·삭제 확인 → 상태 화면/다이얼로그 추가
- 파괴적 삭제는 다크 반전 2-action 다이얼로그 사용
- 행사 다음 날 확인·3일 넛지의 상태 전환 → `repaid_at`·`reminded_at` 기반 실제 액션 연결
- 날짜 표기 혼재 → `lib/format.js` 유틸로 통일
- 온보딩 9:16 영역의 수직 오버플로우 → 내부 스크롤로 수정

## 남은 일 (실키·배포)

- [ ] Supabase 실 키로 연결 테스트 (스키마 적용, 익명 로그인, CRUD)
- [ ] Vercel 배포 후 모바일 실기기 확인 (420px 레이아웃, 날짜 피커, 폰트)
- [ ] PWA 아이콘/스플래시 최종 점검
