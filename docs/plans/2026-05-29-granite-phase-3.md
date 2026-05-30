# Granite Phase 3 Admin Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build production-usable admin operations and deployment flow for Granite: separate admin authentication, content CRUD, direct image upload, soft delete, announcement management, revalidation, audit logging, Vercel CI/CD, and production access through the real service URL.

**Architecture:** Keep all D1 SQL inside `lib/db/`. Keep mutations behind Server Actions with Zod validation, `requireAdmin()`, audit logging, soft-delete semantics, and cache invalidation. R2/CDN public serving is already completed in Phase 2; Phase 3 adds browser-based admin upload to the existing R2/CDN pipeline and stores only client-visible CDN URLs on entity columns.

**Tech Stack:** Next.js App Router, Server Actions, TypeScript strict, Zod, Cloudflare D1 HTTP API, Cloudflare R2 S3 SDK, bcryptjs, jose, Tailwind CSS, Vitest.

---

## Phase Boundary

### Included In Phase 3

- `/admin/login` email/password authentication.
- `granite_admin` HttpOnly cookie with `ADMIN_JWT_SECRET`.
- `admins` and `admin_audit_logs` D1 tables and seed strategy for the first admin.
- Admin route protection in `app/admin/layout.tsx` and double-check protection in all Server Actions.
- Area, Crag, Sector, Boulder, Topo, Route CRUD.
- Announcement CRUD connected to home New Updates.
- Direct image upload from admin UI to R2 with CDN URL persistence.
- Entity-specific admin pages for Area, Crag, Sector, Boulder, Topo, Route, and Announcement operations.
- Soft delete for content and announcements, with restore support in admin.
- Desktop-only admin UI with a unified admin component system. Mobile support is not required for admin.
- Vercel deployment and CI/CD setup. Phase 3 is not complete until the service is reachable through the real deployed URL.
- `revalidatePath` and `revalidateTag` after every mutation.
- Focused tests for auth, validation, SQL, audit, and cache invalidation behavior.

### Explicitly Out Of Phase 3

- Instagram webhook inbox and Beta moderation. Those start in Phase 4.
- User OAuth, favorites, user profile, and claims. Those start in Phase 5.
- CDN domain setup and public image serving. These are already done from Phase 2.
- Mobile admin support. Admin pages are desktop/tablet utility surfaces only.
- Admin change preview/diff.
- Role-based admin permissions.

---

## Current State

Existing useful files:

- `app/admin/login/page.tsx`: visual login scaffold only; no action yet.
- `app/admin/layout.tsx`: admin shell scaffold; not protected yet.
- `app/admin/content/page.tsx`: rough scaffold with Phase 1/old fields (`summary`, `accessDesc`, `coordPrecision`, `rockType`, `routes.boulderId`) that no longer match the Phase 2 schema.
- `app/admin/announcements/page.tsx`: read-only announcement scaffold.
- `lib/auth/admin.ts`: JWT helpers exist, but token payload should move to `{ adminId, email, displayName }` and cookie/session helpers are missing.
- `lib/actions/admin-content.ts`: validates only, does not mutate D1, does not require admin, and uses stale cache tags.
- `lib/actions/admin-content-schema.ts`: needs Phase 2 schema alignment.
- `lib/db/d1-http.ts`: read query helper exists; mutation/transaction helper should be added here or in a sibling file.
- `lib/db/queries.ts`: public read functions exist.
- `lib/r2/images.ts`: R2 key/CDN URL helpers exist.
- `migrations/0001_init.sql`: Phase 2 content schema exists; `admins` and `admin_audit_logs` are not yet created.

---

## Target File Map

### Migrations

- Create `migrations/0003_admin_operations.sql`
  - Adds `admins`.
  - Adds `admin_audit_logs`.
  - Adds `deleted_at` soft-delete columns to content tables and announcements.
  - Adds indexes for admin lookup and audit browsing.

### Auth

- Modify `lib/auth/admin.ts`
  - Keep JWT creation/verification.
  - Add `ADMIN_COOKIE_NAME`.
  - Add `getAdminSession()`.
  - Add `requireAdmin()`.
  - Add `setAdminCookie()` / `clearAdminCookie()` helpers or keep cookie mutation inside actions.
  - Use `adminId` as the JWT subject, not email.

- Create `lib/actions/admin-auth-schema.ts`
  - Zod schema for login form.

- Create `lib/actions/admin-auth.ts`
  - `loginAdminAction(formData)`.
  - `logoutAdminAction()`.

- Create `lib/db/admin-queries.ts`
  - Admin lookup by email/id.
  - Admin audit insert.

- Create `lib/db/admin-queries.test.ts`
  - SQL shape and row mapping tests with mocked `queryD1`.

### D1 Mutation Boundary

- Modify `lib/db/d1-http.ts`
  - Add `executeD1(sql, params?)` for non-query statements, or make `queryD1` safe for `INSERT/UPDATE/DELETE`.
  - Add `batchD1(statements)` only if Cloudflare HTTP API endpoint supports batch in the deployed config; otherwise keep one statement per Server Action.

- Create `lib/db/admin-content-queries.ts`
  - All admin CRUD SQL for content tables and announcements.
  - No direct SQL in components/actions.

- Create `lib/db/admin-content-queries.test.ts`
  - Parameter binding, table-specific column mapping, publish toggles, and delete constraints.

### Validation

- Replace/modify `lib/actions/admin-content-schema.ts`
  - Align with Phase 2 schema.
  - Add schemas for `area`, `crag`, `sector`, `boulder`, `topo`, `route`, `announcement`.
  - Add operation mode: `create`, `update`, `delete`, `toggle_publish`, `reorder`.

- Modify `lib/actions/admin-content.test.ts`
  - Remove stale tests around `coordPrecision`, `rockType`, and `routes.boulderId`.
  - Add Phase 2 shape tests.

### Server Actions

- Replace/modify `lib/actions/admin-content.ts`
  - Require admin before mutation.
  - Validate with Zod.
  - Call `lib/db/admin-content-queries.ts`.
  - Insert audit log.
  - Revalidate correct tags and paths.

- Create `lib/actions/admin-announcements.ts`
  - Announcement create/update/delete/toggle/reorder.

### Admin UI

> **Route-group convention.** Every authenticated admin page below lives under `app/admin/(protected)/` (see Task 4 for the required structure and why). Only `app/admin/login/page.tsx` and the bare `app/admin/layout.tsx` sit outside the protected group. Paths like `app/admin/content/areas/page.tsx` in the lists below are shorthand for `app/admin/(protected)/content/areas/page.tsx`; the URLs (`/admin/content/areas`) are identical because route groups are URL-transparent.

- Modify `app/admin/login/page.tsx`
  - Wire form to `loginAdminAction`.
  - Render `searchParams.error` message.

- Replace `app/admin/layout.tsx`
  - Becomes a bare passthrough layout (NO auth) so it can safely wrap `/admin/login`.

- Create `app/admin/(protected)/layout.tsx`
  - Auth guard via `requireAdmin()`; renders admin nav and logout form. Protects every admin page except `/admin/login`. See Task 4 for the required route-group structure.

- Create `app/admin/(protected)/page.tsx`
  - Redirect to `/admin/content`.

- Replace `app/admin/(protected)/content/page.tsx`
  - Dashboard-style overview and links to entity-specific pages.

- Create desktop admin component system:
  - `components/admin/admin-shell.tsx`
  - `components/admin/admin-card.tsx`
  - `components/admin/admin-table.tsx`
  - `components/admin/admin-field.tsx`
  - `components/admin/admin-actions.tsx`
  - `components/admin/publish-badge.tsx`
  - `components/admin/delete-restore-controls.tsx`

- Create required entity-specific admin pages:
  - `app/admin/content/areas/page.tsx`
  - `app/admin/content/crags/page.tsx`
  - `app/admin/content/sectors/page.tsx`
  - `app/admin/content/boulders/page.tsx`
  - `app/admin/content/topos/page.tsx`
  - `app/admin/content/routes/page.tsx`

- Modify `app/admin/announcements/page.tsx`
  - Add create/update/delete/toggle forms.

### Images

- Modify `lib/r2/images.ts`
  - Keep existing helpers.
  - Add `validateAdminImageFile(file)`.
  - Add upload key and CDN URL helpers used by admin actions.

- Create `lib/actions/admin-images.ts`:
  - Accept `FormData` with `File`, `entityType`, `entityId`, and `purpose`.
  - Validate content type and size.
  - Upload to R2.
  - Return or persist CDN URL.
  - Reject private R2/signed/raw S3 URLs.

### CI/CD And Deployment

- Create `.github/workflows/ci.yml`
  - Runs `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build` on pull requests and `main`.

- Create or update `docs/deployment.md`
  - Vercel project setup.
  - Required preview/production env vars.
  - D1 migration order.
  - Production smoke-test checklist.

- Confirm Vercel Git integration or document `pnpm vercel deploy` / `pnpm vercel deploy --prod` commands.

### Docs

- Modify `docs/ROADMAP.md`
  - Mark Phase 3 preparation and gates as they complete.

- Modify `docs/DATA_MODEL.md`
  - Add any exact Phase 3 constraints for `admins` and audit metadata.

- Create `docs/admin-operations.md`
  - Admin account creation, password rotation, image operation, publish/delete guidance.

---

## Cache And Revalidation Rules

Use the existing public read tags and make admin mutations invalidate only affected surfaces:

| Mutation | Tags | Paths |
|---|---|---|
| Area create/update/delete/toggle/reorder | `areas:list`, `home` | `/` |
| Crag create/update/delete/toggle/reorder | `areas:list`, `home`, `crag:<slug>` and/or `crag:<id>` | `/`, `/c/<slug>` |
| Sector create/update/delete/toggle/reorder | `crag:<cragSlug>`, `sector:<sectorSlug>` | `/c/<cragSlug>` |
| Boulder create/update/delete/toggle/reorder | `crag:<cragSlug>`, `sector:<sectorSlug>`, `boulder:<id>` | `/c/<cragSlug>` |
| Topo create/update/delete/toggle/reorder | `boulder:<boulderId>` | `/topos/<topoId>`, `/c/<cragSlug>` |
| Route create/update/delete/toggle/reorder | `route:<routeId>`, `boulder:<boulderId>`, `crag:<cragSlug>` | `/r/<routeId>`, `/topos/<topoId>`, `/c/<cragSlug>` |
| Announcement create/update/delete/toggle/reorder | `home` | `/` |

Important implementation note: `lib/db/repository.ts` currently uses some slug-based tags where the plan says id-like tag names. During Phase 3, either normalize tags to stable IDs or document slug tags and use them consistently. Do not leave mutation invalidation using stale `spots:list`.

---

## Task 1: Admin Tables Migration

**Files:**
- Create: `migrations/0003_admin_operations.sql`
- Modify: `docs/DATA_MODEL.md`

- [x] **Step 1: Add admin migration**

Create `migrations/0003_admin_operations.sql`:

