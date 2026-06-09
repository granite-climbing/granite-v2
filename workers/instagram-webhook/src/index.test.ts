import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "./hmac";
import { extractMentionEvents } from "./payload";

describe("instagram webhook worker", () => {
  it("verifies Meta sha256 signatures", async () => {
    const body = '{"object":"instagram"}';
    const secret = "secret";
    const signature = await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      new TextEncoder().encode(body)
    );
    const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
    await expect(verifyMetaSignature(body, `sha256=${hex}`, secret)).resolves.toBe(true);
  });

  it("extracts mention event fields", () => {
    const events = extractMentionEvents({
      entry: [
        {
          id: "ig_user_1",
          changes: [
            {
              field: "mentions",
              value: {
                media_id: "media_1",
              },
            },
          ],
        },
      ],
    });

    expect(events).toEqual([
      {
        externalId: "media_1",
        igUserId: "ig_user_1",
        mediaId: "media_1",
        commentId: null,
      },
    ]);
  });

  it("extracts comment mention event ids", () => {
    const events = extractMentionEvents({
      entry: [
        {
          id: "ig_user_1",
          changes: [
            {
              field: "mentions",
              value: {
                media_id: "media_1",
                comment_id: "comment_1",
              },
            },
          ],
        },
      ],
    });

    expect(events[0]).toEqual({
      externalId: "comment_1",
      igUserId: "ig_user_1",
      mediaId: "media_1",
      commentId: "comment_1",
    });
  });
});
