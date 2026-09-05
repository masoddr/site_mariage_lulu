import type { APIRoute } from 'astro';

// Rendered on demand by the Vercel adapter; the rest of the site stays static.
export const prerender = false;

/**
 * Handle an RSVP submission: validate, persist, then notify.
 *
 * Scaffold stub (devbook step 7 will implement it):
 *   1. validate the payload against `RsvpPayload`,
 *   2. store the answer (Google Sheet or Supabase),
 *   3. send a confirmation mail to the guest and a notification to Lucie
 *      via Resend, using `RESEND_API_KEY` and `NOTIFY_EMAIL`.
 */
export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
};
