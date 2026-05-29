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

- Modify `app/admin/login/page.tsx`
  - Wire form to `loginAdminAction`.
  - Render `searchParams.error` message.

- Modify `app/admin/layout.tsx`
  - Protect all admin pages except `/admin/login`.
  - Render admin nav and logout form.

- Create `app/admin/page.tsx`
  - Redirect to `/admin/content`.

- Replace `app/admin/content/page.tsx`
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

- [ ] **Step 1: Add admin migration**

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

- [ ] **Step 2: Smoke-test migration with SQLite**

Run:

```bash
sqlite3 /private/tmp/granite-phase3-admin.sqlite ".read migrations/0001_init.sql" ".read migrations/0002_import_v1_content.sql" ".read migrations/0003_admin_operations.sql" ".schema admins" ".schema admin_audit_logs"
```

Expected: both table schemas print and command exits 0.

- [ ] **Step 3: Update data model docs**

In `docs/DATA_MODEL.md`, expand the `admins` and `admin_audit_logs` section with exact columns from the migration and note:

```markdown
Phase 3 uses `admins.email` only for login lookup. JWT sessions use `admins.id` as the subject. `admin_audit_logs.metadata` stores compact JSON text with changed field names and optional before/after values; do not store passwords or secrets in metadata.

Content tables and `announcements` use `deleted_at` for soft delete. Public read queries must always exclude rows where `deleted_at IS NOT NULL`. Admin read queries include deleted rows by default and label them as deleted; restore actions set `deleted_at = NULL`.
```

- [ ] **Step 4: Commit**

```bash
git add migrations/0003_admin_operations.sql docs/DATA_MODEL.md
git commit -m "feat: add admin operation tables"
```

---

## Task 2: D1 Mutation Helpers

**Files:**
- Modify: `lib/db/d1-http.ts`
- Modify: `lib/db/d1-http.test.ts`

- [ ] **Step 1: Add failing tests for non-query execution**

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

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/db/d1-http.test.ts
```

Expected: fail because `executeD1` is not exported.

- [ ] **Step 3: Implement helper**

Add to `lib/db/d1-http.ts`:

```ts
export async function executeD1(sql: string, params?: unknown[]): Promise<void> {
  await executeQuery<unknown>(sql, params ?? []);
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/d1-http.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/d1-http.ts lib/db/d1-http.test.ts
git commit -m "feat: add d1 mutation helper"
```

---

## Task 3: Admin Query Boundary

**Files:**
- Create: `lib/db/admin-queries.ts`
- Create: `lib/db/admin-queries.test.ts`

- [ ] **Step 1: Create admin query tests**

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

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/db/admin-queries.test.ts
```

Expected: fail because file does not exist.

- [ ] **Step 3: Implement admin queries**

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

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/admin-queries.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/admin-queries.ts lib/db/admin-queries.test.ts
git commit -m "feat: add admin query boundary"
```

---

## Task 4: Admin Authentication

**Files:**
- Modify: `lib/auth/admin.ts`
- Create: `lib/actions/admin-auth-schema.ts`
- Create: `lib/actions/admin-auth.ts`
- Create: `lib/actions/admin-auth.test.ts`
- Modify: `app/admin/login/page.tsx`
- Modify: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Write auth tests**

Create `lib/actions/admin-auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { loginAdminForTest } from "./admin-auth";
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
      loginAdminForTest({ email: "missing@granite.kr", password: "secret123" }),
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
      loginAdminForTest({ email: "ops@granite.kr", password: "wrong-password" }),
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

    const result = await loginAdminForTest({
      email: "ops@granite.kr",
      password: "correct-password",
    });

    expect(result.email).toBe("ops@granite.kr");
    expect(result.displayName).toBe("Ops");
    expect(result.token).toEqual(expect.any(String));
  });
});
```

- [ ] **Step 2: Run failing auth tests**

Run:

```bash
pnpm test lib/actions/admin-auth.test.ts
```

Expected: fail because `admin-auth.ts` is missing.

- [ ] **Step 3: Implement schema**

Create `lib/actions/admin-auth-schema.ts`:

```ts
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
```

- [ ] **Step 4: Update JWT/session helper**

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

- [ ] **Step 5: Implement auth action**

Create `lib/actions/admin-auth.ts`:

```ts
"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, createAdminToken } from "@/lib/auth/admin";
import { findActiveAdminByEmail } from "@/lib/db/admin-queries";
import { adminLoginSchema, type AdminLoginInput } from "./admin-auth-schema";

const INVALID_CREDENTIALS = "Invalid admin credentials";

