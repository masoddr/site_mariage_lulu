/**
 * Server-side unlock session for the password gate.
 *
 * The site password is never sent to the browser. Once it has been verified by
 * `POST /api/check-password`, the server hands back an HMAC-signed, httpOnly
 * cookie. Because the signature is derived from the password itself, changing
 * `SITE_PASSWORD` invalidates every existing session for free.
 */

/** Name of the cookie holding the unlock session. */
export const SESSION_COOKIE = 'lulu_unlocked';

/** How long an unlocked session stays valid. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

/** Encode bytes as URL-safe base64, without padding. */
function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compare two byte arrays without leaking their content through timing. */
function isEqualInConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= (a[index] as number) ^ (b[index] as number);
  }
  return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return new Uint8Array(digest);
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Check a password submission against the configured site password.
 *
 * Both values are hashed first, so the comparison always runs over 32 bytes and
 * cannot leak the expected length.
 *
 * @param submitted - Password typed by the visitor.
 * @param expected - Value of the `SITE_PASSWORD` secret.
 * @returns Whether the submission matches.
 */
export async function isPasswordCorrect(submitted: string, expected: string): Promise<boolean> {
  const [submittedHash, expectedHash] = await Promise.all([
    sha256(submitted.trim()),
    sha256(expected.trim()),
  ]);
  return isEqualInConstantTime(submittedHash, expectedHash);
}

/**
 * Build a signed session token that expires on its own.
 *
 * @param secret - Signing key; the site password is reused on purpose.
 * @param now - Current epoch milliseconds, injectable for tests.
 * @returns A `<expiry>.<signature>` token, safe to store in a cookie.
 */
export async function createSessionToken(secret: string, now: number = Date.now()): Promise<string> {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await hmacSha256(secret, payload)}`;
}

/**
 * Verify a session token: correct signature, and not expired.
 *
 * @param token - Raw cookie value, possibly missing or malformed.
 * @param secret - Signing key used by `createSessionToken`.
 * @param now - Current epoch milliseconds, injectable for tests.
 * @returns Whether the visitor holds a valid unlocked session.
 */
export async function isSessionTokenValid(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const separator = token.lastIndexOf('.');
  if (separator <= 0) {
    return false;
  }

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expiresAt = Number(payload);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    return false;
  }

  const expected = await hmacSha256(secret, payload);
  return isEqualInConstantTime(encoder.encode(signature), encoder.encode(expected));
}
