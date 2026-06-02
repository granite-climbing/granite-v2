export function SearchField({
  defaultValue,
  placeholder,
  action,
  hiddenFields,
}: {
  defaultValue?: string;
  placeholder: string;
  action: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className="relative mx-4">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <label>
        <span className="sr-only">검색</span>
        <input
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete="off"
          className="h-12 w-full rounded-full border-0 bg-white px-4 pr-12 text-[14px] font-medium leading-5 text-[#090909] shadow-[0_0_6px_2px_rgba(0,0,0,0.1)] outline-none placeholder:text-[#B8B8B8] focus:shadow-[0_0_6px_2px_rgba(0,0,0,0.18)]"
        />
      </label>
      <button
        type="submit"
        aria-label="검색"
        className="absolute right-3 top-3 flex size-6 items-center justify-center text-[20px] leading-6 text-[#090909]"
      >
        ⌕
      </button>
    </form>
  );
}
