/**
 * Accommodation status of a guest.
 *
 * - `hotel`: Lucie already arranged a bed, the RSVP form shows it locked.
 * - `libre`: nothing arranged, the guest says what they plan to do.
 */
export type Hebergement = 'hotel' | 'libre';

/**
 * A single guest, generated from Lucie's sheet by `scripts/import_guests.py`.
 *
 * `name` is the sheet's own spelling, deliberately: the site looks the guest's
 * row up by that string when it writes an answer back.
 */
export interface Guest {
  name: string;
  /** Always `null` for now: the sheet has no email column, the form asks. */
  email: string | null;
  hebergement: Hebergement;
  /** Lucie's wording for the bed arranged ("DOMAINE VERDE"), or `null`. */
  logement: string | null;
  /** `true` for a row that is a note rather than an identified guest. */
  needs_review: boolean;
}

/** Accommodation choices offered to a `libre` guest. */
export type HebergementChoice = 'tente' | 'exterieur';

/**
 * Main course served by the food truck.
 *
 * Lucie's mail offers "pâtes ou gnocchis, accompagnés de la sauce de votre
 * choix" without listing the sauces, so `sauce` and `dessert` stay free-text
 * until she sends the options; they then become `select`s without touching
 * this shape.
 */
export type Plat = 'pates' | 'gnocchis';

/** Payload accepted by `POST /api/rsvp`. */
export interface RsvpPayload {
  guestName: string;
  email: string;
  attending: boolean;
  /** All of the below are absent when `attending` is false. */
  hebergement?: Hebergement | HebergementChoice;
  plat?: Plat;
  sauce?: string;
  dessert?: string;
  /** Whether they stay for Sunday's brunch. */
  brunch?: boolean;
  message?: string;
}
