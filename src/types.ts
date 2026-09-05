/**
 * Accommodation status of a guest.
 *
 * - `hotel`: already booked by Lucie, the RSVP form shows a disabled field.
 * - `libre`: the guest picks between a tent on the estate or their own booking.
 */
export type Hebergement = 'hotel' | 'libre';

/** A single guest, as generated once from Lucie's Excel file. */
export interface Guest {
  name: string;
  email: string | null;
  hebergement: Hebergement;
}

/** Accommodation choices offered to a `libre` guest. */
export type HebergementChoice = 'tente' | 'exterieur';

/** Payload accepted by `POST /api/rsvp`. */
export interface RsvpPayload {
  guestName: string;
  email: string;
  attending: boolean;
  hebergement: Hebergement | HebergementChoice;
  message?: string;
}
