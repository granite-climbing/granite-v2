import { PolicyPage } from "@/components/policy/policy-page";
import { termsSections } from "@/lib/policies/content";

export default function TermsPage() {
  return (
    <PolicyPage
      title="이용약관"
      sourceUrl="https://granite.kr/terms/"
      effectiveDate="2026년 2월 22일"
      sections={termsSections}
    />
  );
}
