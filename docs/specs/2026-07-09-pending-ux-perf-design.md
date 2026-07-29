# 뮤테이션 pending UX + 응답속도 개선 설계

날짜: 2026-07-09
상태: 승인됨 (A + B 범위)

## 문제

1. 회원가입·기록 추가·프로젝트 저장 등 뮤테이션 시 처리중 표시가 없거나 미약해 사용자가 처리 여부를 알 수 없다.
2. 전반적인 응답이 느리다. 원인:
   - D1을 REST API(HTTP 왕복 150~400ms/쿼리)로 호출하는 구조적 비용 (ADR 0003)
   - 액션 내 독립 쿼리들의 직렬 실행 (기록 추가 최대 7회 왕복)
   - 기록 추가 시 썸네일 획득(외부 fetch + R2 업로드)이 응답 전에 동기 실행 (1~3초)
   - 뮤테이션 후 서버 재렌더가 완료돼야 화면이 바뀜

## 범위 A — UX 레이어

- `components/public/submit-button.tsx` (신규): `useFormStatus` 기반 공용 제출 버튼.
  스피너 + pending 텍스트 + disabled. 서버 컴포넌트 폼 안에서도 동작.
- 회원가입 폼(`app/(site)/signup/page.tsx`): 제출 버튼을 SubmitButton으로 교체 —
  "가입 중" 표시 + 중복 제출 방지.
- `components/public/toast.tsx` (신규): CustomEvent 기반 전역 토스트.
  `showToast(message, variant)` + `<Toaster/>` (site 레이아웃에 마운트, 2.5초 자동 소멸).
- 프로젝트 북마크(`route-more-sheet.tsx`): `useOptimistic`으로 아이콘 즉시 토글,
  결과는 토스트로 표시. 실패 시 자동 롤백.
- 프로젝트 카드 제거(`project-route-card.tsx`): `useOptimistic`으로 카드 즉시 숨김,
  실패 시 롤백 + 에러 토스트.
- 기록 추가 다이얼로그: 성공 시 토스트 표시 (기존에는 다이얼로그가 닫히며 메시지 유실).

## 범위 B — 성능 퀵윈

- `lib/actions/record.ts`:
  - 썸네일 획득 + `updateBetaThumbnailUrl`을 `next/server`의 `after()`로 이동 —
    응답 후 실행, 사용자 체감 1~3초 단축. 실패는 기존처럼 warn 로그만.
  - `findActiveUserById` ∥ `findPublishedRouteIdForBeta` 병렬화 (왕복 1회 절감).
    이를 위해 폼 파싱을 사용자 조회 앞으로 이동 — 세션 쿠키 부재 시 로그인 에러가
    먼저 나가는 순서는 유지.
  - 중복 베타 검사 2건(`findExistingBetaByExternalMedia` ∥ `findExistingBetaByPermalink`)
    병렬화 (왕복 1회 절감).
- `lib/actions/project.ts`: 변경 없음 — 세션 검증은 로컬 JWT라 D1 왕복이 아니어서
  병렬화 이득이 없음을 확인함.
- 회원가입 쿼리(`createUserForCompletedSignup`)는 FK 의존으로 직렬이 불가피 — 범위 외.

## 범위 외 (C안)

D1 바인딩/배치 API 전환은 ADR 0003 재검토가 필요한 구조 변경으로 보류.

## 테스트

- record 액션: `after()`로 썸네일이 지연 실행되는지, 응답 전에 실행되지 않는지 검증.
- Toaster: 표시 + 자동 소멸.
- ProjectRouteCard: 제거 클릭 시 즉시 숨김(낙관적 업데이트) 검증.