```sql
-- Granite Phase 3 admin operations
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins (is_active);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES admins(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs (created_at);

ALTER TABLE areas ADD COLUMN deleted_at TEXT;
ALTER TABLE crags ADD COLUMN deleted_at TEXT;
ALTER TABLE sectors ADD COLUMN deleted_at TEXT;
ALTER TABLE boulders ADD COLUMN deleted_at TEXT;
ALTER TABLE topos ADD COLUMN deleted_at TEXT;
ALTER TABLE routes ADD COLUMN deleted_at TEXT;
ALTER TABLE announcements ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_areas_deleted_at ON areas (deleted_at);
CREATE INDEX IF NOT EXISTS idx_crags_deleted_at ON crags (deleted_at);
CREATE INDEX IF NOT EXISTS idx_sectors_deleted_at ON sectors (deleted_at);
CREATE INDEX IF NOT EXISTS idx_boulders_deleted_at ON boulders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_topos_deleted_at ON topos (deleted_at);
CREATE INDEX IF NOT EXISTS idx_routes_deleted_at ON routes (deleted_at);
CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON announcements (deleted_at);
```

- [x] **Step 2: Smoke-test migration with SQLite**

Run:

```bash
sqlite3 /private/tmp/granite-phase3-admin.sqlite ".read migrations/0001_init.sql" ".read migrations/0002_import_v1_content.sql" ".read migrations/0003_admin_operations.sql" ".schema admins" ".schema admin_audit_logs"
```

Expected: both table schemas print and command exits 0.

- [x] **Step 3: Update data model docs**

In `docs/DATA_MODEL.md`, expand the `admins` and `admin_audit_logs` section with exact columns from the migration and note:

```markdown
Phase 3 uses `admins.email` only for login lookup. JWT sessions use `admins.id` as the subject. `admin_audit_logs.metadata` stores compact JSON text with changed field names and optional before/after values; do not store passwords or secrets in metadata.

Content tables and `announcements` use `deleted_at` for soft delete. Public read queries must always exclude rows where `deleted_at IS NOT NULL`. Admin read queries include deleted rows by default and label them as deleted; restore actions set `deleted_at = NULL`.
```

- [x] **Step 4: Commit**

```bash
git add migrations/0003_admin_operations.sql docs/DATA_MODEL.md
git commit -m "feat: add admin operation tables"
```

---

## Task 2: D1 Mutation Helpers

**Files:**
- Modify: `lib/db/d1-http.ts`
- Modify: `lib/db/d1-http.test.ts`

- [x] **Step 1: Add failing tests for non-query execution**

Add tests to `lib/db/d1-http.test.ts`:

```ts
import { executeD1 } from "./d1-http";

it("executeD1 posts SQL and params to D1", async () => {
  mockFetch({
    success: true,
    errors: [],
    result: [{ results: [] }],
  });

  await executeD1("UPDATE crags SET name = ? WHERE id = ?", ["안양", "crag_anyang"]);

  expect(fetch).toHaveBeenCalledWith(
    "https://api.cloudflare.com/client/v4/accounts/test/d1/database-id/query",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        sql: "UPDATE crags SET name = ? WHERE id = ?",
        params: ["안양", "crag_anyang"],
      }),
    }),
  );
});

it("executeD1 throws normalized D1 errors", async () => {
  mockFetch({
    success: false,
    errors: [{ message: "constraint failed" }],
    result: [],
  });

  await expect(executeD1("INSERT INTO areas (id) VALUES (?)", ["x"])).rejects.toThrow(
    "D1 query failed: constraint failed",
  );
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/db/d1-http.test.ts
```

Expected: fail because `executeD1` is not exported.

- [x] **Step 3: Implement helper**

Add to `lib/db/d1-http.ts`:

```ts
export async function executeD1(sql: string, params?: unknown[]): Promise<void> {
  await executeQuery<unknown>(sql, params ?? []);
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/d1-http.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add lib/db/d1-http.ts lib/db/d1-http.test.ts
git commit -m "feat: add d1 mutation helper"
```

---

## Task 3: Admin Query Boundary

**Files:**
- Create: `lib/db/admin-queries.ts`
- Create: `lib/db/admin-queries.test.ts`

- [x] **Step 1: Create admin query tests**

Create `lib/db/admin-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findActiveAdminByEmail,
  findActiveAdminById,
  insertAdminAuditLog,
} from "./admin-queries";
import { executeD1, queryD1First } from "./d1-http";

vi.mock("./d1-http", () => ({
  queryD1First: vi.fn(),
  executeD1: vi.fn(),
}));

const mockedQueryFirst = vi.mocked(queryD1First);
const mockedExecute = vi.mocked(executeD1);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin queries", () => {
  it("finds an active admin by lowercased email", async () => {
    mockedQueryFirst.mockResolvedValue({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: "$2a$hash",
      displayName: "Ops",
      isActive: 1,
    });

    const result = await findActiveAdminByEmail(" Ops@Granite.kr ");

    expect(result).toEqual({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: "$2a$hash",
      displayName: "Ops",
      isActive: true,
    });
    expect(mockedQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining("WHERE lower(email) = lower(?)"),
      ["ops@granite.kr"],
    );
  });

  it("returns null for inactive admin rows", async () => {
    mockedQueryFirst.mockResolvedValue(null);
    await expect(findActiveAdminById("admin_1")).resolves.toBeNull();
  });

  it("inserts audit logs as JSON metadata", async () => {
    await insertAdminAuditLog({
      adminId: "admin_1",
      action: "content.update",
      targetType: "crag",
      targetId: "crag_anyang",
      metadata: { fields: ["name"] },
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin_audit_logs"),
      expect.arrayContaining([
        "admin_1",
        "content.update",
        "crag",
        "crag_anyang",
        JSON.stringify({ fields: ["name"] }),
      ]),
    );
  });
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/db/admin-queries.test.ts
```

Expected: fail because file does not exist.

- [x] **Step 3: Implement admin queries**

Create `lib/db/admin-queries.ts`:

```ts
import { randomUUID } from "node:crypto";
import { executeD1, queryD1First } from "./d1-http";

export type AdminRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
};

type AdminSqlRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: 0 | 1;
};

function mapAdmin(row: AdminSqlRow | null): AdminRow | null {
  if (!row) return null;
  return { ...row, isActive: row.isActive === 1 };
}

export async function findActiveAdminByEmail(email: string): Promise<AdminRow | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const row = await queryD1First<AdminSqlRow>(
    `SELECT
       id,
       email,
       password_hash AS passwordHash,
       display_name AS displayName,
       is_active AS isActive
     FROM admins
     WHERE lower(email) = lower(?) AND is_active = 1
     LIMIT 1`,
    [normalizedEmail],
  );
  return mapAdmin(row);
}

export async function findActiveAdminById(id: string): Promise<AdminRow | null> {
  const row = await queryD1First<AdminSqlRow>(
    `SELECT
       id,
       email,
       password_hash AS passwordHash,
       display_name AS displayName,
       is_active AS isActive
     FROM admins
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [id],
  );
  return mapAdmin(row);
}

