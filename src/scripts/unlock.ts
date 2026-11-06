import gsap from 'gsap';

import {
  jumpToOpenState,
  playOpeningSequence,
  prefersReducedMotion,
  readScene,
  waitForImages,
} from './opening-sequence';

/**
 * Password gate wiring: submit, fetch the letter, then play the sequence.
 *
 * The letter markup is absent from the locked page, so it is fetched from the
 * cookie-guarded partial only once the server has accepted the password.
 */

const LETTER_ENDPOINT = '/partials/lettre';
const CHECK_ENDPOINT = '/api/check-password';

/**
 * How the home page was rendered by the server.
 *
 * - `locked`: no session, the letter is not in the page.
 * - `replay`: valid session, letter present but hidden, sequence requested.
 * - `open`: valid session, letter shown directly.
 */
export type HomeMode = 'locked' | 'replay' | 'open';

function setMessage(node: HTMLElement | null, text: string): void {
  if (node) {
    node.textContent = text;
  }
}

/** Shake the form to signal a rejected password, unless motion is reduced. */
function rejectVisually(form: HTMLElement): void {
  if (prefersReducedMotion()) {
    return;
  }
  gsap.fromTo(
    form,
    { x: -8 },
    { x: 0, duration: 0.5, ease: 'elastic.out(1.1, 0.35)', clearProps: 'x' },
  );
}

async function fetchLetter(): Promise<string> {
  const response = await fetch(LETTER_ENDPOINT, {
    headers: { Accept: 'text/html' },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Letter partial responded ${response.status}`);
  }
  return response.text();
}

async function submitPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(CHECK_ENDPOINT, {
    method: 'POST',
    // The JSON content type also satisfies Astro's CSRF check, since a
    // same-origin fetch carries a matching `Origin` header.
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ password }),
  });

  if (response.ok) {
    return { ok: true };
  }

  const fallback = 'Une erreur est survenue. Réessayez dans un instant.';
  try {
    const body = (await response.json()) as { error?: string };
    return { ok: false, error: body.error ?? fallback };
  } catch {
    return { ok: false, error: fallback };
  }
}

/** Reveal the letter and run the choreography. */
async function openEnvelope(slot: HTMLElement): Promise<void> {
  await waitForImages(slot);
  const scene = readScene();
  if (!scene) {
    return;
  }
  // GSAP timelines are awaitable; `null` means motion is reduced and the scene
  // was snapped to its final state instead.
  await playOpeningSequence(scene);
}

function wirePasswordForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-password-form]');
  const slot = document.querySelector<HTMLElement>('[data-letter-slot]');
  if (!form || !slot) {
    return;
  }

  const input = form.querySelector<HTMLInputElement>('input[name="password"]');
  const button = form.querySelector<HTMLButtonElement>('[data-password-submit]');
  const message = form.querySelector<HTMLElement>('[data-password-message]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = input?.value ?? '';
    if (!password) {
      setMessage(message, 'Merci de saisir le mot de passe.');
      rejectVisually(form);
      return;
    }

    if (button) {
      button.disabled = true;
    }
    setMessage(message, 'Vérification…');

    try {
      const result = await submitPassword(password);
      if (!result.ok) {
        setMessage(message, result.error ?? '');
        rejectVisually(form);
        input?.select();
        if (button) {
          button.disabled = false;
        }
        return;
      }

      setMessage(message, '');
      slot.innerHTML = await fetchLetter();
      await openEnvelope(slot);
    } catch {
      setMessage(message, 'Connexion impossible. Vérifiez votre réseau.');
      rejectVisually(form);
      if (button) {
        button.disabled = false;
      }
    }
  });
}

/**
 * Entry point, called from the home page with the mode chosen by the server.
 *
 * @param mode - How the page was rendered.
 */
export function initHomePage(mode: HomeMode): void {
  if (mode === 'locked') {
    wirePasswordForm();
    return;
  }

  const slot = document.querySelector<HTMLElement>('[data-letter-slot]');
  if (!slot) {
    return;
  }

  if (mode === 'replay') {
    void openEnvelope(slot);
    return;
  }

  // `open`: the server already rendered the final state; just settle the scene
  // in case the envelope markup is still around.
  const scene = readScene();
  if (scene) {
    jumpToOpenState(scene);
  }
}
