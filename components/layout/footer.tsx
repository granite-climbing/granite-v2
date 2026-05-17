export function Footer() {
  return (
    <footer className="h-[152px] bg-[#121212] px-4 py-6 text-[#7A7A7A]">
      <div className="flex items-start justify-between">
        <div className="space-y-3 text-[12px] font-medium leading-4">
          <p>이용약관</p>
          <p>개인정보처리방침</p>
        </div>
        <div className="grid size-6 place-items-center rounded-full border border-[#7A7A7A] text-[12px]">◎</div>
      </div>
      <p className="mt-[52px] text-[12px] font-medium leading-4">
        Copyright ⓒ 2026 Granite All rights reserved.
      </p>
    </footer>
  );
}
