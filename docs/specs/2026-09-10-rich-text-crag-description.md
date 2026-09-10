# Crag 설명 리치 텍스트 — 기능 명세

> 상태: 구현 대기
> 작성일: 2026-09-10
> 대상: Granite 관리자 Crag 생성·수정 화면 및 공개 Crag 상세 화면
> 선행 기준: `AGENTS.md`, `docs/DATA_MODEL.md`, `app/admin/(protected)/content/crags/page.tsx`

## 1. 목적

관리자가 Crag(크랙) 설명을 작성할 때 줄바꿈만 가능한 `textarea` 대신, 아래 서식을 안전하게 작성·저장·표시할 수 있게 한다.

- 굵게
- 기울임
- 제목(H2/H3)
- 밑줄
- 이모지(Unicode)
- 문단과 줄바꿈
- 글머리 목록·번호 목록
- 링크
- 구분선
- 인용문
- 하이라이트
- 체크리스트

현재 Crag 설명은 관리자 화면의 `textarea`에서 평문으로 입력되고, 공개 상세 화면의 `InfoRow`가 `whitespace-pre-line`으로 출력한다. 따라서 굵게·제목·밑줄은 표현할 수 없다.

## 2. 범위

### 포함

1. Crag 관리자 생성/수정 drawer의 리치 텍스트 편집기
2. 정해진 서식 toolbar, 링크 입력 UI 및 키보드 단축키
3. JSON 기반 구조화 저장, 기존 평문 설명과의 하위 호환
4. Crag Info 탭의 접근성 있는 리치 텍스트 렌더링
5. 입력 유효성 검증, 길이 제한, 회귀/보안 테스트

### 제외

- Sector, Route, Announcement 등 다른 `description` 필드의 리치 텍스트화
- 이미지·동영상·파일 업로드, 표, 코드 블록
- Markdown 원문 입력/저장, HTML 직접 입력/저장
- `:shortcode:` 이모지 자동완성, 커스텀 이모지, 협업 편집
- Travel 탭 카드의 리치 텍스트 렌더링(기존 요약용 평문 출력 유지)

## 3. 결정

### 3.1 선택: Tiptap + ProseMirror JSON, 서버 정적 렌더링

**채택 라이브러리**

- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-highlight`, `@tiptap/extension-list`
- 공개 화면: `@tiptap/static-renderer`의 React 정적 렌더러

Tiptap core는 MIT 라이선스인 headless 에디터 프레임워크이며 React 바인딩을 제공한다. 이 프로젝트는 Next.js/React이고 관리자 UI를 Tailwind로 직접 구성하고 있으므로, 미리 정해진 WYSIWYG UI보다 toolbar를 최소 기능으로 직접 제어하는 방식이 현재 디자인과 의존성 비용에 맞는다.

### 3.2 저장 포맷: Tiptap JSON을 정본으로 사용

`Markdown`은 굵게·제목·개행에는 적합하지만 밑줄에는 CommonMark 표준 문법이 없다. Tiptap도 밑줄을 `++text++`이라는 비표준 문법으로 내보낸다고 명시한다. 또한 Tiptap Markdown extension은 early release다. 그러므로 이 기능의 정본은 Markdown/HTML이 아닌 제한된 ProseMirror JSON으로 한다.

예시:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "접근 안내 🪨" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "marks": [{ "type": "bold" }], "text": "주차 후" },
        { "type": "text", "text": " 계곡길을 따라 10분 이동합니다." }
      ]
    }
  ]
}
```

### 3.3 이모지 정책

Unicode 이모지는 일반 텍스트로 저장·렌더링한다. 운영체제 이모지 키보드, 붙여넣기, 일반 텍스트 입력을 모두 허용한다. 이모지 picker나 `:climbing:` shortcode 변환은 이번 범위가 아니다. 별도 emoji 노드를 도입하지 않아 복사·검색·접근성 동작도 일반 텍스트와 동일하게 유지한다.

### 3.4 보안 모델

- HTML을 입력·저장·`dangerouslySetInnerHTML`로 출력하지 않는다.
- Server Action에서 JSON 문자열을 파싱한 뒤 허용 노드·mark·속성만 재귀 Zod 스키마로 검증한다.
- 허용 노드: `doc`, `paragraph`, `heading(level 2 또는 3)`, `text`, `hardBreak`, `bulletList`, `orderedList`, `listItem`, `taskList`, `taskItem(checked: boolean)`, `blockquote`, `horizontalRule`.
- 허용 mark: `bold`, `italic`, `underline`, `highlight`, `link`.
- link의 속성은 `href`만 허용하며 값은 `https://` URL이어야 한다. 공개 렌더링은 항상 `target="_blank" rel="noopener noreferrer"`를 붙인다. 색상 하이라이트와 `mailto:`, 상대 URL, `javascript:`/`data:` URL은 허용하지 않는다.
- `heading`은 설명 안에서 H2/H3만 허용한다. Crag 이름은 이미 페이지 H1이므로 H1을 금지한다.
- 정적 React renderer가 검증된 JSON과 동일한 extension 목록으로 React element를 만든다. 원시 HTML 주입은 없다.
- 저장/출력 경계 모두에서 JSON 검증을 수행한다. renderer 오류 또는 알 수 없는 노드/mark는 공개 화면에서 평문 fallback을 출력하고 서버 로그를 남긴다.

