/**
 * Fill a guest's row in Lucie's `fichier inscription` tab.
 *
 * That tab is a tracking grid: every guest already has a row, and answering the
 * form fills its cells in. So this appends nothing — it locates the row, then
 * writes the four answer columns.
 *
 * The site authenticates as a Google service account, which Lucie shares the
 * spreadsheet with like any other collaborator. No user ever signs in, so this
 * works from a background function with nothing but two secrets.
 *
 * Everything here speaks plain HTTP: `googleapis` would pull a large Node-only
 * dependency into a function whose whole job is two API calls.
 */

import type { RsvpPayload } from '../types';

/** Tab holding one row per guest. */
const SHEET_TAB = 'fichier inscription';

/** Rows 1 and 2 are headers; guests start on row 3. */
const FIRST_GUEST_ROW = 3;

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

async function callSheets(
  config: SheetConfig,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${SHEETS_API}/${config.spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Sheets API responded ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/** Compare two spellings of a name, ignoring case, accents and stray spaces. */
function normalise(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Find the spreadsheet row holding a guest.
 *
 * The row is looked up on every submission rather than stored in
 * `guests.json`: Lucie sorts and inserts rows in that tab, and a stale index
 * would quietly write one guest's answer onto another's line.
 */
async function findGuestRow(
  config: SheetConfig,
  token: string,
  guestName: string,
): Promise<number | null> {
  const range = encodeURIComponent(`${SHEET_TAB}!A${FIRST_GUEST_ROW}:A`);
  const body = (await callSheets(config, token, `/values/${range}`)) as {
    values?: string[][];
  };

  const target = normalise(guestName);
  const rows = body.values ?? [];
  for (let index = 0; index < rows.length; index += 1) {
    if (normalise(rows[index]?.[0] ?? '') === target) {
      return FIRST_GUEST_ROW + index;
    }
  }
  return null;
}

/**
 * Write one answer into the guest's row.
 *
 * Only the four answer columns are touched. Column C (`Logement`) is Lucie's
 * own planning and is never overwritten, and neither is the name in column A.
 *
 * @param payload - An already-validated submission.
 * @param config - Service account credentials, or `null` when unconfigured.
 * @returns Whether the row was written.
 */
export async function writeRsvpRow(
  payload: RsvpPayload,
  config: SheetConfig | null,
): Promise<boolean> {
  if (!config) {
    console.warn('RSVP spreadsheet skipped: Google service account secrets are unset.');
    return false;
  }

  try {
    const token = await getAccessToken(config);
    const row = await findGuestRow(config, token, payload.guestName);
    if (row === null) {
      throw new Error(`no row for "${payload.guestName}" in ${SHEET_TAB}`);
    }

    // Uppercase to match how Lucie already fills these cells by hand
    // ("PATES SANS GLUTEN", "DOMAINE VERDE").
    const presence = payload.attending ? 'OUI' : 'NON';
    const meal = payload.attending
      ? [
          payload.plat === 'gnocchis' ? 'GNOCCHIS' : 'PATES',
          (payload.sauce ?? '').toUpperCase(),
          (payload.dessert ?? '').toUpperCase(),
          payload.brunch ? 'OUI' : 'NON',
        ]
      : ['', '', '', ''];

    await callSheets(config, token, '/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `${SHEET_TAB}!B${row}`, values: [[presence]] },
          { range: `${SHEET_TAB}!D${row}:G${row}`, values: [meal] },
        ],
      }),
    });
    return true;
  } catch (error) {
    // A spreadsheet failure must not cost the answer: the caller still has the
    // mail, and reports a hard failure only when both have gone wrong.
    console.error('RSVP spreadsheet write failed:', error);
    cachedToken = null;
    return false;
  }
}
