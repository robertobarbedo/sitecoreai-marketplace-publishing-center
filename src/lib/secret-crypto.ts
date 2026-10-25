import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

/**
 * Server-side sealing of the Vercel Deployment Protection bypass password.
 *
 * The password is only handled in plaintext here, on the server: when the
 * user saves it (/api/secrets/seal) and when /api/fetch-page forwards it to
 * the checked site. What is stored in the Sitecore settings item and held by
 * the browser is AES-256-GCM ciphertext that only this deployment's key can
 * open.
 *
 * The password is sealed together with the hostnames it may be sent to, so
 * the GCM tag covers both: /api/fetch-page only forwards it to a page on one
 * of those hosts, and a caller cannot point a sealed value at a server of
 * their own. Changing the hosts means entering the password again.
 *
 * The key comes from PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY (any passphrase
 * of 16+ characters; a 32-byte AES key is derived from it with HKDF-SHA256).
 * It is never optional: without it the app refuses to store the password
 * rather than silently falling back to plaintext.
 */

const KEY_ENV = "PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY";
const MIN_KEY_LENGTH = 16;

/** Format marker; bump if the wire format ever changes. Mirrored in src/utils/protection-secret.ts. */
const SEAL_VERSION = "v2";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_SALT = "sitecoreai-marketplace-publishing-center";
const HKDF_INFO = "vercel-protection-bypass";

const MAX_HOSTS = 20;
const HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** The deployment has no (usable) PUBLISHING_CENTER_SECRET_ENCRYPTION_KEY. */
export class EncryptionUnavailableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "EncryptionUnavailableError";
  }
}

/** A sealed value could not be opened — malformed, tampered with, or sealed under a different key. */
export class SecretSealError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "SecretSealError";
  }
}

/** What a sealed value holds: the password and the hostnames it may be sent to. */
export interface SealedBypass {
  secret: string;
  hosts: string[];
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const passphrase = process.env[KEY_ENV]?.trim();
  if (!passphrase) {
    throw new EncryptionUnavailableError(
      `${KEY_ENV} is not set on the server, so the protection password cannot be encrypted.`,
    );
  }
  if (passphrase.length < MIN_KEY_LENGTH) {
    throw new EncryptionUnavailableError(
      `${KEY_ENV} must be at least ${MIN_KEY_LENGTH} characters.`,
    );
  }

  cachedKey = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(passphrase, "utf8"),
      Buffer.from(HKDF_SALT, "utf8"),
      Buffer.from(HKDF_INFO, "utf8"),
      KEY_BYTES,
    ),
  );
  return cachedKey;
}

/**
 * Normalizes user-entered hosts ("www.example.com", or a pasted URL) to bare
 * lowercase hostnames. Exact names only — no wildcards, since a shared suffix
 * such as *.vercel.app would include other people's deployments.
 */
export function normalizeHosts(entries: string[]): string[] {
  const hosts = new Set<string>();
  for (const entry of entries) {
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed) continue;
    let hostname = "";
    try {
      hostname = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
    } catch {
      // reported below
    }
    if (!HOSTNAME_PATTERN.test(hostname)) {
      throw new SecretSealError(`"${entry.trim()}" is not a valid hostname.`);
    }
    hosts.add(hostname);
  }
  if (hosts.size === 0) {
    throw new SecretSealError("Enter at least one hostname the protection password is for.");
  }
  if (hosts.size > MAX_HOSTS) {
    throw new SecretSealError(`Enter at most ${MAX_HOSTS} hostnames.`);
  }
  return [...hosts];
}

/** True for values produced by {@link sealSecret}. */
export function isSealed(value: string): boolean {
  return value.startsWith(`${SEAL_VERSION}.`);
}

/** Encrypts the password and its allowed hosts into a self-describing, storable string. */
export function sealSecret({ secret, hosts }: SealedBypass): string {
  const plaintext = JSON.stringify({ secret, hosts: normalizeHosts(hosts) });
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    SEAL_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypts a value produced by {@link sealSecret}. */
export function openSecret(sealed: string): SealedBypass {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== SEAL_VERSION) {
    throw new SecretSealError(
      "The protection password is not encrypted. Open Settings and enter it again.",
    );
  }

  const [, iv, tag, ciphertext] = parts;

  let plaintext: string;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) {
      throw error;
    }
    // Wrong key or tampered payload — indistinguishable, and both mean the
    // user has to enter the password again.
    throw new SecretSealError(
      "The stored protection password could not be decrypted. It was most likely encrypted with a different server key; enter it again in Settings.",
    );
  }

  const payload = JSON.parse(plaintext) as Partial<SealedBypass>;
  if (typeof payload.secret !== "string" || !Array.isArray(payload.hosts)) {
    throw new SecretSealError(
      "The stored protection password is malformed. Enter it again in Settings.",
    );
  }
  return {
    secret: payload.secret,
    hosts: payload.hosts.filter((host): host is string => typeof host === "string"),
  };
}
