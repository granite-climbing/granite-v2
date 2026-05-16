import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";

export type PolicySection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type PolicyPageProps = {
  title: string;
  sourceUrl: string;
  effectiveDate?: string;
  sections: PolicySection[];
};

export function PolicyPage({ title, sourceUrl, effectiveDate, sections }: PolicyPageProps) {
  return (
    <main className="min-h-screen bg-white">
      <AppHeader />
      <article className="px-5 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B8F91]">Policy</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">{title}</h1>
        {effectiveDate ? <p className="mt-2 text-sm font-bold text-[#6F7477]">시행일자: {effectiveDate}</p> : null}
        <p className="mt-3 text-xs font-semibold text-[#8B8F91]">
          원본: <Link href={sourceUrl}>{sourceUrl}</Link>
        </p>
        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[24px] bg-[#F7F8F8] p-5">
              <h2 className="text-lg font-black">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-[#5F6467]">
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
