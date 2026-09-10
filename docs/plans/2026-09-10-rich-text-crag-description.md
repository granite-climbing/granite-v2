# Crag 리치 텍스트 설명 구현 계획

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** 관리자 Crag 설명에서 굵게, H2/H3, 밑줄, Unicode 이모지, 문단/줄바꿈을 안전하게 작성·저장·표시한다.

**Architecture:** Tiptap editor는 관리자 client component에서 제한된 JSON 문서를 만들고, Server Action은 재귀 Zod schema로 허용 구조만 검증한다. JSON은 `crags.description_rich_json`에 정본으로 저장하고, 도출한 평문을 기존 `description`에 함께 저장한다. 공개 Crag Info 탭은 동일한 extension 목록을 쓰는 Tiptap Static React Renderer로 검증된 JSON을 렌더링하며, 레거시 평문은 기존 출력으로 fallback한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Zod, D1/SQLite, Vitest, Testing Library, Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/static-renderer`).

**Spec:** `docs/specs/2026-09-10-rich-text-crag-description.md`

---

## 구현 전제

- 작업 branch/worktree: `docs/rich-text-crag-description`, `/home/azureuser/granite-v2-rich-text-crag-description`
- migration은 roll-forward only이며 production D1 적용은 이 계획 범위 밖이다.
- **Crag만** 대상이다. Sector/Route/Announcement의 description API·UI를 변경하지 않는다.
- Tiptap package의 실제 최신 호환 버전은 `pnpm add` 시 lockfile과 Next/React peer dependency를 확인해 같은 major로 고정한다.

## Task 1: 의존성 및 DB 컬럼 추가

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `migrations/0018_crag_rich_description.sql`

**Step 1: migration 계약 테스트 작성**

새 `lib/db/admin-content-queries.test.ts`의 crag upsert 테스트에 `descriptionRichJson` fixture를 추가한다. mock `queryD1`의 SQL/params assertion에서 `description_rich_json`이 insert와 conflict update 양쪽에 포함되는지 확인한다.

```ts
expect(mockedQueryD1).toHaveBeenCalledWith(
  expect.stringContaining("description_rich_json"),
  expect.arrayContaining([richJson]),
);
```

**Step 2: 테스트 실행 — 실패 확인**

Command: `pnpm test lib/db/admin-content-queries.test.ts`

Expected: FAIL — upsert input/SQL에 `descriptionRichJson`이 아직 없다.

**Step 3: migration과 의존성 추가**

1. `pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/static-renderer`
2. migration에 아래 한 문장만 작성한다.

```sql
ALTER TABLE crags ADD COLUMN description_rich_json TEXT;
```

3. lockfile을 함께 갱신한다. 구현 직전에 마지막 migration 번호를 다시 확인한다. 현재 기준 파일명은 `0018_crag_rich_description.sql`이며, 그 전에 새 migration이 추가됐다면 번호를 재사용하지 말고 다음 번호로 바꾸고 spec/plan 참조도 함께 수정한다.

**Step 4: 테스트 실행 — 통과 확인**

Command: `pnpm test lib/db/admin-content-queries.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml migrations lib/db/admin-content-queries.test.ts
git commit -m "feat: add crag rich description storage"
```

## Task 2: 제한 JSON 계약과 평문 변환 유틸

**Files:**
- Create: `lib/content/rich-description.ts`
- Create: `lib/content/rich-description.test.ts`

**Step 1: 실패하는 유틸 테스트 작성**

다음 fixture와 테스트를 작성한다.

```ts
const richJson = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "접근 🪨" }] },
    { type: "paragraph", content: [
      { type: "text", marks: [{ type: "bold" }], text: "주차 후" },
      { type: "hardBreak" },
      { type: "text", marks: [{ type: "underline" }], text: "10분 이동" },
    ] },
  ],
});

