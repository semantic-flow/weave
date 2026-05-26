const GENERATED_TIMESTAMP_FOOTER_PATTERN =
  /Generated on <span class="wf-term wf-date-tip" tabindex="0" title="[^"]*" data-tooltip="[^"]*">[^<]*<\/span> by/g;

export function replaceGeneratedTimestampFooter(
  contents: string,
  options: {
    readonly iso?: string;
    readonly display?: string;
  } = {},
): string {
  const iso = options.iso ?? "2026-05-21T12:34:56.000Z";
  const display = options.display ?? "May 21, 2026";
  const replacement =
    `Generated on <span class="wf-term wf-date-tip" tabindex="0" title="${iso}" data-tooltip="${iso}">${display}</span> by`;
  const updated = contents.replace(
    GENERATED_TIMESTAMP_FOOTER_PATTERN,
    replacement,
  );

  if (updated === contents) {
    throw new Error("Generated timestamp footer not found.");
  }

  return updated;
}
