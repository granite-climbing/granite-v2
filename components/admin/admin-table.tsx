export function AdminTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E1E4E8] bg-[#F6F8FA]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-semibold text-[#57606A] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminTableRow({ children, deleted }: { children: React.ReactNode; deleted?: boolean }) {
  return (
    <tr
      className={`border-b border-[#E1E4E8] hover:bg-[#F6F8FA] ${deleted ? "opacity-60" : ""}`}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 align-top text-sm text-[#111827] ${className ?? ""}`}>
      {children}
    </td>
  );
}
