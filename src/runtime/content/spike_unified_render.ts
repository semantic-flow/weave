// Temporary proof surface for the unified packaging spike. This module is not
// used by production page rendering.
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Plugin, unified } from "unified";
import { visit } from "unist-util-visit";

const frontmatterDataKey = "unifiedPackagingSpikeFrontmatter";

export interface UnifiedPackagingSpikeResult {
  html: string;
  frontmatter: readonly string[];
}

export interface UnifiedPackagingSpikeRenderer {
  render(markdown: string): UnifiedPackagingSpikeResult;
}

const captureFrontmatter: Plugin = () => {
  return (tree, file) => {
    const frontmatter: string[] = [];
    // The "yaml" node type comes from remark-frontmatter's mdast augmentation,
    // which the bare unified Plugin tree type does not carry — a string test
    // narrows to never. Visit untyped and discriminate by hand.
    visit(tree, (node) => {
      const candidate = node as { type: string; value?: unknown };
      if (candidate.type === "yaml" && typeof candidate.value === "string") {
        frontmatter.push(candidate.value);
      }
    });
    file.data[frontmatterDataKey] = frontmatter;
  };
};

export function createUnifiedPackagingSpikeRenderer(): UnifiedPackagingSpikeRenderer {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(captureFrontmatter)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSlug, { prefix: "weave-" })
    .use(rehypeStringify);

  return {
    render(markdown: string): UnifiedPackagingSpikeResult {
      const file = processor.processSync(markdown);
      const captured = file.data[frontmatterDataKey];
      return {
        html: String(file),
        frontmatter: Array.isArray(captured)
          ? captured.filter((value): value is string =>
            typeof value === "string"
          )
          : [],
      };
    },
  };
}

export function renderUnifiedPackagingSpike(
  markdown: string,
): UnifiedPackagingSpikeResult {
  return createUnifiedPackagingSpikeRenderer().render(markdown);
}