expect(parseRichDescription(richJson)).toEqual(expect.objectContaining({ type: "doc" }));
expect(toPlainText(parseRichDescription(richJson))).toBe("접근 🪨\n\n주차 후\n10분 이동");
expect(() => parseRichDescription('{"type":"doc","content":[{"type":"image"}]}')).toThrow();
expect(() => parseRichDescription('{"type":"doc","content":[{"type":"heading","attrs":{"level":1}}]}')).toThrow();
```

추가로 빈 document가 `null` 저장값으로 정규화되는지, 20,001자 text 및 201개 block이 거절되는지 테스트한다.

**Step 2: 테스트 실행 — 실패 확인**

Command: `pnpm test lib/content/rich-description.test.ts`

Expected: FAIL — module not found.

**Step 3: 최소 구현**

`lib/content/rich-description.ts`에 다음 public API를 구현한다.

- `parseRichDescription(raw: string): RichDescriptionDoc` — JSON.parse 후 recursive Zod schema 검증
- `normalizeRichDescriptionForStorage(raw: string | undefined): { richJson: string | null; plainText: string }`
- `toPlainText(doc: RichDescriptionDoc): string`
- `legacyTextToRichDescription(text: string): RichDescriptionDoc`

구현 규칙:

- node allowlist는 `doc`, `paragraph`, `heading`, `text`, `hardBreak`만이다.
- mark allowlist는 `bold`, `underline`만이다. mark에는 속성을 허용하지 않는다.
- heading attrs는 정확히 `level: 2 | 3`만 허용한다.
- 예기치 않은 key/attrs는 Zod `.strict()`로 거절한다.
- plain text는 paragraph 사이 `\n\n`, hardBreak는 `\n`으로 만든다.
- JSON은 `JSON.stringify(parsedDoc)`로 canonicalize한다.
- 20,000 text code units/200 block 제한은 JSON 크기가 아니라 tree를 순회해 적용한다.

**Step 4: 테스트 실행 — 통과 확인**

Command: `pnpm test lib/content/rich-description.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/content/rich-description.ts lib/content/rich-description.test.ts
git commit -m "feat: validate rich crag descriptions"
```

## Task 3: admin 입력/DB write 계약 확장

**Files:**
- Modify: `lib/actions/admin-content-schema.ts`
- Modify: `lib/actions/admin-content.ts`
- Modify: `lib/db/admin-content-queries.ts`
- Modify: `lib/db/admin-content-queries.test.ts`
- Modify: `lib/actions/admin-content.test.ts`

**Step 1: 실패하는 schema/action 테스트 작성**

`admin-content.test.ts`의 crag form fixture에 `descriptionRichJson: richJson`을 넣고 다음을 검증한다.

```ts
expect(parseCragForm({ ...baseCragForm, descriptionRichJson: richJson }))
  .toMatchObject({ descriptionRichJson: richJson });

