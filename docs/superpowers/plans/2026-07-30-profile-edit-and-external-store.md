# Profile Edit and External Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the Smart Store outside the native WebView and let users create and edit an Instagram-backed profile with an optional YouTube channel URL.

**Architecture:** The web app exposes one shared profile form and one shared parser. Signup and authenticated profile updates call separate server actions but consume the same parsed fields. Store navigation retains an anchor fallback and uses the existing `navigation.open.external.requested` app bridge when available; the Flutter shell validates the fixed store URL before launching it externally.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Cloudflare D1 HTTP API, Flutter, `webview_flutter`, `url_launcher`, Vitest, `flutter_test`.

---

### Task 1: Share profile parsing and persist YouTube channel URLs

**Files:**
- Create: `lib/profile/profile-input.ts`
- Modify: `lib/actions/signup.ts`
- Modify: `lib/db/user-auth-queries.ts`
- Modify: `lib/actions/signup.test.ts`
- Test: `lib/profile/profile-input.test.ts`

- [ ] **Step 1: Write failing parser tests**

```ts
expect(parseProfileInput(new FormData([['youtubeUrl', 'https://youtube.com/@granite']]))).toMatchObject({
  youtubeUrl: 'https://youtube.com/@granite'
});
expect(parseProfileInput(new FormData([['youtubeUrl', 'https://example.com/channel']]))).toBeNull();
```

- [ ] **Step 2: Run the parser test and verify it fails**

Run: `pnpm vitest run lib/profile/profile-input.test.ts`

Expected: FAIL because `parseProfileInput` does not exist.

- [ ] **Step 3: Implement the shared parser**

```ts
export type ProfileInput = { instagramId: string; youtubeUrl: string | null; /* existing editable fields */ };

export function parseProfileInput(formData: FormData): ProfileInput | null {
  // Reuse existing numeric/grade constraints and normalizeHandle(nickname).
  // Accept empty YouTube values; otherwise require https + youtube.com/www.youtube.com.
}
```

- [ ] **Step 4: Make signup pass `youtubeUrl` into `createUserForCompletedSignup` and insert it into `youtube_id`**

```ts
export type CompletedSignupInput = {
  // existing fields
  youtubeUrl: string | null;
};
// INSERT columns include youtube_id and values include user.youtubeId.
```

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm vitest run lib/profile/profile-input.test.ts lib/actions/signup.test.ts lib/db/user-auth-queries.test.ts`

Expected: PASS.

```bash
git add lib/profile lib/actions/signup.ts lib/actions/signup.test.ts lib/db/user-auth-queries.ts lib/db/user-auth-queries.test.ts
git commit -m "feat: save optional YouTube profile URL"
```

### Task 2: Reuse the profile form for signup and editing

**Files:**
- Create: `components/profile/profile-form.tsx`
- Create: `components/profile/profile-form.test.tsx`
- Create: `app/(site)/me/edit/page.tsx`
- Create: `app/(site)/me/edit/page.test.ts`
- Create: `lib/actions/profile.ts`
- Create: `lib/actions/profile.test.ts`
- Modify: `app/(site)/signup/page.tsx`
- Modify: `app/(site)/me/me-page-content.tsx`
- Modify: `app/(site)/me/me-page-content.test.tsx`
- Modify: `lib/db/user-auth-queries.ts`

- [ ] **Step 1: Write failing render and action tests**

```tsx
expect(renderToStaticMarkup(<ProfileForm mode="edit" initialValues={values} />)).toContain('value="https://youtube.com/@granite"');
await expect(updateProfileAction(formData)).rejects.toThrow('NEXT_REDIRECT:/me');
expect(updateUserProfile).toHaveBeenCalledWith('user_1', expect.objectContaining({ youtubeUrl: null }));
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run app/\(site\)/me/edit/page.test.ts lib/actions/profile.test.ts app/\(site\)/me/me-page-content.test.tsx`

Expected: FAIL because edit route, action, and shared form do not exist.

- [ ] **Step 3: Implement the shared form and edit route**

```tsx
export function ProfileForm({ initialValues, action, submitLabel }: ProfileFormProps) {
  // Render the current signup fields and optional youtubeUrl input.
  // Use defaultValue so server-rendered edit values are prefilled.
}
```

```ts
export async function updateProfileAction(formData: FormData) {
  const user = await requireActiveSessionUser();
  const input = parseProfileInput(formData);
  if (!input) redirect('/me/edit?error=invalid_profile');
  await updateUserProfile(user.id, input);
  redirect('/me');
}
```

- [ ] **Step 4: Make “수정” a link to `/me/edit` and implement the scoped update query**

```ts
UPDATE users
SET display_name = ?, instagram_id = ?, youtube_id = ?, gender = ?, height_cm = ?, ape_index_cm = ?,
    weight_kg = ?, top_bouldering_grade = ?, top_sport_grade = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL AND withdraw_at IS NULL
