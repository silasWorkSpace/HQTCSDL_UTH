import { useContext } from 'react';
import { I18nContext } from './I18nContext';

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      lang: 'vi',
      setLang: () => {},
      t: (key) => key,
      formatDate: (d) => d || '—',
      formatDateTime: (d) => d || '—',
    };
  }
  return context;
}
