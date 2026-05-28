import { pingD1 } from "@/lib/db/d1-http";

export async function GET() {
  // Check if D1 is configured (all three env vars present)
  const d1Configured =
    !!process.env.D1_HTTP_URL &&
    !!process.env.D1_API_TOKEN &&
    !!process.env.D1_DATABASE_ID;

  let dbStatus: "ok" | "unreachable" | "not_configured" = "not_configured";
  let dbMs: number | undefined;
  let httpStatus = 200;

  if (d1Configured) {
    const startTime = Date.now();
    const isHealthy = await pingD1();
    dbMs = Date.now() - startTime;

    if (isHealthy) {
      dbStatus = "ok";
    } else {
      dbStatus = "unreachable";
      httpStatus = 503;
    }
  }

  const response: {
    ok: boolean;
    service: string;
    checks: { app: string; db: string };
    timing?: { dbMs: number };
  } = {
    ok: httpStatus === 200,
    service: "granite-v2",
    checks: {
      app: "ok",
      db: dbStatus,
    },
  };

  // Only include timing if a ping was attempted
  if (dbMs !== undefined) {
    response.timing = { dbMs };
  }

  return Response.json(response, { status: httpStatus });
}
