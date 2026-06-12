import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";

export default async function AppEntryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;

  if (user) {
    redirect("/me");
  }

  redirect("/login?returnTo=/me");
}
