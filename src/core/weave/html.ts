import * as posix from "@std/path/posix";

export function toResourcePath(
  pagePath: string,
  createError: (message: string) => Error = (message) => new Error(message),
): string {
  if (pagePath === "index.html") {
    return "";
  }
  if (!pagePath.endsWith("/index.html")) {
    throw createError(`Unsupported resource page path: ${pagePath}`);
  }

  return pagePath.slice(0, -"/index.html".length);
}

export function toRelativeHref(fromPath: string, targetPath: string): string {
  return posix.relative(posix.dirname(fromPath), targetPath);
}

export function deriveMeshLabel(meshBase: string): string {
  const url = new URL(meshBase);
  const segments = url.pathname.split("/").filter((segment) =>
    segment.length > 0
  );
  return segments[segments.length - 1] ?? "_mesh";
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
