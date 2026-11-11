/**
 * Accommodation status of a guest.
 *
 * - `hotel`: already booked by Lucie, the RSVP form shows a disabled field.
 * - `libre`: the guest picks between a tent on the estate or their own booking.
 */
export type Hebergement = 'hotel' | 'libre';

/** Which of the two families invited the guest. */
export type Side = 'lucie' | 'commun' | 'lucas';

/**
 * A single guest, generated from Lucie's sheet by `scripts/import_guests.py`.
 *
 * The extra fields exist to avoid losing what the sheet encodes: they are not
 * used by the RSVP form, only by whoever re-reads the list later.
 */
export interface Guest {
  name: string;
  /** Always `null` for now: the sheet has no email column, the form asks. */
  email: string | null;
  hebergement: Hebergement;
  /** Lucie's own wording for the bed already booked, or `null` if none. */
  logement: string | null;
  /** Usually one side; a few people are listed on both. */
  sides: Side[];
  /** `true` for placeholders like "sa meuf ?" — to clarify with Lucie. */
  needs_review: boolean;
}

/** Accommodation choices offered to a `libre` guest. */
export type HebergementChoice = 'tente' | 'exterieur';

/**
 * Main course served by the food truck.
 *
 * Lucie's mail offers "pâtes ou gnocchis, accompagnés de la sauce de votre
 * choix" without listing the sauces, so `sauce` stays a free-text field until
 * she sends them; it then becomes a `select` without touching this shape.
 */
export type Plat = 'pates' | 'gnocchis';

/** Payload accepted by `POST /api/rsvp`. */
export interface RsvpPayload {
  guestName: string;
  email: string;
  attending: boolean;
  /** All three are absent when `attending` is false: nothing left to choose. */
  hebergement?: Hebergement | HebergementChoice;
  plat?: Plat;
  sauce?: string;
  message?: string;
}
