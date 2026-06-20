# Admin w3w Coordinate Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-only what3words-to-coordinate conversion and Kakao Map coordinate preview to Crag, Sector, and Boulder forms.

**Architecture:** Keep persistence unchanged: saved forms still submit only `lat` and `lng`. Add a small server-only what3words client, an authenticated Server Action wrapper, and one reusable client component for admin Location sections. Reuse the existing Kakao SDK loader in `app/layout.tsx` and `components/public/kakao-map.tsx`.

**Tech Stack:** Next.js App Router, Server Actions, React client leaf component, TypeScript strict, Zod, Vitest, react-kakao-maps-sdk.

---

## File Map

- Create: `lib/location/what3words.ts` — server-side API client, input normalization, response/error mapping.
- Create: `lib/location/what3words.test.ts` — unit tests for normalization and API client behavior.
- Create: `lib/actions/admin-location.ts` — authenticated Server Action that returns a small result object for the client component.
- Create: `lib/actions/admin-location.test.ts` — unit tests for auth, success, and failure result mapping.
- Create: `components/admin/location-coordinate-field.tsx` — reusable client component for w3w input, lat/lng inputs, and Kakao Map preview.
- Modify: `app/admin/(protected)/content/crags/page.tsx` — replace duplicated Location fields with `LocationCoordinateField`.
- Modify: `app/admin/(protected)/content/sectors/page.tsx` — replace duplicated Location fields with `LocationCoordinateField`.
- Modify: `app/admin/(protected)/content/boulders/page.tsx` — replace duplicated Location fields with `LocationCoordinateField`.
- Optional docs update after implementation: add `W3W_API_KEY` to `AGENTS.md` and `.env.example` if `.env.example` exists.

## Task 1: what3words API Client

**Files:**
- Create: `lib/location/what3words.ts`
- Test: `lib/location/what3words.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/location/what3words.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  convertW3wToCoordinates,
  normalizeW3wAddress,
  What3WordsConfigError,
  What3WordsInvalidAddressError,
} from "./what3words";

describe("normalizeW3wAddress", () => {
  it("trims whitespace and removes the leading triple slash", () => {
    expect(normalizeW3wAddress("  ///filled.count.soap  ")).toBe("filled.count.soap");
  });

  it("leaves a plain three word address unchanged after trimming", () => {
    expect(normalizeW3wAddress("filled.count.soap")).toBe("filled.count.soap");
  });
});

describe("convertW3wToCoordinates", () => {
  it("throws a config error when the API key is missing", async () => {
    await expect(convertW3wToCoordinates("filled.count.soap", { apiKey: "" })).rejects.toBeInstanceOf(
      What3WordsConfigError,
    );
  });

  it("returns WGS84 coordinates from a successful API response", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          coordinates: { lat: 51.520847, lng: -0.195521 },
          words: "filled.count.soap",
        }),
        { status: 200 },
      );
    });

    await expect(convertW3wToCoordinates("///filled.count.soap", { apiKey: "test-key", fetchImpl })).resolves.toEqual({
      lat: 51.520847,
      lng: -0.195521,
    });

    const url = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(url.origin).toBe("https://api.what3words.com");
    expect(url.pathname).toBe("/v3/convert-to-coordinates");
    expect(url.searchParams.get("words")).toBe("filled.count.soap");
    expect(url.searchParams.get("format")).toBe("json");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { "X-Api-Key": "test-key" },
    });
  });

  it("maps BadWords API responses to an invalid address error", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: { code: "BadWords", message: "Invalid or non-existent 3 word address" },
        }),
        { status: 400 },
      );
    });

    await expect(convertW3wToCoordinates("no.address.here", { apiKey: "test-key", fetchImpl })).rejects.toBeInstanceOf(
      What3WordsInvalidAddressError,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test lib/location/what3words.test.ts
```

Expected: FAIL because `lib/location/what3words.ts` does not exist.

- [ ] **Step 3: Implement the API client**

Create `lib/location/what3words.ts`:

