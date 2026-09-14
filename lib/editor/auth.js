import { editorConfig, checkOrigin } from './config.js';
import { approvedEditor, rateLimit } from './db.js';
import { insist, EditorError } from './errors.js';
export const cookieName = 'velocity_staging_session';
export function readSessionCookie(request) {
  const raw = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  try { return raw ? decodeURIComponent(raw) : ''; } catch { return ''; }
}
export function sessionCookie(token, request, config, clear = false) {
  const origin = request.headers.get('origin');
  insist(config.origins.includes(origin), 403, 'Invalid editor origin.');
  return `${cookieName}=${encodeURIComponent(token)}; Path=/api/editor; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 86400}${origin.startsWith('https:') ? '; Secure' : ''}`;
}
export async function callAuth(path, config, { body, token, fetcher = fetch } = {}) {
  let response;
  try {
    response = await fetcher(`${config.authUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
  } catch { throw new EditorError(503, 'The login service is temporarily unavailable. Please try again.'); }
  if (!response.ok) {
    throw new EditorError(response.status === 429 ? 429 : response.status >= 500 ? 503 : 401,
      response.status === 429 ? 'Too many login attempts. Wait a few minutes before trying again.' : response.status >= 500 ? 'The login service is temporarily unavailable.' : 'This code or session is invalid or expired. Please request a new code.');
  }
  try { return await response.json(); } catch { throw new EditorError(503, 'The login service returned an invalid response.'); }
}
export async function requireEditor(request, env, dependencies = {}) {
  const config = editorConfig(env);
  if (request.method !== 'GET') checkOrigin(request, config);
  const token = readSessionCookie(request);
  insist(token && token.length <= 4096, 401, 'Sign in to use the editor. Your work has not been discarded.');
  const session = await callAuth('/get-session?disableCookieCache=true', config, { token, fetcher: dependencies.fetcher });
  insist(session?.session && Date.parse(session.session.expiresAt) > Date.now() && session.user?.id && session.user.emailVerified === true && typeof session.user.email === 'string', 401, 'Your session has expired. Sign in again to continue.');
  const editor = await (dependencies.approvedEditor || approvedEditor)(session.user.email, session.user.id, env);
  return { ...editor, token, config };
}
export async function sendCode(email, request, env, dependencies = {}) {
  const config = editorConfig(env); checkOrigin(request, config);
  const limit = dependencies.rateLimit || rateLimit;
  await limit('otp-global', 'staging', 20, 600, env);
  await limit('otp-send', email, 4, 600, env);
  // Separate delivery gate intentionally prevents sending Mike a setup email.
  if (!config.otpEmails.includes(email)) return;
  try { await (dependencies.approvedEditor || approvedEditor)(email, undefined, env); } catch (error) { if (error.status === 403) return; throw error; }
  await callAuth('/email-otp/send-verification-otp', config, { body: { email, type: 'sign-in' }, fetcher: dependencies.fetcher });
}
export async function verifyCode(email, otp, request, env) {
  const config = editorConfig(env); checkOrigin(request, config);
  await rateLimit('otp-verify-global', 'staging', 60, 600, env);
  await rateLimit('otp-verify', email, 8, 600, env);
  insist(config.otpEmails.includes(email), 401, 'This account is not enabled for setup.');
  await approvedEditor(email, undefined, env);
  const result = await callAuth('/sign-in/email-otp', config, { body: { email, otp } });
  insist(typeof result?.token === 'string' && result.token.length <= 4096 && result.user?.email?.toLowerCase() === email && result.user.emailVerified === true && result.user.id, 401, 'The login service could not verify this account.');
  await approvedEditor(email, result.user.id, env);
  // Never return the Neon bearer token in JSON to the browser.
  return sessionCookie(result.token, request, config);
}
