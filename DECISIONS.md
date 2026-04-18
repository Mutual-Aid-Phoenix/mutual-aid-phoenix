# Project Decisions

Running log of decisions made for the Mutual Aid in Phoenix project. Each entry captures the decision, the date, and any relevant context. Open questions are kept at the bottom so they stay visible until resolved.

See [ANALYSIS.md](./ANALYSIS.md) for the full options and tradeoffs behind these decisions.

---

## Decided

### Hosting: Cloudflare Pages
- **Decided:** 2026-04-16
- **Choice:** Cloudflare Pages (primary hosting).
- **Why:** Unlimited bandwidth on the free tier, global edge, free custom domain + TLS, preview deploys per PR, free Pages Functions available if we need a tiny API later. Better free-tier ceiling than Netlify for a site that must stay up under load spikes without a billing account.
- **Implications:**
  - Forms will need a non-Netlify solution (Pages Functions, Web3Forms, or Formspree).
  - Static assets and the map tile file can live on Cloudflare R2 (zero egress) for additional headroom.
  - CI/CD will deploy via GitHub → Cloudflare Pages integration.

### Launch languages: English + Spanish
- **Decided:** 2026-04-16
- **Choice:** Ship v1 with English and Spanish only. Structure the codebase so additional locales can be added later without refactoring.
- **Why:** Covers the largest non-English-primary population in Greater Phoenix immediately. Keeps translation workload manageable for a volunteer-driven project. Auto-translation is off the table for a trust-critical site — human-reviewed translations only.
- **Implications:**
  - Astro i18n routing (`/en/`, `/es/`) from day one.
  - Translation files structured per-locale (JSON or YAML) so translators don't touch code.
  - Language switcher in the header; preserves the current route when switching.
  - Additional languages (Vietnamese, Diné bizaad, Arabic, Somali) remain viable future additions.

### Geographic scope: Greater Phoenix metro
- **Decided:** 2026-04-16
- **Choice:** Greater Phoenix metropolitan area (not just the city of Phoenix, not limited to Maricopa County boundaries).
- **Why:** Mutual aid networks and the people who rely on them don't respect city lines. Tempe, Mesa, Glendale, Scottsdale, Chandler, Avondale, etc. are all functionally part of the same aid ecosystem.
- **Implications:**
  - Map default viewport should frame the metro, not downtown Phoenix.
  - Region filters on the list view should reflect metro sub-areas (e.g., West Valley, East Valley, Central Phoenix, South Phoenix, North Phoenix), not just Phoenix neighborhoods.
  - Listings schema needs a `region` field with a metro-wide enum.
  - PDFs / printables (if we do them) should cover metro sub-regions.

