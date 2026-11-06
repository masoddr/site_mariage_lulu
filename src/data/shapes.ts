import type { ImageMetadata } from 'astro';

import appareilPhoto from '../assets/images/shapes/appareil-photo.png';
import dressCode from '../assets/images/shapes/dress-code.png';
import infosPratiques from '../assets/images/shapes/infos-pratiques.png';
import invit from '../assets/images/shapes/invit.png';
import presence from '../assets/images/shapes/presence.png';
import programme from '../assets/images/shapes/programme.png';

/**
 * One of the six shapes Lucie drew, posed on the letter.
 *
 * Cinq d'entre elles mènent à une page interne ; `invit` reste un pur visuel
 * dont l'artwork porte déjà le texte final (devbook §1.4).
 */
export interface Shape {
  /** Stable identifier, also used as the DOM id targeted by the GSAP timeline. */
  id: string;
  /** Accessible name, reused as the image alt text. */
  label: string;
  image: ImageMetadata;
  /** Destination page, or `null` when the shape is decorative. */
  href: string | null;
}

/** The six shapes, in the order Lucie listed them. */
export const shapes: readonly Shape[] = [
  {
    id: 'presence',
    label: 'Confirmez votre présence',
    image: presence,
    href: '/rsvp',
  },
  {
    id: 'infos-pratiques',
    label: 'Infos pratiques',
    image: infosPratiques,
    href: '/infos-pratiques',
  },
  {
    id: 'dress-code',
    label: 'Dress code',
    image: dressCode,
    href: '/dress-code',
  },
  {
    id: 'appareil-photo',
    label: 'Les photos du mariage',
    image: appareilPhoto,
    href: '/a-venir',
  },
  {
    id: 'programme',
    label: 'Programme du week-end',
    image: programme,
    href: '/programme',
  },
  {
    id: 'invit',
    label: "Carton d'invitation : Domaine Verdé, forêt Royale de Vacquiers, le 31 juillet 2027",
    image: invit,
    href: null,
  },
];
