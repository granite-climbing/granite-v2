import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_ANDROID_PACKAGE_NAME = "com.granite.climbing";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const callbackParams = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      callbackParams.append(key, value);
    }
  }

  const packageName = process.env.ANDROID_PACKAGE_NAME ?? DEFAULT_ANDROID_PACKAGE_NAME;
  const intentUrl = `intent://callback?${callbackParams.toString()}#Intent;package=${packageName};scheme=signinwithapple;end`;

  return NextResponse.redirect(intentUrl);
}
