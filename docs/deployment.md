# Granite Deployment

## Required Vercel Integration

Phase 3 requires the app to be reachable through the real service URL after production deploy. Vercel should be connected to the repository so pushes to `main` can produce deployments, or deployment must be performed with the documented CLI commands.

## CI Gate

Pull requests and pushes to `main` must run:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Preview Deploy

1. Configure Vercel preview environment variables.
2. Apply D1 migrations to preview D1.
3. Confirm preview admin account.
4. Deploy preview.
5. Smoke-test public and admin URLs.

## Production Deploy

1. Configure production environment variables.
2. Apply D1 migrations to production D1 after preview approval.
3. Confirm production admin account.
4. Deploy production with `pnpm vercel deploy --prod` or approved Vercel Git deployment.
5. Smoke-test the real service URL.

---

## Preview & Production Rollout Checklist

The following steps must be completed by a human operator with access to Vercel, Cloudflare, and D1 credentials. These are not automated in CI.

### Step 1: Configure Vercel Preview Environment Variables

Set these Vercel preview environment variables (names match `.env.example`):

- `D1_HTTP_URL`
- `D1_API_TOKEN`
- `D1_DATABASE_ID`
- `CDN_BASE_URL`
- `ADMIN_JWT_SECRET`
- `NEXT_PUBLIC_KAKAO_MAP_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

**Note:** Direct admin image upload requires R2 write credentials. The R2 S3 endpoint is derived from `CLOUDFLARE_ACCOUNT_ID` (`https://<account-id>.r2.cloudflarestorage.com`), so there is no separate `R2_ENDPOINT` var. Keep `CDN_BASE_URL` because stored image URLs and the image loader need the public base.

### Step 2: Apply Migrations to Preview D1

Run the project-approved D1 migration command against preview:

```bash
pnpm wrangler d1 migrations apply granite
```

Expected:

- `0001_init.sql`, `0002_import_v1_content.sql`, and `0003_admin_operations.sql` are applied or already marked applied.
- Preview D1 contains content rows and admin operation tables.

### Step 3: Create or Confirm Preview Admin

Use the documented SOP in `docs/admin-operations.md`:

```bash
node scripts/create-admin-hash.ts '<preview-admin-password>'
```

Then insert or update a preview admin:

```sql
INSERT INTO admins (id, email, password_hash, display_name, is_active)
VALUES ('admin_preview', 'preview-admin@granite.kr', '<bcrypt-hash>', 'Preview Admin', 1)
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  password_hash = excluded.password_hash,
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  updated_at = datetime('now');
```

### Step 4: Deploy Vercel Preview

Run:

```bash
pnpm vercel deploy
```

Expected:

- Build succeeds.
- Preview URL is created.
- `/healthz` returns `checks.app = "ok"` and `checks.db = "ok"`.

### Step 5: Verify Preview Public UI

Open the preview deployment and verify these URLs load correctly:

- `/` (home)
- `/c/anyang` (crag detail, adjust slug as needed)
- `/topos/<known-topo-id>` (topo detail)
- `/r/<known-route-id>` (route detail)
- `/healthz` (health check)

Expected:

- Public pages load from preview D1.
- Images resolve through the approved CDN policy.
- Route line fallback still works when `line_image_url` is empty.

### Step 6: Verify Preview Admin UI

Open preview admin and verify these routes:

- `/admin/login`
- `/admin/content`
- `/admin/announcements`
- `/admin/audit`

Expected:

- Unauthenticated admin pages redirect to login.
- Valid preview admin can log in with credentials from Step 3.
- CRUD actions (create/update/toggle publish/soft delete/restore) update preview D1.
- Public pages revalidate after mutations.
- Audit logs are written to `admin_audit_logs`.

### Step 7: Configure Production Environment Variables

After preview approval, set production variables in Vercel:

- `D1_HTTP_URL`
- `D1_API_TOKEN`
- `D1_DATABASE_ID`
- `CDN_BASE_URL`
- `ADMIN_JWT_SECRET` (production-only, not reused from preview)
- `NEXT_PUBLIC_KAKAO_MAP_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Expected:

- `ADMIN_JWT_SECRET` is production-only and not reused from preview.
- Production D1 target is confirmed before migration.
- `CDN_BASE_URL` points to the already-serving production CDN.
- `NEXT_PUBLIC_KAKAO_MAP_KEY` is the production-approved key.

### Step 8: Apply Migrations to Production D1

Only after preview data and admin behavior are approved:

```bash
pnpm wrangler d1 migrations apply granite
```

Expected:

- Production D1 has content tables, imported content, `admins`, and `admin_audit_logs`.
- No destructive import is rerun accidentally against production.

### Step 9: Create Production Admin

Use one-time D1 console execution or an approved production migration. Do not commit a real production password hash unless the team explicitly accepts that risk.

Expected:

- At least one active admin exists in production.
- Password rotation SOP from `docs/admin-operations.md` is documented and understood.

### Step 10: Deploy Production

Run:

```bash
pnpm vercel deploy --prod
```

Or use Vercel's Git integration if configured.

Expected:

- Production deployment succeeds.
- `/healthz` returns `checks.app = "ok"` and `checks.db = "ok"`.

### Step 11: Verify Production Public Routes

Open the production service URL and verify these routes load correctly:

- `/` (home)
- `/c/anyang` (crag detail, adjust slug as needed)
- `/topos/<known-topo-id>` (topo detail, use production-approved IDs)
- `/r/<known-route-id>` (route detail, use production-approved IDs)
- `/healthz` (health check)

Expected:

- Public routes load from production D1.
- CDN images serve correctly.
- Content matches what was tested in preview.

### Step 12: Verify Production Admin

Open production admin and verify:

- `/admin/login` (login with production admin credentials)
- `/admin/content` (content overview and CRUD pages)
- `/admin/announcements` (announcement management)

Expected:

- Admin login works.
- A harmless draft create/update/delete round-trip succeeds.
- `admin_audit_logs` records the draft mutation.

### Step 13: Post-Deploy Audit Verification

Confirm `admin_audit_logs` contains expected records:

```sql
SELECT id, admin_id, action, target_type, target_id, created_at
FROM admin_audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

Expected:

- Content mutations from preview testing are visible.
- Production mutations from Step 12 are visible.
- No data anomalies or missing audit records.

---

## Rollout Complete

After all steps pass, the real service URL is accessible and the Phase 3 deployment is complete.
