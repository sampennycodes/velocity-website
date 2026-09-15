import { insist } from './errors.js';
export const csv = value => (value || '').split(',').map(item => item.trim()).filter(Boolean);
export function editorConfig(env) {
  insist(env.EDITOR_ENABLED === 'true', 503, 'The editor is not enabled yet. Please contact Sam.');
  // The editor stays on its authenticated CMS host; publishing has a separate target.
  insist(env.EDITOR_ENVIRONMENT === 'staging' && env.VERCEL_ENV !== 'production', 503, 'This integration is available on staging only.');
  const origins = csv(env.EDITOR_ORIGINS);
  insist(origins.length > 0 && env.NEON_AUTH_BASE_URL && env.DATABASE_URL, 503, 'Editor setup is incomplete. Please contact Sam.');
  for (const origin of origins) {
    const u = new URL(origin);
    insist(u.origin === origin && (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))), 503, 'Editor origin configuration is invalid.');
    insist(!['velocitymarketing.com.au', 'www.velocitymarketing.com.au'].includes(u.hostname), 503, 'Production origins cannot use the staging editor.');
  }
  const auth = new URL(env.NEON_AUTH_BASE_URL);
  insist(auth.protocol === 'https:' && auth.hostname.endsWith('.neon.tech') && !auth.username && !auth.password && !auth.search && !auth.hash, 503, 'Authentication setup is invalid.');
  return { origins, authUrl: auth.href.replace(/\/$/, ''), otpEmails: csv(env.EDITOR_OTP_EMAILS).map(s => s.toLowerCase()) };
}
export function checkOrigin(request, config) {
  const origin = request.headers.get('origin');
  insist(config.origins.includes(origin), 403, 'Open the editor on its configured address and try again.');
  insist(!['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site')), 403, 'This request must come from the editor.');
}
export function publicationEnvironment(env) {
  const environment = env.EDITOR_PUBLISH_TARGET || 'staging';
  insist(['staging', 'production'].includes(environment), 503, 'The publishing destination is invalid. Contact Sam.');
  return environment;
}
export function checkPublicationEnvironment(requested, env) {
  // An older open tab must not silently switch from staging to live publishing.
  insist((requested || 'staging') === publicationEnvironment(env), 409, 'The publishing destination changed. Download any unsaved edits, then refresh the editor before publishing.');
}
export function publishConfig(env) {
  insist(env.EDITOR_PUBLISH_ENABLED === 'true', 503, 'Publishing is awaiting configuration.');
  insist(env.EDITOR_ENVIRONMENT === 'staging' && env.VERCEL_ENV !== 'production', 403, 'Publishing is only available from the configured editor.');
  insist(/^team_[A-Za-z0-9]+$/.test(env.EDITOR_VERCEL_TEAM_ID || '') && /^prj_[A-Za-z0-9]+$/.test(env.EDITOR_VERCEL_PROJECT_ID || '') && env.EDITOR_VERCEL_TOKEN, 503, 'Vercel publishing credentials are missing.');
  insist(/^[a-f0-9]{40}$/.test(env.EDITOR_APPROVED_SOURCE_SHA || ''), 503, 'An approved source commit is required.');
  return { environment: publicationEnvironment(env), team: env.EDITOR_VERCEL_TEAM_ID, project: env.EDITOR_VERCEL_PROJECT_ID, token: env.EDITOR_VERCEL_TOKEN, sha: env.EDITOR_APPROVED_SOURCE_SHA };
}
