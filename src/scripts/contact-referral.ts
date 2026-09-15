export function syncReferralQuestion(form: HTMLFormElement, settings?: { enabled: boolean; required: boolean }) {
  if (settings) {
    form.dataset.referralEnabled = String(settings.enabled);
    form.dataset.referralRequired = String(settings.required);
  }
  const enabled = form.dataset.referralEnabled === "true";
  const required = enabled && form.dataset.referralRequired === "true";
  const source = form.querySelector<HTMLSelectElement>("#referralSource")!;
  const other = form.querySelector<HTMLInputElement>("#referralOther")!;
  form.querySelector<HTMLElement>("#referral-question")!.hidden = !enabled;
  source.disabled = !enabled;
  source.required = required;
  const marker = form.querySelector<HTMLElement>("#referral-marker")!;
  marker.textContent = required ? "*" : "(optional)";
  marker.className = required ? "required" : "optional";
  const showOther = enabled && source.value === "other";
  form.querySelector<HTMLElement>("#referral-other-row")!.hidden = !showOther;
  other.disabled = !showOther;
  other.required = showOther;
  for (const field of [source, other]) {
    if (field.disabled || field.validity.valid) {
      field.removeAttribute("aria-invalid");
      form.querySelector<HTMLElement>(`#error-${field.id}`)!.hidden = true;
    }
  }
}
