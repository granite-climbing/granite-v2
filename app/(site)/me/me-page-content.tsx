import React from "react";
import Link from "next/link";
import type { AccountConnectionRow, MePageModel, PrivacyRow, ProfileRow } from "./me-page-model";

type MyPageContentProps = {
  model: MePageModel;
  logoutSlot: React.ReactNode;
};

export function MyPageContent({ model, logoutSlot }: MyPageContentProps) {
  return (
    <main data-hide-site-footer className="min-h-screen bg-[#F7F7F7] pb-[90px] text-[#050505]">
      <MyPageHeader />

      <section className="bg-white px-4 pb-[22px]">
        <div className="flex justify-center pt-[14px]">
          <ProfileAvatar displayName={model.displayName} avatarUrl={model.avatarUrl} />
        </div>
        <dl className="mt-[26px] space-y-[17px]">
          {model.profileRows.map((row) => (
            <ProfileInfoRow key={row.label} row={row} />
          ))}
        </dl>
      </section>

      <Section title="공개여부">
        <div className="space-y-[13px]">
          {model.privacyRows.map((row) => (
            <PrivacyToggleRow key={row.label} row={row} />
          ))}
        </div>
      </Section>

      <Section title="계정 연결">
        <div className="space-y-[17px]">
          {model.accountConnections.map((row) => (
            <AccountConnection key={row.label} row={row} />
          ))}
        </div>
      </Section>

      <Section title="사용 방식">
        <PrivacyToggleRow row={{ label: "알림 설정", enabled: false, disabled: true }} />
      </Section>

      <Section title="서비스">
        <div className="space-y-[17px]">
          <PlainServiceRow label="문의" />
          <Link href="/terms" className="flex items-center gap-1 text-[14px] font-medium">
            약관/개인정보처리방침
            <ChevronRight />
          </Link>
        </div>
      </Section>

      <Section title="로그인">
        <div className="space-y-[18px]">
          {logoutSlot}
          <p className="text-[14px] font-medium text-[#C8C8C8]">회원탈퇴</p>
        </div>
      </Section>

    </main>
  );
}

export function MyPageHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-[56px] items-end justify-between bg-white px-4 pb-[17px]">
      <h1 className="text-[17px] font-semibold leading-none">마이</h1>
      <button
        type="button"
        aria-label="메뉴 열기"
        className="flex size-7 flex-col items-center justify-center gap-[5px]"
        disabled
      >
        <span className="h-[2px] w-[18px] bg-black" />
        <span className="h-[2px] w-[18px] bg-black" />
        <span className="h-[2px] w-[18px] bg-black" />
      </button>
    </header>
  );
}

function ProfileAvatar({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  return (
    <div className="relative size-[68px]">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${displayName} 프로필`}
          className="size-[68px] rounded-full object-cover"
        />
      ) : (
        <div aria-hidden className="grid size-[68px] place-items-center rounded-full bg-[#BDBDBD]">
          <svg viewBox="0 0 64 64" className="size-[45px] text-white" aria-hidden>
            <circle cx="32" cy="22" r="10" fill="currentColor" />
            <path d="M14 54c2-12 10-18 18-18s16 6 18 18H14Z" fill="currentColor" />
          </svg>
        </div>
      )}
      <span className="absolute bottom-0 right-[-2px] grid size-[20px] place-items-center rounded-full bg-black text-white ring-2 ring-white">
        <svg viewBox="0 0 20 20" className="size-[11px]" aria-hidden>
          <path
            fill="currentColor"
            d="M13.8 3.5 16.5 6l-8.8 8.9-3.3.7.7-3.3 8.7-8.8Zm1.6-1.6c.4-.4 1.1-.4 1.5 0l1.2 1.2c.4.4.4 1.1 0 1.5l-.8.8-2.7-2.7.8-.8Z"
          />
        </svg>
      </span>
    </div>
  );
}

function ProfileInfoRow({ row }: { row: ProfileRow }) {
  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-center gap-1 text-[14px] leading-none">
      <dt className="font-medium text-[#8A8A8A]">{row.label}</dt>
      <dd className="min-w-0 truncate font-medium text-black">{row.value}</dd>
      {row.actionLabel ? <span className="text-[14px] font-medium text-[#0057FF]">{row.actionLabel}</span> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-2 bg-white px-4 py-[27px]">
      <h2 className="mb-[17px] text-[14px] font-medium text-[#8A8A8A]">{title}</h2>
      {children}
    </section>
  );
}

function PrivacyToggleRow({ row }: { row: PrivacyRow }) {
  return (
    <div className="flex h-[20px] items-center justify-between text-[14px] font-medium">
      <span>{row.label}</span>
      <span
        role="switch"
        aria-checked={row.enabled}
        aria-disabled={row.disabled}
        className={`relative h-[20px] w-[43px] rounded-full transition ${
          row.enabled ? "bg-black" : "bg-[#BBBBBB]"
        } ${row.disabled ? "opacity-80" : ""}`}
      >
        <span
          className={`absolute top-[2px] size-[16px] rounded-full bg-white transition ${
            row.enabled ? "left-[25px]" : "left-[2px]"
          }`}
        />
      </span>
    </div>
  );
}

function AccountConnection({ row }: { row: AccountConnectionRow }) {
  return (
    <div className="flex items-center justify-between text-[14px] font-medium">
      <span>{row.label}</span>
      <span className={row.linked ? "text-[#0057FF]" : "text-[#B0B0B0]"}>{row.status}</span>
    </div>
  );
}

function PlainServiceRow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1 text-[14px] font-medium">
      {label}
      <ChevronRight />
    </p>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
      <path d="m4.5 2.5 3 3.5-3 3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}
