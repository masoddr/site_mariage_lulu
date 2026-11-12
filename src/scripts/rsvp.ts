/**
 * RSVP form wiring: conditional fields, submit, feedback.
 *
 * The form is plain HTML and the server revalidates everything, so a visitor
 * without JavaScript loses the niceties below, not their answer's integrity.
 */

const ENDPOINT = '/api/rsvp';

interface RsvpResponse {
  ok: boolean;
  error?: string;
  message?: string;
  field?: string;
  /** Durable copies written by the server: spreadsheet row, mail. */
  stored?: boolean;
  mailed?: boolean;
}

const form = document.querySelector<HTMLFormElement>('[data-rsvp-form]');
const submit = document.querySelector<HTMLButtonElement>('[data-rsvp-submit]');
const feedback = document.querySelector<HTMLElement>('[data-rsvp-message]');
const attendingFields = document.querySelector<HTMLElement>('[data-attending-fields]');
const hebergement = document.querySelector<HTMLSelectElement>('#rsvp-hebergement');
const hotelNote = document.querySelector<HTMLElement>('[data-hotel-note]');
const guestSelect = document.querySelector<HTMLSelectElement>('#rsvp-guest');
const success = document.querySelector<HTMLElement>('[data-rsvp-success]');
const successDetail = document.querySelector<HTMLElement>('[data-rsvp-success-detail]');

function setFeedback(text: string): void {
  if (feedback) {
    feedback.textContent = text;
  }
}

/** Whether the visitor has ticked "Avec joie !". */
function isAttending(): boolean {
  return form?.querySelector<HTMLInputElement>('input[name="attending"]:checked')?.value === 'oui';
}

/**
 * Show or hide everything that only concerns people who are coming.
 *
 * The block is also disabled, not just hidden: a hidden but enabled `required`
 * field is a classic way to make a form impossible to submit.
 */
function syncAttendingFields(): void {
  if (!attendingFields) {
    return;
  }
  const attending = isAttending();
  attendingFields.hidden = !attending;
  for (const field of attendingFields.querySelectorAll<HTMLInputElement>('input, select')) {
    field.disabled = !attending;
  }
  if (attending) {
    syncHebergement();
  }
}

/**
 * Adapt the accommodation field to the selected guest.
 *
 * Guests Lucie already booked a bed for get a locked field stating what was
 * reserved, rather than a choice that would be ignored by the server anyway.
 */
function syncHebergement(): void {
  if (!guestSelect || !hebergement || !hotelNote) {
    return;
  }
  const option = guestSelect.selectedOptions[0];
  const booked = option?.dataset.hebergement === 'hotel';

  // Kept visible but locked, so these guests can see what was reserved for
  // them rather than wonder why the question disappeared.
  hebergement.disabled = booked || attendingFields?.hidden === true;
  hotelNote.hidden = !booked;

  // The "already booked" option is never a free choice; it only exists so the
  // locked field has something to display.
  const hotelOption = hebergement.querySelector<HTMLOptionElement>('[data-hotel-option]');
  if (hotelOption) {
    hotelOption.hidden = !booked;
  }

  if (booked) {
    hebergement.value = 'hotel';
    const logement = option?.dataset.logement;
    hotelNote.textContent = logement
      ? `Un couchage vous est déjà réservé : ${logement}. Rien à faire de votre côté.`
      : "Un couchage vous est déjà réservé par les mariés. Rien à faire de votre côté.";
  } else if (hebergement.value === 'hotel') {
    // Switching from a booked guest to a free one must not leave the stale
    // "reserved" answer selected.
    hebergement.value = '';
  }
}

/** Collect the form into the JSON shape `POST /api/rsvp` expects. */
function readPayload(): Record<string, unknown> {
  const data = new FormData(form as HTMLFormElement);
  const attending = isAttending();

  const payload: Record<string, unknown> = {
    guestName: data.get('guestName') ?? '',
    email: data.get('email') ?? '',
    attending,
    message: data.get('message') ?? '',
  };

  if (attending) {
    payload.plat = data.get('plat') ?? '';
    payload.sauce = data.get('sauce') ?? '';
    payload.dessert = data.get('dessert') ?? '';
    // Sent as a boolean, and left undefined while nothing is ticked so the
    // server can tell "not answered" from "not staying".
    const brunch = data.get('brunch');
    payload.brunch = brunch === null ? null : brunch === 'oui';
    // Absent from FormData when the field is disabled, which is exactly the
    // "hotel" case the server fills in from the guest list.
    payload.hebergement = data.get('hebergement') ?? '';
  }

  return payload;
}

/** Move focus to the field the server complained about, when we can find it. */
function focusField(field: string | undefined): void {
  if (!field || !form) {
    return;
  }
  const target = form.querySelector<HTMLElement>(`[name="${field}"]`);
  target?.focus();
}

form?.addEventListener('change', (event) => {
  const target = event.target as HTMLElement;
  if (target.getAttribute('name') === 'attending') {
    syncAttendingFields();
  }
  if (target.id === 'rsvp-guest') {
    syncHebergement();
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  if (submit) {
    submit.disabled = true;
  }
  setFeedback('Envoi…');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(readPayload()),
    });
    const result = (await response.json()) as RsvpResponse;

    if (!result.ok) {
      setFeedback(result.message ?? result.error ?? 'Une erreur est survenue.');
      focusField(result.field);
      return;
    }

    form.hidden = true;
    if (success) {
      success.hidden = false;
    }
    if (successDetail) {
      // A 200 means at least one durable copy was written, so the answer is
      // safe either way; only the mail sentence changes.
      successDetail.textContent = result.mailed
        ? 'Votre réponse est enregistrée, et un e-mail de confirmation vient de vous être envoyé.'
        : 'Votre réponse est bien enregistrée. L’e-mail de confirmation, lui, n’a pas pu partir — ne vous inquiétez pas, nous avons bien reçu votre réponse.';
    }
    success?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    setFeedback("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
  } finally {
    if (submit) {
      submit.disabled = false;
    }
  }
});

// The browser may restore a previous selection on reload, so run once on load
// rather than trusting the server-rendered state.
syncAttendingFields();
syncHebergement();
