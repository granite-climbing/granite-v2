type AdSlotProps = {
  label?: string;
};

export function AdSlot({ label = "AD" }: AdSlotProps) {
  return (
    <div className="mx-5 my-5 grid h-14 place-items-center rounded-2xl bg-[#D9D9D9] text-xs font-bold text-[#8B8F91]">
      {label}
    </div>
  );
}
