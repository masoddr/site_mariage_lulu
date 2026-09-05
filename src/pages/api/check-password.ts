import type { APIRoute } from 'astro';

// Rendered on demand by the Vercel adapter; the rest of the site stays static.
export const prerender = false;

/**
 * Verify the site password server-side against the `SITE_PASSWORD` secret.
 *
 * Scaffold stub (devbook step 4 will implement it). The password must never
 * reach the client bundle, which is why this check lives in a server route.
 */
export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
};
