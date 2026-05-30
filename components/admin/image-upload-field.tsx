"use client";

import { useState } from "react";
import { uploadAdminImageAction } from "@/lib/actions/admin-images";

export function ImageUploadField({
  name,
  defaultValue,
  entityType,
  entityId,
  purpose,
}: {
  name: string;
  defaultValue: string;
  entityType: string;
  entityId: string;
  purpose: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      fd.set("purpose", purpose);
      const { cdnUrl } = await uploadAdminImageAction(fd);
      setUrl(cdnUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-24 w-full rounded-[8px] object-cover" />
      ) : null}
      {/* The hidden input is what the entity save form actually submits */}
      <input type="hidden" name={name} value={url} readOnly />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {busy ? <p className="text-xs text-[#6F7477]">Uploading…</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
