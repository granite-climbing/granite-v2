import { verifyMetaSignature } from "./hmac";
import { extractMentionEvents } from "./payload";
import { processMentionEvent } from "./match";
import { insertWebhookOperationalEvent } from "./d1";

function logStep(step: string, ctx: Record<string, unknown>): void {
  console.log(`[webhook] ${step} ${JSON.stringify(ctx)}`);
}

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
    const requestId = request.headers.get("cf-request-id") ?? "";
    logStep("00.request", {
      requestId,
      method: request.method,
      path: url.pathname,
    });

    if (url.pathname !== "/webhooks/instagram") {
      logStep("00.not_found", { requestId, path: url.pathname });
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const tokenMatch = token === env.META_WEBHOOK_VERIFY_TOKEN;
      logStep("01.verify_handshake", {
        requestId,
        mode,
        hasChallenge: !!challenge,
        tokenMatch,
      });
      if (mode === "subscribe" && tokenMatch && challenge) {
        logStep("01.verify_handshake.ok", { requestId });
        return new Response(challenge, { status: 200 });
      }
      logStep("01.verify_handshake.fail", { requestId, mode, tokenMatch, hasChallenge: !!challenge });
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      logStep("01.method_not_allowed", { requestId, method: request.method });
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.text();
    logStep("02.body_received", { requestId, bytes: body.length });

    const signatureHeader = request.headers.get("X-Hub-Signature-256");
    const valid = await verifyMetaSignature(body, signatureHeader, env.META_APP_SECRET);
    logStep("03.signature_check", {
      requestId,
      hasHeader: !!signatureHeader,
      valid,
    });
    if (!valid) {
      ctx.waitUntil(
        insertWebhookOperationalEvent(env.granite_v2, {
          id: `opev_${crypto.randomUUID()}`,
          eventType: "invalid_signature",
          webhookId: null,
          betaId: null,
          requestId,
          method: "POST",
          path: "/webhooks/instagram",
          statusCode: 401,
          message: "Meta HMAC mismatch",
          metadata: "{}",
        })
      );
      return new Response("Invalid signature", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logStep("04.json_parse_failed", { requestId, message });
      ctx.waitUntil(
        insertWebhookOperationalEvent(env.granite_v2, {
          id: `opev_${crypto.randomUUID()}`,
          eventType: "invalid_payload",
          webhookId: null,
          betaId: null,
          requestId,
          method: "POST",
          path: "/webhooks/instagram",
          statusCode: 400,
          message: `JSON parse failed: ${message.slice(0, 300)}`,
          metadata: JSON.stringify({ bodyBytes: body.length, bodyPreview: body.slice(0, 200) }),
        })
      );
      return new Response("Invalid JSON", { status: 400 });
    }
    const events = extractMentionEvents(payload);
    logStep("04.events_extracted", { requestId, count: events.length });

    // Fast ACK: defer event processing so Meta gets a 200 within 2 seconds.
    ctx.waitUntil(
      Promise.all(events.map((event) => processMentionEvent(event, env, body)))
        .then(() => logStep("05.dispatch_complete", { requestId, count: events.length }))
        .catch((error) =>
          logStep("05.dispatch_error", {
            requestId,
            message: error instanceof Error ? error.message : String(error),
          })
        )
    );

    logStep("05.ack", { requestId, dispatched: events.length });
    return new Response("OK", { status: 200 });
  },
};
