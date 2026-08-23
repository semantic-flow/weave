export const SHA256_CONTENT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function isCanonicalContentDigest(value: string): boolean {
  return SHA256_CONTENT_DIGEST_PATTERN.test(value);
}

export async function sha256ContentDigest(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `sha256:${hex}`;
}