```ts
import { z } from "zod";

const w3wResponseSchema = z.object({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

const w3wErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
  }),
});

export class What3WordsConfigError extends Error {
  constructor() {
    super("what3words API key is not configured.");
    this.name = "What3WordsConfigError";
  }
}

export class What3WordsInvalidAddressError extends Error {
  constructor() {
    super("Invalid what3words address.");
    this.name = "What3WordsInvalidAddressError";
  }
}

export class What3WordsRequestError extends Error {
  constructor() {
    super("Could not convert this what3words address.");
    this.name = "What3WordsRequestError";
  }
}

export type Coordinates = {
  lat: number;
  lng: number;
};

export function normalizeW3wAddress(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("///") ? trimmed.slice(3) : trimmed;
}

export async function convertW3wToCoordinates(
  words: string,
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<Coordinates> {
  const apiKey = options.apiKey ?? process.env.W3W_API_KEY ?? "";
  if (apiKey.trim() === "") {
    throw new What3WordsConfigError();
  }

  const normalizedWords = normalizeW3wAddress(words);
  const url = new URL("https://api.what3words.com/v3/convert-to-coordinates");
  url.searchParams.set("words", normalizedWords);
  url.searchParams.set("format", "json");

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
    },
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = w3wErrorSchema.safeParse(json);
    if (parsedError.success && parsedError.data.error.code === "BadWords") {
      throw new What3WordsInvalidAddressError();
    }
    throw new What3WordsRequestError();
  }

  const parsed = w3wResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new What3WordsRequestError();
  }

  return parsed.data.coordinates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test lib/location/what3words.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/location/what3words.ts lib/location/what3words.test.ts
git commit -m "feat: add what3words coordinate client"
```

## Task 2: Authenticated Admin Server Action

**Files:**
- Create: `lib/actions/admin-location.ts`
- Test: `lib/actions/admin-location.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/actions/admin-location.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/location/what3words", async () => {
  const actual = await vi.importActual<typeof import("@/lib/location/what3words")>("@/lib/location/what3words");
  return {
    ...actual,
    convertW3wToCoordinates: vi.fn(),
  };
});

import { requireAdmin } from "@/lib/auth/admin";
import { convertW3wToCoordinates, What3WordsInvalidAddressError } from "@/lib/location/what3words";
import { convertW3wToCoordinatesAction } from "./admin-location";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedConvertW3wToCoordinates = vi.mocked(convertW3wToCoordinates);

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue({ adminId: "admin_1", email: "admin@granite.kr" });
});

describe("convertW3wToCoordinatesAction", () => {
  it("requires an admin session before converting", async () => {
    mockedConvertW3wToCoordinates.mockResolvedValue({ lat: 37.42, lng: 126.92 });

    await convertW3wToCoordinatesAction({ words: "///filled.count.soap" });

    expect(mockedRequireAdmin).toHaveBeenCalledOnce();
  });

  it("returns converted coordinates on success", async () => {
    mockedConvertW3wToCoordinates.mockResolvedValue({ lat: 37.42, lng: 126.92 });

    await expect(convertW3wToCoordinatesAction({ words: "///filled.count.soap" })).resolves.toEqual({
      ok: true,
      lat: 37.42,
      lng: 126.92,
    });
  });

  it("returns a validation message for empty input", async () => {
    await expect(convertW3wToCoordinatesAction({ words: "" })).resolves.toEqual({
      ok: false,
      message: "Enter a what3words address.",
    });
    expect(mockedConvertW3wToCoordinates).not.toHaveBeenCalled();
  });

  it("returns a stable message when what3words rejects the address", async () => {
    mockedConvertW3wToCoordinates.mockRejectedValue(new What3WordsInvalidAddressError());

    await expect(convertW3wToCoordinatesAction({ words: "no.address.here" })).resolves.toEqual({
      ok: false,
      message: "Invalid what3words address.",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test lib/actions/admin-location.test.ts
```

Expected: FAIL because `lib/actions/admin-location.ts` does not exist.

- [ ] **Step 3: Implement the Server Action**

Create `lib/actions/admin-location.ts`:

