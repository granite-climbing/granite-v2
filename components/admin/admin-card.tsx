export function AdminCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-[#E1E4E8] bg-white p-5">
      <h2 className="text-lg font-bold text-[#111827]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
