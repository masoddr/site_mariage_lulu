/**
 * Append RSVP answers to Lucie's spreadsheet.
 *
 * The site authenticates as a Google service account, which Lucie shares the
 * spreadsheet with like any other collaborator. No user ever signs in, so this
 * works from a background function with nothing but two secrets.
 *
 * Everything here speaks plain HTTP: `googleapis` would pull a large Node-only
 * dependency into a function whose whole job is one POST.
 */

import { formatGuestName } from '../data/guests';
import type { RsvpPayload } from '../types';

/** Tab the answers are appended to, created once by hand. */
const SHEET_TAB = 'REPONSES SITE';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Credentials for the service account, absent until the secrets are set. */
export interface SheetConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

/**
 * Read the spreadsheet configuration, or `null` when it is incomplete.
 *
 * Vercel stores the private key on a single line, so the literal `\n` pairs it
 * contains have to become real newlines before the PEM can be parsed.
 */
export function readSheetConfig(
  clientEmail: string | undefined,
  privateKey: string | undefined,
  spreadsheetId: string | undefined,
): SheetConfig | null {
  if (!clientEmail || !privateKey || !spreadsheetId) {
    return null;
  }
  return { clientEmail, privateKey: privateKey.replace(/\\n/g, '\n'), spreadsheetId };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeJson(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * Decode the base64 body of a PKCS#8 PEM into the bytes WebCrypto expects.
 *
 * The buffer is allocated explicitly rather than via `Uint8Array.from`, whose
 * return type is backed by `ArrayBufferLike` and so is rejected by
 * `importKey`'s `BufferSource` parameter.
 */
function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Access tokens last an hour; a warm function can reuse one across requests.
 *
 * Refreshed a minute early so a token cannot expire between this check and the
 * API call that uses it.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: SheetConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }

  const claims = encodeJson({
    iss: config.clientEmail,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(config.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${toBase64Url(new Uint8Array(signature))}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token endpoint responded ${response.status}: ${await response.text()}`);
  }

  const token = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: token.access_token, expiresAt: now + token.expires_in };
  return token.access_token;
}

/** One spreadsheet row, in the column order of the `REPONSES SITE` tab. */
function toRow(payload: RsvpPayload, submittedAt: string): string[] {
  return [
    submittedAt,
    formatGuestName(payload.guestName),
    payload.email,
    payload.attending ? 'Oui' : 'Non',
    payload.plat ?? '',
    payload.sauce ?? '',
    payload.hebergement ?? '',
    payload.message ?? '',
  ];
}

/**
 * Append one answer as a new row.
 *
 * @param payload - An already-validated submission.
 * @param config - Service account credentials, or `null` when unconfigured.
 * @param submittedAt - Submission timestamp, as an ISO string.
 * @returns Whether the row was written.
 */
export async function appendRsvpRow(
  payload: RsvpPayload,
  config: SheetConfig | null,
  submittedAt: string,
): Promise<boolean> {
  if (!config) {
    console.warn('RSVP spreadsheet skipped: Google service account secrets are unset.');
    return false;
  }

  try {
    const token = await getAccessToken(config);
    const range = encodeURIComponent(`${SHEET_TAB}!A:H`);
    const response = await fetch(
      `${SHEETS_API}/${config.spreadsheetId}/values/${range}:append` +
        '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [toRow(payload, submittedAt)] }),
      },
    );

    if (!response.ok) {
      throw new Error(`Sheets API responded ${response.status}: ${await response.text()}`);
    }
    return true;
  } catch (error) {
    // A spreadsheet failure must not cost the answer: the caller still has the
    // mail, and reports a hard failure only when both have gone wrong.
    console.error('RSVP spreadsheet append failed:', error);
    cachedToken = null;
    return false;
  }
}
