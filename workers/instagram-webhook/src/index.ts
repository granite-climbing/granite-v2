import { verifyMetaSignature } from "./hmac";
import { extractMentionEvents } from "./payload";
import { processMentionEvent } from "./match";

export interface Env {
  META_APP_SECRET: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
  INSTAGRAM_GRAPH_ACCESS_TOKEN: string;
  granite_v2: D1Database;
  BUCKET: R2Bucket;
  CDN_BASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/webhooks/instagram") return new Response("Not found", { status: 404 });

    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await request.text();
    const valid = await verifyMetaSignature(body, request.headers.get("X-Hub-Signature-256"), env.META_APP_SECRET);
    if (!valid) return new Response("Invalid signature", { status: 401 });

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    const events = extractMentionEvents(payload);

    // Fast ACK: defer event processing so Meta gets a 200 within 2 seconds.
    ctx.waitUntil(
      Promise.all(events.map((event) => processMentionEvent(event, env, body)))
    );

    return new Response("OK", { status: 200 });
  },
};
