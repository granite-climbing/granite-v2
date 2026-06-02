# Granite Admin Operations

## Initial Admin (recommended path)

Use `scripts/seed-admin.ts`. It pulls D1 env from `.env.local` (or the current shell), prompts for the password with hidden input + confirmation, shows the target D1 database id tail so you can confirm the environment before any write, and either INSERTs a new row or UPDATEs the existing row keyed by email.

```bash
# 1) Pull the target environment's env vars locally (preview or production)
vercel env pull .env.local --environment preview     # or: --environment production

# 2) Run the seeder (email + display name are positional; password is prompted)
pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops"

#   Optional: pin a stable id for the first admin
pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops" --id admin_primary
```

The script will:

1. Print the **target D1 database id's last 6 chars** and ask for confirmation. Use this to make sure you're not seeding prod from a preview shell (or vice versa).
2. Prompt for the password (hidden) and a confirmation. Enforces ≥ 6 chars.
3. Look up any existing row with this email. If found, asks to UPDATE password + display name + reactivate. Otherwise INSERTs a new row with `id = admin_<uuid>` (or the `--id` you provided).
4. Hash with bcrypt cost = 12 and write to D1. Never prints the password or hash.

Delete `.env.local` after seeding production:

```bash
rm .env.local
```

## Hash-only fallback

If you can only reach D1 through its web console and need to compose the SQL manually, generate just the hash:

```bash
pnpm dlx tsx scripts/create-admin-hash.ts '<strong-password-12-chars-or-more>'
```

Then run in the D1 console:

```sql
INSERT INTO admins (id, email, password_hash, display_name, is_active)
VALUES ('admin_primary', 'ops@granite.kr', '<bcrypt-hash>', 'Granite Ops', 1);
```

Do not commit production password hashes to git. Prefer the seeder or a one-time D1 console insert.

## Password Rotation

Use the same seeder — it detects the existing email and updates the password:

```bash
vercel env pull .env.local --environment production
pnpm dlx tsx scripts/seed-admin.ts ops@granite.kr "Granite Ops"
# Answers "yes" to "Update password + display_name + reactivate?"
```

Or, if rotating from the D1 console with the hash-only fallback:

```sql
UPDATE admins
SET password_hash = '<new-hash>', updated_at = datetime('now')
WHERE id = '<admin-id>';
```

If you suspect session compromise, also rotate `ADMIN_JWT_SECRET` in Vercel; this immediately invalidates every existing admin session.

Confirm old sessions no longer access `/admin/content` after either change.

## Image Policy

Public image serving is already configured through R2/CDN. Admin forms must store only URLs on the configured `CDN_BASE_URL` host (currently `https://cdn.granite.kr/...`) or approved relative CDN paths. Do not store private R2 URLs, signed URLs, or raw S3 endpoint URLs.

## Seed Strategy

For production environments, create the initial admin user through a **one-time D1 console insert**. Do NOT create a seed migration file with a committed password hash, as this poses an operational security risk in a shared repository.

For local development and testing, you may optionally create a local-only seed file (e.g., `migrations/0004_seed_initial_admin.sql` in `.gitignore`) if needed, but it should never be committed to version control.

### Process

1. Deploy migrations (including `0003_admin_operations.sql` with the admin table schema).
2. In the D1 console or command-line tool, run the INSERT statement above with a strong, randomly generated password hash.
3. Securely distribute the password to the initial admin via a separate channel (not email, git, or chat).
4. Delete any temporary seed files or notes containing the hash.

### Credentials Management

- Passwords must be at least 6 characters long (enforced by `seed-admin.ts`, `create-admin-hash.ts`, and the login Zod schema). Consider raising this if your operational policy allows.
- Store rotated hashes only in D1; never log plaintext passwords.
- Use a password manager or secure credential store for operational secrets.

## Phase 3 Verification Status

_Last updated: 2026-05-30 on branch `phase3-implement`._

### Automated checks — PASSED

