import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";
import { OAUTH_PROVIDER_IDS } from "./oauth/types";
import { getUserSessionSecret } from "./session";

export const NATIVE_BROWSER_HANDOFF_TTL_SECONDS = 120;

const NATIVE_BROWSER_HANDOFF_TYPE = "granite-native-browser-handoff+jwt";
const NATIVE_BROWSER_HANDOFF_ISSUER = "granite-v2";
const NATIVE_BROWSER_HANDOFF_AUDIENCE = "granite-ios";

const challengeSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const returnPathSchema = z
  .string()
  .startsWith("/")
  .refine((value) => !value.startsWith("//"), "Return path must be local");

const nativeBrowserHandoffSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("session"),
    userId: z.string().min(1),
    returnTo: returnPathSchema,
    challenge: challengeSchema
  }),
  z.object({
    kind: z.literal("signup"),
    provider: z.enum(OAUTH_PROVIDER_IDS),
    providerUserId: z.string().min(1),
    email: z.string().email().nullable(),
    displayName: z.string(),
    avatarUrl: z.string().url().nullable(),
    returnTo: returnPathSchema,
    challenge: challengeSchema
  }),
  z.object({
    kind: z.literal("recover"),
    userId: z.string().min(1),
    returnTo: returnPathSchema,
    challenge: challengeSchema
  })
]);

export type NativeBrowserHandoff = z.infer<typeof nativeBrowserHandoffSchema>;

type NativeBrowserHandoffClock = {
  now?: Date;
};

export function createNativeBrowserChallenge(verifier: string): string {
  if (!verifier) {
    throw new Error("Native browser verifier is required");
  }

  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export async function createNativeBrowserHandoff(
  input: NativeBrowserHandoff,
  clock: NativeBrowserHandoffClock = {}
): Promise<string> {
  const payload = nativeBrowserHandoffSchema.parse(input);
  const issuedAt = Math.floor((clock.now ?? new Date()).getTime() / 1000);

  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: NATIVE_BROWSER_HANDOFF_TYPE })
    .setIssuer(NATIVE_BROWSER_HANDOFF_ISSUER)
    .setAudience(NATIVE_BROWSER_HANDOFF_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + NATIVE_BROWSER_HANDOFF_TTL_SECONDS)
    .encrypt(getNativeBrowserHandoffKey());
}

export async function verifyNativeBrowserHandoff(
  token: string,
  clock: NativeBrowserHandoffClock = {}
): Promise<NativeBrowserHandoff> {
  const verified = await jwtDecrypt(token, getNativeBrowserHandoffKey(), {
    issuer: NATIVE_BROWSER_HANDOFF_ISSUER,
    audience: NATIVE_BROWSER_HANDOFF_AUDIENCE,
    currentDate: clock.now
  });

  if (verified.protectedHeader.typ !== NATIVE_BROWSER_HANDOFF_TYPE) {
    throw new Error("Invalid native browser handoff type");
  }

  return nativeBrowserHandoffSchema.parse(verified.payload);
}

function getNativeBrowserHandoffKey(): Uint8Array {
  return createHash("sha256")
    .update("granite-native-browser-handoff\0", "utf8")
    .update(getUserSessionSecret())
    .digest();
}
