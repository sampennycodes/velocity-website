export const TURNSTILE_ACTION = 'contact';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const HOSTNAMES = new Set(['velocitymarketing.com.au', 'www.velocitymarketing.com.au']);
const unavailable = () => ({ status: 503, body: { success: false, message: 'Verification is temporarily unavailable. Please try again or email Mike directly.' } });
const rejected = () => ({ status: 403, body: { success: false, message: 'Please complete the verification and try again.' } });

// Every real submission must pass Siteverify. Never trust browser-supplied
// success, hostname, action or preview flags, or forward contact details here.
export async function verifyContactTurnstile(token, env, fetchImpl = fetch) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || (env.VERCEL_ENV === 'production' && /^[123]x0{10}/.test(secret))) return unavailable();
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return rejected();
  try {
    const response = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) return unavailable();
    const result = await response.json();
    if (!result || typeof result.success !== 'boolean') return unavailable();
    if (!result.success || result.action !== TURNSTILE_ACTION || !HOSTNAMES.has(result.hostname)) return rejected();
    return null;
  } catch {
    return unavailable();
  }
}
