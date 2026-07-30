import type { OAuthProviderId, User, UserOAuthIdentity } from "@/lib/db/schema";
import {
  PRIVACY_VISIBILITY_ITEMS,
  parsePrivacyVisibility,
  type PrivacyVisibilityKey
} from "@/lib/user/privacy-visibility";

export type ProfileRow = {
  label: string;
  value: string;
  actionLabel?: string;
};

export type PrivacyRow = {
  label: string;
  enabled: boolean;
  disabled: boolean;
  key?: PrivacyVisibilityKey;
};

export type AccountConnectionRow = {
  label: string;
  status: string;
  linked: boolean;
};

export type MePageModel = {
  displayName: string;
  avatarUrl: string | null;
  profileRows: ProfileRow[];
  privacyRows: PrivacyRow[];
  accountConnections: AccountConnectionRow[];
};

const PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  apple: "Apple",
  google: "Google",
  kakao: "Kakao",
  naver: "Naver"
};

export function buildMePageModel(user: User, identities: UserOAuthIdentity[]): MePageModel {
  const primaryIdentity = identities[0] ?? null;
  const loginMethod = primaryIdentity ? PROVIDER_LABELS[primaryIdentity.provider] : "확인 필요";
  const visibility = parsePrivacyVisibility(user.privacyVisibility);

  return {
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    profileRows: [
      { label: "닉네임", value: user.displayName, actionLabel: "수정" },
      { label: "이메일", value: user.email ?? "제공되지 않음" },
      { label: "로그인 방법", value: loginMethod },
      { label: "비밀번호 관리", value: "소셜 로그인" }
    ],
    privacyRows: PRIVACY_VISIBILITY_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      enabled: visibility[item.key],
      disabled: false
    })),
    accountConnections: [
      {
        label: "Instagram",
        status: user.instagramId ? "연결됨" : "연결안됨",
        linked: Boolean(user.instagramId)
      },
      {
        label: "Youtube",
        status: user.youtubeId ? "연결됨" : "연결안됨",
        linked: Boolean(user.youtubeId)
      }
    ]
  };
}
