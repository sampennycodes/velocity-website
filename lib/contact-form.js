// Shared defaults and field identities for the form, preview and submission handler.
export const contactFormFields = [
  { id: 'name', key: 'name', label: 'Name', required: true, error: 'Please enter your name.' },
  { id: 'email', key: 'email', label: 'Email', required: true, error: 'Please enter your email address.' },
  { id: 'phone', key: 'phone', label: 'Phone Number', required: false, error: 'Please enter your phone number.' },
  { id: 'referralSource', key: 'referral', label: 'How did you hear about us?', required: false, error: 'Please tell us how you heard about us.' },
  { id: 'referralOther', key: 'referralOther', label: 'Other — please specify', required: true, error: 'Please specify how you heard about us.' },
  { id: 'message', key: 'message', label: 'Message', required: true, error: 'Please tell me a little about what you need.' },
];

export function formFieldSettings(values) {
  return Object.fromEntries(contactFormFields.map(field => [field.id, {
    required: values[`shared.form.${field.key}Required`] ?? field.required,
    showMarker: values[`shared.form.${field.key}ShowMarker`] ?? true,
  }]));
}
