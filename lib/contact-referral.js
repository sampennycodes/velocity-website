export const referralOptions = [
  { value: 'word-of-mouth', label: 'Word of mouth' },
  { value: 'google-search', label: 'Google Search' },
  { value: 'other-search-engine', label: 'Search Engine (Other)' },
  { value: 'ai-assistant', label: 'AI Assistant (ChatGPT, etc.)' },
  { value: 'other', label: 'Other (Please specify)' },
];

export function referralError({ referralSource = '', referralOther = '' }, { enabled = true, required = false, otherRequired = true } = {}) {
  if (!enabled) return null;
  if (!referralSource) return required
    ? { field: 'referralSource', message: 'Please tell us how you heard about us.' }
    : null;
  if (!referralOptions.some(option => option.value === referralSource))
    return { field: 'referralSource', message: 'Please choose an option from the list.' };
  if (referralSource === 'other' && otherRequired && !referralOther.trim())
    return { field: 'referralOther', message: 'Please specify how you heard about us.' };
  return null;
}

export function referralAnswer({ referralSource = '', referralOther = '' }) {
  if (referralSource === 'other') return referralOther ? `Other: ${referralOther}` : 'Other';
  return referralOptions.find(option => option.value === referralSource)?.label || '';
}
