# Data Model

Single entity: **Listing**. A Listing represents one mutual aid offering at one physical location — a community fridge, a recurring meal distro, a resource center, or a one-off event. Scheduling flexibility is absorbed by the `schedule` tagged union, so we don't need separate Location and Event entities.

Notation:
- `*` — requires i18n (stored as `{ en, es }` at launch; structured so additional locales slot in later).
- `?` — optional field.
- Unmarked fields are required.

---

## Listing

### Identity & copy

| Field | Type | Notes |
|---|---|---|
| `name`* | string | Program name. e.g., "Mesa Mutual Aid Friday Distro". |
| `location_name`* | string | Physical site name. e.g., "Pilgrim Rest Church Parking Lot". May match `name` when the program and site are one and the same. |
| `description`* | string (Markdown) | What's offered, who it's for, what to expect. |
| `barriers_to_entry`* | string | Honest about requirements: ID, zip, referral, time windows, etc. Use "None" if truly open-door — silence reads as "unknown," not "open." |
| `accessibility_notes`* | string | Step-free entry, ADA restroom, trauma-informed staff, service-animal policy, sensory considerations. Free text, short. |

### Classification

| Field | Type | Notes |
|---|---|---|
| `resource_type[]` | enum[] | Physical form of the resource: `distro`, `fridge`, `free-table`, `meals`, `resource-center`, `other`. Multi-select. |
| `category[]` | enum[] | Domain of aid: `food`, `harm-reduction`, `medical`, `transportation`, `hygiene`, `clothing`, `shelter`, `other`. Multi-select. Start narrow; grow the enum as real listings demand it. |
| `region` | enum | Metro sub-region for list-view filtering: `central-phoenix`, `north-phoenix`, `south-phoenix`, `east-valley`, `west-valley`. One value. |
| `seasons`? | enum[] | `spring`, `summer`, `winter`, `fall`. Omit for year-round. Phoenix-specific: cooling centers are summer-only; winter shelters are winter-only. |

### Location

Nested under `location` in the frontmatter so the Decap "location" custom widget (one-click geocode + map preview) owns the full flow from a single field.

| Field | Type | Notes |
|---|---|---|
| `location.address_1` | string | Street address. |
| `location.address_2`? | string | Suite / unit / landmark. |
| `location.city` | string | |
| `location.state` | string | 2-letter code. Default `AZ`. |
| `location.zip_code` | string | **String, not number** — preserves leading zeros, supports ZIP+4 (`85001-1234`). |
| `location.lat` | number | Required. Written by the geocoding widget in Decap. |
| `location.lng` | number | Required. Build fails if outside the Greater Phoenix metro bounding box. |

### Access

| Field | Type | Notes |
|---|---|---|
| `languages_spoken[]` | string[] | ISO 639-1 codes of languages staff/volunteers speak on-site. e.g., `["en", "es"]`. Drives a list-view filter. |
| `contact`? | object | `{ phone?, email?, url? }`. All sub-fields optional. Omit the object entirely if none apply. |

### Schedule (tagged union)

Exactly one `kind` per listing.

**`always-open`** — community fridges, 24/7 free tables.

```yaml
schedule:
  kind: always-open
```

**`by-appointment`** — clinics, resource centers that require a call first.

```yaml
schedule:
  kind: by-appointment
  note*: "Call 602-555-0100 Mon–Fri 9am–5pm to schedule."
```

**`one-off`** — a specific-date event.

```yaml
schedule:
  kind: one-off
  date: 2026-05-17
  start_time?: "11:00"
  end_time?: "13:00"
```

**`recurring`** — the common case for ongoing distros and meal programs. Exactly one of `weekly` or `monthly` must be provided.

Weekly cadence:

```yaml
schedule:
  kind: recurring
  start_date?: 2026-01-01    # when this schedule began, if known
  end_date?: 2026-12-31      # when the program ends, if bounded
  weekly:                    # structured — parseable for "open now" later
    - { day: mon, start_time: "11:00", end_time: "13:00" }
    - { day: fri, start_time: "11:00", end_time: "13:00" }
```

Monthly cadence (e.g., "3rd Thursday of every month"):

```yaml
schedule:
  kind: recurring
  monthly:
    - { week: 3, day: thu, start_time: "18:00", end_time: "20:00" }
```

`week: 5` means "last week of the month." The structured shape (not a free-text string) is what enables a future "open now" filter without re-entering data.

### Provenance & freshness

| Field | Type | Notes |
|---|---|---|
| `last_verified_date` | date | ISO `YYYY-MM-DD`. Drives the "stale >90 days" visual treatment and the "verify this" prompt. |

---

## Enums at launch

Keep these small; grow them only when a real listing needs the new value.

- **`resource_type`**: `distro`, `fridge`, `free-table`, `meals`, `resource-center`, `other`
- **`category`**: `food`, `harm-reduction`, `medical`, `transportation`, `hygiene`, `clothing`, `shelter`, `other`
- **`region`**: `central-phoenix`, `north-phoenix`, `south-phoenix`, `east-valley`, `west-valley`
- **`seasons`**: `spring`, `summer`, `winter`, `fall`
- **`schedule.kind`**: `always-open`, `by-appointment`, `one-off`, `recurring`
- **`cadence_data[].day`**: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`

---

## Slugs

A listing's slug is its Markdown filename (without extension), not a frontmatter field. The `glob` content loader exposes it as the entry's `id`. Filesystem uniqueness guarantees slug uniqueness for free — no cross-entry validation needed. File names must be lowercase kebab-case (e.g., `mesa-mutual-aid-friday-distro.md`).

## Invariants enforced at build time

- `location.lat` and `location.lng` are required and must fall inside the Greater Phoenix metro bounding box (per DECISIONS.md).
- `schedule.kind === "one-off"` requires `date`.
- `schedule.kind === "recurring"` requires exactly one of `weekly` or `monthly` with at least one entry.
- If `schedule.kind === "recurring"` and both `start_date` and `end_date` are set, `start_date <= end_date`.
- `resource_type` and `category` each have at least one value.
- All `*` fields have entries for every launch locale (`en`, `es`).
- `last_verified_date` is not in the future.

---

## Implementation notes

- **Storage format:** YAML frontmatter on a Markdown file per listing, under `src/content/listings/`. All fields — including the long-form `description` — live in the frontmatter (as i18n objects using YAML's `|` block-scalar syntax for multi-line values). The Markdown body is unused today; reserved for per-locale rich content later if we need it.
- **Validation:** Astro Content Collections + Zod schema. The invariants above become Zod refinements.
- **i18n fields:** stored as nested objects (`name: { en: "...", es: "..." }`) so Decap's i18n mode and Astro's content layer both see them naturally.
- **Decap config parity:** the Decap `config.yml` collection schema must mirror the Zod schema. Both update together or the CMS form and the build diverge. Noted as a recurring risk in DECISIONS.md.