```

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm vitest run components/profile/profile-form.test.tsx app/\(site\)/me/edit/page.test.ts lib/actions/profile.test.ts app/\(site\)/me/me-page-content.test.tsx`

Expected: PASS.

```bash
git add components/profile app/\(site\)/signup app/\(site\)/me lib/actions/profile.ts lib/actions/profile.test.ts lib/db/user-auth-queries.ts lib/db/user-auth-queries.test.ts
git commit -m "feat: let users edit their climbing profile"
```

### Task 3: Dispatch Smart Store navigation to the native shell

**Files:**
- Create: `components/bridge/native-external-link.tsx`
- Modify: `components/layout/bottom-nav.tsx`
- Modify: `components/layout/bottom-nav.test.tsx`

- [ ] **Step 1: Write a failing client-component test**

```tsx
window.FlutterWebView = { postMessage: vi.fn() };
fireEvent.click(screen.getByRole('link', { name: 'STORE' }));
expect(window.FlutterWebView.postMessage).toHaveBeenCalledWith(expect.stringContaining('navigation.open.external.requested'));
```

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm vitest run components/layout/bottom-nav.test.tsx`

Expected: FAIL because the Store anchor has no bridge dispatch.

- [ ] **Step 3: Implement the native-capability-aware Store link**

```ts
const STORE_URL = 'https://m.smartstore.naver.com/granite_kr';
// On click, only preventDefault when window.FlutterWebView.postMessage exists.
// Post version: 1, type: navigation.open.external.requested,
// direction: web-to-native, payload: { url: STORE_URL }.
```

- [ ] **Step 4: Run test and commit**

Run: `pnpm vitest run components/layout/bottom-nav.test.tsx`

Expected: PASS; browser rendering still contains `target="_blank"` and the fixed href.

```bash
git add components/bridge/native-external-link.tsx components/layout/bottom-nav.tsx components/layout/bottom-nav.test.tsx
git commit -m "feat: open Smart Store outside the native WebView"
```

### Task 4: Allow the fixed Smart Store URL in the Flutter shell

**Files (repository `../granite-climbing-app`):**
- Modify: `lib/data/bridge/handlers/navigation_bridge_handler.dart`
- Modify: `test/data/bridge/handlers/navigation_bridge_handler_test.dart`

- [ ] **Step 1: Add a failing bridge-handler test**

```dart
payload: {'url': 'https://m.smartstore.naver.com/granite_kr'},
expect(service.externalUrls, [Uri.parse('https://m.smartstore.naver.com/granite_kr')]);
```

- [ ] **Step 2: Run the focused Flutter test and verify failure**

Run: `flutter test test/data/bridge/handlers/navigation_bridge_handler_test.dart`

Expected: FAIL because the Smart Store host is rejected.

- [ ] **Step 3: Replace broad host matching for this destination with a fixed-URL allow rule**

```dart
static final _smartStoreUrl = Uri.parse('https://m.smartstore.naver.com/granite_kr');
// Keep existing Granite URL allowance and permit only url == _smartStoreUrl for the Store route.
```

- [ ] **Step 4: Verify accepted and rejected URLs, then commit only navigation files**

Run: `flutter test test/data/bridge/handlers/navigation_bridge_handler_test.dart`

Expected: PASS.

```bash
git add lib/data/bridge/handlers/navigation_bridge_handler.dart test/data/bridge/handlers/navigation_bridge_handler_test.dart
git commit -m "feat: launch Smart Store in external browser"
```

### Task 5: Full verification

**Files:**
- No production files.

- [ ] **Step 1: Verify the web repository**

Run: `pnpm typecheck && pnpm test && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 2: Verify the Flutter repository without staging unrelated local changes**

Run: `flutter analyze && flutter test`

Expected: both commands exit 0.

- [ ] **Step 3: Manual smoke tests**

Run: `flutter run -d <ios-simulator-id> --dart-define-from-file=config/prod.json`

Expected: Store opens outside the WebView in the configured iOS browser; signup saves a YouTube URL; `/me/edit` prefills and saves all editable fields.
