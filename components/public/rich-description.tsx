import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { parseRichDescription } from "@/lib/content/rich-description";
import { richDescriptionExtensions } from "@/lib/content/tiptap-extensions";

export function RichDescription({ richJson, fallbackText }: { richJson?: string | null; fallbackText: string }) {
  if (!richJson) return <p className="mt-[2px] whitespace-pre-line text-[14px] font-normal leading-5 text-[#2A2A2A]">{fallbackText}</p>;
  try {
    const content = parseRichDescription(richJson);
    return <div className="mt-[2px] space-y-2 text-[14px] font-normal leading-5 text-[#2A2A2A] [&_blockquote]:border-l-2 [&_blockquote]:border-[#7A7A7A] [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_input]:pointer-events-none">{renderToReactElement({ content, extensions: richDescriptionExtensions() })}</div>;
  } catch (error) {
    console.error("[rich-description] Invalid persisted content", error);
    return <p className="mt-[2px] whitespace-pre-line text-[14px] font-normal leading-5 text-[#2A2A2A]">{fallbackText}</p>;
  }
}