## 4. 데이터 계약과 마이그레이션

새 롤포워드 전용 migration `migrations/0018_crag_rich_description.sql`을 추가한다. (작성 시점의 마지막 migration은 `0017`이다.)

```sql
ALTER TABLE crags ADD COLUMN description_rich_json TEXT;
```

| 컬럼 | 역할 | 전환 후 규칙 |
|---|---|---|
| `crags.description` | 레거시 호환·요약용 평문 | 리치 JSON이 있으면 서버가 JSON에서 추출한 평문으로 함께 갱신한다. |
| `crags.description_rich_json` | Crag 상세 설명의 정본 | 유효한 제한 JSON 문자열 또는 `NULL`. |

- 기존 row는 migration 직후 `description_rich_json IS NULL`이다. 데이터 backfill은 필수 작업이 아니다.
- 공개 Crag 상세는 `description_rich_json`이 유효하면 이를 렌더링하고, `NULL`/검증 실패면 기존 `description`을 기존처럼 줄바꿈 보존해 표시한다.
- 관리자 수정 화면은 rich JSON이 유효하면 그것을 초기값으로 쓰고, 없으면 기존 `description`을 paragraph/hardBreak로 변환한 JSON을 초기값으로 쓴다.
- 최초 리치 저장 시에도 `description`은 JSON에서 파생한 평문으로 갱신한다. 이로써 Travel 탭 등 아직 평문 계약인 기존 소비자가 깨지지 않는다.

## 5. 관리자 입력 UX

### 5.1 편집기

`components/admin/crag-description-editor.tsx` client component를 만든다. 부모 `<form>`에는 hidden input `name="descriptionRichJson"`을 두며 값은 최신 검증 대상 JSON 문자열이다. 기존 `textarea name="description"`은 제거한다.

Toolbar는 다음 버튼만 제공한다.

| 기능 | 버튼/동작 | 접근성 |
|---|---|---|
| 굵게 | **B**, `Ctrl/Cmd+B` | `aria-label="굵게"`, 활성 상태 `aria-pressed` |
| 기울임 | *I*, `Ctrl/Cmd+I` | `aria-label="기울임"`, 활성 상태 `aria-pressed` |
| 밑줄 | U, `Ctrl/Cmd+U` | `aria-label="밑줄"`, 활성 상태 `aria-pressed` |
| 하이라이트 | 형광펜 아이콘 | `aria-label="하이라이트"`, 기본 단색만 사용 |
| 제목 2 | `H2` | `aria-label="제목 2"` |
| 제목 3 | `H3` | `aria-label="제목 3"` |
| 본문 | `본문` | 현재 블록을 paragraph로 전환 |
| 줄바꿈 | Enter=새 문단, Shift+Enter=같은 문단 hard break | 별도 버튼 없음 |
| 글머리 목록 | 목록 아이콘 | `aria-label="글머리 목록"` |
| 번호 목록 | 번호 목록 아이콘 | `aria-label="번호 목록"` |
| 체크리스트 | 체크박스 아이콘 | `aria-label="체크리스트"`; 공개 화면은 읽기 전용 |
| 인용문 | 인용 아이콘 | `aria-label="인용문"` |
| 구분선 | 수평선 아이콘 | `aria-label="구분선 삽입"` |
| 링크 | 링크 아이콘 | `aria-label="링크"`; URL 입력 dialog를 열고 HTTPS URL만 저장 |

- placeholder: `크랙 접근, 주차, 주의사항 등을 작성하세요.`
- 에디터 아래에 “제목, 목록, 링크, 인용문, 강조, 체크리스트를 사용할 수 있습니다.”를 표시한다.
- 링크 dialog는 선택 영역이 있을 때 열리며, 유효한 HTTPS URL 저장·기존 링크 편집·링크 해제를 지원한다. URL 검증 오류는 dialog 안에 표시한다.
- 붙여넣기 시 허용 서식(목록, 인용문, 링크 포함)만 보존하고, 표·이미지·동영상·코드 같은 비지원 구조는 plain text/paragraph로 평탄화한다.
- 빈 문서는 저장 시 빈 리치 JSON 대신 `description_rich_json = NULL`, `description = ""`으로 저장한다.

### 5.2 제한과 오류

- 최대 **20,000 UTF-16 code units**(JSON 직렬화 전 사용자 텍스트 합계 기준), 최대 200 block 노드.
- Server Action 유효성 실패 시 기존 action 오류 처리 경로로 요청을 실패시킨다. 구현 시에는 관리자에게 “설명 형식이 올바르지 않거나 최대 길이를 초과했습니다.”를 표시하는 UX를 추가한다.
- 클라이언트 길이 카운터는 즉시 피드백 용도일 뿐, 서버 검증을 대체하지 않는다.