export async function insertAdminAuditLog(input: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await executeD1(
    `INSERT INTO admin_audit_logs
       (id, admin_id, action, target_type, target_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `audit_${randomUUID()}`,
      input.adminId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/admin-queries.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add lib/db/admin-queries.ts lib/db/admin-queries.test.ts
git commit -m "feat: add admin query boundary"
```

---

## Task 4: Admin Authentication

**Files:**
- Modify: `lib/auth/admin.ts`
- Create: `lib/actions/admin-auth-schema.ts`
- Create: `lib/auth/admin-credentials.ts` (credential check — NOT a `"use server"` file)
- Create: `lib/actions/admin-auth.ts` (exports only `loginAdminAction`/`logoutAdminAction`)
- Create: `lib/actions/admin-auth.test.ts`
- Move: `app/admin/login/page.tsx` stays OUTSIDE the protected group (no auth wrapper)
- Replace: `app/admin/layout.tsx` becomes a bare passthrough layout (NO `requireAdmin`)
- Create: `app/admin/(protected)/layout.tsx` (the auth-guarded shell with nav + logout)
- Create: `app/admin/(protected)/page.tsx` (redirect to `/admin/content`)

> **Required route structure (not optional).** `app/admin/layout.tsx` wraps every route under `/admin`, including `/admin/login`. If that layout calls `requireAdmin()`, hitting `/admin/login` redirects to `/admin/login` forever. The fix is a route group: keep auth in `app/admin/(protected)/layout.tsx` and leave login outside it. Route groups do not change URLs, so `/admin/content` still resolves. **All admin pages referenced later in this plan (`app/admin/content/*`, `app/admin/announcements/*`, `app/admin/audit/*`) live under `app/admin/(protected)/`.**
>
> ```text
> app/admin/layout.tsx                 # bare passthrough, NO auth
> app/admin/login/page.tsx             # login, NO auth
> app/admin/(protected)/layout.tsx     # requireAdmin() + nav + logout
> app/admin/(protected)/page.tsx       # redirect → /admin/content
> app/admin/(protected)/content/...    # content overview + entity pages
> app/admin/(protected)/announcements/...
> app/admin/(protected)/audit/...
> ```

- [x] **Step 1: Write auth tests**

Create `lib/actions/admin-auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { verifyAdminCredentials } from "@/lib/auth/admin-credentials";
import { findActiveAdminByEmail } from "@/lib/db/admin-queries";

vi.mock("@/lib/db/admin-queries", () => ({
  findActiveAdminByEmail: vi.fn(),
}));

const mockedFindAdmin = vi.mocked(findActiveAdminByEmail);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin auth", () => {
  it("rejects unknown email", async () => {
    mockedFindAdmin.mockResolvedValue(null);

    await expect(
      verifyAdminCredentials({ email: "missing@granite.kr", password: "secret123" }),
    ).rejects.toThrow("Invalid admin credentials");
  });

  it("rejects invalid password", async () => {
    mockedFindAdmin.mockResolvedValue({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: await bcrypt.hash("correct-password", 4),
      displayName: "Ops",
      isActive: true,
    });

    await expect(
      verifyAdminCredentials({ email: "ops@granite.kr", password: "wrong-password" }),
    ).rejects.toThrow("Invalid admin credentials");
  });

  it("returns token session data for valid credentials", async () => {
    mockedFindAdmin.mockResolvedValue({
      id: "admin_1",
      email: "ops@granite.kr",
      passwordHash: await bcrypt.hash("correct-password", 4),
      displayName: "Ops",
      isActive: true,
    });

    const result = await verifyAdminCredentials({
      email: "ops@granite.kr",
      password: "correct-password",
    });

    expect(result.email).toBe("ops@granite.kr");
    expect(result.displayName).toBe("Ops");
    expect(result.token).toEqual(expect.any(String));
  });
});
```

- [x] **Step 2: Run failing auth tests**

Run:

```bash
pnpm test lib/actions/admin-auth.test.ts
```

Expected: fail because `admin-auth.ts` is missing.

- [x] **Step 3: Implement schema**

Create `lib/actions/admin-auth-schema.ts`:

```ts
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
```

- [x] **Step 4: Update JWT/session helper**

Update `lib/auth/admin.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { findActiveAdminById } from "@/lib/db/admin-queries";

const encoder = new TextEncoder();

export const ADMIN_COOKIE_NAME = "granite_admin";

export type AdminSession = {
  adminId: string;
  email: string;
  displayName: string;
};

export function getAdminSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_JWT_SECRET is required in production");
  }
  return encoder.encode(secret ?? "granite-local-admin-secret");
}

export async function createAdminToken(session: AdminSession): Promise<string> {
  return new SignJWT({
    email: session.email,
    displayName: session.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.adminId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAdminSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const verified = await jwtVerify(token, getAdminSecret());
    const adminId = verified.payload.sub;
    if (!adminId) return null;

    const admin = await findActiveAdminById(adminId);
    if (!admin) return null;

    return {
      adminId: admin.id,
      email: admin.email,
      displayName: admin.displayName,
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
```

**Behavioral note:** `verifyAdminToken` now calls `findActiveAdminById` on every verification, so each protected admin navigation performs one D1 HTTP round trip. This is intentional (it lets a deactivated admin be locked out mid-session and keeps `displayName`/`email` authoritative), and acceptable for the low-traffic admin surface. Do not reuse this verifier on hot public paths.

- [x] **Step 5: Implement credential check and auth action**

**Security boundary:** In Next.js, every exported async function in a `"use server"` file is a publicly invokable server-action endpoint. So the credential-checking function (which returns a raw JWT) must NOT live in the `"use server"` file — otherwise it becomes a public token-minting endpoint. Put it in a plain module and let only `loginAdminAction`/`logoutAdminAction` be server actions.

Create `lib/auth/admin-credentials.ts` (NO `"use server"`):

```ts
import bcrypt from "bcryptjs";
import { findActiveAdminByEmail } from "@/lib/db/admin-queries";
import { createAdminToken } from "@/lib/auth/admin";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/actions/admin-auth-schema";

// Precomputed valid bcrypt hash. When the email is unknown we still run a
// compare against this so the unknown-email path takes ~the same time as the
// wrong-password path — prevents email enumeration via response latency.
const DUMMY_HASH = "$2b$12$aaaaaaaaaaaaaaaaaaaaaa.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVALID_CREDENTIALS = "Invalid admin credentials";

export async function verifyAdminCredentials(input: AdminLoginInput): Promise<{
  token: string;
  email: string;
  displayName: string;
}> {
  const parsed = adminLoginSchema.parse(input);
  const admin = await findActiveAdminByEmail(parsed.email);

  if (!admin) {
    await bcrypt.compare(parsed.password, DUMMY_HASH);
    throw new Error(INVALID_CREDENTIALS);
  }

  const validPassword = await bcrypt.compare(parsed.password, admin.passwordHash);
  if (!validPassword) throw new Error(INVALID_CREDENTIALS);

  const token = await createAdminToken({
    adminId: admin.id,
    email: admin.email,
    displayName: admin.displayName,
  });

  return { token, email: admin.email, displayName: admin.displayName };
}
```

Create `lib/actions/admin-auth.ts` (exports ONLY the two actions):

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin";
import { verifyAdminCredentials } from "@/lib/auth/admin-credentials";
import type { AdminLoginInput } from "./admin-auth-schema";

export async function loginAdminAction(formData: FormData): Promise<void> {
  try {
    const result = await verifyAdminCredentials(Object.fromEntries(formData) as AdminLoginInput);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin",
      maxAge: 60 * 60 * 8,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid admin credentials") {
      redirect("/admin/login?error=invalid_credentials");
    }
    // Surface infra errors (missing ADMIN_JWT_SECRET, D1 failure, …) instead of
    // masking them as a login failure.
    console.error(err);
    throw err;
  }

  // redirect() throws NEXT_REDIRECT; must be OUTSIDE try/catch so it propagates.
  redirect("/admin/content");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  // Delete with the SAME path the cookie was set with ("/admin"); a default
  // path="/" delete will not clear a cookie scoped to "/admin".
  cookieStore.delete({ name: ADMIN_COOKIE_NAME, path: "/admin" });
  redirect("/admin/login");
}
```

Note: the login cookie above is set with `path: "/admin"`, so logout must delete with the matching `path: "/admin"`. If you later change the cookie path, update both set and delete together.

- [x] **Step 6: Wire login page**

Update `app/admin/login/page.tsx` so the form uses the action:

```tsx
import { AppHeader } from "@/components/layout/app-header";
import { loginAdminAction } from "@/lib/actions/admin-auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const hasInvalidCredentials = resolvedSearchParams?.error === "invalid_credentials";

  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <section className="px-5 py-10">
        <h1 className="text-3xl font-black">Admin Login</h1>
        <form action={loginAdminAction} className="mt-8 space-y-4 rounded-[8px] bg-[#F7F8F8] p-5">
          {hasInvalidCredentials ? (
            <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              이메일 또는 비밀번호가 올바르지 않습니다.
            </p>
          ) : null}
          <label className="block">
            <span className="text-sm font-bold">Email</span>
            <input name="email" type="email" required className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4" />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Password</span>
            <input name="password" type="password" required className="mt-2 h-12 w-full rounded-[8px] border border-[#E8E8E8] px-4" />
          </label>
          <button className="h-12 w-full rounded-full bg-[#1A1A1A] text-sm font-black text-white" type="submit">
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [x] **Step 7: Protect admin via a route group (required)**

First make the root `app/admin/layout.tsx` a bare passthrough with NO auth, so it can safely wrap `/admin/login`:

```tsx
export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
```

Then put the auth guard + chrome in `app/admin/(protected)/layout.tsx`:

```tsx
import Link from "next/link";
import { logoutAdminAction } from "@/lib/actions/admin-auth";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F7F8F8]">
      <header className="border-b border-[#E8E8E8] bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black">Granite Admin</h1>
            <p className="text-xs font-semibold text-[#6F7477]">{admin.displayName}</p>
          </div>
          <form action={logoutAdminAction}>
            <button className="h-9 rounded-full border border-[#D0D5D8] px-3 text-sm font-bold" type="submit">
              Logout
            </button>
          </form>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto text-sm font-bold text-[#6F7477]">
          <Link href="/admin/content">Content</Link>
          <Link href="/admin/announcements">Announcements</Link>
          <Link href="/admin/audit">Audit</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
```

`app/admin/login/page.tsx` stays at its current path (outside the `(protected)` group), so it is reachable without a session. Move `content`, `announcements`, and `audit` page directories under `app/admin/(protected)/`. URLs are unchanged because route groups are URL-transparent.

- [x] **Step 8: Create admin index redirect**

Create `app/admin/(protected)/page.tsx` (inside the protected group so `/admin` requires a session before redirecting):

```tsx
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/content");
}
```

- [x] **Step 9: Run tests**

Run:

```bash
pnpm test lib/actions/admin-auth.test.ts
pnpm typecheck
```

Expected: both pass.

- [x] **Step 10: Commit**

```bash
git add app/admin lib/actions/admin-auth.ts lib/actions/admin-auth-schema.ts lib/actions/admin-auth.test.ts lib/auth/admin.ts
git commit -m "feat: add admin authentication"
```

---

## Task 5: First Admin Creation SOP

**Files:**
- Create: `scripts/create-admin-hash.ts`
- Create: `docs/admin-operations.md`
- Optional Create: `migrations/0004_seed_initial_admin.sql`

- [x] **Step 1: Add hash generator script**

Create `scripts/create-admin-hash.ts`:

```ts
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password || password.length < 12) {
  console.error("Usage: node scripts/create-admin-hash.ts <password-with-at-least-12-chars>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
```

- [x] **Step 2: Document manual admin insert**

Create `docs/admin-operations.md`:

````markdown
# Granite Admin Operations

## Initial Admin

Generate a password hash locally:

```bash
node scripts/create-admin-hash.ts '<strong-password>'
```

Insert the first admin through D1 migration or one-time D1 console execution:

```sql
INSERT INTO admins (id, email, password_hash, display_name, is_active)
VALUES ('admin_primary', 'ops@granite.kr', '<bcrypt-hash>', 'Granite Ops', 1);
```

Do not commit real password hashes for production admins unless the repository is private and the operational risk is accepted. Prefer a one-time D1 console insert for production.

## Password Rotation

1. Generate a new hash with `scripts/create-admin-hash.ts`.
2. Update `admins.password_hash` for the target admin.
3. Rotate `ADMIN_JWT_SECRET` if session compromise is suspected.
4. Confirm old sessions no longer access `/admin/content`.

## Image Policy

Public image serving is already configured through R2/CDN. Admin forms must store only URLs on the configured `CDN_BASE_URL` host (currently `https://cdn.granite.kr/...`) or approved relative CDN paths. The `cdnUrl` validator derives the allowed host from `CDN_BASE_URL`, so it stays correct if the domain changes. Do not store private R2 URLs, signed URLs, or raw S3 endpoint URLs.
````

- [x] **Step 3: Decide seed strategy**

Choose one:

- Migration seed for local/preview only: create `migrations/0004_seed_initial_admin.sql` with a non-production local hash.
- Production one-time insert: do not create a seed migration; follow `docs/admin-operations.md`.

Recommended: one-time insert for production, optional local seed outside production.

- [x] **Step 4: Commit**

```bash
git add scripts/create-admin-hash.ts docs/admin-operations.md
git commit -m "docs: add admin account operations"
```

---

## Task 6: Admin Content Validation

**Files:**
- Modify: `lib/actions/admin-content-schema.ts`
- Modify: `lib/actions/admin-content.test.ts`

- [x] **Step 1: Replace stale form schema tests**

Update `lib/actions/admin-content.test.ts` to cover Phase 2 fields:

```ts
import { describe, expect, it } from "vitest";
import {
  parseAreaForm,
  parseBoulderForm,
  parseCragForm,
  parseRouteForm,
  parseTopoForm,
} from "./admin-content-schema";

describe("admin content form parsing", () => {
  it("parses crag fields matching Phase 2 schema", () => {
    const parsed = parseCragForm({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      description: "지하철 접근 가능",
      lat: "37.4194",
      lng: "126.9323",
      season: "2월 말 ~ 5월 말",
      coverImageUrl: "https://cdn.granite.kr/crags/anyang/cover.webp",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed).toMatchObject({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      description: "지하철 접근 가능",
      lat: 37.4194,
      lng: 126.9323,
      isPublished: true,
      sortOrder: 1,
    });
  });

  it("normalizes boulder hashtags into JSON text", () => {
    const parsed = parseBoulderForm({
      id: "boulder_gomul_boulder",
      sectorId: "sector_anyang_antique",
      name: "고물 볼더",
      slug: "gomul_boulder",
      lat: "37.423499",
      lng: "126.92643",
      hashtags: "#안양, 고물",
      coverImageUrl: "",
      isPublished: "on",
      sortOrder: "1",
    });

    expect(parsed.hashtags).toBe(JSON.stringify(["안양", "고물"]));
  });

  it("rejects routes without topo id", () => {
    expect(() =>
      parseRouteForm({
        id: "route_anaconda",
        topoId: "",
        name: "아나콘다",
        slug: "anaconda",
        grade: "V5",
        gradeNum: "5",
        fa: "",
        description: "",
        lineImageUrl: "",
        isPublished: "on",
        sortOrder: "1",
      }),
    ).toThrow();
  });
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: fail until schemas are replaced.

- [x] **Step 3: Implement aligned schemas**

Update `lib/actions/admin-content-schema.ts` with Phase 2 fields:

```ts
import { z } from "zod";
import { normalizeSlug, parseGradeNum } from "@/lib/db/import-normalize";

type RawForm = Record<string, FormDataEntryValue | string | undefined>;

const optionalId = z.string().trim().optional().transform((value) => value || null);
const requiredText = z.string().trim().min(1);
const optionalText = z.string().optional().transform((value) => value?.trim() ?? "");
const nullableText = z.string().optional().transform((value) => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
});