| Command | Result |
|---------|--------|
| `pnpm test` | 13 test files, 227 tests — all passed |
| `pnpm typecheck` | 0 errors |
| `pnpm build` | 23 routes compiled successfully |

The `stderr` lines visible during `pnpm test` (`[audit] Failed to write audit log`) are intentional: those tests explicitly verify that audit failures are non-fatal and do not roll back the content mutation.

### Still requires human verification (out of scope for automated checks)

The following steps must be completed by a human operator before the admin system is production-ready:

1. **Apply migration to D1** — run `pnpm wrangler d1 migrations apply granite --local` for local, and the equivalent command without `--local` for preview/prod environments. Migration file: `migrations/0003_admin_operations.sql`.

2. **Insert first admin row** — after migration is applied, run a one-time D1 console INSERT using the hash generated by `scripts/create-admin-hash.ts` (see "Initial Admin" section above).

3. **Browser smoke tests** — verify the following routes in a running dev or preview environment:
   - `/admin/login` — login with email+password, confirm `granite_admin` cookie is set as HttpOnly
   - `/admin/login` (logged out) — confirm unauthenticated redirect from any `/admin/*` route
   - `/admin/content` — confirm overview page loads with entity counts
   - `/admin/content/areas`, `/admin/content/crags`, `/admin/content/sectors`, `/admin/content/boulders`, `/admin/content/topos`, `/admin/content/routes` — CRUD round-trip (create, edit, save), publish toggle, soft-delete (confirm `DELETE` prompt), restore
   - `/admin/announcements` — announcement create, edit, soft-delete, restore
   - `/admin/audit` — confirm audit log rows appear after mutations above

4. **Image upload verification** — on any content form that supports image upload, upload a file and confirm:
   - The stored URL begins with `https://cdn.granite.kr/`
   - No private R2 or signed URLs are persisted
   - Audit log records the upload action

5. **Public cache isolation** — confirm that soft-deleted content does not appear on public-facing pages (`/`, `/c/[cragSlug]`, etc.) after revalidation.

6. **Session expiry** — confirm that an expired or tampered `granite_admin` JWT cookie results in redirect to `/admin/login` rather than an error page.

## Known operational caveats (Phase 3.5 follow-up)

The Phase 3 cache-invalidation logic explicitly handles parent moves: `saveSector`/`Boulder`/`TopoAction` flushes both OLD and NEW ancestry surfaces and enumerates immediate descendants. However the following two cases were intentionally deferred to a Phase 3.5 follow-up patch and are tracked here as a known caveat:

- **Unpublishing a crag/sector/boulder/topo** via `togglePublishAction` invalidates the toggled entity's own surface but does NOT enumerate descendant detail caches (`boulder:<id>`, `route:<id>`, `/t/<id>`, `/r/<id>`). A boulder/topo/route detail page cached just before an ancestor was unpublished can continue serving until its `unstable_cache` TTL or until another mutation invalidates it.
- **Soft-deleting or restoring** a crag/sector/boulder/topo has the same descendant-cache gap.

**Public exposure bound:** all public detail pages are `force-dynamic`, so only `unstable_cache`-wrapped data fetchers are affected — the actual page render runs every request and the underlying SQL still enforces ancestor `is_published`/`deleted_at` filters. The user-visible stale window is therefore bounded by the cache TTL of `findBoulderById`/`findRouteById`/etc., not unbounded.

**Operational workaround until the patch lands:** after unpublishing or soft-deleting any non-leaf content, an admin can either (a) wait out the cache TTL, or (b) trigger any small change on a descendant (e.g. toggle then re-toggle its own publish state) to force its cache to flush.

**Planned follow-up:** consolidate descendant invalidation into a shared `invalidateEntityAndDescendants` helper called from save / soft-delete / restore / publish-toggle paths uniformly. Tracked as a Phase 3.5 GitHub Issue (see plan: "Phase 3.5 — Deferred follow-ups").