### Map stack: MapLibre GL JS + Protomaps on Cloudflare R2
- **Decided:** 2026-04-16
- **Choice:** MapLibre GL JS as the map renderer; a single self-hosted Protomaps `.pmtiles` file for the Greater Phoenix metro, served from Cloudflare R2.
- **Why:** No API keys, no rate limits, no per-request billing. R2 has zero egress fees, so traffic spikes don't translate to surprise costs. Vector tiles render crisply on any zoom level and use less bandwidth than raster tiles. MapLibre is MIT-licensed, actively maintained, and a drop-in fork of Mapbox GL so the ecosystem of plugins and examples is deep.
- **Implications:**
  - Build pipeline needs a step (likely CI) to extract a metro-bounded `.pmtiles` file from the global Protomaps daily build, then upload it to R2. Document the refresh cadence (monthly is probably plenty).
  - R2 bucket needs public read + a Cloudflare cache rule for long TTLs on the `.pmtiles` file.
  - Custom SVG pin icons for distro / fridge / free table / meals / other (matching the reference site's taxonomy) — shipped as static assets.
  - Accessibility plan for the map is non-negotiable: every pin must have a corresponding list-view entry, a "skip map" link before the map, focus-trapped popups, and keyboard-reachable pins. The reference site flagged this as a known gap — we should not ship with the same gap.
  - Need a `<noscript>` / graceful fallback that routes map-view visitors without JS to the list view.
  - Fallback plan if Protomaps tooling becomes a burden: MapTiler free tier (100k tile loads/month) is a drop-in swap since MapLibre stays the same.

### Content editing workflow: Decap CMS with per-volunteer GitHub accounts
- **Decided:** 2026-04-16
- **Choice:** Decap CMS mounted at `/admin/`. Volunteers sign in with their own GitHub accounts through a GitHub OAuth App, with token exchange handled by a small Pages Function at `functions/api/auth`. No git-gateway, no custom auth UI.
- **Why:** Initially picked Sveltia (a newer Svelte-based reimplementation) to avoid running an OAuth proxy, but Sveltia's docs list custom field types as "unimplemented." Decap is the more mature, widely-deployed fork with a stable `registerWidget` API and a large ecosystem of third-party widgets. The cost of switching is a ~30-line OAuth token-exchange Pages Function, which runs comfortably in Cloudflare's free tier (100k requests/day; our volunteer-login traffic is a handful of requests per week). Net: we trade a tiny proxy for a more mature CMS and the option to build an inline geocoding widget later.
- **Implications:**
  - Create a GitHub OAuth App (distinct from the GitHub App used server-side for contact-form Issues). Client ID in `public/admin/config.yml`; client secret as an encrypted Pages env var consumed by `functions/api/auth`.
  - Decap lives as static files at `public/admin/index.html` + `public/admin/config.yml`, loading Decap's JS from its CDN.
  - All user-facing strings (nav, buttons, copy) must live in translation files or content frontmatter from day one, not hard-coded in `.astro` components, so the CMS can reach them.
  - Decap's config schema must be kept in sync with the Astro content-collection Zod schema — two places to update when fields change. Document this in CONTRIBUTING.md.
  - All Decap collections (listings, pages) commit **direct-to-`main`** — no editorial workflow, no PR review. Chosen 2026-04-17 for faster iteration: the volunteer pool is small and trusted, the Zod schema enforces correctness at build time, and `git revert` is always available if something bad lands. If moderation becomes necessary later, flip `publish_mode: editorial_workflow` back on per collection.
  - UI translation strings (`src/i18n/*.json`) are edited directly in the repo for v1 — not exposed as a Decap collection. A structured key/value editor widget is a possible future enhancement if volunteers need to change UI chrome without a PR.
  - Geocoding helper ships as a separate page for v1 (see geocoding decision below). Upgrade path: reimplement as an inline custom widget via `CMS.registerWidget` — this is the main capability we gained by switching from Sveltia, but not worth delaying launch for.
  - Contact-form backend uses Resend (email delivery); see the dedicated decision below.

### No custom domain at launch
- **Decided:** 2026-04-16
- **Choice:** Launch on the default Cloudflare Pages subdomain (`<project>.pages.dev`) rather than buying a custom domain for v1.
- **Why:** Removes the only recurring cost from the project (~$11/year) and avoids domain configuration work during initial build. Custom domain can be added at any time without affecting the codebase — it's purely a Cloudflare dashboard change.
- **Implications:**
  - Zero recurring cost at launch. Project runs entirely on free tiers.
  - Cloudflare Email Routing only receives mail, so sending must go through a third-party HTTP API. See the "Contact-form email" decision below for the current choice.
  - R2 tile file is served from R2's default public URL (e.g., `pub-<hash>.r2.dev`) instead of a custom subdomain. Works identically; the URL is just uglier in DevTools.
  - Social share preview images still work — OG tags just point to the `pages.dev` URL.
  - When we do add a custom domain later: update Pages domain settings, update canonical URLs in site metadata, update R2 public URL if we front it with a subdomain. ~30-minute change.

### Geocoding: Nominatim with editor validation, stored once in the listing
- **Decided:** 2026-04-16
- **Choice:** Addresses are geocoded exactly once, at the time a listing is created, using Nominatim (OpenStreetMap's free geocoder — no API key, no account, no billing). The editor visually validates the result on a preview map before saving. The validated `lat`/`lng` are written directly to the listing's markdown frontmatter and never re-geocoded on subsequent edits or builds.
- **Why:** Zero ongoing cost, no keys to guard, no rate-limit risk (write-time only, low volume). Editor-in-the-loop validation catches the ~10% of addresses that geocoders mis-resolve (ambiguous street names, new construction, apartment subunits). Storing coords in the frontmatter means the site has no geocoding dependency at build time or runtime — if Nominatim vanishes tomorrow, existing listings keep working.
- **Implications:**
  - Listing schema: `lat` and `lng` are **required** fields on every listing.
  - **All listings have exact, public locations.** We are not building fuzzy-location / private-pin behavior into the v1 schema. (If a specific site ever needs privacy, we'll revisit — but the default assumption is public.)
  - Implementation for v1: a standalone helper page at `public/admin/geocode.html` — address input → Nominatim candidate list → MapLibre preview (reusing our R2 tiles) → copyable lat/lng. Editor uses this alongside the Decap form. Simpler than a custom Decap widget, upgrade path exists later via `CMS.registerWidget` if editors request inline integration.
  - **Manual override is always available**: editor can paste in lat/lng they got another way (e.g., right-click in Google Maps → "What's here" gives coordinates without an API key). Necessary for ad-hoc community fridges, empty lots, and addresses Nominatim can't resolve.
  - CI adds a bbox check: any listing with `lat`/`lng` outside the Greater Phoenix metro bounding box fails the build. Catches typos and misgeocoded entries automatically.
  - Helper page must set an identifying `Referer` (Decap loads it from our origin, so the Pages domain serves as identification) and respect Nominatim's 1 req/sec usage policy.

### Contact-form email via Resend (supersedes GitHub Issue)
- **Decided:** 2026-04-18
- **Choice:** Contact-form submissions are emailed via [Resend](https://resend.com) to a single recipient address stored as a Cloudflare Pages env var (`CONTACT_RECIPIENT_EMAIL`). Fan-out to other humans, if ever needed, is handled by a Gmail forward rule on that inbox — not by code.
- **Why:** The original plan (submissions → GitHub Issue) assumed a triageable shared queue, but in practice we don't want community feedback posted to a public repo, nor do we want to direct anyone to our issue tracker. Email keeps submissions private and goes to a normal inbox. Cloudflare has no first-party outbound-email product (Email Routing only receives; MailChannels ended its free tier in mid-2024), so an HTTP email API is unavoidable. Resend's free tier (100/day, 3000/month) covers a small volunteer site indefinitely, and their shared sandbox sender (`onboarding@resend.dev`) works without DNS verification — no custom domain required at launch.
- **Why env var, not CMS-editable:** Resend's sandbox sender (`onboarding@resend.dev`) only delivers to the Resend account-owner email. That means changing the recipient address inside Decap would silently break delivery unless the Resend account itself changes too — a footgun for volunteers. Instead we keep the recipient pinned to the Resend account email via a Pages env var (rarely changes) and use inbox-side forwarding for fan-out. If we ever verify a custom domain on Resend (Phase 8), arbitrary recipients become possible and this decision can be revisited.
- **Implications:**
  - `functions/api/contact.ts` validates + verifies Turnstile + POSTs to Resend's `/emails` endpoint. Recipient is read at request time from `env.CONTACT_RECIPIENT_EMAIL`.
  - **Three Pages env vars** (all set via `pnpm wrangler pages secret put …` — using the "secret" mechanism for all three keeps them in one place, even though the recipient isn't strictly sensitive): `RESEND_API_KEY`, `TURNSTILE_SECRET`, `CONTACT_RECIPIENT_EMAIL`. Plus `PUBLIC_TURNSTILE_SITE_KEY` as a plain (non-secret) GitHub Actions repo secret read at build time.
  - **No GitHub-issues escape hatch anywhere.** All mentions ("Open a GitHub issue" fallback link, the noscript fallback, the pending-notice link) are removed from the frontend and the i18n files.
  - ARCHITECTURE.md flowchart and sequence diagram updated to swap `GHApp → Issues` for `Resend`.
  - The "GitHub App for contact form" implication in the Decap decision is obsolete — no server-side GitHub App is created.
  - If submission volume ever outgrows the free tier or we add a custom domain, we can verify a sender domain on Resend (DNS-only; code unchanged).

---

## Still open

_None. All decisions needed for v1 implementation have been made._
