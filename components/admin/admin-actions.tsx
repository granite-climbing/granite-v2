/** Horizontal actions bar for a table row: publish toggle, delete, restore. */
export function AdminRowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
