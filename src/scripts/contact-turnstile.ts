type Turnstile = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
};
declare global { interface Window { turnstile?: Turnstile; } }

export function setupContactTurnstile(form: HTMLFormElement) {
  let token = '';
  let widgetId: string | undefined;
  const container = form.querySelector<HTMLElement>('[data-turnstile]');
  const status = form.querySelector<HTMLElement>('#verification-status');
  const setStatus = (message: string) => { if (status) status.textContent = message; };
  const failed = () => {
    token = '';
    setStatus('Verification could not load. Please reload the page or email Mike directly.');
  };
  const controller = {
    getToken: () => token,
    reset() {
      token = '';
      if (widgetId !== undefined) {
        setStatus('Checking your browser…');
        try { window.turnstile?.reset(widgetId); } catch { failed(); }
      }
    },
  };
  // Local, review and CMS previews never load Cloudflare or send email.
  if (!container || form.dataset.preview === 'true') return controller;
  const sitekey = container.dataset.sitekey;
  if (!sitekey) { failed(); return controller; }
  setStatus('Checking your browser…');
  const timer = window.setTimeout(failed, 15000);
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onerror = () => { window.clearTimeout(timer); failed(); };
  script.onload = () => {
    window.clearTimeout(timer);
    if (!window.turnstile) { failed(); return; }
    try {
      widgetId = window.turnstile!.render(container, {
        sitekey,
        action: 'contact',
        theme: 'light',
        size: container.clientWidth < 300 ? 'compact' : 'flexible',
        'response-field': false,
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
        callback: (response: string) => { token = response; setStatus(''); },
        'expired-callback': () => { token = ''; setStatus('Verification expired. Checking again…'); },
        'timeout-callback': () => { token = ''; setStatus('Verification timed out. Please try the check again.'); },
        'error-callback': () => { failed(); return true; },
      });
    } catch { failed(); }
  };
  document.head.appendChild(script);
  return controller;
}
