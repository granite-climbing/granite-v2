export function FormSection({
  title,
  children,
  cols = 2,
}: {
  title: string;
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 border-b border-[#E1E4E8] pb-2 text-xs font-bold uppercase tracking-wide text-[#57606A]">
        {title}
      </h3>
      <div
        className={`grid gap-x-4 gap-y-3 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {children}
      </div>
    </section>
  );
}

export function FullWidth({ children }: { children: React.ReactNode }) {
  return <div className="col-span-2">{children}</div>;
}
