import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import hiCommon from "./locales/hi/common.json";
import bnCommon from "./locales/bn/common.json";
import mrCommon from "./locales/mr/common.json";
import teCommon from "./locales/te/common.json";
import taCommon from "./locales/ta/common.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeName: "বাংলা" },
  { code: "mr", label: "Marathi", nativeName: "मराठी" },
  { code: "te", label: "Telugu", nativeName: "తెలుగు" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const resources = {
  en: { common: enCommon },
  hi: { common: hiCommon },
  bn: { common: bnCommon },
  mr: { common: mrCommon },
  te: { common: teCommon },
  ta: { common: taCommon },
};

// Initialize i18next
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS: "common",
      fallbackLng: "en",
      supportedLngs: ["en", "hi", "bn", "mr", "te", "ta"],
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "sahayak_lang",
        caches: ["localStorage"],
      },
      interpolation: {
        escapeValue: false, // React already escapes values
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
