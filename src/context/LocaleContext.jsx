'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { MESSAGES } from '@/lib/i18n/messages';
import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  getStoredLocale,
  normalizeLocale,
  storeLocale,
} from '@/lib/i18n/locale';

const LocaleContext = createContext(null);

function lookup(tree, path) {
  let node = tree;
  for (const segment of path) {
    if (node == null || typeof node !== 'object') {
      return undefined;
    }
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template, params) {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] == null ? match : String(params[key]),
  );
}

function createTranslator(locale) {
  return (key, params, fallback) => {
    const path = String(key).split('.');
    const message =
      lookup(MESSAGES[locale], path) ?? lookup(MESSAGES[DEFAULT_LOCALE], path) ?? fallback;
    if (message == null) {
      return key;
    }
    return interpolate(message, params);
  };
}

export function LocaleProvider({ children }) {
  // Server renders the default locale; the stored choice lands after hydration.
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState(stored);
    applyDocumentLocale(stored);
  }, []);

  const setLocale = useCallback(next => {
    const normalized = normalizeLocale(next);
    setLocaleState(normalized);
    storeLocale(normalized);
    applyDocumentLocale(normalized);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      isKorean: locale === 'ko',
      t: createTranslator(locale),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

/** `t('home.heading')`, `t('output.layer', { index: 2 })`, `t(key, null, fallback)`. */
export function useT() {
  return useLocale().t;
}
