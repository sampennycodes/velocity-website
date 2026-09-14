const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = (text: string) => { $('message').textContent = text; };
let canPublish = false;
let email = sessionStorage.getItem('velocity-setup-email') || ''; let jobId = ''; let busy = false; let uploading = false; let requestKey = crypto.randomUUID();
const activeStatuses = ['preparing', 'building', 'unknown'];
async function api(action: string, body?: object) {
  const response = await fetch(`/api/editor?action=${action}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) { $('login').hidden = false; }
    throw new Error(result.message || 'The request failed. Please try again.');
  }
  return result;
}
async function act(button: HTMLButtonElement, fn: () => Promise<void>) {
  if (busy) return; busy = true; button.disabled = true;
  try { await fn(); } catch (error) { message((error as Error).message); }
  finally { busy = false; button.disabled = false; }
}
async function load() {
  try {
    const session = await api('session');
    $('identity-email').textContent = session.email; $('login').hidden = true; $('workspace').hidden = false;
    message('Signed in. Complete the staging integration checks below.');
    const status = await api('status');
    $('storage-state').textContent = status.privateUploadsConfigured ? 'Private image storage is connected.' : 'Private image storage is awaiting Vercel configuration.';
    $<HTMLButtonElement>('upload-button').disabled = !status.privateUploadsConfigured;
    $('publish-state').textContent = status.publishingConfigured ? 'Staging publishing is configured.' : 'Staging publishing is awaiting project access and an approved source commit.';
    canPublish = status.publishingConfigured && session.role === 'owner';
    $<HTMLButtonElement>('publish-button').disabled = !canPublish;
    $('history').replaceChildren(); $('no-history').hidden = status.publications.length > 0;
    for (const row of status.publications) {
      const item = document.createElement('li'); const button = document.createElement('button'); button.className = 'secondary';
      button.textContent = `${new Date(row.created_at).toLocaleString()} · ${row.status}`;
      button.addEventListener('click', () => { jobId = row.id; void checkJob(); }); item.append(button); $('history').append(item);
    }
    const active = status.publications.find((row: { status: string }) => activeStatuses.includes(row.status));
    if (active) { jobId = active.id; $<HTMLButtonElement>('publish-button').disabled = true; await checkJob(); }
  } catch (error) { $('login').hidden = false; message((error as Error).message); }
}
$('email-form').addEventListener('submit', event => {
  event.preventDefault(); const button = $('email-form').querySelector('button')!;
  void act(button, async () => {
    email = $<HTMLInputElement>('email').value.trim().toLowerCase();
    const result = await api('send-code', { email }); sessionStorage.setItem('velocity-setup-email', email); message(result.message);
    $('email-form').hidden = true; $('code-form').hidden = false; $('otp').focus();
  });
});
$('code-form').addEventListener('submit', event => {
  event.preventDefault(); void act($('code-form').querySelector('button')!, async () => {
    await api('verify-code', { email, otp: $<HTMLInputElement>('otp').value });
    $<HTMLInputElement>('otp').value = ''; sessionStorage.removeItem('velocity-setup-email'); await load();
  });
});
$('change-email').addEventListener('click', () => { sessionStorage.removeItem('velocity-setup-email'); $('code-form').hidden = true; $('email-form').hidden = false; $('email').focus(); });
$('sign-out').addEventListener('click', () => { void act($('sign-out'), async () => {
  await api('sign-out', {}); $('workspace').hidden = true; $('login').hidden = false; $('email-form').hidden = false; $('code-form').hidden = true;
  $<HTMLImageElement>('image-preview').removeAttribute('src'); $('uploaded-image').hidden = true; $('history').replaceChildren(); jobId = ''; message('You are signed out.');
}); });
$('upload-form').addEventListener('submit', event => {
  event.preventDefault(); const file = $<HTMLInputElement>('image-file').files?.[0]; if (!file || uploading) return;
  if (file.size > 3 * 1024 * 1024) { message('Choose an image up to 3 MB.'); return; }
  uploading = true; $<HTMLButtonElement>('upload-button').disabled = true;
  const progress = $<HTMLProgressElement>('upload-progress'); progress.hidden = false; progress.value = 0;
  const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/editor?action=upload'); xhr.timeout = 60000;
  xhr.setRequestHeader('Content-Type', file.type); xhr.setRequestHeader('X-Image-Name', encodeURIComponent(file.name));
  xhr.setRequestHeader('X-Image-Description', encodeURIComponent($<HTMLTextAreaElement>('image-description').value));
  xhr.upload.onprogress = event => { if (event.lengthComputable) progress.value = event.loaded / event.total * 100; };
  xhr.onload = () => {
    try {
      const result = JSON.parse(xhr.responseText);
      if (xhr.status >= 400) { if ([401, 403].includes(xhr.status)) $('login').hidden = false; throw new Error(result.message); }
      const img = $<HTMLImageElement>('image-preview'); img.src = result.url; img.alt = result.description; img.width = result.width; img.height = result.height;
      $('uploaded-image').hidden = false; $('image-details').textContent = `${result.width} × ${result.height} · private WebP`;
      message('Private image uploaded. The website has not changed.');
    } catch (error) { message((error as Error).message || 'The upload failed. Please try again.'); }
  };
  xhr.onerror = xhr.ontimeout = () => message('The upload could not finish. Check your connection and retry.');
  xhr.onloadend = () => { uploading = false; $<HTMLButtonElement>('upload-button').disabled = false; progress.hidden = true; };
  xhr.send(file);
});
async function checkJob() {
  if (!jobId) return;
  try {
    const job = await api(`publish-status&id=${encodeURIComponent(jobId)}`);
    $('job-status').textContent = job.error || (job.status === 'ready' ? 'Staging build ready. Vercel confirmed the deployment.' : job.status === 'failed' ? 'Build failed. You can retry.' : 'Publishing to staging…');
    $('check-status').hidden = !activeStatuses.includes(job.status);
    const link = $<HTMLAnchorElement>('deployment-link'); link.hidden = job.status !== 'ready' || !job.url; if (job.url) link.href = job.url;
    $<HTMLButtonElement>('publish-button').disabled = !canPublish || activeStatuses.includes(job.status);
    if (['ready', 'failed'].includes(job.status)) requestKey = crypto.randomUUID();
  } catch (error) { message((error as Error).message); $('check-status').hidden = false; }
}
$('publish-button').addEventListener('click', () => { void act($('publish-button'), async () => {
  const job = await api('publish', { key: requestKey }); jobId = job.id; await checkJob();
}).finally(() => { if (jobId && !$('check-status').hidden) $<HTMLButtonElement>('publish-button').disabled = true; }); });
$('check-status').addEventListener('click', () => { void act($('check-status'), checkJob); });
window.addEventListener('beforeunload', event => { if (uploading) { event.preventDefault(); event.returnValue = ''; } });
if (email) { $<HTMLInputElement>('email').value = email; $('email-form').hidden = true; $('code-form').hidden = false; }
void load();
