import type { APIRoute } from 'astro';
import { SITE_PASSWORD } from 'astro:env/server';

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isPasswordCorrect,
} from '../../lib/session';

// Rendered on demand by the Vercel adapter; the rest of the site stays static.
export const prerender = false;

/**
 * Every answer takes at least this long. It hides the cost difference between
 * a malformed body and a wrong password, and caps brute-force throughput.
 */
const MIN_RESPONSE_MS = 400;

interface CheckPasswordBody {
  password?: unknown;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function padDuration(startedAt: number): Promise<void> {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

/**
 * Verify the site password and open an unlocked session.
 *
 * The password itself never reaches the browser: the client only learns whether
 * its submission was accepted, and receives an httpOnly signed cookie.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const startedAt = Date.now();

  let submitted = '';
  try {
    const body = (await request.json()) as CheckPasswordBody;
    if (typeof body.password === 'string') {
      submitted = body.password;
    }
  } catch {
    // Malformed JSON is treated as a wrong password, to stay indistinguishable.
  }

  if (!(await isPasswordCorrect(submitted, SITE_PASSWORD))) {
    await padDuration(startedAt);
    return json({ ok: false, error: 'Ce mot de passe ne correspond pas.' }, 401);
  }

  cookies.set(SESSION_COOKIE, await createSessionToken(SITE_PASSWORD), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  await padDuration(startedAt);
  return json({ ok: true }, 200);
};
