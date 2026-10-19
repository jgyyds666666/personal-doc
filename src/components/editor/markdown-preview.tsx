"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const components: Components = {
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-700 underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  img({ alt }) {
    return (
      <span className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
        外部图片已阻止{alt ? `：${alt}` : ""}
      </span>
    );
  },
  h1({ children }) {
    return <h1 className="mb-4 mt-6 text-2xl font-semibold">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-3 mt-6 text-xl font-semibold">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-5 text-lg font-semibold">{children}</h3>;
  },
  p({ children }) {
    return <p className="my-3 leading-7 text-slate-700">{children}</p>;
  },
  ul({ children }) {
    return <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-4 border-l-4 border-indigo-200 bg-indigo-50/50 px-4 py-1">
        {children}
      </blockquote>
    );
  },
  code({ children, className }) {
    const isBlock = className?.includes("language-");
    return (
      <code
        className={
          isBlock
            ? "font-mono text-sm"
            : "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm"
        }
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="my-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-slate-100">
        {children}
      </pre>
    );
  },
  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-slate-200 px-3 py-2">{children}</td>;
  },
};

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <article className="h-full overflow-auto bg-white px-6 py-4 text-slate-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
