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
        className="absolute right-4 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-[#090909]"
      >
        <SearchIcon />
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="none">
      <path
        d="m20 20-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
