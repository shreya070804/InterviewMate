import '@testing-library/jest-dom';
import { vi } from 'vitest';
import enTranslations from './src/locales/en.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const parts = key.split('.');
      let current: any = enTranslations;
      for (const part of parts) {
        if (current && typeof current === 'object') {
          current = current[part];
        } else {
          return key;
        }
      }
      if (typeof current === 'string') {
        let resolved = current;
        if (options) {
          Object.keys(options).forEach(optKey => {
            resolved = resolved.replace(`{{${optKey}}}`, String(options[optKey]));
          });
        }
        return resolved;
      }
      return key;
    },
    i18n: {
      changeLanguage: () => Promise.resolve(),
      language: 'en',
    }
  })
}));