const slug = requiredText.refine((value) => normalizeSlug(value) === value, {
  message: "Slug must be lowercase snake_case",
});

const optionalNumber = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error("Invalid number");
  return parsed;
});

const requiredNumber = z.union([z.string(), z.number()]).transform((value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error("Invalid number");
  return parsed;
});

const sortOrder = z.union([z.string(), z.number(), z.undefined()]).transform((value) => {
  if (value === undefined || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Invalid sort order");
  return parsed;
});

const checkbox = z.union([z.string(), z.boolean(), z.undefined()]).transform((value) => value === "on" || value === true);

// Derive the allowed CDN host from CDN_BASE_URL so this stays in lockstep with
// lib/r2/images.ts (buildCdnImageUrl). Do NOT hardcode the host here — the
// public domain is configured via env and may differ between environments.
function cdnOrigin(): string {
  const base = process.env.CDN_BASE_URL ?? "https://cdn.granite.kr";
  return new URL(base).origin;
}

const cdnUrl = z.string().trim().default("").refine(
  (value) => {
    if (value === "" || value.startsWith("/")) return true;
    try {
      return new URL(value).origin === cdnOrigin();
    } catch {
      return false;
    }
  },
  { message: "Image URL must be empty, a CDN URL on CDN_BASE_URL's host, or an approved CDN path" },
);

export const areaFormSchema = z.object({
  id: optionalId,
  name: requiredText,
  nameEn: nullableText,
  slug,
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const cragFormSchema = z.object({
  id: optionalId,
  areaId: requiredText,
  name: requiredText,
  nameEn: nullableText,
  slug,
  lat: optionalNumber,
  lng: optionalNumber,
  description: optionalText,
  season: optionalText,
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const sectorFormSchema = z.object({
  id: optionalId,
  cragId: requiredText,
  name: requiredText,
  nameEn: nullableText,
  slug,
  lat: optionalNumber,
  lng: optionalNumber,
  description: optionalText,
  season: optionalText,
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const boulderFormSchema = z.object({
  id: optionalId,
  sectorId: requiredText,
  name: requiredText,
  slug,
  lat: requiredNumber,
  lng: requiredNumber,
  hashtags: z.string().default("").transform((value) =>
    JSON.stringify(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ),
  coverImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

export const topoFormSchema = z.object({
  id: optionalId,
  boulderId: requiredText,
  name: requiredText,
  baseImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
});

// NOTE: a per-field transform CANNOT read sibling `grade`, so blank `gradeNum`
// must be derived at the OBJECT level. Keep `gradeNum` as a raw optional field
// here, then add an object-level `.transform` (below) to compute the final
// number. Do NOT call `parseGradeNum("")` in a field transform — it throws.
export const routeFormSchema = z.object({
  id: optionalId,
  topoId: requiredText,
  name: requiredText,
  slug,
  grade: requiredText,
  gradeNum: z.union([z.string(), z.number()]).optional(),
  fa: optionalText,
  description: optionalText,
  lineImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
}).transform((data, ctx) => {
  // Compute final numeric gradeNum: use the provided value, else derive from grade.
  let gradeNum: number;
  if (data.gradeNum !== undefined && data.gradeNum !== "") {
    gradeNum = Number(data.gradeNum);
    if (Number.isNaN(gradeNum)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid grade number", path: ["gradeNum"] });
      return z.NEVER;
    }
  } else {
    gradeNum = parseGradeNum(data.grade);
  }
  return { ...data, gradeNum };
});

export function parseAreaForm(rawForm: RawForm) {
  return areaFormSchema.parse(rawForm);
}

export function parseCragForm(rawForm: RawForm) {
  return cragFormSchema.parse(rawForm);
}

export function parseSectorForm(rawForm: RawForm) {
  return sectorFormSchema.parse(rawForm);
}

export function parseBoulderForm(rawForm: RawForm) {
  return boulderFormSchema.parse(rawForm);
}

export function parseTopoForm(rawForm: RawForm) {
  return topoFormSchema.parse(rawForm);
}

export function parseRouteForm(rawForm: RawForm) {
  return routeFormSchema.parse(rawForm);
}
```

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add lib/actions/admin-content-schema.ts lib/actions/admin-content.test.ts
git commit -m "feat: align admin content validation with phase 2 schema"
```

---

## Task 7: Admin Content SQL Mutations With Soft Delete

**Files:**
- Create: `lib/db/admin-content-queries.ts`
- Create: `lib/db/admin-content-queries.test.ts`

- [x] **Step 1: Add tests for upsert, soft delete, and restore SQL**

Create `lib/db/admin-content-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { restoreContent, softDeleteContent, upsertCrag, updatePublishState } from "./admin-content-queries";
import { executeD1 } from "./d1-http";

vi.mock("./d1-http", () => ({
  executeD1: vi.fn(),
}));

const mockedExecute = vi.mocked(executeD1);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin content queries", () => {
  it("upserts crags with Phase 2 columns", async () => {
    await upsertCrag({
      id: "crag_anyang",
      areaId: "area_greater_seoul",
      name: "안양",
      nameEn: "Anyang",
      slug: "anyang",
      lat: 37.4194,
      lng: 126.9323,
      description: "desc",
      season: "spring",
      coverImageUrl: "https://cdn.granite.kr/crags/anyang/cover.webp",
      isPublished: true,
      sortOrder: 1,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crags"),
      expect.arrayContaining(["crag_anyang", "area_greater_seoul", "안양", "Anyang", "anyang", 1, 1]),
    );
  });

  it("updates publish state with a constrained table name", async () => {
    await updatePublishState({
      table: "routes",
      id: "route_anaconda",
      isPublished: false,
    });

    expect(mockedExecute).toHaveBeenCalledWith(
      "UPDATE routes SET is_published = ?, updated_at = datetime('now') WHERE id = ?",
      [0, "route_anaconda"],
    );
  });

  it("soft deletes routes by id", async () => {
    await softDeleteContent({ table: "routes", id: "route_anaconda" });

    expect(mockedExecute).toHaveBeenCalledWith(
      "UPDATE routes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      ["route_anaconda"],
    );
  });

  it("restores soft deleted content by id", async () => {
    await restoreContent({ table: "routes", id: "route_anaconda" });

    expect(mockedExecute).toHaveBeenCalledWith(
      "UPDATE routes SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?",
      ["route_anaconda"],
    );
  });
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/db/admin-content-queries.test.ts
```

Expected: fail because file is missing.

- [x] **Step 3: Implement query functions**

Create `lib/db/admin-content-queries.ts` with explicit upsert functions and constrained table helpers for soft delete/restore:

```ts
import { executeD1 } from "./d1-http";

const mutableTables = new Set(["areas", "crags", "sectors", "boulders", "topos", "routes", "announcements"]);

export async function updatePublishState(input: {
  table: "areas" | "crags" | "sectors" | "boulders" | "topos" | "routes" | "announcements";
  id: string;
  isPublished: boolean;
}): Promise<void> {
  if (!mutableTables.has(input.table)) {
    throw new Error(`Unsupported publish table: ${input.table}`);
  }
  await executeD1(
    `UPDATE ${input.table} SET is_published = ?, updated_at = datetime('now') WHERE id = ?`,
    [input.isPublished ? 1 : 0, input.id],
  );
}

export async function softDeleteContent(input: {
  table: "areas" | "crags" | "sectors" | "boulders" | "topos" | "routes" | "announcements";
  id: string;
}): Promise<void> {
  if (!mutableTables.has(input.table)) {
    throw new Error(`Unsupported soft-delete table: ${input.table}`);
  }
  await executeD1(
    `UPDATE ${input.table} SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [input.id],
  );
}

export async function restoreContent(input: {
  table: "areas" | "crags" | "sectors" | "boulders" | "topos" | "routes" | "announcements";
  id: string;
}): Promise<void> {
  if (!mutableTables.has(input.table)) {
    throw new Error(`Unsupported restore table: ${input.table}`);
  }
  await executeD1(
    `UPDATE ${input.table} SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [input.id],
  );
}

export async function upsertCrag(input: {
  id: string;
  areaId: string;
  name: string;
  nameEn: string | null;
  slug: string;
  lat: number | null;
  lng: number | null;
  description: string;
  season: string;
  coverImageUrl: string;
  isPublished: boolean;
  sortOrder: number;
}): Promise<void> {
  await executeD1(
    `INSERT INTO crags
       (id, area_id, name, name_en, slug, lat, lng, description, season, cover_image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       area_id = excluded.area_id,
       name = excluded.name,
       name_en = excluded.name_en,
       slug = excluded.slug,
       lat = excluded.lat,
       lng = excluded.lng,
       description = excluded.description,
       season = excluded.season,
       cover_image_url = excluded.cover_image_url,
       is_published = excluded.is_published,
       sort_order = excluded.sort_order,
       updated_at = datetime('now')`,
    [
      input.id,
      input.areaId,
      input.name,
      input.nameEn,
      input.slug,
      input.lat,
      input.lng,
      input.description,
      input.season,
      input.coverImageUrl,
      input.isPublished ? 1 : 0,
      input.sortOrder,
    ],
  );
}

```

Then add equivalent explicit functions for:

- `upsertArea`
- `upsertSector`
- `upsertBoulder`
- `upsertTopo`
- `upsertRoute`
- `softDeleteContent`
- `restoreContent`

Use the same pattern: explicit SQL, parameter binding, `updated_at = datetime('now')` on conflict/update.

> **Soft delete vs. UNIQUE(slug) — must handle.** Soft delete only sets `deleted_at`; the row physically stays, so it still occupies its UNIQUE slot: `areas.slug` and `crags.slug` are globally UNIQUE, and `sectors`/`boulders`/`routes` enforce `UNIQUE(parent, slug)`. Re-creating a record with the same slug after a soft delete therefore fails with a constraint violation, and `ON CONFLICT(id)` upsert does NOT rescue it because the collision is on the slug index, not the id. SQLite cannot scope a UNIQUE constraint to `deleted_at IS NULL` without rebuilding the table (out of scope for roll-forward migrations). Pick one behavior and implement it in the upsert/create path:
>
> - **Recommended:** before insert, look up any row (including soft-deleted) with the same slug under the same parent. If it is soft-deleted, restore-and-update that row instead of inserting a new one. If it is live, reject with a clear "slug already in use" error.
> - Alternative: require the operator to change the slug when reusing one from a deleted record.
>
> Add a test in `admin-content-queries.test.ts` covering "create with a slug that belongs to a soft-deleted row".

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/admin-content-queries.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add lib/db/admin-content-queries.ts lib/db/admin-content-queries.test.ts
git commit -m "feat: add admin content mutation queries"
```

---

## Task 8: Server Actions For Content CRUD

**Files:**
- Modify: `lib/actions/admin-content.ts`
- Modify: `lib/actions/admin-content.test.ts`

- [x] **Step 1: Add action behavior tests**

Add tests that mock:

- `requireAdmin`
- admin content query functions
- `insertAdminAuditLog`
- `revalidatePath`
- `revalidateTag`

Required assertions:

- Every action calls `requireAdmin()` first.
- Save action inserts/updates the correct entity.
- Delete action writes an audit log.
- Publish toggle invalidates the correct public tags.

Example test:

```ts
it("saveCragAction requires admin, upserts crag, audits, and revalidates", async () => {
  mockedRequireAdmin.mockResolvedValue({
    adminId: "admin_1",
    email: "ops@granite.kr",
    displayName: "Ops",
  });

  const formData = new FormData();
  formData.set("id", "crag_anyang");
  formData.set("areaId", "area_greater_seoul");
  formData.set("name", "안양");
  formData.set("nameEn", "Anyang");
  formData.set("slug", "anyang");
  formData.set("description", "desc");
  formData.set("season", "spring");
  formData.set("coverImageUrl", "https://cdn.granite.kr/crags/anyang/cover.webp");
  formData.set("isPublished", "on");
  formData.set("sortOrder", "1");

  await saveCragAction(formData);

  expect(mockedRequireAdmin).toHaveBeenCalled();
  expect(mockedUpsertCrag).toHaveBeenCalledWith(expect.objectContaining({ id: "crag_anyang" }));
  expect(mockedInsertAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
    adminId: "admin_1",
    action: "content.upsert",
    targetType: "crag",
    targetId: "crag_anyang",
  }));
  expect(mockedRevalidateTag).toHaveBeenCalledWith("home");
  expect(mockedRevalidatePath).toHaveBeenCalledWith("/");
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: fail until actions are rewritten.

- [x] **Step 3: Rewrite actions**

Implement actions with this pattern:

```ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import { upsertCrag } from "@/lib/db/admin-content-queries";
import { parseCragForm } from "./admin-content-schema";

function revalidateCragSurface(slug?: string): void {
  revalidateTag("home");
  revalidateTag("areas:list");
  if (slug) revalidateTag(`crag:${slug}`);
  revalidatePath("/");
  if (slug) revalidatePath(`/c/${slug}`);
}

export async function saveCragAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseCragForm(Object.fromEntries(formData));
  const id = parsed.id ?? `crag_${parsed.slug}`;

  await upsertCrag({ ...parsed, id });
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "content.upsert",
    targetType: "crag",
    targetId: id,
    metadata: { slug: parsed.slug },
  });

  revalidateCragSurface(parsed.slug);
}
```

Add equivalent actions:

- `saveAreaAction`
- `saveSectorAction`
- `saveBoulderAction`
- `saveTopoAction`
- `saveRouteAction`
- `softDeleteAreaAction`
- `softDeleteCragAction`
- `softDeleteSectorAction`
- `softDeleteBoulderAction`
- `softDeleteTopoAction`
- `softDeleteRouteAction`
- `restoreAreaAction`
- `restoreCragAction`
- `restoreSectorAction`
- `restoreBoulderAction`
- `restoreTopoAction`
- `restoreRouteAction`
- `togglePublishAction`

Delete actions are soft deletes: set `deleted_at = datetime('now')`, write audit action `content.soft_delete`, and revalidate affected public surfaces. Restore actions set `deleted_at = NULL`, write audit action `content.restore`, and revalidate affected public surfaces.

> **Atomicity note.** The mutation and `insertAdminAuditLog` are two separate `executeD1` calls; the D1 HTTP path used here has no multi-statement transaction, so they can diverge if the audit insert fails after the mutation succeeds. Order them so the **mutation runs first, the audit log second** (as shown). Treat a failed audit insert as non-fatal to the data change: let the mutation stand, but log the audit failure server-side (e.g., `console.error`) so it can be reconciled — do not roll back or retry the content write. Never let an audit failure surface as a content-save failure to the operator. If true atomicity becomes a requirement later, revisit `batchD1` (see Task 2) once the deployed D1 endpoint's batch support is confirmed.

- [x] **Step 4: Run action tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add lib/actions/admin-content.ts lib/actions/admin-content.test.ts
git commit -m "feat: implement admin content actions"
```

---

## Task 9: Admin Read Models For Editing

**Files:**
- Create: `lib/db/admin-read-queries.ts`
- Create: `lib/db/admin-read-queries.test.ts`

- [x] **Step 1: Define admin list/detail read models**

Admin read models must include unpublished rows. Do not reuse public read functions that filter `is_published = 1`.

Create functions:

- `getAdminContentOverview()`
- `getAdminAreas()`
- `getAdminCrags()`
- `getAdminSectors(cragId?)`
- `getAdminBoulders(sectorId?)`
- `getAdminTopos(boulderId?)`
- `getAdminRoutes(topoId?)`
- `getAdminAnnouncements()`

- [x] **Step 2: Write tests**

Test that:

- Admin SQL does not filter unpublished or deleted rows unless a function explicitly asks for a filter.
- Rows are ordered by hierarchy and `sort_order`.
- `getAdminContentOverview()` returns counts for published and draft rows.
- `getAdminContentOverview()` returns deleted counts separately.

- [x] **Step 2A: Update public query tests for soft delete**

Modify `lib/db/queries.test.ts` so public SQL assertions require `deleted_at IS NULL` for every content table and announcement query. Required coverage:

- home stats exclude deleted ancestors;
- area/crag lists exclude deleted rows;
- crag detail queries exclude deleted sectors, boulders, topos, routes;
- topo and route detail queries exclude deleted ancestors;
- announcements exclude deleted rows.

- [x] **Step 3: Implement queries**

Use `queryD1` and explicit SQL. Example:

```ts
export async function getAdminCrags(): Promise<AdminCragRow[]> {
  return queryD1<AdminCragRow>(
    `SELECT
       c.id,
       c.area_id AS areaId,
       a.name AS areaName,
       c.name,
       c.name_en AS nameEn,
       c.slug,
       c.lat,
       c.lng,
       c.description,
       c.season,
       c.cover_image_url AS coverImageUrl,
       c.is_published AS isPublished,
       c.sort_order AS sortOrder
     FROM crags c
     JOIN areas a ON a.id = c.area_id
     -- Admin reads INCLUDE deleted crags (so the UI can show + restore them);
     -- only filter out orphans whose parent area is deleted.
     WHERE a.deleted_at IS NULL
     ORDER BY a.sort_order ASC, c.sort_order ASC, c.name ASC`,
  );
}
```

- [x] **Step 3A: Update public queries for soft delete**

Modify `lib/db/queries.ts` to add `deleted_at IS NULL` checks to every public read. Public pages must behave as if soft-deleted rows do not exist. Do not add soft-delete filters only in repository row shaping; keep the filtering in SQL.

- [x] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/admin-read-queries.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add lib/db/admin-read-queries.ts lib/db/admin-read-queries.test.ts
git commit -m "feat: add admin content read models"
```

---

## Task 10: Desktop Admin Component System And Entity Pages

> **Cache-revalidation wiring (required).** The save/softDelete/restore actions for sector/boulder/topo/route read OPTIONAL parent-context fields from `FormData` to fire the right `crag:<slug>`/`sector:<slug>`/`boulder:<id>`/`/topos/<id>`/`/c/<slug>` tags and paths. Each entity form MUST include these as hidden inputs alongside the persisted fields, otherwise the public crag/topo pages will go stale until TTL:
> - Sector form: `<input type="hidden" name="cragSlug" value={crag.slug} />`
> - Boulder form: `<input type="hidden" name="cragSlug" value={crag.slug} />` and `<input type="hidden" name="sectorSlug" value={sector.slug} />`
> - Topo form: `<input type="hidden" name="cragSlug" value={crag.slug} />`
> - Route form: `<input type="hidden" name="cragSlug" value={crag.slug} />` and `<input type="hidden" name="boulderId" value={boulder.id} />` (the route's `topoId` is already a schema field)
> - The matching soft-delete and restore button forms for boulder/route/topo must include the same hidden inputs as the save form so cache invalidation is symmetric.

**Files:**
- Replace: `app/admin/(protected)/content/page.tsx`
- Create: `components/admin/admin-shell.tsx`
- Create: `components/admin/admin-card.tsx`
- Create: `components/admin/admin-table.tsx`
- Create: `components/admin/admin-field.tsx`
- Create: `components/admin/admin-actions.tsx`
- Create: `components/admin/publish-badge.tsx`
- Create: `components/admin/delete-restore-controls.tsx`
- Create: `app/admin/content/areas/page.tsx`
- Create: `app/admin/content/crags/page.tsx`
- Create: `app/admin/content/sectors/page.tsx`
- Create: `app/admin/content/boulders/page.tsx`
- Create: `app/admin/content/topos/page.tsx`
- Create: `app/admin/content/routes/page.tsx`

- [x] **Step 1: Add desktop-only admin UI components**

Admin pages are not required to support mobile. Use a desktop utility layout with fixed minimum width and dense tables:

```tsx
export function AdminCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#E1E4E8] bg-white p-5">
      <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
```

```tsx
export function PublishBadge({ published, deleted }: { published: boolean; deleted?: boolean }) {
  if (deleted) {
    return <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Deleted</span>;
  }
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}>
      {published ? "Published" : "Draft"}
    </span>
  );
}
```

All admin pages should use:

```tsx
<main className="min-h-screen min-w-[1024px] bg-[#F7F8F8] text-[#111827]">
```

- [x] **Step 2: Replace stale page fields**

Remove old Phase 1 fields from `app/admin/content/page.tsx`:

- `summary`
- `accessDesc`
- `parkingDesc`
- `coordPrecision`
- `rockType`
- route `boulderId`

Use Phase 2 fields:

- `description`
- `nameEn`
- `sortOrder`
- `isPublished`
- `topoId` for routes

- [x] **Step 3: Build overview page**

`app/admin/content/page.tsx` should render:

- Counts: total/published/draft for each entity type.
- Navigation links to entity sections or filtered forms.
- A compact "recently edited" placeholder can be omitted until audit browse is built.

Use dense admin styling, not marketing cards. Cards are acceptable for repeated entity rows only.

- [x] **Step 4: Create one page per entity**

Build required pages:

- `/admin/content/areas`
- `/admin/content/crags`
- `/admin/content/sectors`
- `/admin/content/boulders`
- `/admin/content/topos`
- `/admin/content/routes`

Each page must:

- use the shared admin components;
- show active and soft-deleted rows;
- include filters for parent entity where useful;
- include create/update forms;
- include publish toggle;
- include soft delete and restore controls.

- [x] **Step 5: Add entity forms**

For each entity, include:

- Create form.
- Existing row list.
- Inline update form or "Edit" details section.
- Publish toggle form.
- Soft delete form.
- Restore form for deleted rows.

For delete, require a confirmation field:

```tsx
<input name="confirm" placeholder="DELETE" required />
```

The Server Action must reject delete unless `confirm === "DELETE"`.

- [x] **Step 6: Use server actions directly**

Forms should use direct action imports:

```tsx
<form action={saveCragAction}>
  <input type="hidden" name="id" defaultValue={crag.id} />
  <input name="name" defaultValue={crag.name} />
  <button type="submit">Save</button>
</form>
```

- [x] **Step 7: Run verification**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both pass.

- [x] **Step 8: Commit**

```bash
git add app/admin/content components/admin
git commit -m "feat: build desktop admin content pages"
```

---

## Task 11: Announcement CRUD

**Files:**
- Create: `lib/actions/admin-announcements.ts`
- Create: `lib/actions/admin-announcements.test.ts`
- Add functions in: `lib/db/admin-content-queries.ts`
- Modify: `app/admin/announcements/page.tsx`

- [x] **Step 1: Add announcement validation**

Either place in `admin-content-schema.ts` or new `admin-announcement-schema.ts`:

```ts
export const announcementFormSchema = z.object({
  id: optionalId,
  title: requiredText,
  body: optionalText,
  coverImageUrl: cdnUrl,
  cragId: nullableText,
  linkUrl: optionalText,
  isPublished: checkbox,
  publishedAt: optionalText,
  sortOrder,
});
```

- [x] **Step 2: Add SQL functions**

Add:

- `upsertAnnouncement(input)`
- `softDeleteAnnouncement(id)`
- `restoreAnnouncement(id)`

Use `announcements` columns from `migrations/0001_init.sql`.

- [x] **Step 3: Add Server Actions**

Pattern:

```ts
export async function saveAnnouncementAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseAnnouncementForm(Object.fromEntries(formData));
  const id = parsed.id ?? `announcement_${randomUUID()}`;

  await upsertAnnouncement({ ...parsed, id });
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "announcement.upsert",
    targetType: "announcement",
    targetId: id,
    metadata: { title: parsed.title },
  });

  revalidateTag("home");
  revalidatePath("/");
}
```

- [x] **Step 4: Replace read-only page**

`app/admin/announcements/page.tsx` should:

- Read all announcements, including drafts.
- Render create form.
- Render edit forms for existing announcements.
- Render publish toggles and delete controls.

- [x] **Step 5: Run tests and build**

Run:

```bash
pnpm test lib/actions/admin-announcements.test.ts lib/db/admin-content-queries.test.ts
pnpm typecheck
pnpm build
```

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add app/admin/announcements lib/actions lib/db/admin-content-queries.ts lib/db/admin-content-queries.test.ts
git commit -m "feat: add admin announcement management"
```

---

## Task 12: Direct Admin Image Upload

**Files:**
- Modify: `next.config.ts` (raise Server Action body size limit)
- Modify: `lib/r2/images.ts`
- Create: `lib/actions/admin-images.ts`
- Create: `lib/actions/admin-images.test.ts`
- Create: `components/admin/image-upload-field.tsx` (client component glue)
- Modify admin entity forms where image fields appear.

### Required Scope

Because R2/CDN public serving is already complete, Phase 3 does not configure the CDN. It adds direct admin upload into that existing serving pipeline:

- Admin forms accept only empty string, a URL on the `CDN_BASE_URL` host, or an approved CDN path (see the env-derived `cdnUrl` validator in Task 6).
- UI previews the current image URL.
- Server Actions store the URL on the entity table.
- No private R2 URL or signed URL is stored.
- Admin image upload accepts `image/jpeg`, `image/png`, and `image/webp`.
- Max upload size is 10MB. **This requires raising the Next.js Server Action body size limit (Step 1A); the default is 1MB and any upload over 1MB fails without it.**
- Upload key uses `buildR2ImageKey`.
- Persisted URL uses `buildCdnImageUrl`.

- [x] **Step 1: Add R2 file validation tests**

Create `lib/actions/admin-images.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { validateAdminImageFileForTest } from "./admin-images";

describe("admin image uploads", () => {
  it("accepts jpeg, png, and webp under 10MB", () => {
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    expect(validateAdminImageFileForTest(file)).toEqual({ extension: "jpg" });
  });

  it("rejects unsupported mime types", () => {
    const file = new File(["x"], "cover.gif", { type: "image/gif" });
    expect(() => validateAdminImageFileForTest(file)).toThrow("Unsupported image type");
  });

  it("rejects files over 10MB", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "cover.jpg", { type: "image/jpeg" });
    expect(() => validateAdminImageFileForTest(file)).toThrow("Image is too large");
  });
});
```

- [x] **Step 1A: Raise the Server Action body size limit**

Server Actions receive `FormData` over the same request body as the action invocation, and Next.js caps that at **1MB by default**. A 10MB image upload will fail at the framework boundary before the action runs. Raise it in `next.config.ts`:

```ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    loader: "custom",
    loaderFile: "./lib/r2/cloudflare-image-loader.ts",
  },
  poweredByHeader: false,
};

export default nextConfig;
```

Keep the limit aligned with `MAX_IMAGE_BYTES` (10MB) in the upload action. After editing, run `pnpm build` to confirm the config still parses.

- [x] **Step 2: Implement upload action**

Create `lib/actions/admin-images.ts`:

```ts
"use server";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import { buildCdnImageUrl, buildR2ImageKey, type ImageEntityType } from "@/lib/r2/images";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function validateAdminImageFileForTest(file: File): { extension: string } {
  const extension = allowedTypes.get(file.type);
  if (!extension) throw new Error("Unsupported image type");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large");
  return { extension };
}

// Env names must match the committed `.env.example`: the R2 S3 endpoint is
// derived from CLOUDFLARE_ACCOUNT_ID, and the bucket is R2_BUCKET_NAME.
function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for R2 upload");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export async function uploadAdminImageAction(formData: FormData): Promise<{ cdnUrl: string }> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");
  const purpose = formData.get("purpose");

  if (!(file instanceof File)) throw new Error("Image file is required");
  if (typeof entityType !== "string") throw new Error("entityType is required");
  if (typeof entityId !== "string") throw new Error("entityId is required");
  if (typeof purpose !== "string") throw new Error("purpose is required");

  const { extension } = validateAdminImageFileForTest(file);
  const key = buildR2ImageKey({
    entityType: entityType as ImageEntityType,
    entityId,
    purpose,
    extension,
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: bytes,
    ContentType: file.type,
  }));

  const cdnUrl = buildCdnImageUrl(key);
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "image.upload",
    targetType: entityType,
    targetId: entityId,
    metadata: { key, purpose, contentType: file.type, size: file.size },
  });

  return { cdnUrl };
}
```

- [x] **Step 3: Add image preview and upload controls to forms**

The rest of the admin is plain server-action forms, but image upload needs a client component: `uploadAdminImageAction` returns `{ cdnUrl }`, and that value must be written back into the entity form's `coverImageUrl`/`baseImageUrl`/`lineImageUrl` field before the entity is saved. A bare `<input type="file">` inside the save form does nothing — `saveCragAction` does not read the file. Build one small client component and reuse it for every image field.

Create `components/admin/image-upload-field.tsx`:

```tsx
"use client";

import { useState } from "react";
import { uploadAdminImageAction } from "@/lib/actions/admin-images";

export function ImageUploadField({
  name,
  defaultValue,
  entityType,
  entityId,
  purpose,
}: {
  name: string;
  defaultValue: string;
  entityType: string;
  entityId: string;
  purpose: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      fd.set("purpose", purpose);
      const { cdnUrl } = await uploadAdminImageAction(fd);
      setUrl(cdnUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {url ? <img src={url} alt="" className="h-24 w-full rounded-[8px] object-cover" /> : null}
      {/* The hidden input is what the entity save form actually submits */}
      <input type="hidden" name={name} value={url} readOnly />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {busy ? <p className="text-xs text-[#6F7477]">Uploading…</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
```

Notes:
- The upload happens **before** the entity save: the action returns the CDN URL, the component stores it in a hidden input, and the subsequent `saveCragAction` submit persists that URL. The entity must already have an `id` so `buildR2ImageKey` has a stable path; for brand-new records, save the entity first (creating its id), then attach an image on edit, or generate the id client-side and pass it through.
- Keep the field name matching the schema (`coverImageUrl`, `baseImageUrl`, or `lineImageUrl`).
- Because `uploadAdminImageAction` returns a value, it is invoked from the client component (not via `<form action={...}>`), which is why this glue is required.

- [x] **Step 4: Confirm validation blocks private URLs**

Add validation tests:

```ts
expect(() =>
  parseCragForm({
    areaId: "area_greater_seoul",
    name: "안양",
    slug: "anyang",
    coverImageUrl: "https://granite-v2.r2.cloudflarestorage.com/private.jpg",
  }),
).toThrow("Image URL");
```

- [x] **Step 5: Run image tests**

Run:

```bash
pnpm test lib/actions/admin-images.test.ts lib/r2/images.test.ts
```

Expected: pass.

- [x] **Step 6: Commit direct upload**

```bash
git add next.config.ts app/admin components/admin/image-upload-field.tsx lib/actions/admin-images.ts lib/actions/admin-images.test.ts lib/actions/admin-content-schema.ts lib/actions/admin-content.test.ts lib/r2
git commit -m "feat: add direct admin image upload"
```

---

## Task 13: Audit Log Visibility

**Files:**
- Create: `app/admin/audit/page.tsx`
- Modify: `app/admin/layout.tsx`
- Add read query to: `lib/db/admin-read-queries.ts`

- [x] **Step 1: Add audit read query**

Add:

```ts
export async function getRecentAdminAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
  return queryD1<AdminAuditLog>(
    `SELECT
       l.id,
       l.admin_id AS adminId,
       a.email AS adminEmail,
       l.action,
       l.target_type AS targetType,
       l.target_id AS targetId,
       l.metadata,
       l.created_at AS createdAt
     FROM admin_audit_logs l
     JOIN admins a ON a.id = l.admin_id
     ORDER BY l.created_at DESC
     LIMIT ?`,
    [limit],
  );
}
```

- [x] **Step 2: Build audit page**

Create `app/admin/audit/page.tsx`:

```tsx
import { getRecentAdminAuditLogs } from "@/lib/db/admin-read-queries";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const logs = await getRecentAdminAuditLogs(100);

  return (
    <section className="p-5">
      <h1 className="text-2xl font-black">Audit Log</h1>
      <div className="mt-4 divide-y divide-[#E8E8E8] rounded-[8px] bg-white">
        {logs.map((log) => (
          <article key={log.id} className="p-4">
            <p className="text-sm font-black">{log.action}</p>
            <p className="mt-1 text-xs font-semibold text-[#6F7477]">
              {log.targetType}:{log.targetId} · {log.adminEmail} · {log.createdAt}
            </p>
            <pre className="mt-2 overflow-x-auto rounded-[8px] bg-[#F7F8F8] p-2 text-xs">
              {log.metadata}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [x] **Step 3: Add nav link**

Add `/admin/audit` to `app/admin/layout.tsx`.

- [x] **Step 4: Commit**

```bash
git add app/admin/audit app/admin/layout.tsx lib/db/admin-read-queries.ts
git commit -m "feat: add admin audit log view"
```

---

## Task 14: Admin Operations Verification

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/admin-operations.md`

- [x] **Step 1: Run full automated verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected:

- All Vitest files pass.
- TypeScript exits 0.
- Next build exits 0.

- [x] **Step 2: Apply migrations to local D1**

Run with the project’s configured wrangler command. If `wrangler` is not installed as a dependency, either add it as a dev dependency or use the installed environment command:

```bash
pnpm wrangler d1 migrations apply granite --local
```

Expected: `0003_admin_operations.sql` applies once.

- [x] **Step 3: Verify admin login manually**

Start app:

```bash
pnpm dev
```

Manual checks:

- `/admin/login` rejects invalid credentials.
- `/admin/login` accepts a valid admin.
- `/admin/content` redirects to login when no cookie exists.
- Logout clears access.
- Expired/invalid `granite_admin` cookie cannot access protected pages.

- [x] **Step 4: Verify CRUD manually**

Use draft test records:

- Create draft Crag under an existing Area.
- Update its name and description.
- Toggle publish on/off.
- Confirm public `/` and `/c/<slug>` reflect publish state.
- Upload a cover image from admin and confirm the persisted URL is a CDN URL.
- Soft delete the draft record and confirm it disappears from public pages.
- Restore the draft record and confirm it returns where published.
- Repeat minimal create/update/toggle/soft-delete/restore for Sector, Boulder, Topo, Route.
- Create/update/publish/soft-delete/restore an Announcement and confirm home New Updates behavior.

- [x] **Step 5: Verify audit**

Confirm `admin_audit_logs` has entries for:

- login success is optional; content mutations are required.
- content create/update/soft-delete.
- announcement create/update/soft-delete.
- content restore.
- publish toggle.

- [x] **Step 6: Update roadmap**

Mark completed Phase 3 items in `docs/ROADMAP.md`.

- [x] **Step 7: Commit verification docs**

```bash
git add docs/ROADMAP.md docs/admin-operations.md
git commit -m "docs: record phase 3 admin verification"
```

---

## Task 15: Vercel CI/CD And Production Rollout

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/deployment.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/admin-operations.md`

This task intentionally lives in Phase 3, not Phase 2, because it includes Vercel deployment, CI/CD, production environment wiring, admin session secrets, and operational checks. Public R2/CDN image serving is already complete; this rollout verifies that deployed admin and public read paths use the already-serving assets correctly. Phase 3 is complete only when the real service URL is reachable and passes smoke tests.

- [x] **Step 1: Add GitHub Actions CI**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.14.0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm test

      - name: Typecheck
        run: pnpm typecheck

      - name: Build
        run: pnpm build
```

- [x] **Step 2: Add deployment documentation**

Create `docs/deployment.md`:

```markdown
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
```

- [x] **Step 3: Configure Vercel preview environment**

Set these Vercel preview environment variables (names match the committed `.env.example`):

```text
D1_HTTP_URL
D1_API_TOKEN
D1_DATABASE_ID
CDN_BASE_URL
ADMIN_JWT_SECRET
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Direct admin image upload is required in Phase 3, so R2 write credentials must be configured for preview and production. The R2 S3 endpoint is derived from `CLOUDFLARE_ACCOUNT_ID` (`https://<account-id>.r2.cloudflarestorage.com`), so there is no separate `R2_ENDPOINT` var. Keep `CDN_BASE_URL` because stored image URLs and the image loader need the public base.

- [x] **Step 4: Apply migrations to preview D1**

Run the project-approved D1 migration command against preview:

```bash
pnpm wrangler d1 migrations apply granite
```

Expected:

- `0001_init.sql`, `0002_import_v1_content.sql`, and `0003_admin_operations.sql` are applied or already marked applied.
- Preview D1 contains content rows and admin operation tables.

- [x] **Step 5: Create or confirm preview admin**

Use the `docs/admin-operations.md` SOP:

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

- [x] **Step 6: Deploy Vercel preview**

Run:

```bash
pnpm vercel deploy
```

Expected:

- Build succeeds.
- Preview URL is created.
- `/healthz` returns `checks.app = "ok"` and `checks.db = "ok"`.

- [x] **Step 7: Verify preview public UI**

Open the preview deployment and verify:

- `/`
- `/c/anyang`
- `/topos/<known-topo-id>`
- `/r/<known-route-id>`
- `/healthz`

Expected:

- Public pages load from preview D1.
- Images resolve through the approved CDN policy.
- Route line fallback still works when `line_image_url` is empty.

- [x] **Step 8: Verify preview admin UI**

Open preview admin:

- `/admin/login`
- `/admin/content`
- `/admin/announcements`
- `/admin/audit`

Expected:

- Unauthenticated admin pages redirect to login.
- Valid preview admin can log in.
- CRUD actions update preview D1.
- Public pages revalidate after publish/toggle/update.
- Audit logs are written.

- [x] **Step 9: Configure production environment**

Set production variables:

```text
D1_HTTP_URL
D1_API_TOKEN
D1_DATABASE_ID
CDN_BASE_URL
ADMIN_JWT_SECRET
```

If direct upload is approved, also set:

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Expected:

- `ADMIN_JWT_SECRET` is production-only and not reused from preview.
- Production D1 target is confirmed before migration.
- `CDN_BASE_URL` points to the already-serving production CDN.

- [x] **Step 10: Apply migrations to production D1**

Only after preview data and admin behavior are approved:

```bash
pnpm wrangler d1 migrations apply granite
```

Expected:

- Production D1 has content tables, imported content, `admins`, and `admin_audit_logs`.
- No destructive import is rerun accidentally against production.

- [x] **Step 11: Create production admin**

Use one-time D1 console execution or approved production migration. Do not commit a real production password hash unless the team explicitly accepts that risk.

Expected:

- At least one active admin exists.
- Password rotation SOP is documented.

- [x] **Step 12: Deploy production**

Run:

```bash
pnpm vercel deploy --prod
```

Expected:

- Production deployment succeeds.
- `/healthz` returns `checks.app = "ok"` and `checks.db = "ok"`.

- [x] **Step 13: Post-deploy smoke test**

Verify production:

- `/`
- `/c/anyang`
- `/topos/<known-topo-id>`
- `/r/<known-route-id>`
- `/healthz`
- `/admin/login`
- `/admin/content`
- `/admin/announcements`

Expected:

- Public routes load.
- CDN images serve.
- Admin login works.
- A harmless draft create/update/delete round-trip works.
- `admin_audit_logs` records the draft mutation.
- The real service URL is accessible to users.

- [x] **Step 14: Commit rollout docs**

After rollout notes are recorded:

```bash
git add .github/workflows/ci.yml docs/deployment.md docs/ROADMAP.md docs/admin-operations.md
git commit -m "docs: record phase 3 deployment"
```

---

## Optional Enhancements To Decide Later

These remain outside the Phase 3 required implementation unless explicitly approved in a later pass.

### Option A: CSRF Token For Admin Server Actions

**Value:** Additional defense for cookie-authenticated mutations.

**Cost/Risk:** Token plumbing through forms and actions.

**Recommendation:** Consider if admin will be used from production browsers immediately. SameSite=Lax helps, but explicit CSRF token is stronger.

### Option B: Local Admin Seed Command

**Value:** Easier local/preview setup.

**Cost/Risk:** Need to avoid production secrets or committed real hashes.

**Recommendation:** Add a local-only script or documented SQL; avoid committing production admin seed.

## Explicitly Rejected Enhancements

These should not be implemented in Phase 3:

- Admin change preview/diff.
- Role-based admin permissions.

---

## Completion Criteria

Phase 3 is complete when:

- Admin login/logout/session expiry works with `granite_admin`.
- `/admin/*` pages are protected, and every mutation calls `requireAdmin()`.
- Area/Crag/Sector/Boulder/Topo/Route CRUD works against D1.
- Announcement CRUD updates home New Updates.
- Direct admin image upload stores only approved CDN URLs or CDN paths.
- Entity-specific admin pages exist for Area, Crag, Sector, Boulder, Topo, Route, and Announcements.
- Admin UI uses a consistent desktop-only component system.
- Soft-deleted content disappears from public pages and can be restored from admin.
- Mutations write `admin_audit_logs`.
- Mutations revalidate correct public tags/paths.
- CI runs tests, typecheck, and build for pull requests and `main`.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.
- Admin SOP documents initial admin creation and password rotation.
- Preview deployment verifies admin CRUD and public D1 reads.
- Production deployment smoke test passes after admin tables and production admin are configured.
- The real service URL is accessible after Phase 3 production deployment.

---

## Task 16: Post-review hardening — slug-derived id collisions + image sanitization

> Added after the Codex adversarial review surfaced two pre-ship blockers. Both must land before Phase 3 ships to production.

**Files:**
- Modify: `lib/actions/admin-content.ts` (id generation for parent-scoped entities)
- Modify: `lib/actions/admin-content.test.ts` (new collision regression tests)
- Modify: `lib/actions/admin-images.ts` (sanitize bytes before R2 upload)
- Modify: `lib/actions/admin-images-validate.ts` (or add `lib/actions/admin-images-sanitize.ts`)
- Modify: `lib/actions/admin-images.test.ts` (sanitization assertions)
- Modify: `lib/r2/images.ts` if extension/content-type derivation needs to change
- Modify: `package.json` / lockfile (add `sharp`)

### Task 16.1 — Fix parent-scoped slug id collisions (CRITICAL)

**Problem (Codex review):** Sectors, boulders, and routes have `UNIQUE(parent, slug)` in SQL (e.g. `UNIQUE(crag_id, slug)` on `sectors`), so the SAME slug may legitimately appear under TWO different parents. However the save actions generate the primary key as `sector_${slug}` / `boulder_${slug}` / `route_${slug}` — slug-only. `findRowBySlug` runs in parent scope and finds nothing under the new parent, so the action proceeds to `upsertSector` with a globally colliding id. `ON CONFLICT(id) DO UPDATE` then **overwrites the unrelated row that lives under a different parent** — silent data loss.

Areas and crags are NOT affected: `areas.slug` and `crags.slug` are GLOBALLY UNIQUE, so `findRowBySlug` (no parent scope) would already catch the live duplicate and reject it.

Topos already use `topo_${randomUUID()}` (no slug) and announcements use `announcement_${randomUUID()}` — both safe.

- [x] **Step 1: Switch parent-scoped id generation to UUID**

In `lib/actions/admin-content.ts`, change the three affected save actions:
```ts
let id = parsed.id ?? `sector_${randomUUID()}`;   // saveSectorAction
let id = parsed.id ?? `boulder_${randomUUID()}`;  // saveBoulderAction
let id = parsed.id ?? `route_${randomUUID()}`;    // saveRouteAction
```
Leave `saveAreaAction` and `saveCragAction` on the slug-based id (they are scoped globally so collisions are already handled by `findRowBySlug`).

> Trade-off note: UUIDs make admin debugging slightly harder (you can no longer guess an id from a slug). The plan accepts this — silent overwrite of unrelated content is the worse failure mode. If a friendlier id is desired later, a follow-up could use `sector_${cragId}_${slug}` etc.; the UUID change is enough to ship.

- [x] **Step 2: Add collision regression tests**

Add to `lib/actions/admin-content.test.ts` — for each of sector / boulder / route, a test that:
1. Mocks `findRowBySlug` to return `null` (no collision in parent scope) and `requireAdmin`/`upsert*`/`auditLog` as before.
2. Calls the save action TWICE with the same `slug` under TWO DIFFERENT parents (e.g. `cragId="crag_a"` then `cragId="crag_b"`).
3. Asserts `upsertSector` (etc.) is called with TWO DIFFERENT `id` values (not the same `sector_<slug>` twice).

These tests fail today and pass after Step 1.

- [x] **Step 3: Run + commit**
```bash
pnpm test lib/actions/admin-content.test.ts
pnpm test
pnpm typecheck
```
All pass. Then:
```bash
git add lib/actions/admin-content.ts lib/actions/admin-content.test.ts
git commit -m "fix: avoid id collision when saving parent-scoped content under different parents"
```

### Task 16.2 — Sanitize uploaded image bytes before R2 (HIGH)

**Problem (Codex review):** `uploadAdminImageAction` trusts the browser-reported MIME type and uploads original bytes to R2 unchanged. Original bytes carry EXIF (GPS coordinates, camera serials, etc.). For a curated outdoor-bouldering CDN, leaking GPS EXIF on every cover image undermines coordinate stewardship and is a real privacy/business risk. There is also no server-side content sniffing — a `.jpg` extension on a non-image file would pass.

- [x] **Step 1: Add sharp**

Add `sharp` to dependencies:
```bash
pnpm add sharp
```
`sharp` is a standard Node image library; Vercel Node runtime supports it. By default `sharp` does NOT preserve metadata on output (no EXIF/ICC/XMP).

- [x] **Step 2: Add a server-side sanitizer**

Create `lib/actions/admin-images-sanitize.ts` (NOT a `"use server"` file — pure helpers + an awaited sharp pipeline):

```ts
import sharp from "sharp";

const MAX_DIMENSION = 4000;        // px — admin covers are big but bounded
const ALLOWED_OUTPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

export type SanitizedImage = {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

export async function sanitizeAdminImage(input: Buffer): Promise<SanitizedImage> {
  // Decode via sharp — also validates that input IS an image (rejects content-type spoofing).
  const pipeline = sharp(input, { failOn: "error" }).rotate(); // honour EXIF orientation then drop metadata
  const meta = await pipeline.metadata();
  if (!meta.format || !ALLOWED_OUTPUT_FORMATS.has(meta.format)) {
    throw new Error("Unsupported image format");
  }
  if (!meta.width || !meta.height || meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new Error(`Image dimensions exceed ${MAX_DIMENSION}px or are missing`);
  }

  // Re-encode in the same family without metadata. `withMetadata` is NOT called,
  // so EXIF/GPS/XMP/ICC are stripped.
  let buffer: Buffer;
  let contentType: SanitizedImage["contentType"];
  let extension: SanitizedImage["extension"];
  if (meta.format === "jpeg") {
    buffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    contentType = "image/jpeg";
    extension = "jpg";
  } else if (meta.format === "png") {
    buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    contentType = "image/png";
    extension = "png";
  } else {
    buffer = await pipeline.webp({ quality: 85 }).toBuffer();
    contentType = "image/webp";
    extension = "webp";
  }

  return { bytes: buffer, contentType, extension, width: meta.width, height: meta.height };
}
```

- [x] **Step 3: Wire sanitizer into `uploadAdminImageAction`**

In `lib/actions/admin-images.ts`:
- Keep `requireAdmin`, the FormData reads, and `validateAdminImageFileForTest` (size + browser-MIME pre-check is still useful as a cheap early reject).
- AFTER `Buffer.from(await file.arrayBuffer())`, call `sanitizeAdminImage(bytes)` and use ITS `bytes`/`contentType`/`extension` for `buildR2ImageKey` + the `PutObjectCommand` (NOT the browser-reported values).
- Add the sanitized `width`/`height` to the audit metadata for forensics.

- [x] **Step 4: Tests**

Update `lib/actions/admin-images.test.ts`:
- Keep the 3 existing pure-validator tests.
- Add a test for `sanitizeAdminImage` using a fixture buffer that sharp can parse (e.g. construct a tiny test image via `sharp({create:{...}}).jpeg().toBuffer()`). Assert: returns expected `contentType`, `extension`, `width`, `height`; the output buffer is non-empty.
- Add a test that `sanitizeAdminImage` REJECTS a non-image buffer (e.g. `Buffer.from("not an image")`) with a thrown error.
- Add a test that an image with EXIF GPS in input does NOT contain EXIF in the output. (Generate input with sharp `withMetadata({exif: ...})` if convenient, then re-decode the output with sharp and assert `metadata.exif === undefined`.)

- [x] **Step 5: Run + commit**
```bash
pnpm test
pnpm typecheck
pnpm build
```
All pass. Then:
```bash
git add lib/actions/admin-images.ts lib/actions/admin-images-sanitize.ts lib/actions/admin-images.test.ts package.json pnpm-lock.yaml
git commit -m "fix: sanitize admin image uploads (decode + re-encode, strip EXIF, enforce dimensions)"
```

### Task 16 completion criteria
- Phase 3 cannot ship until Task 16.1 and 16.2 are both committed and the full test suite + typecheck + build remain green.
- Re-run `/codex:adversarial-review` after committing, and confirm both findings are resolved.

---

## Task 17: Authoritative cache invalidation (post-3rd-review)

> Added after Codex's 3rd pass. Two follow-on ship-blockers about cache invalidation being driven from untrusted form context rather than the DB.

**Files:**
- Modify: `lib/db/admin-content-queries.ts` (add ancestry lookups) + matching tests
- Modify: `lib/actions/admin-content.ts` — `togglePublishAction` becomes entity-aware; save/softDelete/restore actions resolve parent slugs server-side
- Modify: `lib/actions/admin-content.test.ts` — new tests covering toggling routes/topos/boulders and saves without hidden context

### Task 17.1 — `togglePublishAction` must invalidate entity-specific caches (HIGH)

**Problem:** `togglePublishAction` flips `is_published` for any of areas/crags/sectors/boulders/topos/routes/announcements but only revalidates `home`, `areas:list`, `/`. Public detail caches (`route:<id>`, `boulder:<id>`, `sector:<slug>`, `crag:<slug>`, plus paths `/r/<id>`, `/topos/<id>`, `/c/<slug>`) are NOT invalidated. An unpublished route/topo can stay publicly visible until some unrelated mutation happens to flush its tag.

- [x] **Step 1: Add ancestry lookups (DB-driven, authoritative)**

Add to `lib/db/admin-content-queries.ts` a small set of read helpers that, given a row id, return what's needed for revalidation. Each uses `queryD1First` and joins up the parent chain. DO NOT filter `deleted_at IS NULL` on the row itself (admin needs caches flushed for deleted rows too); the parent chain must exist.

```ts
export async function getCragSlugByCragId(id: string): Promise<string | null>;
export async function getSectorAncestry(id: string): Promise<{ cragSlug: string; sectorSlug: string } | null>;
export async function getBoulderAncestry(id: string): Promise<{ cragSlug: string; sectorSlug: string } | null>;
export async function getTopoAncestry(id: string): Promise<{ cragSlug: string; boulderId: string } | null>;
export async function getRouteAncestry(id: string): Promise<{ cragSlug: string; boulderId: string; topoId: string } | null>;
```

- [x] **Step 2: Make `togglePublishAction` entity-aware**

Switch on `table` and, after `updatePublishState`, look up ancestry and call the matching `revalidate*Surface` helper used by save/delete actions. Keep the existing table allowlist and singular-targetType audit map.

### Task 17.2 — save / softDelete / restore actions resolve parent slugs server-side (MEDIUM)

**Problem:** the parent-scoped actions currently read hidden `cragSlug`/`sectorSlug`/`boulderId` from `FormData`. If the admin uses a Create form without a parent filter selected, those hidden fields are empty even though `cragId`/`sectorId`/`topoId` are valid in the parsed schema. Revalidation degrades silently.

- [x] **Step 1: Switch every parent-scoped action to DB-driven ancestry**

In `saveSectorAction`/`saveBoulderAction`/`saveTopoAction`/`saveRouteAction` AND their soft-delete + restore siblings: remove the `formData.get("cragSlug")` reads (the hidden inputs in the entity pages can stay — they're harmless), and resolve ancestry from the row's parent id via the new helpers. Pass the resolved values to the existing `revalidate*Surface` helpers.

### Task 17 — Tests
- For each affected action: regression test "save/softDelete/restore <entity> WITHOUT hidden context still invalidates parent caches" — mock the ancestry helper to return real values; assert `revalidateTag("crag:<slug>")` etc. fire.
- For `togglePublishAction`: "unpublishing a route invalidates `route:<id>` and the parent chain" (mocking ancestry).
- Existing tests that supplied hidden context can remain.

### Task 17 — Verify + commit
```bash
pnpm test
pnpm typecheck
pnpm build
```
Then:
```bash
git add lib/actions/admin-content.ts lib/actions/admin-content.test.ts lib/db/admin-content-queries.ts lib/db/admin-content-queries.test.ts
git commit -m "fix: derive cache-invalidation context from D1 (authoritative ancestry)"
```

### Task 17 completion criteria
- Phase 3 cannot ship until 17.1 and 17.2 are both committed.
- Re-run `/codex:adversarial-review` and confirm no remaining ship-blockers.

---

## Task 18: Invalidate both OLD and NEW ancestry on parent moves (post-4th-review)

> Added after Codex's 4th pass. Task 17 made ancestry DB-driven, but only for the AFTER state. Moving a sector/boulder/topo/route to a different parent leaves the OLD parent's public page cache stale until something unrelated flushes it.

**Files:**
- Modify: `lib/actions/admin-content.ts` — `saveSectorAction`, `saveBoulderAction`, `saveTopoAction`, `saveRouteAction`
- Modify: `lib/actions/admin-content.test.ts` — add parent-move regression tests

### Task 18.1 — Capture pre-upsert ancestry and revalidate both sides

**Problem:** When the admin edits an existing row and changes its parent (`cragId` for sector, `sectorId` for boulder, `boulderId` for topo, `topoId` for route), the action upserts FIRST and only resolves ancestry from the now-new parent. The old crag/sector/boulder/topo page tag (`crag:<oldSlug>` etc.) never fires; public pages can keep listing the moved child until an unrelated mutation invalidates them.

- [x] **Step 1: Snapshot ancestry before upsert (only when editing)**

In each of the four save actions, when `parsed.id` is present (edit, not create):
1. Fetch ancestry for the existing row id with the appropriate helper BEFORE calling `upsert*`:
   - sector: `getSectorAncestry(parsed.id)` → old `{ cragSlug, sectorSlug }`
   - boulder: `getBoulderAncestry(parsed.id)` → old `{ cragSlug, sectorSlug }`
   - topo: `getTopoAncestry(parsed.id)` → old `{ cragSlug, boulderId }`
   - route: `getRouteAncestry(parsed.id)` → old `{ cragSlug, boulderId, topoId }`
2. Call `upsert*` as today.
3. Fetch ancestry for the (possibly new) parent the same way the action already does.
4. Call `revalidate*Surface` for the NEW ancestry first.
5. If OLD ancestry exists AND any of the relevant fields differ from NEW (the parent changed), call `revalidate*Surface` again for the OLD ancestry.

This is the cheapest correct fix: 1 extra D1 read per edit save, no extra reads on create.

- [x] **Step 2: Tests**

In `lib/actions/admin-content.test.ts`, mocking the ancestry helpers and `revalidateTag`/`revalidatePath`:
- "saveSectorAction (edit, parent move): invalidates old AND new crag tags" — `parsed.id` set, mock `getSectorAncestry` to return OLD `{ cragSlug: "anyang", sectorSlug: "old_sector" }`; the form's `cragId` resolves to NEW `{ cragSlug: "samsung", sectorSlug: "new_sector_slug" }`. Assert `revalidateTag("crag:samsung")` AND `revalidateTag("crag:anyang")` both fire.
- Same shape for boulder, topo, route. For route, OLD and NEW will differ on `topoId` (`/topos/<id>` path) and via `cragSlug`/`boulderId`.

The existing "save without hidden context" tests (create-path) still pass — no OLD ancestry to fetch.

### Task 18 — Verify + commit
```bash
pnpm test
pnpm typecheck
pnpm build
```
Then:
```bash
git add lib/actions/admin-content.ts lib/actions/admin-content.test.ts
git commit -m "fix: revalidate old AND new ancestry when admin moves content between parents"
```

### Task 18 completion criteria
- 18.1 committed; full suite + typecheck + build green.
- Re-run `/codex:adversarial-review` and confirm no remaining ship-blockers.
