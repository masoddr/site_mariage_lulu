/**
 * What happens to an RSVP once it has been accepted: record it, then notify.
 *
 * Recording and notifying are split on purpose. Recording must never fail —
 * it is the only thing standing between a guest's answer and oblivion —
 * whereas a mail is a convenience that may legitimately be unavailable.
 */

import { formatGuestName } from '../data/guests';
import { formatRsvpSummary } from './rsvp';
import type { RsvpPayload } from '../types';

/**
 * Sender shown on both mails.
 *
 * Resend only accepts a domain verified in the account; until
 * lemariagedeslulu.fr is verified there, sending fails and the answer survives
 * through `recordRsvp` alone.
 */
const MAIL_FROM = 'Lucie & Lucas <bonjour@lemariagedeslulu.fr>';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Mail configuration, absent as long as the secrets are unset in Vercel. */
export interface MailConfig {
  apiKey: string;
  notifyEmail: string;
}

/**
 * Trace an answer in the function logs.
 *
 * This is NOT storage: Vercel keeps runtime logs for one hour on the Hobby
 * plan. It only helps debugging a submission that just happened. The durable
 * copies are the spreadsheet row and the notification mail, and an answer that
 * gets neither is reported as a failure to the guest.
 *
 * @param payload - An already-validated submission.
 */
export function traceRsvp(payload: RsvpPayload): void {
  console.log(`RSVP ${JSON.stringify(payload)}`);
}

/** Read the mail configuration, or `null` when it is incomplete. */
export function readMailConfig(
  apiKey: string | undefined,
  notifyEmail: string | undefined,
): MailConfig | null {
  return apiKey && notifyEmail ? { apiKey, notifyEmail } : null;
}

async function sendMail(
  config: MailConfig,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text }),
  });

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}

function guestMailBody(payload: RsvpPayload): string {
  const firstName = formatGuestName(payload.guestName);

  if (!payload.attending) {
    return [
      `Bonjour ${firstName},`,
      '',
      'Nous avons bien reçu votre réponse : vous ne pourrez pas être des nôtres.',
      'Vous nous manquerez, et nous penserons à vous ce jour-là.',
      '',
      'Lucie & Lucas',
    ].join('\n');
  }

  return [
    `Bonjour ${firstName},`,
    '',
    'Votre présence est bien enregistrée, merci ! Voici ce que nous avons noté :',
    '',
    formatRsvpSummary(payload),
    '',
    'Rendez-vous le samedi 31 juillet 2027 au Domaine Verdé, portes ouvertes à 15h',
    'et cérémonie à 16h. Toutes les infos sont sur https://lemariagedeslulu.fr',
    '',
    'À très vite,',
    'Lucie & Lucas',
  ].join('\n');
}

/**
 * Send the guest confirmation and the notification to the couple.
 *
 * Failures are swallowed and reported, never thrown: the answer is already
 * recorded, and telling a guest their RSVP failed because of our mail provider
 * would only push them to submit again.
 *
 * @param payload - An already-validated submission.
 * @param config - Mail configuration, or `null` when mails are disabled.
 * @returns Whether both mails went out.
 */
export async function sendRsvpMails(
  payload: RsvpPayload,
  config: MailConfig | null,
): Promise<boolean> {
  if (!config) {
    console.warn('RSVP mails skipped: RESEND_API_KEY or NOTIFY_EMAIL is unset.');
    return false;
  }

  const name = formatGuestName(payload.guestName);
  const results = await Promise.allSettled([
    sendMail(
      config,
      payload.email,
      payload.attending ? 'Votre présence est confirmée' : 'Réponse bien reçue',
      guestMailBody(payload),
    ),
    sendMail(
      config,
      config.notifyEmail,
      `RSVP — ${name} : ${payload.attending ? 'présent·e' : 'absent·e'}`,
      formatRsvpSummary(payload),
    ),
  ]);

  const failures = results.filter((result) => result.status === 'rejected');
  for (const failure of failures) {
    console.error('RSVP mail failed:', (failure as PromiseRejectedResult).reason);
  }

  return failures.length === 0;
}
