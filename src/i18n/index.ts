import en from "./en.json";
import es from "./es.json";
import { LOCALES, type Locale } from "../lib/schema";

// Every locale must have exactly the same key shape; `en` is the canonical
// structure and `es` is type-checked against it.
const dictionaries: Record<Locale, typeof en> = { en, es };

export { LOCALES, type Locale };
export const DEFAULT_LOCALE: Locale = "en";

// Resolve a dotted key (e.g. "nav.home") against a locale's dictionary.
// Throws at build time if the key is missing — silent fallbacks hide bugs.
export function t(locale: Locale, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, segment) => {
      if (acc && typeof acc === "object" && segment in acc) {
        return (acc as Record<string, unknown>)[segment];
      }
      return undefined;
    }, dictionaries[locale]);

  if (typeof value !== "string") {
    throw new Error(`Missing or non-string i18n key "${key}" for locale "${locale}"`);
  }
  return value;
}
