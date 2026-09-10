"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useMemo, useState } from "react";
import { legacyTextToRichDescription, parseRichDescription } from "@/lib/content/rich-description";
import { richDescriptionExtensions } from "@/lib/content/tiptap-extensions";

export function CragDescriptionEditor({ initialRichJson, initialText }: { initialRichJson: string | null; initialText: string }) {
  const initialContent = useMemo(() => {
    if (!initialRichJson) return legacyTextToRichDescription(initialText);
    try { return parseRichDescription(initialRichJson); } catch { return legacyTextToRichDescription(initialText); }
  }, [initialRichJson, initialText]);
  const [json, setJson] = useState(() => JSON.stringify(initialContent));
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const editor = useEditor({
    extensions: richDescriptionExtensions(),
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => setJson(JSON.stringify(current.getJSON())),
    editorProps: { attributes: { class: "min-h-32 rounded-b border border-[#D0D7DE] p-3 text-sm outline-none" } },
  });
  if (!editor) return null;
  const button = (label: string, run: () => void, active = false) => (
    <button type="button" aria-label={label} aria-pressed={active} onClick={run} className="rounded px-2 py-1 text-xs hover:bg-[#F3F4F6]">{label}</button>
  );
  const applyLink = () => {
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
      editor.chain().focus().setLink({ href: url }).run();
      setJson(JSON.stringify(editor.getJSON())); setLinkOpen(false); setError("");
    } catch { setError("HTTPS URL만 사용할 수 있습니다."); }
  };
  return <div>
    <input type="hidden" name="descriptionRichJson" value={json} />
    <div className="flex flex-wrap gap-1 rounded-t border border-b-0 border-[#D0D7DE] bg-[#F6F8FA] p-2">
      {button("굵게", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {button("기울임", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {button("밑줄", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
      {button("하이라이트", () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"))}
      {button("제목 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
      {button("제목 3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
      {button("본문", () => editor.chain().focus().setParagraph().run())}
      {button("글머리 목록", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {button("번호 목록", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {button("체크리스트", () => editor.chain().focus().toggleTaskList().run(), editor.isActive("taskList"))}
      {button("인용문", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {button("구분선 삽입", () => editor.chain().focus().setHorizontalRule().run())}
      {button("링크", () => { setUrl(editor.getAttributes("link").href ?? ""); setLinkOpen(true); }, editor.isActive("link"))}
      {editor.isActive("link") && button("링크 해제", () => editor.chain().focus().unsetLink().run())}
    </div>
    <EditorContent editor={editor} />
    <p className="mt-1 text-xs text-[#57606A]">제목, 목록, 링크, 인용문, 강조, 체크리스트를 사용할 수 있습니다.</p>
    {linkOpen && <div role="dialog" aria-label="링크 입력" className="mt-2 flex gap-2"><input aria-label="HTTPS URL" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 rounded border p-2 text-sm" placeholder="https://" /><button type="button" onClick={applyLink}>적용</button><button type="button" onClick={() => setLinkOpen(false)}>취소</button>{error && <p role="alert">{error}</p>}</div>}
  </div>;
}
