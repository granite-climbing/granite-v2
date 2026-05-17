type AdSlotProps = {
  label?: string;
};

export function AdSlot({ label = "AD" }: AdSlotProps) {
  return (
    <div className="grid h-14 w-full place-items-center bg-[#D9D9D9] text-[20px] font-bold leading-7 text-white">
      {label === "AD" ? "광고" : label}
    </div>
  );
}
