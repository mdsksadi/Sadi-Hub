import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Keep sanitisation strict, but allow the classes highlight.js adds to code
// blocks. Scripts, event handlers and unknown protocols stay stripped.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
  },
};

export function Markdown({
  source,
  className,
}: {
  source?: string | null;
  className?: string;
}) {
  if (!source) return null;
  return (
    <div className={cn("prose-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, schema]]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
