import gsap from 'gsap';

/**
 * Choreography of the envelope opening (devbook §1).
 *
 * The sequence is a single `gsap.timeline()` on purpose: the phases overlap,
 * and that overlap is what makes it read as one gesture rather than a queue of
 * separate animations. Nothing uses `ease: 'linear'`, which is what produces
 * the mechanical, old-school feel the devbook warns about.
 */

/** Elements the timeline drives, resolved once from the DOM. */
export interface SceneElements {
  /** Full-bleed background, pushed back once the letter takes over. */
  backdrop: HTMLElement;
  /** Wrapper holding the envelope and the password form. */
  stage: HTMLElement;
  /** The envelope itself, measured to scale the card travel. */
  envelope: HTMLElement;
  /** Wrapper that carries the rotation. */
  flap: HTMLElement;
  /** The artwork inside the flap, which carries the brightness. */
  flapFace: HTMLElement;
  card: HTMLElement;
  form: HTMLElement | null;
  /** Viewport-sized container of the letter; drives visibility. */
  slot: HTMLElement;
  /** The letter panel itself; drives the unfold. */
  panel: HTMLElement;
  shapes: HTMLElement[];
}

/** Tunables that differ between a phone and a desktop. */
interface Tempo {
  flap: number;
  card: number;
  unfold: number;
  stagger: number;
  /** Backdrop blur is expensive to composite on mobile GPUs, so it is dropped. */
  blurPx: number;
}

const DESKTOP_TEMPO: Tempo = { flap: 1.05, card: 0.95, unfold: 1.0, stagger: 0.08, blurPx: 7 };
const MOBILE_TEMPO: Tempo = { flap: 0.8, card: 0.7, unfold: 0.75, stagger: 0.05, blurPx: 0 };

/** How far the card rises, as a fraction of the envelope height. */
const CARD_RISE_RATIO = 0.62;

/** How far the flap swings. Stopping short of 180° reads as real paper. */
const FLAP_OPEN_DEGREES = -168;

/**
 * How much the backdrop is dimmed once the letter takes over.
 *
 * Darkening rather than fading matters: the backdrop sits over the page's cream
 * body background, so lowering its opacity would wash it out to grey instead of
 * pushing it back.
 */
const BACKDROP_RESTING_BRIGHTNESS = 0.55;

/** Brightness of the flap's inner face once it has swung over. */
const FLAP_SHADED_BRIGHTNESS = 0.82;

/** Closed state of the letter: a horizontal sliver, like folded paper. */
const PANEL_FOLDED_CLIP = 'inset(46% 0% 46% 0%)';
const PANEL_OPEN_CLIP = 'inset(0% 0% 0% 0%)';

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isSmallScreen(): boolean {
  return window.matchMedia('(max-width: 640px)').matches;
}

/**
 * Collect the elements of the scene.
 *
 * @param root - Element containing the scene.
 * @returns The elements, or `null` when the page has no opening sequence.
 */
export function readScene(root: ParentNode = document): SceneElements | null {
  const backdrop = root.querySelector<HTMLElement>('[data-backdrop]');
  const stage = root.querySelector<HTMLElement>('[data-envelope-stage]');
  const envelope = root.querySelector<HTMLElement>('[data-envelope]');
  const flap = root.querySelector<HTMLElement>('[data-envelope-flap]');
  const flapFace = root.querySelector<HTMLElement>('[data-envelope-flap-face]');
  const card = root.querySelector<HTMLElement>('[data-envelope-card]');
  const slot = root.querySelector<HTMLElement>('[data-letter-slot]');
  const panel = slot?.querySelector<HTMLElement>('[data-letter]') ?? null;

  if (!backdrop || !stage || !envelope || !flap || !flapFace || !card || !slot || !panel) {
    return null;
  }

  return {
    backdrop,
    stage,
    envelope,
    flap,
    flapFace,
    card,
    form: root.querySelector<HTMLElement>('[data-password-form]'),
    slot,
    panel,
    shapes: Array.from(panel.querySelectorAll<HTMLElement>('[data-shape]')),
  };
}

/**
 * Wait until freshly injected artwork is decoded.
 *
 * Without this the stagger would land on half-loaded images.
 *
 * @param root - Element whose images should be ready.
 */
