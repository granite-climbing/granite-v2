import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById, findOAuthIdentitiesByUserId } from "@/lib/db/user-auth-queries";
import { buildMePageModel } from "./me-page-model";
import { MyPageContent } from "./me-page-content";
import { LogoutButton } from "./logout-button";

export default async function MePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;

  if (!user) {
    redirect("/login?returnTo=/me");
  }

  const identities = await findOAuthIdentitiesByUserId(user.id);
  const model = buildMePageModel(user, identities);

  return <MyPageContent model={model} logoutSlot={<LogoutButton />} />;
}
