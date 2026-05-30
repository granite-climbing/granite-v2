/** A labeled form field row for dense admin forms. */
export function AdminField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3">
      <span className="w-40 shrink-0 pt-2 text-sm font-bold text-[#374151]">{label}</span>
      <div className="flex-1">{children}</div>
    </label>
  );
}

/** Common input styling for admin forms. */
export const inputCls =
  "h-8 w-full rounded border border-[#D0D7DE] bg-white px-2 text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#0969DA]";

export const textareaCls =
  "w-full rounded border border-[#D0D7DE] bg-white px-2 py-1 text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#0969DA]";

export const selectCls =
  "h-8 w-full rounded border border-[#D0D7DE] bg-white px-2 text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#0969DA]";

export const btnPrimaryCls =
  "rounded border border-[#D0D7DE] bg-[#F6F8FA] px-3 py-1 text-xs font-semibold text-[#24292F] hover:bg-[#E6EBF0] active:bg-[#DDE3EA]";

export const btnDangerCls =
  "rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100";

export const btnRestoreCls =
  "rounded border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100";
