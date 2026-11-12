import type { Guest } from '../types';
import guestsData from './guests.json';

/**
 * Guest list, generated from Lucie's `fichier inscription` tab (devbook step 2).
 *
 * The JSON file is the single source of truth; this module only adds the
 * domain type so that consumers get autocompletion and type checking.
 */
export const guests: readonly Guest[] = guestsData as Guest[];

/** Look up a guest by their exact name, as sent by the RSVP form. */
export function findGuestByName(name: string): Guest | undefined {
  return guests.find((guest) => guest.name === name);
}

/**
 * Guests offered in the RSVP dropdown, alphabetically.
 *
 * Names are displayed exactly as Lucie wrote them. They are full names, which
 * matters: twelve first names are shared by several guests, so "Corinne" alone
 * would not let Corinne Brugnoli and Corinne Solere tell themselves apart.
 *
 * `needs_review` rows are notes rather than identified people; the current
 * export has none, but a future one might.
 */
export const selectableGuests: readonly Guest[] = guests
  .filter((guest) => !guest.needs_review)
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** First name, for addressing a guest in a mail. */
export function firstNameOf(guest: string): string {
  return guest.split(' ')[0] ?? guest;
}
