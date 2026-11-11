import type { APIRoute } from 'astro';
import { NOTIFY_EMAIL, RESEND_API_KEY } from 'astro:env/server';

import { readMailConfig, recordRsvp, sendRsvpMails } from '../../lib/notify';
import { validateRsvp } from '../../lib/rsvp';

// Rendered on demand by the Vercel adapter; the rest of the site stays static.
export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Handle an RSVP submission: validate, record, then notify.
 *
 * The answer is recorded before any mail is attempted, and a mail failure is
 * reported in the response (`mailed: false`) rather than turned into an error:
 * once recorded, the guest's job is done and they should not be asked to retry.
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

  recordRsvp(validation.payload);

  const mailed = await sendRsvpMails(
    validation.payload,
    readMailConfig(RESEND_API_KEY, NOTIFY_EMAIL),
  );

  return json({ ok: true, mailed }, 200);
};
