// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mutual-aid-phoenix.pages.dev",
  i18n: {
    locales: ["en", "es"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: true,
    },
    fallback: {
      es: "en",
    },
  },
  redirects: {
    "/": "/en/",
  },
});