await saveCragAction(new FormData(/* base fields + descriptionRichJson */));
expect(mockedUpsertCrag).toHaveBeenCalledWith(expect.objectContaining({
  description: "접근 🪨\n\n주차 후\n10분 이동",
  descriptionRichJson: richJson,
}));
```

빈 rich document가 `{ description: "", descriptionRichJson: null }`을 전달하고 image node JSON이 action 전에 reject되는 테스트도 추가한다.

**Step 2: 테스트 실행 — 실패 확인**

Command: `pnpm test lib/actions/admin-content.test.ts lib/db/admin-content-queries.test.ts`

Expected: FAIL — `descriptionRichJson`이 schema/input type/SQL에 없다.

**Step 3: 최소 구현**

1. `cragFormSchema`에는 raw `descriptionRichJson` string optional 필드만 추가한다. 기존 `description` 외부 input은 호환을 위해 action에 남기지 말고 Task 2 utility가 만든 값을 action에서 사용한다.
2. `saveCragAction`에서 admin 인증 뒤 `normalizeRichDescriptionForStorage(parsed.descriptionRichJson)`을 호출하고, `upsertCrag`에 명시적으로 `description`, `descriptionRichJson`을 보낸다.
3. `upsertCrag` input type과 SQL의 `INSERT` column/value, `ON CONFLICT` update에 `description_rich_json`/`descriptionRichJson`을 추가한다.
4. `getAdminCrags` 및 공개 Crag query의 row type/SELECT에 `description_rich_json AS descriptionRichJson`을 추가한다. 공개/관리자 read model의 field name은 모두 camelCase `descriptionRichJson`으로 통일한다.
5. audit metadata에는 rich JSON 전체를 넣지 않는다. 필요하면 `hasRichDescription: Boolean(...)`만 기록한다.

**Step 4: 테스트 실행 — 통과 확인**

Command: `pnpm test lib/actions/admin-content.test.ts lib/db/admin-content-queries.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/actions/admin-content-schema.ts lib/actions/admin-content.ts lib/db/admin-content-queries.ts lib/db/admin-content-queries.test.ts lib/actions/admin-content.test.ts lib/db
git commit -m "feat: persist rich crag descriptions"
```

## Task 4: 관리자 Tiptap 편집기

**Files:**
- Create: `components/admin/crag-description-editor.tsx`
- Create: `components/admin/crag-description-editor.test.tsx`
- Modify: `app/admin/(protected)/content/crags/page.tsx`

**Step 1: 실패하는 component 테스트 작성**

Tiptap editor는 browser API에 의존하므로 `@tiptap/react`의 `useEditor`, `EditorContent`를 mock한다. 다음을 테스트한다.

```tsx
render(<CragDescriptionEditor initialRichJson={null} initialText="첫 줄\n둘째 줄" />);
expect(screen.getByRole("button", { name: "굵게" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "제목 2" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "밑줄" })).toBeInTheDocument();
expect(screen.getByDisplayValue(expect.stringContaining('"type":"doc"'))).toHaveAttribute("name", "descriptionRichJson");
```

mock editor의 `isActive`/`chain().focus().toggleBold().run()` spy로 굵게 버튼이 올바른 command를 실행하고, `onUpdate`가 hidden input 값 갱신으로 이어지는 것을 테스트한다.

**Step 2: 테스트 실행 — 실패 확인**

Command: `pnpm test components/admin/crag-description-editor.test.tsx`

Expected: FAIL — component not found.

**Step 3: 최소 구현**

- 파일 첫 줄에 `"use client"`를 둔다.
- `StarterKit.configure({ heading: { levels: [2, 3] } })`, `Underline`만 extension으로 등록한다. support하지 않는 StarterKit nodes/marks(링크, 목록, code, blockquote 등)는 extension 구성에서 제거하거나 paste transform에서 허용 tree로 정규화한다.
- prop: `initialRichJson: string | null`, `initialText: string`.
- initial rich JSON은 Task 2 parser로 안전하게 파싱하고 실패하면 legacy text conversion으로 fallback한다.
- hidden input은 `name="descriptionRichJson"`, textarea는 사용하지 않는다.
- toolbar button은 `type="button"`, `aria-label`, `aria-pressed`를 모두 갖는다.
- 에디터 update마다 JSON을 hidden input에 반영한다. client 제한 초과 시 저장 버튼을 직접 제어하지 말고 경고를 표시하며 서버가 최종 거절한다.
- `crags/page.tsx`의 create/edit textarea를 component로 교체하고 `editRow.descriptionRichJson`과 `editRow.description`을 전달한다.

**Step 4: 테스트 실행 — 통과 확인**

Command: `pnpm test components/admin/crag-description-editor.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/crag-description-editor.tsx components/admin/crag-description-editor.test.tsx 'app/admin/(protected)/content/crags/page.tsx'
git commit -m "feat: add crag rich description editor"
```

## Task 5: 공개 static renderer와 legacy fallback

**Files:**
- Create: `components/public/rich-description.tsx`
- Create: `components/public/rich-description.test.tsx`
- Modify: `app/(site)/c/[cragSlug]/page.tsx`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/repository.test.ts`

**Step 1: 실패하는 renderer/read model 테스트 작성**

`rich-description.test.tsx`에서 검증된 fixture의 heading, strong, u, hard break, emoji를 확인한다.

```tsx
render(<RichDescription richJson={richJson} fallbackText="legacy" />);
expect(screen.getByRole("heading", { level: 2, name: "접근 🪨" })).toBeInTheDocument();
expect(screen.getByText("주차 후").tagName).toBe("STRONG");
expect(screen.getByText("10분 이동").tagName).toBe("U");

render(<RichDescription richJson={null} fallbackText={"첫 줄\n둘째 줄"} />);
expect(screen.getByText("첫 줄\n둘째 줄")).toHaveClass("whitespace-pre-line");
```

`repository.test.ts`에서는 Crag detail row에 `description_rich_json`이 있을 때 `descriptionRichJson`이 model로 전달되는지 확인한다.

**Step 2: 테스트 실행 — 실패 확인**

