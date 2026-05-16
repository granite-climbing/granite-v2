type AdSlotProps = {
  label?: string;
};

export function AdSlot({ label = "AD" }: AdSlotProps) {
  return (
    <div className="mx-auto my-5 grid h-14 w-[360px] max-w-[calc(100%-32px)] place-items-center bg-[#D9D9D9] text-xs font-bold text-[#9A9EA1]">
      {label}
    </div>
  );
}
