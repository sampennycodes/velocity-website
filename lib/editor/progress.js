// Estimates describe recent successful publications; they are never a countdown
// or a percentage. Queueing and provider delays can exceed the usual range.
export function publicationEstimate(publications = []) {
  const seconds = publications.filter(job => job.status === 'ready').map(job =>
    (Date.parse(job.updated_at || job.updatedAt) - Date.parse(job.created_at || job.createdAt)) / 1000,
  ).filter(value => Number.isFinite(value) && value >= 3 && value <= 600).sort((a, b) => a - b);
  if (seconds.length < 3) return { minSeconds: 20, maxSeconds: 45 };
  return {
    minSeconds: Math.max(10, Math.round(seconds[0] * .8 / 5) * 5),
    maxSeconds: Math.max(30, Math.ceil(seconds.at(-1) * 1.35 / 5) * 5),
  };
}

export function publicationProgress(job, estimate, now = Date.now(), environment = job?.environment || 'staging') {
  const destination = environment === 'production' ? 'live' : 'staging';
  const name = environment === 'production' ? 'Live site' : 'Staging';
  const start = Date.parse(job?.createdAt || job?.created_at);
  const end = ['ready', 'failed'].includes(job?.status) ? Date.parse(job.updatedAt || job.updated_at) : now;
  const elapsed = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / 1000)) : 0;
  const duration = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  const usual = `Usually ${estimate.minSeconds}–${estimate.maxSeconds} seconds`;
  if (job?.status === 'ready') return { title: `${name} is up to date`, detail: `Updated in ${duration}. Your saved changes are visible on the ${destination} site.`, elapsed: '', active: false };
  if (job?.status === 'failed') return { title: `Saved · ${destination} update failed`, detail: `Your draft is safe. Retry the ${destination} update below.`, elapsed: '', active: false };
  if (!job) return { title: 'Saving your changes', detail: `${usual} to save and update the ${destination} site. Please keep this tab open until your draft is saved.`, elapsed: '', active: true };
  const title = job.phase === 'checking' ? `Saved · checking the ${destination} link` : job.phase === 'queued' ? 'Saved · waiting for the build to start' : job.status === 'unknown' ? 'Saved · waiting for build confirmation' : `Saved · building the ${destination} site`;
  const detail = elapsed > estimate.maxSeconds
    ? 'Taking longer than usual. Your draft is saved; we’re still checking. You can keep editing.'
    : `${usual}. Your draft is saved. You can keep editing while the ${destination} site updates.`;
  return { title, detail, elapsed: `${duration} elapsed`, active: true };
}
