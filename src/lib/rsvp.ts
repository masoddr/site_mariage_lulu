/**
 * Validation and formatting of an RSVP submission.
 *
 * Kept away from the API route so the rules can be read — and tested — without
 * standing up a request. The route only maps the outcome to a status code.
 */

import { findGuestByName } from '../data/guests';
import type { Hebergement, HebergementChoice, Plat, RsvpPayload } from '../types';

/** Upper bound on free-text fields, to keep a mail from becoming a novel. */
const MAX_MESSAGE_LENGTH = 2000;
const MAX_SAUCE_LENGTH = 200;

const PLATS: readonly Plat[] = ['pates', 'gnocchis'];
const HEBERGEMENT_CHOICES: readonly HebergementChoice[] = ['tente', 'exterieur'];

/** Human wording for each stored value, reused by the mails. */
const PLAT_LABELS: Record<Plat, string> = {
  pates: 'Pâtes',
  gnocchis: 'Gnocchis',
};

const HEBERGEMENT_LABELS: Record<Hebergement | HebergementChoice, string> = {
  hotel: "Logement à l'hôtel (réservé par Lucie)",
  libre: 'À préciser',
  tente: 'Tente sur le domaine',
  exterieur: 'Se loge par ses propres moyens',
};

/**
 * A rejected submission, with a message meant to be shown to the guest.
 *
 * `field` lets the form move focus to whatever needs fixing.
 */
export interface RsvpError {
  field: keyof RsvpPayload;
  message: string;
}

export type RsvpValidation =
  | { ok: true; payload: RsvpPayload }
  | { ok: false; error: RsvpError };

function fail(field: keyof RsvpPayload, message: string): RsvpValidation {
  return { ok: false, error: { field, message } };
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Deliberately loose address check: one `@`, something on each side, no space.
 *
 * A stricter regexp rejects valid addresses, and the only real proof that a
 * mailbox exists is the confirmation mail reaching it.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Validate a raw JSON body into an `RsvpPayload`.
 *
 * The guest name is checked against the invite list: the dropdown already
 * constrains it, but the endpoint is public and must not take a stranger's
 * word for it.
 *
 * @param body - Parsed JSON from the request, of unknown shape.
 * @returns The accepted payload, or the first problem found.
 */
export function validateRsvp(body: unknown): RsvpValidation {
  if (typeof body !== 'object' || body === null) {
    return fail('guestName', 'Requête invalide.');
  }
  const raw = body as Record<string, unknown>;

  const guestName = readString(raw.guestName);
  const guest = findGuestByName(guestName);
  if (!guest) {
    return fail('guestName', 'Merci de choisir votre nom dans la liste.');
  }

  const email = readString(raw.email);
  if (!looksLikeEmail(email)) {
    return fail('email', 'Cette adresse e-mail ne semble pas valide.');
  }

  if (typeof raw.attending !== 'boolean') {
    return fail('attending', 'Merci d’indiquer si vous serez présent·e.');
  }

  const message = readString(raw.message);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return fail('message', 'Votre message est un peu trop long.');
  }

  // Someone who declines has nothing to choose: drop the rest rather than
  // validate fields the form did not even show them.
  if (!raw.attending) {
    return {
      ok: true,
      payload: {
        guestName: guest.name,
        email,
        attending: false,
        ...(message ? { message } : {}),
      },
    };
  }

  const plat = readString(raw.plat) as Plat;
  if (!PLATS.includes(plat)) {
    return fail('plat', 'Merci de choisir entre les pâtes et les gnocchis.');
  }

  const sauce = readString(raw.sauce);
  if (sauce.length > MAX_SAUCE_LENGTH) {
    return fail('sauce', 'Votre choix de sauce est un peu trop long.');
  }

  const dessert = readString(raw.dessert);
  if (dessert.length > MAX_SAUCE_LENGTH) {
    return fail('dessert', 'Votre choix de dessert est un peu trop long.');
  }

  if (typeof raw.brunch !== 'boolean') {
    return fail('brunch', 'Merci d’indiquer si vous restez pour le brunch.');
  }

  // A guest Lucie already booked a bed for does not get to choose: whatever
  // the browser sent, the sheet wins.
  let hebergement: Hebergement | HebergementChoice;
  if (guest.hebergement === 'hotel') {
    hebergement = 'hotel';
  } else {
    const submitted = readString(raw.hebergement) as HebergementChoice;
    if (!HEBERGEMENT_CHOICES.includes(submitted)) {
      return fail('hebergement', 'Merci de choisir une option d’hébergement.');
    }
    hebergement = submitted;
  }

  return {
    ok: true,
    payload: {
      guestName: guest.name,
      email,
      attending: true,
      hebergement,
      plat,
      brunch: raw.brunch,
      ...(sauce ? { sauce } : {}),
      ...(dessert ? { dessert } : {}),
      ...(message ? { message } : {}),
    },
  };
}

/**
 * Render a payload as the plain-text block used by both notification mails.
 *
 * @param payload - An already-validated submission.
 * @returns A human-readable summary, one field per line.
 */
export function formatRsvpSummary(payload: RsvpPayload): string {
  const lines = [
    `Invité·e : ${payload.guestName}`,
    `E-mail : ${payload.email}`,
    `Présence : ${payload.attending ? 'Oui' : 'Non'}`,
  ];

  if (payload.attending) {
    lines.push(`Plat : ${payload.plat ? PLAT_LABELS[payload.plat] : '—'}`);
    lines.push(`Sauce : ${payload.sauce ?? 'sans préférence'}`);
    lines.push(`Dessert : ${payload.dessert ?? 'sans préférence'}`);
    lines.push(`Brunch du dimanche : ${payload.brunch ? 'Oui' : 'Non'}`);
    lines.push(
      `Hébergement : ${payload.hebergement ? HEBERGEMENT_LABELS[payload.hebergement] : '—'}`,
    );
  }

  if (payload.message) {
    lines.push('', `Message : ${payload.message}`);
  }

  return lines.join('\n');
}