## 6. 공개 출력 UX

Crag 상세 Info 탭의 `InfoRow`는 `body: string` 대신 `descriptionRichJson: string | null`와 `descriptionText: string`을 받을 수 있게 확장하거나, 전용 `RichDescription` 컴포넌트를 사용한다.

- paragraph: 기존 body와 비슷한 `14px / leading-5` 본문 스타일, 문단 사이 `8px`.
- H2: `18px`, semibold. H3: `16px`, semibold. 제목 hierarchy는 semantic `h2`/`h3`로 렌더링한다.
- bold: `<strong>`, italic: `<em>`, underline: `<u>`, highlight: `<mark>`.
- hardBreak: `<br>`.
- 이모지: 브라우저 기본 텍스트 렌더링.
- bullet/ordered list: semantic `<ul>`/`<ol>`/`<li>`; 중첩 목록은 지원하지 않는다.
- checklist: 체크 상태를 표시하는 읽기 전용 `<ul>`/checkbox이며, 공개 화면에서 사용자가 상태를 바꿀 수 없다.
- blockquote: semantic `<blockquote>`와 좌측 border 스타일을 사용한다.
- horizontalRule: `<hr>`로 렌더링한다.
- link: 새 탭으로 열리고 `rel="noopener noreferrer"`를 갖는다.
- legacy fallback: 기존 `whitespace-pre-line`을 유지한다.

## 7. 수용 조건

1. 관리자가 새 Crag 또는 기존 Crag에서 굵게·기울임·H2/H3·밑줄·하이라이트·Unicode 이모지·문단/Shift+Enter·글머리/번호 목록·체크리스트·인용문·구분선·HTTPS 링크를 입력하고 저장할 수 있다.
2. 새 JSON 컬럼에는 지원 구조만 저장되고 `description`에는 동등한 평문이 저장된다.
3. 새로고침 후 편집 drawer는 동일한 서식을 복원한다.
4. 공개 `/c/[cragSlug]` Info 탭은 각 허용 서식과 이모지를 의미론적 HTML로 표시하고, 링크는 새 탭과 안전한 `rel` 속성으로 연다. 체크리스트는 읽기 전용이다.
5. 기존 `description_rich_json IS NULL` Crag은 이전과 동일하게 평문과 개행을 표시한다.
6. 악성/알 수 없는 node, mark, attribute, HTTPS 이외 URL이 포함된 JSON은 저장되지 않으며 공개 출력에도 원시 HTML이 주입되지 않는다.
7. `pnpm test`, `pnpm typecheck`, `pnpm build`가 통과한다.

## 8. 검토한 대안

| 대안 | 장점 | 미채택 이유 |
|---|---|---|
| Markdown + renderer | 사람이 직접 읽고 Git 친화적 | 밑줄이 CommonMark 표준이 아니며 Tiptap Markdown extension은 early release; 요청 서식의 round-trip 안정성이 낮다. |
| HTML 문자열 + DOMPurify | 구현 초기에 단순해 보임 | 입력/출력 양쪽 sanitization 정책, 허용 목록, SSR 일관성 부담이 생긴다. JSON allowlist + React 정적 렌더링이 더 좁은 공격면이다. |
| Lexical | React 친화적·성능 우수 | 현재 요구는 작은 고정 toolbar이고, Tiptap의 서버 정적 React renderer/확장 생태계가 구현량을 더 줄인다. |
| 완성형 CKEditor/TinyMCE | 빠른 WYSIWYG 시작 | 관리자 drawer 디자인/기능 범위보다 UI·번들·설정이 과하다. |

## 9. 조사 출처 (2026-09-10 조회)

- [Tiptap GitHub — MIT 라이선스와 headless editor](https://github.com/ueberdosis/tiptap)
- [Tiptap Underline extension — `<u>` 정규화](https://tiptap.dev/docs/editor/extensions/marks/underline)
- [Tiptap Markdown 소개 — early release 및 제한](https://tiptap.dev/docs/editor/markdown)
- [Tiptap Markdown export — underline의 비표준 `++text++`](https://tiptap.dev/docs/conversion/export/markdown/editor-extension)
- [Tiptap Static Renderer — JSON에서 React/HTML 렌더](https://tiptap.dev/docs/editor/api/utilities/static-renderer)
- [Tiptap Emoji extension — inline node 및 plain text copy 동작](https://tiptap.dev/docs/editor/extensions/nodes/emoji)
- [Tiptap StarterKit — 기본 목록, 인용문, 구분선, 기울임, 링크](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)
- [Tiptap TaskList extension — 체크리스트](https://tiptap.dev/docs/editor/extensions/nodes/task-list)
- [Tiptap Highlight extension — 하이라이트](https://tiptap.dev/docs/editor/extensions/marks/highlight)
- [Tiptap Link extension — link mark](https://tiptap.dev/docs/editor/extensions/marks/link)
- [OWASP XSS Prevention Cheat Sheet — HTML sanitization 권고](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
