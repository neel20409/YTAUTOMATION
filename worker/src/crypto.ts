import crypto from "node:crypto";

// Mirrors web/src/lib/crypto.ts's encryptToken() - format: base64(iv).base64(authTag).base64(ciphertext).
// Keep in sync with that file; both must agree on TOKEN_ENCRYPTION_KEY (same env var value).
export function decryptToken(payload: string): string {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 random bytes).");
  }
  const key = Buffer.from(hex, "hex");

  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted token payload.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
