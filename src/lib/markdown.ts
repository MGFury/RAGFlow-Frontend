import { marked } from "marked";
import DOMPurify from "dompurify";

/** Markdown to sanitized HTML. Used for answers and for .md files. */
export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
