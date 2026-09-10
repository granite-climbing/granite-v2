import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

const GraniteLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
    };
  },
});

export function richDescriptionExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      link: false,
      underline: false,
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    GraniteLink.configure({
      autolink: false,
      linkOnPaste: false,
      openOnClick: false,
      isAllowedUri: (url) => {
        try {
          return new URL(url).protocol === "https:";
        } catch {
          return false;
        }
      },
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
    }),
    TaskList,
    TaskItem.configure({ nested: false }),
  ];
}
