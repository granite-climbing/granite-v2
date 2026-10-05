# Crag Description Rich Text Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Crag Description Markdown/HTML 붙여넣기를 안전한 리치텍스트로 저장하고 공개 상세에 렌더링한다.

**Architecture:** Markdown 파싱과 HTML sanitization을 `lib/rich-text`에 분리한다. 클라이언트 편집기는 hidden form field로 기존 Server Action을 유지하고, 공개 출력은 공용 서버 렌더러가 sanitizer 결과만 출력한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, unified/remark/rehype ecosystem.

---

### Task 1: Markdown 변환과 HTML sanitize 유틸리티

**Files:**
- Create: `lib/rich-text/crag-description.ts`
- Create: `lib/rich-text/crag-description.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

1. sanitizer와 Markdown 변환의 허용 태그·속성, 안전한 링크 프로토콜을 검증하는 failing tests를 작성한다.
2. `vitest run lib/rich-text/crag-description.test.ts`로 기대한 실패를 확인한다.
3. GFM/확장 inline 문법을 HTML로 변환하고 plain text 및 HTML 클립보드를 allowlist로 정규화하는 최소 구현을 작성한다.
4. 같은 테스트를 실행해 통과를 확인한다.

### Task 2: Crag Description 편집기

**Files:**
- Create: `components/admin/crag-description-editor.tsx`
- Create: `components/admin/crag-description-editor.test.tsx`
- Modify: `app/admin/(protected)/content/crags/page.tsx`

1. Markdown 및 HTML paste가 hidden `description` input에 안전 HTML을 기록하는 failing component tests를 작성한다.
2. 테스트의 expected failure를 확인한다.
3. client-side editor, paste conversion, hidden form value 동기화, 안내 문구를 구현하고 생성·수정 폼의 textarea를 교체한다.
4. component tests를 통과시킨다.

### Task 3: 공개 RichText 출력과 회귀 검증

**Files:**
- Create: `components/public/rich-text.tsx`
- Create: `components/public/rich-text.test.tsx`
- Modify: `app/(site)/c/[cragSlug]/page.tsx`

1. 리치텍스트가 허용 HTML을 렌더링하고 기존 plain text를 이스케이프·줄바꿈 보존하는 failing tests를 작성한다.
2. 테스트 실패를 확인한다.
3. InfoRow의 Description body를 RichText로 교체하되 Travel 미리보기는 안전한 plain-text 요약을 유지한다.
4. 관련 테스트, `npm run typecheck`, `npm run build`를 실행한다.

### Task 4: 독립 검토와 커밋 준비

**Files:**
- Review: 위 변경 파일 전체

1. `git diff --check`, 전체 Vitest, typecheck, build를 실행한다.
2. 추가된 라인을 대상으로 secret/XSS 위험을 점검한다.
3. 독립 코드 리뷰를 실행하고 문제를 수정한 뒤 재검증한다.
