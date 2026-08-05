export const LOCALES = ['en', 'ko'];

export const DEFAULT_LOCALE = 'en';

export const LOCALE_STORAGE_KEY = 'redrob-studio.locale';

export const LOCALE_LABELS = {
  en: 'EN',
  ko: '한국어',
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

export function normalizeLocale(value) {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getStoredLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(locale) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale));
  } catch {
    // Storage may be blocked (private mode); the toggle still works for the session.
  }
}

export function applyDocumentLocale(locale) {
  if (typeof document === 'undefined') {
    return;
  }
  const next = normalizeLocale(locale);
  const root = document.documentElement;
  root.lang = next;
  root.dataset.locale = next;
  root.classList.toggle('locale-ko', next === 'ko');
  root.classList.toggle('locale-en', next === 'en');
}
