import { vi as reviewsVi } from '../../features/reviews/i18n';
import { vi as suggestionsVi } from '../../features/suggestions/i18n';

// Gộp các từ điển giao diện
const translationData = {
  vi: {
    ...reviewsVi,
    ...suggestionsVi,
  },
  en: {
    ...reviewsVi,
    ...suggestionsVi,
  },
};

function resolvePath(obj, path) {
  if (!obj || !path) return null;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

export function useTranslation() {
  const language = typeof window !== 'undefined' ? (localStorage.getItem('ld_lang') || 'vi') : 'vi';
  const dict = translationData[language] || translationData.vi;

  const t = (key, options = {}) => {
    let text = resolvePath(dict, key);
    if (typeof text !== 'string') {
      text = options.defaultValue || key;
    }
    // Interpolation: {{var}}
    if (typeof text === 'string' && options) {
      Object.keys(options).forEach((k) => {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(options[k]));
      });
    }
    return text;
  };

  return {
    t,
    i18n: {
      language,
      changeLanguage: (lng) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ld_lang', lng);
          window.location.reload();
        }
      },
    },
  };
}

export default {
  useTranslation,
};
