/**
 * sha256Hex returns the lowercase hex sha256 of a UTF-8 string.
 *
 * Used to bind the user's outcome evidence to the on-chain record: the raw
 * evidence text is never stored, only its hash is committed, so a user can
 * later prove which evidence backed a claim.
 *
 * Requires the Web Crypto API (crypto.subtle), which is available in secure
 * contexts (HTTPS / localhost). We fail loudly rather than silently produce a
 * non-cryptographic hash that could be committed on-chain.
 */
export async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error(
      "Web Crypto (crypto.subtle) is not available in this context. Open the app over HTTPS or localhost.",
    );
  }
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
