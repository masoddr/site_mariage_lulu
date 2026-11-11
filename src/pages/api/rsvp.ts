import type { APIRoute } from 'astro';
import {
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  NOTIFY_EMAIL,
  RESEND_API_KEY,
  RSVP_SPREADSHEET_ID,
} from 'astro:env/server';

import { readMailConfig, sendRsvpMails, traceRsvp } from '../../lib/notify';
import { validateRsvp } from '../../lib/rsvp';
import { appendRsvpRow, readSheetConfig } from '../../lib/sheets';

// Rendered on demand by the Vercel adapter; the rest of the site stays static.
export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Handle an RSVP submission: validate, then store it durably.
 *
 * There are two durable copies — a spreadsheet row and a notification mail —
 * and they are attempted together rather than in sequence, since neither
 * depends on the other. One of the two succeeding is enough to answer the
 * guest. If both fail the answer really is lost, and saying "merci, c'est
 * noté" would be a lie, so the route fails loudly instead.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Requête invalide.' }, 400);
  }

  const validation = validateRsvp(body);
  if (!validation.ok) {
    return json({ ok: false, ...validation.error }, 422);
  }

  const { payload } = validation;
  traceRsvp(payload);

  const [stored, mailed] = await Promise.all([
    appendRsvpRow(
      payload,
      readSheetConfig(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, RSVP_SPREADSHEET_ID),
      new Date().toISOString(),
    ),
    sendRsvpMails(payload, readMailConfig(RESEND_API_KEY, NOTIFY_EMAIL)),
  ]);

  if (!stored && !mailed) {
    console.error('RSVP lost: neither the spreadsheet nor the mail accepted it.', payload.guestName);
    return json(
      {
        ok: false,
        error:
          "Votre réponse n'a pas pu être enregistrée. Merci de réessayer dans un instant, ou de nous écrire directement.",
      },
      502,
    );
  }

  return json({ ok: true, stored, mailed }, 200);
};
