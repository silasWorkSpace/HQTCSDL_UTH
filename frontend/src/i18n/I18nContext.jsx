/* oxlint-disable react/only-export-components */
import React, { createContext, useState, useCallback } from 'react';
import { TRANSLATIONS } from './translations';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('ld_lang') || 'vi';
  });

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem('ld_lang', newLang);
  }, []);

  const t = useCallback(
    (keyPath, defaultText = '') => {
      if (!keyPath) return defaultText;
      const parts = keyPath.split('.');
      let current = TRANSLATIONS[lang] || TRANSLATIONS.vi;

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          // Fallback to Vietnamese if key is missing in English
          let fallback = TRANSLATIONS.vi;
          for (const fbPart of parts) {
            if (fallback && typeof fallback === 'object' && fbPart in fallback) {
              fallback = fallback[fbPart];
            } else {
              return defaultText || keyPath;
            }
          }
          return typeof fallback === 'string' ? fallback : defaultText || keyPath;
        }
      }

      return typeof current === 'string' ? current : defaultText || keyPath;
    },
    [lang]
  );

  const formatDate = useCallback(
    (isoDate) => {
      if (!isoDate) return '—';
      try {
        const d = new Date(isoDate);
        return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(d);
      } catch {
        return isoDate;
      }
    },
    [lang]
  );

  const formatDateTime = useCallback(
    (isoDate) => {
      if (!isoDate) return '—';
      try {
        const d = new Date(isoDate);
        return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d);
      } catch {
        return isoDate;
      }
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, formatDate, formatDateTime }}>
      {children}
    </I18nContext.Provider>
  );
}

export { I18nContext };
export { useI18n } from './useI18n';
