import React from 'react';
import { I18nProvider } from '../i18n/I18nContext';

export default function AppProviders({ children }) {
  return (
    <I18nProvider>
      {children}
    </I18nProvider>
  );
}
