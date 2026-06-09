import { PolicyPage } from "@/components/policy/policy-page";
import { dataDeletionSections } from "@/lib/policies/content";

export default function DataDeletionPage() {
  return (
    <PolicyPage
      title="데이터 삭제 안내"
      sections={dataDeletionSections}
    />
  );
}
