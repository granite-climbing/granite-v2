import { PolicyPage } from "@/components/policy/policy-page";
import { privacySections } from "@/lib/policies/content";

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="개인정보처리방침"
      effectiveDate="2026년 2월 22일"
      sections={privacySections}
    />
  );
}
