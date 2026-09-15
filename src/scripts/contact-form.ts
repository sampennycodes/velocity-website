import { contactFormFields } from "../../lib/contact-form.js";

type FormSettings = {
  fields: Record<string, { required: boolean; showMarker: boolean }>;
  referral: { enabled: boolean };
};

export function syncContactForm(form: HTMLFormElement, settings?: FormSettings) {
  if (settings) form.dataset.formSettings = JSON.stringify(settings);
  const config: FormSettings = JSON.parse(form.dataset.formSettings!);
  const enabled = config.referral.enabled;
  const source = form.querySelector<HTMLSelectElement>("#referralSource")!;
  const other = form.querySelector<HTMLInputElement>("#referralOther")!;
  form.querySelector<HTMLElement>("#referral-question")!.hidden = !enabled;
  source.disabled = !enabled;
  const showOther = enabled && source.value === "other";
  form.querySelector<HTMLElement>("#referral-other-row")!.hidden = !showOther;
  other.disabled = !showOther;
  for (const definition of contactFormFields) {
    const field = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`#${definition.id}`)!;
    const policy = config.fields[definition.id];
    field.required = !field.disabled && policy.required;
    const marker = form.querySelector<HTMLElement>(`[data-field-marker="${definition.id}"]`)!;
    marker.textContent = field.required ? "*" : "(optional)";
    marker.className = field.required ? "required" : "optional";
    marker.hidden = !policy.showMarker;
    if (field.disabled || ((!field.required || Boolean(field.value.trim())) && field.validity.valid)) {
      field.removeAttribute("aria-invalid");
      form.querySelector<HTMLElement>(`#error-${field.id}`)!.hidden = true;
    }
  }
}
