import MarkdownIt from "markdown-it";
import markdownItIns from "markdown-it-ins";
import markdownItMark from "markdown-it-mark";
import markdownItTaskLists from "markdown-it-task-lists";
import sanitizeHtml from "sanitize-html";

const markdown = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: false,
  typographer: false,
}).use(markdownItMark).use(markdownItIns).use(markdownItTaskLists);

const allowedTags = [
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr",
  "ul", "ol", "li", "input", "pre", "code", "table", "thead", "tbody", "tr", "th", "td",
  "a", "strong", "em", "s", "del", "u", "mark",
];

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags,
  allowedAttributes: {
    a: ["href", "title"],
    input: ["type", "checked", "disabled"],
    ul: ["data-type"],
    li: ["data-type", "data-checked"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
};

function sanitizeRichHtml(value: string): string {
  return sanitizeHtml(value.replace(/<\/?ins>/gi, (tag) => (tag[1] === "/" ? "</u>" : "<u>")), sanitizeOptions);
}

/** Converts GFM Markdown plus ==mark== and ++underline++ extensions to safe HTML. */
export function markdownToSafeHtml(markdownSource: string): string {
  if (!markdownSource.trim()) return "";
  const taskListHtml = markdown.render(markdownSource)
    .replace(/<ul class="contains-task-list">/g, '<ul data-type="taskList">')
    .replace(/<li class="task-list-item"><input([^>]*)>\s*([\s\S]*?)<\/li>/g, (_match, attributes: string, content: string) =>
      `<li data-type="taskItem" data-checked="${/\bchecked\b/.test(attributes)}"><p>${content}</p></li>`,
    );
  return sanitizeRichHtml(taskListHtml);
}

/** Keeps semantic clipboard HTML while removing styles, media, and executable content. */
export function htmlClipboardToSafeHtml(html: string): string {
  if (!html.trim()) return "";
  return sanitizeRichHtml(html);
}

/** Escapes legacy plain text and keeps its line breaks without treating it as markup. */
export function plainTextToSafeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>");
}

/** Canonicalizes an admin form value before persistence. Plain text is parsed as Markdown. */
export function normalizeCragDescriptionForStorage(value: string): string {
  return markdownToSafeHtml(value);
}

/** Existing stored descriptions are HTML only when they contain an HTML element. */
export function renderStoredCragDescription(value: string): string {
  return /<\/?[a-z][\s\S]*>/i.test(value)
    ? htmlClipboardToSafeHtml(value)
    : plainTextToSafeHtml(value);
}

/** Safe text-only summary for surfaces that do not render rich content. */
export function plainTextFromRichText(html: string): string {
  const spaced = html.replace(/<\/(?:p|div|h[1-6]|li|blockquote|tr|table|ul|ol|pre)>/gi, " ");
  return sanitizeHtml(spaced, { allowedTags: ["br"], allowedAttributes: {} })
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
