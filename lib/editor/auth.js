import { editorConfig, checkOrigin } from './config.js';
import { approvedEditor, rateLimit } from './db.js';
import { insist, EditorError } from './errors.js';
export const cookieName = 'velocity_staging_session';
const providerCookieName = '__Secure-neon-auth.session_token';
const isProviderCookie = value => typeof value === 'string' && value.startsWith(`${providerCookieName}=`) && value.length <= 4096 && /^[^\s;,]+$/.test(value) && value.length > providerCookieName.length + 1;
function providerCookie(headers) {
  const cookie = headers.getSetCookie().map(value => value.split(';', 1)[0]).find(value => value.startsWith(`${providerCookieName}=`));
  insist(isProviderCookie(cookie), 503, 'The login service did not establish a session. Please request a new code.');
  return cookie;
}
const isCurrentSession = data => data?.session && Date.parse(data.session.expiresAt) > Date.now() && data.user?.id && data.user.emailVerified === true && typeof data.user.email === 'string';
export function readSessionCookie(request) {
  const raw = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  try { return raw ? decodeURIComponent(raw) : ''; } catch { return ''; }
}
export function sessionCookie(token, request, config, clear = false) {
  const origin = request.headers.get('origin');
  insist(config.origins.includes(origin), 403, 'Invalid editor origin.');
  return `${cookieName}=${encodeURIComponent(token)}; Path=/api/editor; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 86400}${origin.startsWith('https:') ? '; Secure' : ''}`;
}
export async function callAuth(path, config, { body, token, includeHeaders = false, fetcher = fetch } = {}) {
  // Neon uses a signed session cookie. The unsigned token in its JSON response
  // is not a substitute, even though the generated OpenAPI lists bearer auth.
  if (token) insist(isProviderCookie(token), 401, 'Please sign in again to update your editor session.');
  let response;
  try {
    response = await fetcher(`${config.authUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json', Origin: config.origins[0] } : {}), ...(token ? { Cookie: token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
  } catch { throw new EditorError(503, 'The login service is temporarily unavailable. Please try again.'); }
  if (!response.ok) {
    console.warn('Editor auth request rejected', { path: path.split('?')[0], status: response.status });
    throw new EditorError(response.status === 429 ? 429 : response.status >= 500 ? 503 : 401,
      response.status === 429 ? 'Too many login attempts. Wait a few minutes before trying again.' : response.status >= 500 ? 'The login service is temporarily unavailable.' : 'This code or session is invalid or expired. Please request a new code.');
  }
  let data;
  try { data = await response.json(); } catch { throw new EditorError(503, 'The login service returned an invalid response.'); }
  return includeHeaders ? { data, headers: response.headers } : data;
}
export async function requireEditor(request, env, dependencies = {}) {
  const config = editorConfig(env);
  if (request.method !== 'GET') checkOrigin(request, config);
  const token = readSessionCookie(request);
  insist(token && token.length <= 4096, 401, 'Sign in to use the editor. Your work has not been discarded.');
  const session = await callAuth('/get-session?disableCookieCache=true', config, { token, fetcher: dependencies.fetcher });
  if (!isCurrentSession(session)) console.warn('Editor session not recognized', { hasSession: Boolean(session?.session), verified: session?.user?.emailVerified === true });
  insist(isCurrentSession(session), 401, 'Your session has expired. Request a new code to sign in again.');
  const editor = await (dependencies.approvedEditor || approvedEditor)(session.user.email, session.user.id, env);
  return { ...editor, token, config };
}
export async function sendCode(email, request, env, dependencies = {}) {
  const config = editorConfig(env); checkOrigin(request, config);
  const limit = dependencies.rateLimit || rateLimit;
  await limit('otp-global', 'staging', 20, 600, env);
  await limit('otp-send', email, 4, 600, env);
  // Separate delivery gate permits codes only after an account is released.
  if (!config.otpEmails.includes(email)) return;
  try { await (dependencies.approvedEditor || approvedEditor)(email, undefined, env); } catch (error) { if (error.status === 403) return; throw error; }
  await callAuth('/email-otp/send-verification-otp', config, { body: { email, type: 'sign-in' }, fetcher: dependencies.fetcher });
}
export async function verifyCode(email, otp, request, env, dependencies = {}) {
  const config = editorConfig(env); checkOrigin(request, config);
  const limit = dependencies.rateLimit || rateLimit;
  const approve = dependencies.approvedEditor || approvedEditor;
  await limit('otp-verify-global', 'staging', 60, 600, env);
  await limit('otp-verify', email, 8, 600, env);
  insist(config.otpEmails.includes(email), 401, 'This account is not enabled for sign-in.');
  await approve(email, undefined, env);
  const { data: result, headers } = await callAuth('/sign-in/email-otp', config, { body: { email, otp }, includeHeaders: true, fetcher: dependencies.fetcher });
  insist(result?.user?.email?.toLowerCase() === email && result.user.emailVerified === true && result.user.id, 401, 'The login service could not verify this account.');
  const token = providerCookie(headers);
  const session = await callAuth('/get-session?disableCookieCache=true', config, { token, fetcher: dependencies.fetcher });
  insist(isCurrentSession(session) && session.user.id === result.user.id && session.user.email.toLowerCase() === email, 503, 'Sign-in could not be completed. Please request a new code.');
  await approve(email, session.user.id, env);
  console.info('Editor sign-in verified');
  // Keep the upstream signed cookie inside our own HttpOnly cookie, never JSON.
  return sessionCookie(token, request, config);
}
