# Mutual Aid in Phoenix — Reference Site Analysis & Tech Plan

Reference: https://mutual-aid-in-philly.netlify.app/

This document analyzes the Philly reference site page-by-page, then proposes a stack for a Phoenix equivalent that prioritizes reliability, accessibility, maintainability, multilingual support, and aggressive use of free-tier services.

---

## Part 1 — Page-by-Page Analysis

### 1. Home (`/`)

**Purpose:** Welcome mat and philosophical framing. Explains what mutual aid is, who it's for ("Mutual Aid is for Everybody"), and routes visitors to the two discovery surfaces (Map View, List View).

**Features:**
- Hero with illustration (hands graphic) and a short mission statement.
- Plain-language explainer about dignified access to aid (no applications, no gatekeeping).
- Categorical teasers: free food distribution, harm reduction supplies, menstrual/postpartum items.
- Two primary CTAs → Map View and List View.
- Responsive top nav, skip-to-content link, dark-mode toggle, footer with site + external resource links.

**Implementation:**
- Static Astro page rendered at build time; zero JS required to read content.
- Tailwind-style utility classes; Lucide icons (moon/sun for dark mode toggle).
- Astro View Transitions for soft page swaps.

**Pros:**
- Fast (pre-rendered HTML, minimal hydration).
- Loads even on bad cellular — the audience most likely to need aid is often on constrained connections.
- Trivial to edit (Markdown/MDX content).

**Cons:**
- Static copy goes stale unless the team has a content-editing workflow.
- Single language only (`lang="en"`); no visible language switcher.

---

### 2. Map View (`/map-view/`)

**Purpose:** Primary discovery surface. "Where's the closest fridge/distro/meal right now?"

**Features:**
- Interactive Leaflet map with OpenStreetMap tiles (attribution link is the tell).
- Five custom pin icons: **Distro**, **Free Table**, **Fridge**, **Meals**, **Other** (non-food).
- Legend overlay showing each icon type.
- Popups open on pin click (content not inspected fully, but pattern matches name/description/hours/address).
- Static PDF maps for **North Philly**, **South Philly / Center City**, and **West Philly** for printable offline use.
- Links out to external "food finder" tools (Share Food Program, phila.gov).

