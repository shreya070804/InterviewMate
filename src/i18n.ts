import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en.json';
import hiTranslation from './locales/hi.json';

// ============================================================================
// FUTURE LANGUAGE INTEGRATION REFERENCE:
// To add a new language (e.g., Spanish - 'es'):
// 1. Create a translation dictionary JSON file: `src/locales/es.json`.
// 2. Import the JSON translation file here:
//    `import esTranslation from './locales/es.json';`
// 3. Add the language definition to the `resources` dictionary below:
//    `es: { translation: esTranslation }`
// 4. Update the switcher UI in `src/components/Navbar.tsx` (both desktop and
//    mobile sections) to include the new language option (e.g. 🇪🇸 Spanish).
// ============================================================================

const resources = {
  en: {
    translation: enTranslation,
  },
  hi: {
    translation: hiTranslation,
  },
};

const savedLanguage = localStorage.getItem('language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safeguards against XSS (cross-site scripting) attacks
    },
  });

export default i18n;
