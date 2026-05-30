"use client";

export default function AdminContentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="px-5 py-10">
      <div className="rounded-[8px] border border-red-200 bg-red-50 p-5">
        <h2 className="text-lg font-black text-red-800">Action failed</h2>
        <p className="mt-2 text-sm text-red-700">{error.message || "Unknown error"}</p>
        {error.digest ? <p className="mt-1 text-xs text-red-500">digest: {error.digest}</p> : null}
        <button
          type="button"
          onClick={reset}
          className="mt-4 h-9 rounded-full border border-red-300 bg-white px-4 text-sm font-bold text-red-700"
        >
          Try again
        </button>
      </div>
    </section>
  );
}
