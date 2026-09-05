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
