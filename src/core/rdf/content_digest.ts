export const SHA256_CONTENT_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function isCanonicalContentDigest(value: string): boolean {
  return SHA256_CONTENT_DIGEST_PATTERN.test(value);
}
