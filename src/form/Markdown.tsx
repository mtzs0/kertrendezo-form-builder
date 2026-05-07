import React from "react";

/**
 * Minimal inline markdown renderer for note/comment fields.
 * Supported syntax (inline only, no block elements except line breaks):
 *   **bold**         → <strong>
 *   *italic*  / _italic_  → <em>
 *   ~~strike~~       → <s>
 *   `code`           → <code>
 *   [text](href)     → <a>
 *   newline          → <br/>
 *
 * Intentionally tiny — avoids pulling in a full markdown lib.
 */

type Node = string | { tag: "strong" | "em" | "s" | "code" | "a" | "br"; href?: string; children?: Node[] };

const TOKEN_RE =
  /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(__[^_\n]+__)|(_[^_\n]+_)|(~~[^~\n]+~~)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\n]+\))/;

function parseInline(text: string): Node[] {
  const out: Node[] = [];
  let rest = text;
  while (rest.length) {
    const m = rest.match(TOKEN_RE);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push({ tag: "strong", children: parseInline(tok.slice(2, -2)) });
    } else if (tok.startsWith("~~")) {
      out.push({ tag: "s", children: parseInline(tok.slice(2, -2)) });
    } else if (tok.startsWith("`")) {
      out.push({ tag: "code", children: [tok.slice(1, -1)] });
    } else if (tok.startsWith("[")) {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        out.push({ tag: "a", href: linkMatch[2], children: parseInline(linkMatch[1]) });
      } else {
        out.push(tok);
      }
    } else {
      // *italic* or _italic_
      out.push({ tag: "em", children: parseInline(tok.slice(1, -1)) });
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

function renderNodes(nodes: Node[], keyPrefix = ""): React.ReactNode {
  return nodes.map((n, i) => {
    const k = `${keyPrefix}-${i}`;
    if (typeof n === "string") return <React.Fragment key={k}>{n}</React.Fragment>;
    if (n.tag === "br") return <br key={k} />;
    if (n.tag === "code")
      return (
        <code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {n.children && renderNodes(n.children, k)}
        </code>
      );
    if (n.tag === "a")
      return (
        <a
          key={k}
          href={n.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {n.children && renderNodes(n.children, k)}
        </a>
      );
    const Tag = n.tag;
    return <Tag key={k}>{n.children && renderNodes(n.children, k)}</Tag>;
  });
}

export interface MarkdownProps {
  children: string | undefined | null;
  className?: string;
  as?: "p" | "span" | "div";
}

export function Markdown({ children, className, as = "p" }: MarkdownProps) {
  if (!children) return null;
  const lines = String(children).split("\n");
  const nodes: Node[] = [];
  lines.forEach((line, i) => {
    nodes.push(...parseInline(line));
    if (i < lines.length - 1) nodes.push({ tag: "br" });
  });
  const Tag = as;
  return <Tag className={className}>{renderNodes(nodes)}</Tag>;
}
