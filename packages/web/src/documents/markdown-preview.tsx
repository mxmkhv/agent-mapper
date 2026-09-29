import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownBody } from "./markdown-body";
import "./markdown-preview.css";

const external = (href: string | undefined) =>
  Boolean(href && /^https?:\/\//i.test(href));

/**
 * Raw HTML is skipped and only explicit http(s) links navigate. Images render as their alt text,
 * so previewing never fetches a remote or local resource.
 */
const components: Components = {
  a: ({ href, children }) =>
    external(href) ? (
      <a href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ) : (
      <span className="markdown-link" title={href}>
        {children}
      </span>
    ),
  img: ({ alt, src }) => (
    <span className="markdown-image" title={src}>
      [image{alt ? `: ${alt}` : ""}]
    </span>
  )
};

export function MarkdownPreview({ content }: { content: string }) {
  const body = markdownBody(content);
  if (!body.trim()) {
    return <p className="text-ink-muted">Nothing to preview.</p>;
  }
  return (
    <div className="markdown-preview">
      <Markdown components={components} remarkPlugins={[remarkGfm]} skipHtml>
        {body}
      </Markdown>
    </div>
  );
}
