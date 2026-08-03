import { en } from "./en.js";
import { es } from "./es.js";

export const LANGUAGE_SETTINGS = ["auto", "en", "es"] as const;

export type LanguageSetting = (typeof LANGUAGE_SETTINGS)[number];
export type ResolvedLanguage = "en" | "es";
export type TranslationKey = keyof typeof en;

const LANGUAGE_SETTING_KEY = "language";
const dictionaries = { en, es } satisfies Record<ResolvedLanguage, Record<TranslationKey, string>>;

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return typeof value === "string" && LANGUAGE_SETTINGS.includes(value as LanguageSetting);
}

export function isTranslationKey(value: unknown): value is TranslationKey {
  return typeof value === "string" && value in en;
}

export function resolveLanguage(setting: LanguageSetting, languages = browserLanguages()): ResolvedLanguage {
  if (setting !== "auto") {
    return setting;
  }

  const preferred = languages.find(Boolean)?.toLowerCase() || "";
  return preferred.startsWith("es") ? "es" : "en";
}

export function createTranslator(language: ResolvedLanguage) {
  return function t(key: TranslationKey, replacements: Record<string, string> = {}): string {
    const template = dictionaries[language][key] || dictionaries.en[key] || key;

    return Object.entries(replacements).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, value),
      template
    );
  };
}

export function loadLanguageSetting(): LanguageSetting {
  const value = localStorage.getItem(LANGUAGE_SETTING_KEY);

  return isLanguageSetting(value) ? value : "auto";
}

export function saveLanguageSetting(setting: LanguageSetting): void {
  localStorage.setItem(LANGUAGE_SETTING_KEY, setting);
}

export function browserLanguages(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}
