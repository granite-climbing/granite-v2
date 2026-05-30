import { Footer } from "@/components/layout/footer";

/**
 * Site (public) layout. Wraps every non-admin route in the mobile-first
 * 360px container with the shared Footer (ADR 0001).
 *
 * Route groups in Next.js are URL-transparent, so URLs like `/`, `/c/anyang`,
 * `/topos/<id>`, `/r/<id>`, `/healthz`, `/me`, `/privacy`, `/terms`,
 * `/data-deletion` continue to resolve unchanged.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[360px] bg-white shadow-card">
      {children}
      <div className="mt-10">
        <Footer />
      </div>
    </div>
  );
}
