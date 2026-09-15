import { insist } from './errors.js';
export function deploymentContentRevision(deployment, env) {
  const revision = deployment.meta?.velocityContentRevision;
  if (!revision) return null;
  insist(deployment.projectId === env.EDITOR_VERCEL_PROJECT_ID && deployment.ownerId === env.EDITOR_VERCEL_TEAM_ID && deployment.target == null, 403, 'Content build does not belong to the staging project.');
  insist(deployment.meta.velocityEnvironment === 'staging' && deployment.meta.velocitySourceSha === env.VERCEL_GIT_COMMIT_SHA, 403, 'Content build source does not match the saved revision.');
  insist(/^[0-9a-f-]{36}$/.test(revision), 400, 'Invalid content revision.');
  return revision;
}
