import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const configured = process.env["CHANNEL_TOKEN_ENCRYPTION_KEY"];
  if (process.env["NODE_ENV"] === "production" && (!configured || configured.length < 32)) {
    throw new Error("CHANNEL_TOKEN_ENCRYPTION_KEY must be configured in production.");
  }
  // Development still encrypts values at rest. The explicit production key
  // can later be moved to a managed secret without changing the data model.
  return createHash("sha256")
    .update(configured || process.env["SESSION_SECRET"] || "marketingpilot-development-token-key")
    .digest();
}

/** Creates a short-lived signature for a public Meta media fetch URL. */
export function signMediaAccess(mediaId: string, expiresAt: number) {
  return createHmac("sha256", encryptionKey())
    .update(`${mediaId}.${expiresAt}`)
    .digest("base64url");
}

export function verifyMediaAccess(mediaId: string, expiresAt: number, signature: string) {
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expected = signMediaAccess(mediaId, expiresAt);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function encryptToken(value: string) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptToken(value: string | null | undefined) {
  if (!value) return null;
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(":");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Érvénytelen token-tárolási formátum.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}
