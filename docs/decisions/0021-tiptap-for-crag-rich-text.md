---
id: 0021
title: Crag 설명 리치 텍스트에 Tiptap과 제한된 JSON 문서를 사용한다
status: Accepted
date: 2026-09-10
---

## Context

Crag 설명은 현재 관리자 `textarea`에서 평문으로 작성되고 공개 상세 화면에서는 줄바꿈만 보존해 출력된다. 접근법·주차·자연보호·안전 주의사항을 더 읽기 쉽게 전달하기 위해 굵게·기울임·제목(H2/H3)·밑줄·하이라이트·Unicode 이모지·문단/줄바꿈·글머리/번호 목록·HTTPS 링크·구분선·인용문·체크리스트를 지원해야 한다.

Granite는 Next.js App Router와 React를 사용하며, 관리자는 별도 Admin drawer UI 안에서 콘텐츠를 작성한다. 따라서 완성형 WYSIWYG UI를 그대로 삽입하기보다 기존 Tailwind 디자인과 권한 모델에 맞는 작은 toolbar가 필요하다. 또한 관리자 입력이라도 공개 HTML 출력 경로가 생기므로 XSS 방어, 서버 렌더링, 레거시 `crags.description` 평문 데이터와의 호환을 함께 결정해야 한다.

## Decision

Crag 설명 리치 텍스트 편집기로 **Tiptap**을 채택하고, HTML/Markdown 문자열이 아닌 **제한된 ProseMirror JSON**을 정본으로 저장한다.

- 클라이언트 편집기: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-highlight`, `@tiptap/extension-list`.
- 저장: `crags.description_rich_json`에 허용된 JSON만 저장한다. 기존 `crags.description`에는 JSON에서 도출한 평문을 함께 저장해 레거시 화면·검색·Travel 카드의 계약을 유지한다.
- 공개 렌더링: `@tiptap/static-renderer`로 검증된 JSON을 React element로 렌더링한다. `dangerouslySetInnerHTML`는 사용하지 않는다.
- 서버 allowlist:
  - node: `doc`, `paragraph`, `heading`(H2/H3), `text`, `hardBreak`, `bulletList`, `orderedList`, `listItem`, `taskList`, `taskItem`, `blockquote`, `horizontalRule`
  - mark: `bold`, `italic`, `underline`, 단색 `highlight`, `link`
  - 링크는 `href`만 가지며 `https://` URL만 허용한다. 공개 출력은 `target="_blank" rel="noopener noreferrer"`를 강제한다.
- 이미지, 표, 동영상, 파일, 코드 블록, 커스텀 이모지, 협업 편집, 중첩 목록은 이번 결정의 범위 밖이다.

세부 UX, 데이터 migration, 입력 검증 및 테스트 계획은 `docs/specs/2026-09-10-rich-text-crag-description.md`와 `docs/plans/2026-09-10-rich-text-crag-description.md`를 따른다.

## Consequences

### 좋은 영향

- React/Next.js에 맞는 headless 편집기이므로 Granite의 Admin drawer와 Tailwind UI에 필요한 toolbar와 dialog만 구현할 수 있다.
- Tiptap JSON은 문서 구조와 mark를 보존해 편집 → 저장 → 재편집의 round-trip이 가능하다.
- JSON allowlist와 React 정적 렌더링으로 HTML 문자열 저장·직접 주입보다 공격면이 작아진다.
- `description_rich_json`이 없는 기존 Crag은 기존 평문과 `whitespace-pre-line` fallback으로 그대로 표시할 수 있다.
- `description`의 파생 평문을 유지하므로 리치 렌더링으로 전환하지 않는 기존 소비자를 동시에 변경할 필요가 없다.

### 비용 및 제약

- Tiptap은 headless이므로 toolbar, 링크 입력 dialog, paste 정책, styling, 접근성 테스트를 Granite가 직접 구현·유지해야 한다.
- 허용 node/mark 하나를 추가할 때마다 editor extension, 서버 Zod schema, JSON→평문 변환, static renderer mapping, 보안/회귀 테스트를 모두 함께 갱신해야 한다.
- 중복 컬럼(`description`, `description_rich_json`)이 존재한다. 리치 JSON이 정본이고 평문은 서버에서만 파생해야 하며, 두 값을 독립적으로 수정하면 안 된다.
- Tiptap package의 major 버전 업데이트는 JSON schema와 static renderer의 호환성 테스트를 선행해야 한다.

### 재검토 트리거

- 이미지/동영상/파일 업로드, 공동 편집, 댓글·변경 추적, 사용자 생성 콘텐츠가 필요해지는 경우
- 콘텐츠가 Markdown 파일로 외부 교환되어야 하는 경우
- Rich text를 Crag 외 Sector/Route/Announcement 등으로 확대하는 경우

위 요구가 생기면 새 ADR에서 지원 node/mark, 미디어 저장소·검수·권한, Markdown export 정책을 별도로 결정한다.

## Alternatives considered

- **Markdown을 정본으로 저장:** 사람이 읽기 쉽고 Git 친화적이지만, 밑줄은 CommonMark 표준 문법이 아니다. Tiptap의 Markdown 기능도 early release이고 밑줄은 비표준 `++text++` 표현에 의존한다. 이번 지원 서식의 안정적인 round-trip 정본으로는 부적합하다.
- **HTML 문자열 + DOMPurify:** 초기에 구현이 단순해 보이지만 입력/저장/SSR 출력의 sanitization allowlist와 bypass 대응을 지속적으로 관리해야 한다. React의 `dangerouslySetInnerHTML` 경로를 만들지 않는 제한 JSON 방식보다 위험과 정책 비용이 크다.
- **Lexical:** React 친화적이고 성능이 좋지만, 현재 고정된 관리자 toolbar와 서버 정적 출력 요구에는 Tiptap의 extension 구성과 Static Renderer가 더 직접적인 경로다. 성능·복잡한 custom node가 핵심 요구가 되면 재검토한다.
- **CKEditor 5/TinyMCE 등 완성형 에디터:** 빠른 WYSIWYG 시작에는 유리하지만, 현재 Admin drawer의 디자인·작은 기능 범위에 비해 제공 UI, 번들, 설정, 라이선스 검토 범위가 과하다.

## References

- [Tiptap GitHub — MIT license, headless editor](https://github.com/ueberdosis/tiptap)
- [Tiptap StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)
- [Tiptap Static Renderer](https://tiptap.dev/docs/editor/api/utilities/static-renderer)
- [Tiptap Markdown — early release](https://tiptap.dev/docs/editor/markdown)
- [Tiptap Markdown export — non-standard underline syntax](https://tiptap.dev/docs/conversion/export/markdown/editor-extension)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

조회일: 2026-09-10