Command: `pnpm test components/public/rich-description.test.tsx lib/db/repository.test.ts`

Expected: FAIL — renderer/read model field가 없다.

**Step 3: 최소 구현**

1. `components/public/rich-description.tsx`에서 Task 2 `parseRichDescription`로 JSON을 검증한다.
2. 검증 성공 시 `@tiptap/static-renderer/pm/react`의 renderer와 editor와 동일한 최소 extension 목록을 사용한다. `dangerouslySetInnerHTML`을 쓰지 않는다.
3. renderer node/mark mapping은 semantic `h2`, `h3`, `p`, `br`, `strong`, `u`와 spec의 Tailwind class를 반환한다.
4. `richJson`이 null 또는 검증/renderer 오류면 `fallbackText`를 `<p className="... whitespace-pre-line">`로 출력한다. 오류는 서버에 `console.error`로 context 없이 기록한다.
5. Crag DB schema/query/read type에 `descriptionRichJson`을 추가한다.
6. `InfoRow`에 원시 `body` 대신 `RichDescription`을 연결한다. Travel 카드에는 `crag.description` 평문을 그대로 유지한다.

**Step 4: 테스트 실행 — 통과 확인**

Command: `pnpm test components/public/rich-description.test.tsx lib/db/repository.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add components/public/rich-description.tsx components/public/rich-description.test.tsx 'app/(site)/c/[cragSlug]/page.tsx' lib/db/schema.ts lib/db/queries.ts lib/db/repository.test.ts
git commit -m "feat: render rich crag descriptions"
```

## Task 6: 통합 회귀·보안 검증

**Files:**
- Modify: `lib/content/rich-description.test.ts`
- Modify: `lib/actions/admin-content.test.ts`
- Modify: `components/public/rich-description.test.tsx`
- Modify: `docs/DATA_MODEL.md`

**Step 1: 실패하는 보안/round-trip 테스트 추가**

아래 cases를 명시적으로 추가한다.

1. `script`, `image`, `link`, `bulletList` node 거절
2. `text` node의 임의 attribute 거절
3. bold mark의 `onclick` attribute 거절
4. HTML 문자열(`<img src=x onerror=...>`)은 JSON parse 실패
5. legacy multiline 텍스트 → JSON → plain text의 개행 보존
6. JSON → 저장 → renderer로 heading/bold/underline/emoji/hardBreak가 모두 유지

**Step 2: 테스트 실행 — 실패 확인**

Command: `pnpm test lib/content/rich-description.test.ts lib/actions/admin-content.test.ts components/public/rich-description.test.tsx`

Expected: FAIL — 새 regression case 중 하나 이상을 보호하지 못한다면 구현을 보완한다.

**Step 3: 최소 구현/문서 갱신**

- 실패한 case를 통과하도록 allowlist/normalizer/renderer를 최소 수정한다. HTML sanitization library나 허용 범위를 넓히지 않는다.
- `docs/DATA_MODEL.md` Crag 표에 `description_rich_json` (`TEXT`, nullable, 제한된 Tiptap JSON 정본) row를 추가한다. 기존 `description` row는 “legacy/fallback 및 파생 평문”으로 수정한다.

**Step 4: 개별 테스트 실행 — 통과 확인**

Command: `pnpm test lib/content/rich-description.test.ts lib/actions/admin-content.test.ts components/public/rich-description.test.tsx`

Expected: PASS.

**Step 5: 전체 검증**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: 세 명령 모두 exit code 0. 실패 시 기존 실패인지 새 실패인지 분리하여 해결하고, 성공 로그를 PR 설명에 기록한다.

**Step 6: Commit**

```bash
git add lib/content/rich-description.test.ts lib/actions/admin-content.test.ts components/public/rich-description.test.tsx docs/DATA_MODEL.md
git commit -m "test: cover rich crag description safety"
```

## 완료 기준

- Spec의 수용 조건 1–7을 모두 충족한다.
- migration은 생성만 되었고 어떤 D1 환경에도 적용하지 않았다.
- `git status --short`가 clean이며 `pnpm test`, `pnpm typecheck`, `pnpm build`가 모두 성공한다.
- 구현 PR에는 dependency 버전, migration 파일명, legacy fallback, 보안 allowlist의 이유와 검증 로그를 적는다.
