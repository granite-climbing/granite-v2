import { afterEach, describe, expect, it } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { getOAuthClientSecret, getOAuthProvider } from "./providers";

const originalEnv = {
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_WEB_CLIENT_ID: process.env.APPLE_WEB_CLIENT_ID,
  APPLE_IOS_CLIENT_ID: process.env.APPLE_IOS_CLIENT_ID,
  APPLE_CLIENT_SECRET: process.env.APPLE_CLIENT_SECRET,
  APPLE_KEY_ID: process.env.APPLE_KEY_ID,
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID
};

describe("Apple OAuth client secret", () => {
  afterEach(() => {
    process.env.APPLE_CLIENT_ID = originalEnv.APPLE_CLIENT_ID;
    process.env.APPLE_WEB_CLIENT_ID = originalEnv.APPLE_WEB_CLIENT_ID;
    process.env.APPLE_IOS_CLIENT_ID = originalEnv.APPLE_IOS_CLIENT_ID;
    process.env.APPLE_CLIENT_SECRET = originalEnv.APPLE_CLIENT_SECRET;
    process.env.APPLE_KEY_ID = originalEnv.APPLE_KEY_ID;
    process.env.APPLE_PRIVATE_KEY = originalEnv.APPLE_PRIVATE_KEY;
    process.env.APPLE_TEAM_ID = originalEnv.APPLE_TEAM_ID;
  });

  it("generates a Sign in with Apple client_secret from the configured private key", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    process.env.APPLE_CLIENT_ID = "";
    process.env.APPLE_WEB_CLIENT_ID = "kr.granite.web";
    process.env.APPLE_IOS_CLIENT_ID = "com.granite.climbing";
    process.env.APPLE_CLIENT_SECRET = "";
    process.env.APPLE_KEY_ID = "APPLEKEY1";
    process.env.APPLE_PRIVATE_KEY = await exportPKCS8(privateKey);
    process.env.APPLE_TEAM_ID = "TEAMID1234";

    const clientSecret = await getOAuthClientSecret(getOAuthProvider("apple"));
    const verified = await jwtVerify(clientSecret, publicKey, {
      audience: "https://appleid.apple.com",
      issuer: "TEAMID1234",
      subject: "kr.granite.web"
    });

    expect(verified.protectedHeader.kid).toBe("APPLEKEY1");
  });
});