export async function loginAdminForTest(input: AdminLoginInput): Promise<{
  token: string;
  email: string;
  displayName: string;
}> {
  const parsed = adminLoginSchema.parse(input);
  const admin = await findActiveAdminByEmail(parsed.email);
  if (!admin) throw new Error(INVALID_CREDENTIALS);

  const validPassword = await bcrypt.compare(parsed.password, admin.passwordHash);
  if (!validPassword) throw new Error(INVALID_CREDENTIALS);

  const token = await createAdminToken({
    adminId: admin.id,
    email: admin.email,
    displayName: admin.displayName,
  });

  return { token, email: admin.email, displayName: admin.displayName };
}

export async function loginAdminAction(formData: FormData): Promise<void> {
  try {
    const result = await loginAdminForTest(Object.fromEntries(formData) as AdminLoginInput);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/admin",
      maxAge: 60 * 60 * 8,
    });
  } catch {
    redirect("/admin/login?error=invalid_credentials");
  }

  redirect("/admin/content");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
```

- [ ] **Step 6: Wire login page**

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

- [ ] **Step 7: Protect admin layout**

Update `app/admin/layout.tsx`:

```tsx
import Link from "next/link";
import { logoutAdminAction } from "@/lib/actions/admin-auth";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
        </nav>
      </header>
      {children}
    </main>
  );
}
```

Important: because this protects `/admin/login` too, move login to a route group if needed:

```text
app/admin/(auth)/login/page.tsx
app/admin/(protected)/layout.tsx
app/admin/(protected)/content/page.tsx
```

Prefer the route group if `requireAdmin()` redirects `/admin/login` in a loop.

- [ ] **Step 8: Create admin index redirect**

Create `app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/content");
}
```

- [ ] **Step 9: Run tests**

Run:

```bash
pnpm test lib/actions/admin-auth.test.ts
pnpm typecheck
```

Expected: both pass.

- [ ] **Step 10: Commit**

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

- [ ] **Step 1: Add hash generator script**

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

- [ ] **Step 2: Document manual admin insert**

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

Public image serving is already configured through R2/CDN. Admin forms must store only `https://cdn.granite.kr/...` URLs or approved CDN paths. Do not store private R2 URLs, signed URLs, or raw S3 endpoint URLs.
````

- [ ] **Step 3: Decide seed strategy**

Choose one:

- Migration seed for local/preview only: create `migrations/0004_seed_initial_admin.sql` with a non-production local hash.
- Production one-time insert: do not create a seed migration; follow `docs/admin-operations.md`.

Recommended: one-time insert for production, optional local seed outside production.

- [ ] **Step 4: Commit**

```bash
git add scripts/create-admin-hash.ts docs/admin-operations.md
git commit -m "docs: add admin account operations"
```

---

## Task 6: Admin Content Validation

**Files:**
- Modify: `lib/actions/admin-content-schema.ts`
- Modify: `lib/actions/admin-content.test.ts`

- [ ] **Step 1: Replace stale form schema tests**

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

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: fail until schemas are replaced.

- [ ] **Step 3: Implement aligned schemas**

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