**Implementation:**
- Leaflet.js + OSM raster tiles (free, no API key required if you respect OSM's tile usage policy, or you swap to a free tile CDN).
- Custom SVG pins served from `/media/*.svg`.
- Map data likely a static JSON file baked into the site at build time (no API calls visible).

**Pros:**
- Spatial search is the fastest way to answer "what's near me?"
- Leaflet is small (~42KB), MIT-licensed, zero vendor lock-in.
- OSM is free and doesn't require a billing account like Google Maps / Mapbox.

**Cons:**
- The site's own accessibility statement flags that **map keyboard navigation and pin accessibility still need work** — this is a known, hard problem with Leaflet.
- Raster tiles look dated vs. vector tiles (Mapbox/Maptiler). Minor.
- OSM public tile server has a usage policy that effectively prohibits high-traffic production use. For any real traffic you need a tile provider (see §3 below).

---

### 3. List View (`/list-view/`)

**Purpose:** Accessible, screen-reader-friendly alternative to the map. Also serves anyone who prefers scanning text, or whose device struggles with the map.

**Features:**
- Filters by **region** (Center City, North, Northeast, Northwest, South, Southwest, West) with "Select all".
- Filters by **resource type** (Food, Non-food).
- Each entry shows: name, resource-type tags (Distro / Fridge / Meals / Health / Resource center), description, days & times, and an address that links to Google Maps directions (`/maps/search/?api=1&…` — no API key needed).
- Appears to support a search bar ("use the list and search bar below").
- Alphabetized; single long scroll, no pagination.

**Implementation:**
- Likely static HTML generated from the same source-of-truth JSON that feeds the map.
- Client-side filter toggles (lightweight JS).

**Pros:**
- Completely usable with keyboard and screen readers.
- Prints well.
- Works offline once loaded.

**Cons:**
- Single long page doesn't scale forever — at ~500+ listings you'd want pagination, virtualization, or server-side search.
- Sort is alphabetical only (no "nearest to me," no "open now").

---

### 4. Contact (`/contact/`)

**Purpose:** Single inbound channel — feedback, corrections, requests to add new sites.

**Features:**
- Form with three fields: Name (optional), Email (optional), Feedback (required).
- Anonymous submission supported.
- Submits via `POST` with a hidden `form-name=form 1` input — **the unmistakable Netlify Forms signature**.

**Implementation:**
- Netlify Forms handles submissions server-side; no backend code. Free tier = 100 submissions/month.

**Pros:**
- No backend, no database, no spam-handler to maintain.
- Anonymity is a deliberate trust-building choice for a population that may distrust institutions.

**Cons:**
- 100 submissions/month is the Netlify free-tier ceiling (plenty for a local project, but worth knowing).
- No honeypot or reCAPTCHA visible; spam could eat the quota. Netlify has built-in Akismet + honeypot support that isn't toggled on here.
- No confirmation email to the submitter.

---

### 5. Accessibility Statement (`/accessibility-statement`)

**Purpose:** Formal commitment and escape hatch. Named contact path when something doesn't work.

**Features:**
- Claims **WCAG 2.2 Level AA** conformance (tested 2025-10-09).
- Enumerates implemented a11y features: semantic HTML, full keyboard nav, color contrast, logical focus order, skip links, responsive design, alt text, ARIA where needed.
- Honestly acknowledges gaps (map pins / keyboard nav on map).
- Directs users to the contact form for barrier reports.

**Pros:**
- Legal-ish posture + public accountability.
- Acknowledging known gaps is a trust signal.

**Cons:**
- Statements decay; needs a re-audit cadence.

---

### Cross-cutting features

- **Dark mode** (system-aware + manual toggle, persisted in localStorage).
- **Astro View Transitions** for smooth in-site navigation.
- **Skip-to-main-content** link for keyboard users.
- **Footer** with internal nav + two external resource partners.
- **Open Graph / meta** tags for link previews.
- **No analytics** visible in the markup (privacy-respecting, or just unconfigured).
- **No cookie banner** (none needed — no tracking).
- **No user accounts, no login, no PII storage** — an important design choice.

---

## Part 2 — Proposed Stack for Mutual Aid in Phoenix

Design goals, in priority order:
1. **Reliability & availability** — the page must load even under load, on bad networks, on old devices.
2. **Accessibility** — WCAG 2.2 AA is the floor, not the ceiling.
3. **Multilingual** — Phoenix has a large Spanish-speaking population; plan for at least English + Spanish, ideally pluggable for Vietnamese, Somali, Arabic, Diné bizaad (Navajo).
4. **Maintainability** — volunteers should be able to add a listing without opening a code editor.
5. **Free-tier friendly** — this is a community project; a credit card going dormant shouldn't take the site down.

### Core framework

| Choice | Why |
|---|---|
| **Astro** (same as reference) | Best-in-class static site generator for content-heavy sites. Ships zero JS by default. First-class i18n routing. Integrates cleanly with React/Vue/Svelte islands if we need interactivity. MIT. |
| **TypeScript** | Type safety on the data schema (listings) catches broken entries at build time, not after a volunteer commits. |
| **Tailwind CSS v4** | Consistent with the reference, tiny output, great a11y-friendly defaults via `@tailwindcss/forms`. |
| **Lucide icons** | Same icon family as reference; MIT; tree-shakable. |

### Map

| Choice | Why |
|---|---|
| **MapLibre GL JS** (preferred over Leaflet) | Vector tiles → crisper, rotatable, lower bandwidth. Drop-in alt to Mapbox GL. Fork-maintained, MIT. Better mobile performance. |
| **Protomaps** tiles, self-hosted as a single `.pmtiles` file on a CDN | **Free, no API keys, no rate limits.** A single `.pmtiles` file (~100–400 MB for a metro area) serves all vector tiles via HTTP range requests. Costs pennies on Cloudflare R2 (free egress) or even stays within Netlify's free bandwidth for small-metro traffic. This is the single biggest "leverage free plans heavily" decision in the stack. |
| **Fallback:** MapTiler free tier (100k tile loads/month) | If Protomaps is too much ops overhead, MapTiler's free tier is generous and well-documented. |
| **Leaflet** as a fallback | If MapLibre's a11y story proves worse than Leaflet's (it's roughly even), we can swap. Both support custom markers. |
| **Skip Google Maps / Mapbox paid** | Both require a billing account with a live credit card — violates the "dormant-card shouldn't kill the site" rule. |

**Accessibility plan for the map** (directly addressing the reference site's known gap):
- Every pin gets a corresponding entry in the list view with the same ID.
- A toggle "View as list" on the map page jumps to the list with the same filters applied.
- Pins are `role="button"` with accessible names; popups trap focus correctly.
- A "skip map" link appears before the map for keyboard users.

### Content / data layer

| Choice | Why |
|---|---|
| **Listings stored as Markdown + frontmatter** (or YAML) in the git repo, read by **Astro Content Collections** with a Zod schema | Volunteers edit via GitHub web UI (no local setup). PR review = built-in moderation. Schema validation at build time prevents broken entries. Full history for free. No database. |
| **Decap CMS** (formerly Netlify CMS) or **Sveltia CMS** on top of the git repo | Gives non-technical editors a WYSIWYG/form UI over the Markdown files. Free. Auth via GitHub or Netlify Identity (free tier). Sveltia is a modern, maintained Decap drop-in I'd pick today. |
| **Schema fields** (per listing) | `name`, `slug`, `type[]` (distro/fridge/free-table/meals/health/resource-center/other), `region`, `address`, `lat`, `lng`, `hours` (structured), `description`, `accessibility_notes`, `languages_spoken[]`, `contact`, `last_verified_date`, `source_url`. |

**Why not a database:** A Postgres/Firebase dependency adds a failure mode, a free-tier expiration risk, and a maintenance burden for what is fundamentally a small, slowly-changing dataset (probably <500 entries).

### Hosting & infrastructure

| Choice | Why |
|---|---|
| **Cloudflare Pages** (primary) | Unlimited bandwidth on free tier (vs. Netlify's 100 GB), global edge, free custom domain + TLS, preview deploys per PR, free Pages Functions if we need a tiny API. Strictly better than Netlify for a site that wants to stay free under load. |
| **Netlify** (acceptable alternative) | What the reference uses; Netlify Forms is genuinely convenient. Good fallback. |
| **Cloudflare R2** for the `.pmtiles` map file | **Zero egress fees.** A free-tier S3 would bill egress; R2 does not. |
| **GitHub** for source + Issues for "report a problem" | Free, ubiquitous. |

### Forms (contact / "add a listing" / "report a problem")

| Choice | Why |
|---|---|
| **Cloudflare Pages Function → Resend** (chosen; see DECISIONS.md) | Submissions go to a normal inbox, not a public tracker. Resend's free tier (100/day, 3000/month) more than covers volunteer-site volume; its shared sender works without DNS setup. Cloudflare itself has no outbound-email product — Email Routing only receives, and MailChannels ended its free tier in 2024. |
| **Originally considered: Pages Function → GitHub Issue** | Rejected 2026-04-18 — we don't want community feedback posted to a public repo and don't want to point anyone at our issue tracker. |
| **Alternative: Formspree** (50 submissions/month free) or **Web3Forms** (unlimited free) | Drop-in HTML form → email, no backend. Viable fallback if Resend ever changes terms. |
| **Honeypot + Cloudflare Turnstile** (free, privacy-respecting CAPTCHA) | Keeps spam from eating quota without hurting a11y or tracking users. |

### Internationalization (i18n)

| Choice | Why |
|---|---|
| **Astro's built-in i18n routing** (`/en/`, `/es/`, etc.) | First-class, static-friendly, SEO-friendly (`hreflang` tags auto-generated). |
| **Translation files as JSON/YAML** per locale, consumed via a tiny helper | Translators don't need to touch code. Works well with Crowdin/Weblate if volunteer translators grow beyond a spreadsheet. |
| **Crowdin (free for open source)** or **Weblate (self-hostable, free)** | Gives translators a real UI; plugs into GitHub via PRs. |
| **No auto-translate at runtime** | LibreTranslate / Google Translate widgets produce unreliable copy for a trust-critical site. Human-reviewed translations only. |
| **Start with English + Spanish**, structure the code for more | Pragmatic; covers the largest non-English-primary population in Phoenix immediately. |

**Language switcher** goes in the header next to the dark-mode toggle, with a locale selector that preserves the current route.

### Search & filtering (list view)

| Choice | Why |
|---|---|
| **Pagefind** (static search index generated at build) | Zero infra, works offline, ~20 KB runtime, WCAG-friendly. Ideal for our dataset size. |
| **Client-side filter state in URL query params** | Shareable links ("Fridges in West Phoenix open Sunday"); back button works. |

### Accessibility tooling

| Choice | Why |
|---|---|
| **axe-core via @axe-core/playwright** in CI | Fails the build on new a11y regressions. |
| **Pa11y** for scheduled full-site audits | Reports trend over time. |
| **Lighthouse CI** on every PR preview | Regression guard on perf + a11y + SEO. |
| **Manual screen-reader pass** (VoiceOver / NVDA) before launch and on major changes | Tools catch ~40%; humans catch the rest. |

### Analytics (optional, privacy-respecting)

| Choice | Why |
|---|---|
| **Cloudflare Web Analytics** (free, no cookies, no PII) | Enough to know which pages are used without tracking anyone. |
| **Plausible self-hosted** (only if needed) | Also privacy-friendly, open-source. |
| **Skip GA4** | Heavy, cookie-banner-inducing, tracks users we promised not to track. |

### CI/CD & quality gates

- **GitHub Actions**: lint, typecheck, build, axe, Lighthouse, link-check (`lychee`), dead-image check.
- **Dependabot / Renovate**: keep deps current.
- **Preview deploys per PR** (Cloudflare Pages does this free).
- **Branch protection**: require green checks + one reviewer on `main`.

### Monitoring & uptime

| Choice | Why |
|---|---|
| **UptimeRobot** (free, 50 monitors, 5-min interval) | Pages alerts to email/Slack when the site is down. |
| **Cloudflare status page** (built-in) | Infra-level visibility. |
| **Broken-link check in CI** | Listings go stale; catch dead external URLs on every build. |

### Domain & email

- Buy a `.org` domain (e.g., `mutualaidphx.org`) from **Porkbun** or **Cloudflare Registrar** (at-cost). ~$10–12/year — the only recurring cost in the stack.
- **Cloudflare Email Routing** (free): forward `contact@mutualaidphx.org` → a shared team inbox (Proton/Google).
- **SPF/DKIM/DMARC** configured from day one — lowers the chance of "add a listing" form submissions hitting spam when forwarded.

---

## Part 3 — Additional Ideas Worth Considering

These are suggestions — flag any you want to pull in or drop.

1. **"Open now" filter** — a static site can still compute this client-side from structured hours. Huge UX win for people who are hungry *right now*.
2. **"Nearest to me" sort** — browser Geolocation API, permission-gated, never stored. Falls back gracefully.
3. **Printable single-page region PDFs** — the Philly site does this well. Generate them at build time from the same data (e.g., Puppeteer in CI).
4. **QR code stickers / posters** — encourage physical distribution in shelters, libraries, clinics. Each QR can carry a UTM-like tag if you want to know which neighborhoods use them (optional).
5. **SMS-friendly short URL per listing** — e.g., `mutualaidphx.org/r/tempe-fridge` so volunteers can text a link.
6. **"Last verified" badge on each listing** — listings >90 days stale show a "verify this" button that opens a pre-filled Issue. Keeps data honest without a paid CMS.
7. **Offline-capable PWA** — `@vite-pwa/astro`. Install to home screen, works with no signal. Especially valuable for unhoused users with intermittent connectivity.
8. **Accessibility filter** — "wheelchair accessible," "ADA restroom," "no stairs," "trauma-informed staff" as filter chips. Data field + UI.
9. **Languages-spoken filter** — surface which sites have Spanish / Diné / Vietnamese speakers on site.
10. **Transit directions** — deep-link to Valley Metro / Google Maps transit mode, not just driving.
11. **"This site needs help" board** — sites can request specific donations (socks, formula, hygiene kits). Keeps the aid flowing both directions; embodies mutual aid principle.
12. **Data export** — publish the listings dataset as JSON/CSV at `/data.json` under an open license. Lets other orgs build on it. Harm-reduction orgs, academics, and journalists will use it.
13. **Status banner** component — for weather events, heat emergencies, cooling centers. Phoenix summers make this critical; a heat-wave banner with cooling-center-specific filter is a plausible life-saver.
14. **Community fridge photo-of-the-week / "what's in the fridge" updates** — only if volunteers can commit to keeping it fresh. Otherwise stale content erodes trust.
15. **Respectful imagery guidelines** in `CONTRIBUTING.md` — no photos of people receiving aid without consent; avoid "poverty porn."
16. **Licensing** — code under MIT or Apache-2.0; content (listings) under CC BY-SA 4.0 so forks must share back.
17. **Governance doc** — who has merge rights, how disputes are resolved, how a site gets removed. This isn't glamorous but it's what keeps small community projects from dying in year two.
18. **Budget line** — the only real cost is the domain (~$12/year). Document that in the README so future maintainers don't panic.

---

## Part 4 — Technologies at a Glance

**Frameworks & libraries**
- Astro (static site generator, i18n routing, content collections)
- TypeScript
- Tailwind CSS v4
- MapLibre GL JS (map) — or Leaflet as fallback
- Lucide (icons)
- Pagefind (static search)
- Zod (content schema validation)

**Services (all free tier, no credit card required to operate)**
- Cloudflare Pages (hosting, edge, preview deploys)
- Cloudflare R2 (map tile storage, zero egress)
- Cloudflare Web Analytics (privacy-respecting analytics)
- Cloudflare Turnstile (CAPTCHA)
- Cloudflare Email Routing (email forwarding)
- GitHub (source, Issues, Actions CI)
- Sveltia CMS or Decap CMS (editor UI for volunteers)
- Protomaps or MapTiler free tier (map tiles)
- Web3Forms or Formspree (form handler — if not using Pages Functions)
- UptimeRobot (uptime monitoring)
- Crowdin (free for OSS) or Weblate (translations)

**Quality & a11y tooling**
- axe-core + Playwright
- Pa11y
- Lighthouse CI
- Lychee (link checker)
- Renovate / Dependabot

**Recurring cost:** ~$12/year for the domain. Everything else runs on free tiers.

---

## Part 5 — What to Decide Next

Before we start building, I'd want your call on:
1. **Hosting** — Cloudflare Pages (my recommendation) vs. Netlify (simpler, matches the reference)?
2. **Map** — MapLibre + Protomaps (most free, slight ops overhead) vs. Leaflet + OSM free tiles vs. MapTiler free tier?
3. **CMS** — Pure git/Markdown with PR review, or layer Sveltia/Decap for non-technical editors from day one?
4. **Launch languages** — English + Spanish only at v1, or add one more (Vietnamese, Diné)?
5. **Scope** — Greater Phoenix metro, city of Phoenix only, or Maricopa County?
