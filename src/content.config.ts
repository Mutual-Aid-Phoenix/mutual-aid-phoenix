import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { listingSchema, pageSchema } from "./lib/schema";

// Schema lives in src/lib/schema.ts so it can be shared between Astro's
// build-time validation and the admin bundle (src/admin/custom-widgets.tsx).
// Adding Astro-runtime concerns (loaders, defineCollection) here keeps the
// schema module browser-safe.

const listings = defineCollection({
  loader: glob({ pattern: "**/*.{md,yml,yaml}", base: "./src/content/listings" }),
  schema: listingSchema,
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: pageSchema,
});

export const collections = { listings, pages };