```ts
"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import {
  convertW3wToCoordinates,
  What3WordsConfigError,
  What3WordsInvalidAddressError,
  What3WordsRequestError,
} from "@/lib/location/what3words";

const convertW3wInputSchema = z.object({
  words: z.string().trim().min(1, "Enter a what3words address."),
});

export type ConvertW3wToCoordinatesResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string };

export async function convertW3wToCoordinatesAction(input: unknown): Promise<ConvertW3wToCoordinatesResult> {
  await requireAdmin();

  const parsed = convertW3wInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a what3words address." };
  }

  try {
    const coordinates = await convertW3wToCoordinates(parsed.data.words);
    return { ok: true, ...coordinates };
  } catch (error) {
    if (
      error instanceof What3WordsConfigError ||
      error instanceof What3WordsInvalidAddressError ||
      error instanceof What3WordsRequestError
    ) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not convert this what3words address." };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test lib/actions/admin-location.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/admin-location.ts lib/actions/admin-location.test.ts
git commit -m "feat: add admin w3w conversion action"
```

## Task 3: Reusable Admin Location Component

**Files:**
- Create: `components/admin/location-coordinate-field.tsx`

- [ ] **Step 1: Create the client component**

Create `components/admin/location-coordinate-field.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { convertW3wToCoordinatesAction } from "@/lib/actions/admin-location";
import { inputCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { KakaoMap } from "@/components/public/kakao-map";

type LocationCoordinateFieldProps = {
  latDefaultValue?: number | string | null;
  lngDefaultValue?: number | string | null;
  latRequired?: boolean;
  lngRequired?: boolean;
  previewName?: string;
};

function toInputValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseCoordinate(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function LocationCoordinateField({
  latDefaultValue,
  lngDefaultValue,
  latRequired = false,
  lngRequired = false,
  previewName = "Location preview",
}: LocationCoordinateFieldProps) {
  const [words, setWords] = useState("");
  const [lat, setLat] = useState(toInputValue(latDefaultValue));
  const [lng, setLng] = useState(toInputValue(lngDefaultValue));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const marker = useMemo(() => {
    const parsedLat = parseCoordinate(lat);
    const parsedLng = parseCoordinate(lng);
    if (parsedLat === null || parsedLng === null) return null;
    return { lat: parsedLat, lng: parsedLng };
  }, [lat, lng]);

  function convertWords() {
    setMessage(null);
    startTransition(async () => {
      const result = await convertW3wToCoordinatesAction({ words });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setLat(String(result.lat));
      setLng(String(result.lng));
      setMessage("Coordinates updated from what3words.");
    });
  }

  return (
    <div className="col-span-2 space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-[#374151]">what3words</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={words}
              onChange={(event) => setWords(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  convertWords();
                }
              }}
              className={inputCls}
              placeholder="///filled.count.soap"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={convertWords}
              disabled={isPending}
              className={`${btnPrimaryCls} h-8 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isPending ? "Converting..." : "Convert"}
            </button>
          </div>
          {message ? <p className="mt-1 text-xs text-[#57606A]">{message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#374151]">
            Lat{latRequired ? " (required)" : ""}
          </label>
          <input
            name="lat"
            type="number"
            step="any"
            required={latRequired}
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            className={inputCls}
            placeholder="37.42"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#374151]">
            Lng{lngRequired ? " (required)" : ""}
          </label>
          <input
            name="lng"
            type="number"
            step="any"
            required={lngRequired}
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            className={inputCls}
            placeholder="126.92"
          />
        </div>
      </div>

      <div className="h-[220px] overflow-hidden rounded border border-[#D0D7DE] bg-[#F6F8FA]">
        {marker ? (
          <KakaoMap lat={marker.lat} lng={marker.lng} name={previewName} zoom={4} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[#6F7477]">
            Enter latitude and longitude to preview the marker.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck for the new component**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If the import of a Server Action into a client component causes a Next type error, move the action call behind a tiny client-safe prop wrapper only if required by the compiler.

- [ ] **Step 3: Commit**

```bash
git add components/admin/location-coordinate-field.tsx
git commit -m "feat: add admin coordinate preview field"
```

## Task 4: Wire Crag, Sector, and Boulder Forms

**Files:**
- Modify: `app/admin/(protected)/content/crags/page.tsx`
- Modify: `app/admin/(protected)/content/sectors/page.tsx`
- Modify: `app/admin/(protected)/content/boulders/page.tsx`

- [ ] **Step 1: Add imports**

In each page, add:

```ts
import { LocationCoordinateField } from "@/components/admin/location-coordinate-field";
```

- [ ] **Step 2: Replace Crag Location sections**

In `app/admin/(protected)/content/crags/page.tsx`, replace the create Location section body with:

```tsx
<FormSection title="Location" cols={2}>
  <LocationCoordinateField previewName="Crag location preview" />
</FormSection>
```

Replace the edit Location section body with:

```tsx
<FormSection title="Location" cols={2}>
  <LocationCoordinateField
    latDefaultValue={editRow.lat ?? ""}
    lngDefaultValue={editRow.lng ?? ""}
    previewName={editRow.name}
  />
</FormSection>
```

- [ ] **Step 3: Replace Sector Location sections**

In `app/admin/(protected)/content/sectors/page.tsx`, replace the create Location section body with:

```tsx
<FormSection title="Location" cols={2}>
  <LocationCoordinateField previewName="Sector location preview" />
</FormSection>
```

Replace the edit Location section body with:

```tsx
<FormSection title="Location" cols={2}>
  <LocationCoordinateField
    latDefaultValue={editRow.lat ?? ""}
    lngDefaultValue={editRow.lng ?? ""}
    previewName={editRow.name}
  />
</FormSection>
```

- [ ] **Step 4: Replace Boulder Location sections**

In `app/admin/(protected)/content/boulders/page.tsx`, replace the create Location section body with:

```tsx
<FormSection title="Location" cols={2}>
  <LocationCoordinateField
    latRequired
    lngRequired
    previewName="Boulder location preview"
  />
</FormSection>
```

Replace the edit Location section body with:

```tsx
<FormSection title="Location" cols={2}>
  <LocationCoordinateField
    latDefaultValue={editRow.lat}
    lngDefaultValue={editRow.lng}
    latRequired
    lngRequired
    previewName={editRow.name}
  />
</FormSection>
```

- [ ] **Step 5: Verify old inputs are gone and form names are preserved**

Run:

```bash
rg -n 'name="lat"|name="lng"|LocationCoordinateField' 'app/admin/(protected)/content/crags/page.tsx' 'app/admin/(protected)/content/sectors/page.tsx' 'app/admin/(protected)/content/boulders/page.tsx'
```

Expected: each page imports and renders `LocationCoordinateField`; raw `name="lat"` and `name="lng"` appear only inside `components/admin/location-coordinate-field.tsx`.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'app/admin/(protected)/content/crags/page.tsx' 'app/admin/(protected)/content/sectors/page.tsx' 'app/admin/(protected)/content/boulders/page.tsx'
git commit -m "feat: add coordinate tools to admin forms"
```

## Task 5: Final Verification

**Files:**
- No production file changes expected.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test lib/location/what3words.test.ts lib/actions/admin-location.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing admin content tests**

Run:

```bash
pnpm test lib/actions/admin-content.test.ts
```

Expected: PASS. This confirms the existing save parsers still accept the `lat` and `lng` payload shape.

- [ ] **Step 3: Run full typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Start the dev server**

Run:

```bash
pnpm dev
```

Expected: Next.js starts successfully. Open `/admin/content/crags?create=1`, `/admin/content/sectors?create=1`, and `/admin/content/boulders?create=1`.

- [ ] **Step 5: Manual browser checks**

Use an admin session and confirm:

- Crag create form shows w3w input, lat/lng inputs, and an empty preview panel.
- Sector edit form with existing coordinates shows a Kakao marker immediately.
- Boulder create form keeps `lat` and `lng` required.
- Directly typing `37.42` and `126.92` shows a marker.
- With `W3W_API_KEY` configured, converting `///filled.count.soap` fills both coordinate fields.
- With `W3W_API_KEY` missing, conversion shows `what3words API key is not configured.` and direct coordinate entry still works.

- [ ] **Step 6: Commit any documentation-only environment note**

If implementation added `W3W_API_KEY` to project environment docs, commit it:

```bash
git add AGENTS.md .env.example
git commit -m "docs: document what3words api key"
```

If `.env.example` does not exist and `AGENTS.md` was not changed, skip this step.

## Self-Review

- Spec coverage: Tasks 1 and 2 cover server-only w3w conversion, API key secrecy, error mapping, and admin auth. Task 3 covers the reusable Location UX and Kakao preview. Task 4 covers all target admin forms. Task 5 covers tests and manual checks.
- Placeholder scan: No deferred implementation placeholders are present.
- Type consistency: The plan consistently uses `convertW3wToCoordinates`, `convertW3wToCoordinatesAction`, `LocationCoordinateField`, `lat`, and `lng`.
