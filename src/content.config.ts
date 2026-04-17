import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// ---------------------------------------------------------------------------
// Listings — canonical schema lives in DATA_MODEL.md. Keep these types, enums,
// and refinements in sync with that doc (and with Decap's config.yml once the
// CMS lands in Phase 5).
// ---------------------------------------------------------------------------

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

// Greater Phoenix metro bounding box. Intentionally generous — the purpose is
// catching gross errors (wrong hemisphere, transposed coords, typos), not
// pinpoint city-limit enforcement. Tighten later if editors report false
// positives from listings on the metro fringe.
export const PHOENIX_METRO_BBOX = {
  lat_min: 33.0,
  lat_max: 34.0,
  lng_min: -113.0,
  lng_max: -111.3,
} as const;

// An i18n string: one entry per launch locale. Additional locales slot in by
// extending LOCALES — the schema adapts automatically.
const i18nString = z.object(
  Object.fromEntries(LOCALES.map((l) => [l, z.string().min(1)])) as Record<
    Locale,
    z.ZodString
  >,
);

export const RESOURCE_TYPES = [
  "distro",
  "fridge",
  "free-table",
  "meals",
  "resource-center",
  "other",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
const resourceType = z.enum(RESOURCE_TYPES);

export const CATEGORIES = [
  "food",
  "harm-reduction",
  "medical",
  "transportation",
  "hygiene",
  "clothing",
  "shelter",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
const category = z.enum(CATEGORIES);

export const REGIONS = [
  "central-phoenix",
  "north-phoenix",
  "south-phoenix",
  "east-valley",
  "west-valley",
] as const;
export type Region = (typeof REGIONS)[number];
const region = z.enum(REGIONS);

const season = z.enum(["spring", "summer", "winter", "fall"]);

const dayOfWeek = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

// HH:MM 24-hour. Keep it a string so YAML doesn't coerce it to a number.
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");

const weeklySlot = z.object({
  day: dayOfWeek,
  start_time: timeOfDay,
  end_time: timeOfDay,
});

const monthlySlot = z.object({
  week: z.number().int().min(1).max(5), // 5 = "last"
  day: dayOfWeek,
  start_time: timeOfDay,
  end_time: timeOfDay,
});

const scheduleAlwaysOpen = z.object({
  kind: z.literal("always-open"),
});

const scheduleByAppointment = z.object({
  kind: z.literal("by-appointment"),
  note: i18nString.optional(),
});

const scheduleOneOff = z.object({
  kind: z.literal("one-off"),
  date: z.date(),
  start_time: timeOfDay.optional(),
  end_time: timeOfDay.optional(),
});

const scheduleRecurring = z.object({
  kind: z.literal("recurring"),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
  // Exactly one of `weekly` or `monthly` must be provided — enforced in Phase 2
  // alongside the rest of the build-time refinements.
  weekly: z.array(weeklySlot).optional(),
  monthly: z.array(monthlySlot).optional(),
});

const schedule = z.discriminatedUnion("kind", [
  scheduleAlwaysOpen,
  scheduleByAppointment,
  scheduleOneOff,
  scheduleRecurring,
]);

const contact = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

const listings = defineCollection({
  loader: glob({ pattern: "**/*.{md,yml,yaml}", base: "./src/content/listings" }),
  schema: z
    .object({
      // Identity & copy.
      // `slug` is the entry's filename stem — the glob loader supplies it as
      // `id`, and filesystem uniqueness gives us cross-entry uniqueness for
      // free. Not a frontmatter field.
      name: i18nString,
      location_name: i18nString,
      description: i18nString,
      barriers_to_entry: i18nString,
      accessibility_notes: i18nString,

      // Classification
      resource_type: z.array(resourceType).min(1),
      category: z.array(category).min(1),
      region: region,
      seasons: z.array(season).optional(),

      // Location
      address_1: z.string().min(1),
      address_2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().length(2).default("AZ"),
      // String, not number — preserves leading zeros and supports ZIP+4.
      zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits or ZIP+4"),
      lat: z.number(),
      lng: z.number(),

      // Access
      languages_spoken: z.array(z.string().length(2)),
      contact: contact.optional(),

      // Schedule
      schedule,

      // Provenance & freshness
      last_verified_date: z.date(),
      source_url: z.string().url().optional(),
    })
    .refine(
      ({ lat, lng }) =>
        lat >= PHOENIX_METRO_BBOX.lat_min &&
        lat <= PHOENIX_METRO_BBOX.lat_max &&
        lng >= PHOENIX_METRO_BBOX.lng_min &&
        lng <= PHOENIX_METRO_BBOX.lng_max,
      {
        message: `Coordinates are outside the Greater Phoenix metro bounding box (lat ${PHOENIX_METRO_BBOX.lat_min}–${PHOENIX_METRO_BBOX.lat_max}, lng ${PHOENIX_METRO_BBOX.lng_min}–${PHOENIX_METRO_BBOX.lng_max})`,
        path: ["lat"],
      },
    )
    .refine(({ last_verified_date }) => last_verified_date <= new Date(), {
      message: "last_verified_date cannot be in the future",
      path: ["last_verified_date"],
    })
    .superRefine((data, ctx) => {
      if (data.schedule.kind !== "recurring") return;

      const hasWeekly = (data.schedule.weekly?.length ?? 0) > 0;
      const hasMonthly = (data.schedule.monthly?.length ?? 0) > 0;
      if (hasWeekly === hasMonthly) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["schedule"],
          message:
            "Recurring schedule must provide exactly one of `weekly` or `monthly` with at least one entry",
        });
      }

      const { start_date, end_date } = data.schedule;
      if (start_date && end_date && start_date > end_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["schedule", "end_date"],
          message: "start_date must be on or before end_date",
        });
      }
    }),
});

// ---------------------------------------------------------------------------
// Pages — long-form editable page content (Home, Accessibility Statement,
// Contact copy). One entry per (page × locale), organized as
// `src/content/pages/{locale}/{page-slug}.md`. The entry `id` encodes both
// (e.g., `en/home`); templates filter by locale prefix.
// ---------------------------------------------------------------------------

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    last_updated: z.date().optional(),
  }),
});

export const collections = { listings, pages };