export async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((image) => (image.decode ? image.decode().catch(() => undefined) : undefined)),
  );
}

/** Put the scene straight into its final state, with no animation. */
export function jumpToOpenState(scene: SceneElements): void {
  gsap.set(scene.stage, { autoAlpha: 0, display: 'none' });
  gsap.set(scene.slot, { autoAlpha: 1 });
  gsap.set(scene.panel, { scale: 1, clipPath: PANEL_OPEN_CLIP });
  gsap.set(scene.shapes, { autoAlpha: 1, y: 0, scale: 1 });
  gsap.set(scene.backdrop, { filter: `brightness(${BACKDROP_RESTING_BRIGHTNESS})` });
}

/**
 * Play the full opening sequence.
 *
 * Honours `prefers-reduced-motion` by jumping to the final state instead, as
 * required by devbook §1.3.
 *
 * @param scene - Elements returned by `readScene`.
 * @returns The timeline, which is awaitable, or `null` when motion is reduced.
 */
export function playOpeningSequence(scene: SceneElements): gsap.core.Timeline | null {
  if (prefersReducedMotion()) {
    jumpToOpenState(scene);
    return null;
  }

  const tempo = isSmallScreen() ? MOBILE_TEMPO : DESKTOP_TEMPO;
  const cardRise = scene.envelope.getBoundingClientRect().height * CARD_RISE_RATIO;

  const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (import.meta.env.DEV) {
    // Lets the choreography be stepped through frame by frame from the console
    // or a browser test. Stripped from the production bundle.
    (window as unknown as { __luluTimeline?: gsap.core.Timeline }).__luluTimeline = timeline;
  }

  timeline.set(scene.slot, { autoAlpha: 0 });
  timeline.set(scene.panel, { scale: 0.88, clipPath: PANEL_FOLDED_CLIP });
  timeline.set(scene.shapes, { autoAlpha: 0, y: 28, scale: 0.9 });

  if (scene.form) {
    timeline.to(scene.form, { autoAlpha: 0, y: 10, duration: 0.35 });
  }

  // The flap pivots on its top edge in 3D, dimming as its shadowed inner
  // face comes into view.
  timeline.to(
    scene.flap,
    { rotateX: FLAP_OPEN_DEGREES, duration: tempo.flap, ease: 'power2.inOut' },
    scene.form ? '<0.1' : 0,
  );
  timeline.set(scene.flapFace, { filter: 'brightness(1)' }, 0);
  timeline.to(
    scene.flapFace,
    { filter: `brightness(${FLAP_SHADED_BRIGHTNESS})`, duration: tempo.flap, ease: 'power1.in' },
    '<',
  );

  // The card starts sliding before the flap has finished swinging. That
  // overlap is what removes the "one step at a time" feel.
  timeline.to(scene.card, { y: -cardRise, duration: tempo.card }, `-=${tempo.flap * 0.45}`);

  // Hand over from the envelope to the full-screen letter.
  timeline.to(
    scene.stage,
    { autoAlpha: 0, scale: 0.95, duration: 0.55, ease: 'power2.inOut' },
    '+=0.12',
  );
  timeline.to(scene.slot, { autoAlpha: 1, duration: 0.3 }, '<0.1');
  timeline.to(
    scene.panel,
    { scale: 1, clipPath: PANEL_OPEN_CLIP, duration: tempo.unfold, ease: 'expo.inOut' },
    '<',
  );

  // The six shapes settle onto the letter, offset by `stagger` and eased with
  // `back` so each overshoots a hair before landing.
  timeline.to(
    scene.shapes,
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.7,
      stagger: tempo.stagger,
      ease: 'back.out(1.2)',
    },
    `-=${tempo.unfold * 0.35}`,
  );

  // The backdrop recedes behind the letter. Both ends of the tween declare
  // the same filter functions, so GSAP interpolates each one instead of
  // giving up on a mismatched list.
  timeline.set(scene.backdrop, { filter: 'blur(0px) brightness(1)' }, 0);
  timeline.to(
    scene.backdrop,
    {
      filter: `blur(${tempo.blurPx}px) brightness(${BACKDROP_RESTING_BRIGHTNESS})`,
      duration: 1.2,
      ease: 'power2.out',
    },
    '<-0.5',
  );

  return timeline;
}