const cdnUrl = z.string().trim().default("").refine(
  (value) => value === "" || value.startsWith("https://cdn.granite.kr/") || value.startsWith("/"),
  { message: "Image URL must be empty, CDN URL, or approved CDN path" },
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

export const routeFormSchema = z.object({
  id: optionalId,
  topoId: requiredText,
  name: requiredText,
  slug,
  grade: requiredText,
  gradeNum: z.union([z.string(), z.number(), z.undefined()]).transform((value) => {
    if (value === undefined || value === "") return parseGradeNum(String(value));
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error("Invalid grade number");
    return parsed;
  }),
  fa: optionalText,
  description: optionalText,
  lineImageUrl: cdnUrl,
  isPublished: checkbox,
  sortOrder,
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

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/admin-content-schema.ts lib/actions/admin-content.test.ts
git commit -m "feat: align admin content validation with phase 2 schema"
```

---

## Task 7: Admin Content SQL Mutations With Soft Delete

**Files:**
- Create: `lib/db/admin-content-queries.ts`
- Create: `lib/db/admin-content-queries.test.ts`

- [ ] **Step 1: Add tests for upsert, soft delete, and restore SQL**

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

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/db/admin-content-queries.test.ts
```

Expected: fail because file is missing.

- [ ] **Step 3: Implement query functions**

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

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/admin-content-queries.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/admin-content-queries.ts lib/db/admin-content-queries.test.ts
git commit -m "feat: add admin content mutation queries"
```

---

## Task 8: Server Actions For Content CRUD

**Files:**
- Modify: `lib/actions/admin-content.ts`
- Modify: `lib/actions/admin-content.test.ts`

- [ ] **Step 1: Add action behavior tests**

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

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: fail until actions are rewritten.

- [ ] **Step 3: Rewrite actions**

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

- [ ] **Step 4: Run action tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/admin-content.ts lib/actions/admin-content.test.ts
git commit -m "feat: implement admin content actions"
```

---

## Task 9: Admin Read Models For Editing

**Files:**
- Create: `lib/db/admin-read-queries.ts`
- Create: `lib/db/admin-read-queries.test.ts`

- [ ] **Step 1: Define admin list/detail read models**

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

- [ ] **Step 2: Write tests**

Test that:

- Admin SQL does not filter unpublished or deleted rows unless a function explicitly asks for a filter.
- Rows are ordered by hierarchy and `sort_order`.
- `getAdminContentOverview()` returns counts for published and draft rows.
- `getAdminContentOverview()` returns deleted counts separately.

- [ ] **Step 2A: Update public query tests for soft delete**

Modify `lib/db/queries.test.ts` so public SQL assertions require `deleted_at IS NULL` for every content table and announcement query. Required coverage:

- home stats exclude deleted ancestors;
- area/crag lists exclude deleted rows;
- crag detail queries exclude deleted sectors, boulders, topos, routes;
- topo and route detail queries exclude deleted ancestors;
- announcements exclude deleted rows.

- [ ] **Step 3: Implement queries**

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
     WHERE c.deleted_at IS NULL
       AND a.deleted_at IS NULL
     ORDER BY a.sort_order ASC, c.sort_order ASC, c.name ASC`,
  );
}
```

- [ ] **Step 3A: Update public queries for soft delete**

Modify `lib/db/queries.ts` to add `deleted_at IS NULL` checks to every public read. Public pages must behave as if soft-deleted rows do not exist. Do not add soft-delete filters only in repository row shaping; keep the filtering in SQL.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test lib/db/admin-read-queries.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/admin-read-queries.ts lib/db/admin-read-queries.test.ts
git commit -m "feat: add admin content read models"
```

---

## Task 10: Desktop Admin Component System And Entity Pages

**Files:**
- Replace: `app/admin/content/page.tsx`
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

- [ ] **Step 1: Add desktop-only admin UI components**

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

- [ ] **Step 2: Replace stale page fields**

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

- [ ] **Step 3: Build overview page**

`app/admin/content/page.tsx` should render:

- Counts: total/published/draft for each entity type.
- Navigation links to entity sections or filtered forms.
- A compact "recently edited" placeholder can be omitted until audit browse is built.

Use dense admin styling, not marketing cards. Cards are acceptable for repeated entity rows only.

- [ ] **Step 4: Create one page per entity**

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

- [ ] **Step 5: Add entity forms**

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

- [ ] **Step 6: Use server actions directly**

Forms should use direct action imports:

```tsx
<form action={saveCragAction}>
  <input type="hidden" name="id" defaultValue={crag.id} />
  <input name="name" defaultValue={crag.name} />
  <button type="submit">Save</button>
</form>
```

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both pass.

- [ ] **Step 8: Commit**

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

- [ ] **Step 1: Add announcement validation**

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

- [ ] **Step 2: Add SQL functions**

Add:

- `upsertAnnouncement(input)`
- `softDeleteAnnouncement(id)`
- `restoreAnnouncement(id)`

Use `announcements` columns from `migrations/0001_init.sql`.

- [ ] **Step 3: Add Server Actions**

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

- [ ] **Step 4: Replace read-only page**

`app/admin/announcements/page.tsx` should:

- Read all announcements, including drafts.
- Render create form.
- Render edit forms for existing announcements.
- Render publish toggles and delete controls.

- [ ] **Step 5: Run tests and build**

Run:

```bash
pnpm test lib/actions/admin-announcements.test.ts lib/db/admin-content-queries.test.ts
pnpm typecheck
pnpm build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/announcements lib/actions lib/db/admin-content-queries.ts lib/db/admin-content-queries.test.ts
git commit -m "feat: add admin announcement management"
```

---

## Task 12: Direct Admin Image Upload

**Files:**
- Modify: `lib/r2/images.ts`
- Create: `lib/actions/admin-images.ts`
- Create: `lib/actions/admin-images.test.ts`
- Modify admin entity forms where image fields appear.

### Required Scope

Because R2/CDN public serving is already complete, Phase 3 does not configure the CDN. It adds direct admin upload into that existing serving pipeline:

- Admin forms accept only empty string, `https://cdn.granite.kr/...`, or approved CDN path.
- UI previews the current image URL.
- Server Actions store the URL on the entity table.
- No private R2 URL or signed URL is stored.
- Admin image upload accepts `image/jpeg`, `image/png`, and `image/webp`.
- Max upload size is 10MB.
- Upload key uses `buildR2ImageKey`.
- Persisted URL uses `buildCdnImageUrl`.

- [ ] **Step 1: Add R2 file validation tests**

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

- [ ] **Step 2: Implement upload action**

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

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
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
    Bucket: process.env.R2_BUCKET,
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

- [ ] **Step 3: Add image preview and upload controls to forms**

For each image URL field:

```tsx
{crag.coverImageUrl ? (
  <img src={crag.coverImageUrl} alt="" className="h-24 w-full rounded-[8px] object-cover" />
) : null}
<input name="coverImageUrl" defaultValue={crag.coverImageUrl} />
<input type="file" name="file" accept="image/jpeg,image/png,image/webp" />
```

- [ ] **Step 4: Confirm validation blocks private URLs**

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

- [ ] **Step 5: Run image tests**

Run:

```bash
pnpm test lib/actions/admin-images.test.ts lib/r2/images.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit direct upload**

```bash
git add app/admin lib/actions/admin-images.ts lib/actions/admin-images.test.ts lib/actions/admin-content-schema.ts lib/actions/admin-content.test.ts lib/r2
git commit -m "feat: add direct admin image upload"
```

---

## Task 13: Audit Log Visibility

**Files:**
- Create: `app/admin/audit/page.tsx`
- Modify: `app/admin/layout.tsx`
- Add read query to: `lib/db/admin-read-queries.ts`

- [ ] **Step 1: Add audit read query**

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

- [ ] **Step 2: Build audit page**

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

- [ ] **Step 3: Add nav link**

Add `/admin/audit` to `app/admin/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/audit app/admin/layout.tsx lib/db/admin-read-queries.ts
git commit -m "feat: add admin audit log view"
```

---

## Task 14: Admin Operations Verification

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/admin-operations.md`

- [ ] **Step 1: Run full automated verification**

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

- [ ] **Step 2: Apply migrations to local D1**

Run with the project’s configured wrangler command. If `wrangler` is not installed as a dependency, either add it as a dev dependency or use the installed environment command:

```bash
pnpm wrangler d1 migrations apply granite --local
```

Expected: `0003_admin_operations.sql` applies once.

- [ ] **Step 3: Verify admin login manually**

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

- [ ] **Step 4: Verify CRUD manually**

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

- [ ] **Step 5: Verify audit**

Confirm `admin_audit_logs` has entries for:

- login success is optional; content mutations are required.
- content create/update/soft-delete.
- announcement create/update/soft-delete.
- content restore.
- publish toggle.

- [ ] **Step 6: Update roadmap**

Mark completed Phase 3 items in `docs/ROADMAP.md`.

- [ ] **Step 7: Commit verification docs**

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

- [ ] **Step 1: Add GitHub Actions CI**

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

- [ ] **Step 2: Add deployment documentation**

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

- [ ] **Step 3: Configure Vercel preview environment**

Set these Vercel preview environment variables:

```text
D1_HTTP_URL
D1_API_TOKEN
D1_DATABASE_ID
CDN_BASE_URL
ADMIN_JWT_SECRET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_ENDPOINT
```

Direct admin image upload is required in Phase 3, so R2 write credentials must be configured for preview and production. Keep `CDN_BASE_URL` because stored image URLs and the image loader need the public base.

- [ ] **Step 4: Apply migrations to preview D1**

Run the project-approved D1 migration command against preview:

```bash
pnpm wrangler d1 migrations apply granite
```

Expected:

- `0001_init.sql`, `0002_import_v1_content.sql`, and `0003_admin_operations.sql` are applied or already marked applied.
- Preview D1 contains content rows and admin operation tables.

- [ ] **Step 5: Create or confirm preview admin**

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

- [ ] **Step 6: Deploy Vercel preview**

Run:

```bash
pnpm vercel deploy
```

Expected:

- Build succeeds.
- Preview URL is created.
- `/healthz` returns `checks.app = "ok"` and `checks.db = "ok"`.

- [ ] **Step 7: Verify preview public UI**

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

- [ ] **Step 8: Verify preview admin UI**

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

- [ ] **Step 9: Configure production environment**

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
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_ENDPOINT
```

Expected:

- `ADMIN_JWT_SECRET` is production-only and not reused from preview.
- Production D1 target is confirmed before migration.
- `CDN_BASE_URL` points to the already-serving production CDN.

- [ ] **Step 10: Apply migrations to production D1**

Only after preview data and admin behavior are approved:

```bash
pnpm wrangler d1 migrations apply granite
```

Expected:

- Production D1 has content tables, imported content, `admins`, and `admin_audit_logs`.
- No destructive import is rerun accidentally against production.

- [ ] **Step 11: Create production admin**

Use one-time D1 console execution or approved production migration. Do not commit a real production password hash unless the team explicitly accepts that risk.

Expected:

- At least one active admin exists.
- Password rotation SOP is documented.

- [ ] **Step 12: Deploy production**

Run:

```bash
pnpm vercel deploy --prod
```

Expected:

- Production deployment succeeds.
- `/healthz` returns `checks.app = "ok"` and `checks.db = "ok"`.

- [ ] **Step 13: Post-deploy smoke test**

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

- [ ] **Step 14: Commit rollout docs**

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
