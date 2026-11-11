import type { Guest } from '../types';
import guestsData from './guests.json';

/**
 * Guest list, generated once from Lucie's Excel file (devbook step 2).
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
 * Pretty-print a name typed inconsistently in Lucie's sheet.
 *
 * The sheet mixes "FABIENNE", "stephan" and "DAVID B", which looks careless in
 * a dropdown. Shouting names are title-cased word by word; short all-caps words
 * are left alone so initials like "JB" survive.
 */
export function formatGuestName(name: string): string {
  return name
    .split(' ')
    .map((word) =>
      word.length <= 2 ? word : word[0]?.toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ');
}

/**
 * Guests offered in the RSVP dropdown, alphabetically.
 *
 * `needs_review` rows ("sa meuf ?", "+1 de maxime") are placeholders Lucie uses
 * to count heads, not people who can pick their own name — showing them would
 * be confusing. They come back in as soon as she replaces them with real names.
 */
export const selectableGuests: readonly Guest[] = guests
  .filter((guest) => !guest.needs_review)
  .slice()
  .sort((a, b) => formatGuestName(a.name).localeCompare(formatGuestName(b.name), 'fr'));
