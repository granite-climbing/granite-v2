export async function GET() {
  return Response.json({
    ok: true,
    service: "granite-v2",
    checks: {
      app: "ok",
      db: process.env.CLOUDFLARE_D1_DATABASE_ID ? "configured" : "not_configured",
      r2: process.env.R2_BUCKET_NAME ? "configured" : "not_configured"
    }
  });
}
