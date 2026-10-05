# Crag Description Rich Text Design

## Goal

Crag 관리 화면의 Description 필드에 붙여넣은 Markdown 또는 의미 있는 HTML 클립보드 콘텐츠를 안전한 리치텍스트로 변환하고, 저장한 서식을 공개 Crag 상세 화면에서도 동일하게 표시한다.

## Scope

- 대상은 `/admin/content/crags`의 생성·수정 Description 필드만이다.
- Markdown은 CommonMark/GFM 구조(제목, 문단, 인용, 구분선, 중첩 목록, 체크리스트, 코드, 표, 링크)와 인라인 서식(굵게, 기울임, 취소선, 코드)을 지원한다.
- 확장 표기는 `==텍스트==`(하이라이트), `++텍스트++`(밑줄)도 지원한다.
- 브라우저 클립보드의 HTML에서 같은 의미를 갖는 태그(`strong`, `em`, `s`, `u`, `mark`, 목록, 표, 링크 등)를 보존한다.
- 외부 이미지·동영상·iframe·임의 스타일은 자동 삽입하지 않는다.

## Architecture

1. 클라이언트 `CragDescriptionEditor`는 Tiptap 기반 편집기와 `descriptionRichJson` hidden input을 제공한다. 기존 Server Action의 FormData 경계는 유지한다.
2. 붙여넣기 시 HTML 클립보드는 의미 태그만 정규화하고, Markdown 텍스트는 안전 HTML로 변환한 뒤 Tiptap의 허용 노드로 삽입한다.
3. Server Action은 허용 노드·마크·링크를 Zod로 검증한 Tiptap JSON만 저장한다. 외부 이미지·iframe·임의 HTML 노드는 저장되지 않는다.
4. 공개 Crag 상세는 Tiptap static renderer로 검증된 JSON만 렌더링하며, 기존 일반 텍스트는 fallback으로 유지한다.

## Persistence and Compatibility

- `crags.description`에는 검색·미리보기용 plain text를, `description_rich_json`에는 검증된 Tiptap JSON을 저장한다.
- 기존 일반 텍스트는 `description_rich_json`이 비어 있을 때 그대로 표시되며, 편집기를 열면 안전한 문단 노드로 변환된다.

## Security

- 원본 클립보드 HTML을 그대로 `innerHTML`에 넣거나 저장하지 않는다.
- allowlist 외 태그, 이벤트 속성, CSS style, `data:`/`javascript:` URL 및 미디어/임베드 태그를 제거한다.
- `dangerouslySetInnerHTML`은 sanitizer가 반환한 문자열을 렌더링하는 `RichText` 한 곳에만 한정한다.

## Error Handling

- 파싱하지 못하는 입력은 텍스트로 보존한다.
- 변환 중 오류가 발생하면 붙여넣기를 막지 않고 plain text로 삽입한다.
- 빈 값은 빈 문자열로 제출한다.

## Acceptance Criteria

- 제공된 무등산 Markdown을 붙여넣으면 굵은 문구, 문단, 비순서 목록이 에디터와 공개 Crag 상세에 표시된다.
- 제목, 중첩 목록, 체크리스트, 인용, 코드, 표, 링크, 굵게/기울임/취소선/밑줄/하이라이트가 변환된다.
- HTML 클립보드의 `strong`, `em`, `s`, `u`, `mark`, 목록, 표, 링크가 유지된다.
- `<script>`, event handler, style, `javascript:` URL, iframe, image는 저장·렌더링 결과에 포함되지 않는다.
- 기존 plain-text Description은 안전하게 줄바꿈을 보존해 렌더링된다.
