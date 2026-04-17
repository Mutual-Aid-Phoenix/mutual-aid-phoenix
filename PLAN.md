# Implementation Plan

Step-by-step plan for building Mutual Aid in Phoenix v1, as a checkbox list. Check off items as they land. Assumes all decisions in [DECISIONS.md](./DECISIONS.md) are settled.

See [ANALYSIS.md](./ANALYSIS.md) for background on why each piece was chosen.

---

## What we're building

A static, bilingual (EN/ES), accessibility-first website for discovering mutual aid resources across the Greater Phoenix metro. Pages: Home, Map View, List View, Contact, Accessibility Statement. Volunteer-editable via a browser-based CMS. Hosted on Cloudflare Pages' free tier, **deployed manually from a laptop via `wrangler` for v1**, with near-zero ongoing cost (~$0/year at launch — no custom domain for v1).

**In scope for v1:**
- Home / Map View / List View / Contact / Accessibility Statement pages
- English + Spanish
- Decap CMS for volunteer editing
- Contact form → GitHub Issue
- Map with custom pins, list with filters + search
- Manual a11y pass (axe CLI + VoiceOver/NVDA) before launch; WCAG 2.2 AA target

**Explicitly deferred (future iterations):**
Custom domain, "open now" filter, geolocation sort, PWA/offline mode, additional languages, printable PDFs, heat-emergency banner, data export page, photo features, inline geocoding widget (custom Decap widget replacing the helper page), Cloudflare Access gate on `/admin/` for anonymous-volunteer flows.

**Automation deferred (see "Deferred automation" at the bottom):** GitHub → Pages auto-deploys, monthly tile refresh cron, CI a11y/perf/link gates, Renovate/Dependabot. Everything is deployed by hand from laptop for v1.

---

## Phase 0 — Prereqs + first manual deploy

Goal: a deployed "hello world" Astro site at `mutual-aid-phoenix.pages.dev`, published from laptop.

- [x] **Install tools (one-time):**
  - [x] Node 22 (`nvm install 22`)
  - [x] Enable pnpm via corepack: `corepack enable && corepack prepare pnpm@latest --activate`
  - [x] `gh` CLI — repo + Issue work
  - [x] `go-pmtiles` (`brew install protomaps/tap/go-pmtiles`) — for the tile step in Phase 3
- [x] Authenticate: `gh auth login`. (Wrangler logs in during the first deploy below.)
- [x] Create GitHub repo `mutual-aid-phoenix` (public) via `gh repo create`.
- [x] Scaffold Astro project with TypeScript + Tailwind CSS v4 (`pnpm create astro@latest`). Add `"packageManager": "pnpm@<version>"` to `package.json` so tooling pins to pnpm.
- [x] Add `wrangler` as a dev dep: `pnpm add -D wrangler`. Then `pnpm wrangler login`.
- [ ] Add baseline files: `README.md`, `LICENSE` (MIT), `.editorconfig`, `.gitignore`, `.nvmrc`.
- [x] First deploy: `pnpm build && pnpm wrangler pages deploy ./dist --project-name=mutual-aid-phoenix`. The first run creates the Pages project.
- [x] Add `"deploy": "pnpm build && wrangler pages deploy ./dist"` to `package.json` scripts. Every subsequent deploy is `pnpm deploy`.

**Exit criteria:** `pnpm deploy` publishes a hello-world Astro page to `mutual-aid-phoenix.pages.dev` over HTTPS.

---

## Phase 1 — Content model & i18n foundation

Goal: define the data shape once, so every subsequent phase reads from it.

- [x] Define an Astro Content Collection `listings/` with a Zod schema matching the shape in [DATA_MODEL.md](./DATA_MODEL.md). Store listings as Markdown files with YAML frontmatter under `src/content/listings/`.
- [x] Encode the build-time invariants from DATA_MODEL.md as Zod refinements — including the Greater Phoenix metro bounding-box check on `lat`/`lng`, required `weekly` or `monthly` cadence when `schedule.kind === "recurring"`, and i18n completeness for every `*` field across launch locales. Slug uniqueness is guaranteed by the filesystem (slug = filename stem).
- [x] Create `src/content/pages/` for editable page content (Home, Accessibility Statement) as Markdown with frontmatter. Structure: `src/content/pages/{locale}/{page-slug}.md`.
- [x] Create `src/i18n/en.json` and `src/i18n/es.json` for UI strings. Convention: **no hardcoded user-facing strings in `.astro` components** — everything routes through the translation files. A small `t(locale, key)` helper in `src/i18n/index.ts` resolves dotted keys and throws loudly on missing strings.
- [x] Configure Astro i18n routing: `/en/…` and `/es/…`, default locale `en`, redirect `/` → `/en/` (meta-refresh for v1; HTTP 301 via Cloudflare Pages `_redirects` tracked in Deferred automation). `hreflang` tags (plus `x-default`) emitted from the base layout.
- [x] Seed ~10 test listings covering all 5 regions, all 6 resource types, and all 4 `schedule.kind` variants (plus both weekly and monthly recurring branches). These are clearly fixtures — real verified listings come in Phase 8.

**Exit criteria:** `pnpm build` succeeds with the schema enforced. Broken listings (including out-of-bbox coordinates) fail the build with a clear error.

---

## Phase 2 — List view

Goal: a fully functional, accessible listings page — the fallback surface for anyone who can't use the map.

- [ ] Build the list view page at `/[locale]/list/`.
- [ ] Region filter chips (multi-select) and resource-type filter chips.
- [ ] URL-synced filter state (query params) so filtered views are shareable/back-button-safe.
- [ ] Integrate **Pagefind** for static full-text search across listings.
- [ ] Each listing card shows: name, type tags, description, hours (human-formatted from the structured data), address (links to Google Maps directions via the no-key `/maps/search/?api=1&query=…` URL).
- [ ] Sort: alphabetical by default. Leave sort-by-nearest as a future hook.
- [ ] "Last verified" date shown on each card; visually dim listings older than 90 days.
- [ ] Keyboard-navigable filter chips, proper heading hierarchy, semantic list markup.

**Exit criteria:** The list view is fully usable with keyboard only and with VoiceOver. `axe` CLI reports zero violations.

---

## Phase 3 — Map view (Protomaps + MapLibre)

Goal: the headline discovery surface, with accessibility parity the reference site lacks. Tile pipeline is manual for v1; cron automation deferred.

- [ ] **Tile pipeline (manual for v1):**
  - [ ] `pnpm wrangler r2 bucket create phoenix-metro-tiles` — create the bucket.
  - [ ] Enable public read access (CF dashboard, or `pnpm wrangler r2 bucket update --public`).
  - [ ] Download the latest Protomaps daily global `.pmtiles` build.
  - [ ] `pmtiles extract global.pmtiles phoenix-metro.pmtiles --bbox=<lon_min>,<lat_min>,<lon_max>,<lat_max>` — clip to metro (~200–400 MB output).
  - [ ] `pnpm wrangler r2 object put phoenix-metro-tiles/phoenix-metro.pmtiles --file phoenix-metro.pmtiles` — upload.
  - [ ] Document this sequence in CONTRIBUTING.md so anyone can refresh manually until we automate.
- [ ] Wire MapLibre GL JS to read tiles from R2 via the `pmtiles://` protocol adapter.
- [ ] Custom SVG pins for each `type` (distro / fridge / free-table / meals / other). Ship as static assets in `/public/media/`.
- [ ] Build the map view page at `/[locale]/map/`:
  - Map container with legend overlay.
  - Pins rendered from the same content collection as the list view.
  - Click a pin → popup with name, description snippet, hours, address, and a **"See full details in list"** link anchoring to that listing's ID on the list page.
- [ ] **Accessibility (non-negotiable):**
  - [ ] Skip-map link before the map for keyboard users.
  - [ ] A "View as list" button prominently placed on the map page.
  - [ ] Pins have accessible names; popups are focus-trapped and dismissible via Esc.
  - [ ] `<noscript>` block inside the map container that directs users to the list view.
- [ ] Default viewport frames the Greater Phoenix metro.

**Exit criteria:** Map loads under 2s on mid-tier mobile over 4G. Keyboard-only user can reach every listing on the map. `<noscript>` fallback works.

---

## Phase 4 — Static pages

Goal: round out the site with Home, Contact, and Accessibility Statement.

- [ ] **Home**: hero, mission statement, primary CTAs to Map + List. All copy pulled from `src/content/pages/home.md` + translation files so the CMS can edit it.
- [ ] **Contact**: form with Name (optional), Email (optional), Feedback (required), plus a Cloudflare Turnstile widget. Submits to a Pages Function (Phase 6).
- [ ] **Accessibility Statement**: Markdown page, mirrors the reference site's structure (WCAG 2.2 AA claim, implemented features, known limitations, contact path). Editable via CMS.
- [ ] **Shared layout**: header with nav + dark-mode toggle + **language switcher**; skip-to-main-content link; footer with internal + external resource links. All strings translated.

**Exit criteria:** All five pages render in both locales. Language switcher preserves the current page when toggling.

---

## Phase 5 — Decap CMS + geocoding helper

Goal: volunteers can add/edit listings and page content from a browser without touching code, and can geocode addresses without an API key.

- [ ] Create a GitHub OAuth App (GitHub → Settings → Developer settings → OAuth Apps). Callback URL: `https://mutual-aid-phoenix.pages.dev/api/auth/callback`. Client ID goes in `public/admin/config.yml`.
- [ ] Store the client secret: `pnpm wrangler pages secret put OAUTH_CLIENT_SECRET --project-name=mutual-aid-phoenix`.
- [ ] Write the OAuth proxy at `functions/api/auth.ts` (+ `functions/api/auth/callback.ts`): redirects to GitHub's `authorize` endpoint, receives the code on callback, exchanges it for an access token using the client secret, and returns the token to the Decap popup via `postMessage`. ~30 lines.
- [ ] Drop `public/admin/index.html` (loads Decap's JS from its CDN) and `public/admin/config.yml` into the repo.
- [ ] In `config.yml`, define collections:
  - **Listings** — maps to `src/content/listings/`, form fields mirror the Zod schema, commits default to PR workflow (Decap editorial workflow).
  - **Pages** — Home and Accessibility Statement, commits direct to `main`.
  - **Translations** — `src/i18n/*.json`, with Decap's i18n mode enabled for per-locale editing.
- [ ] `pnpm deploy`; verify the OAuth flow end-to-end: visit `/admin/`, sign in with GitHub, open and save a listing.
- [ ] **Build the geocoding helper page** at `public/admin/geocode.html`:
  - [ ] Plain HTML/JS, no framework. Linked from the Decap admin UI and from CONTRIBUTING.md.
  - [ ] Address input field.
  - [ ] Calls Nominatim (`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=<address>`), respecting the 1 req/sec usage policy and setting an identifying Referer.
  - [ ] Renders the top candidates as a list; clicking one drops a pin on a small MapLibre preview (reuses our R2 tiles).
  - [ ] Displays the validated `lat`, `lng` values ready to copy into the Decap listing form.
  - [ ] Fallback affordance: a "I'll enter coords manually" field so editors can paste in lat/lng from any source (Google Maps right-click, GPS reading, etc.).
  - Future upgrade path: reimplement as an inline custom widget via `CMS.registerWidget`. Noted in CONTRIBUTING.md as a wanted enhancement; out of scope for v1.
- [ ] Test with a secondary GitHub account (not an owner) to confirm the full volunteer experience: sign in → add a new listing → use geocode helper → paste coords → save → PR opens. **Note:** until we wire up GitHub→Pages auto-deploys (deferred), someone with deploy access still needs to `pnpm deploy` for volunteer edits to go live.
- [ ] Write `CONTRIBUTING.md` documenting: how to get access, the listings schema, moderation expectations, the geocode helper workflow, the manual tile refresh, the manual deploy step, and the note that Decap's config must stay in sync with the Zod schema.

**Exit criteria:** A non-owner volunteer can sign in, create a new listing (including geocoding its address via the helper), open a PR. A maintainer's `pnpm deploy` publishes the change. The bbox check catches bad coordinates at build time.

---

## Phase 6 — Contact form backend

Goal: feedback lands in a triageable queue.

- [ ] Create a GitHub App (distinct from the OAuth App in Phase 5). Permissions: issues write, metadata read. Install on the repo.
- [ ] Store credentials: `pnpm wrangler pages secret put GITHUB_APP_ID` and `pnpm wrangler pages secret put GITHUB_APP_PRIVATE_KEY`.
- [ ] Register a Turnstile site (CF dashboard). Site key goes inline in the form; `pnpm wrangler pages secret put TURNSTILE_SECRET` for the secret.
- [ ] Write `functions/api/contact.ts`:
  - [ ] Validates payload (required `feedback` field; optional name/email).
  - [ ] Verifies the Turnstile token server-side.
  - [ ] Mints an installation token from the GitHub App private key, opens an Issue in the repo labeled `feedback` and `needs-triage`.
  - [ ] Returns a success/failure JSON response.
- [ ] Add Cloudflare Rate Limiting rules on the function URL (free tier covers this).
- [ ] Frontend: progressive enhancement — the form posts to the Function; if JS fails, show a graceful error linking to the repo's Issues page as a fallback.

**Exit criteria:** Submitting the form opens a correctly labeled GitHub Issue. Spam submissions are blocked by Turnstile + rate limiting.

---

## Phase 7 — Manual quality pass

Goal: catch regressions by hand before launch. CI gates are deferred; these checks are run manually against the preview URL.

- [ ] `pnpm dlx @axe-core/cli <url>` against each page, both locales — zero violations.
- [ ] Lighthouse from Chrome DevTools — target ≥90 on performance, accessibility, best-practices, SEO.
- [ ] `pnpm dlx lychee` on built HTML — no dead external links in listings or static pages.
- [ ] **Manual screen-reader pass**: VoiceOver (Safari) and NVDA (Firefox) across all five pages, both locales.
- [ ] Enable Cloudflare Web Analytics (privacy-respecting, no cookies) — 2-minute dashboard click.
- [ ] Add a UptimeRobot monitor on the homepage (free tier, 5-min interval).

**Exit criteria:** All manual checks pass. Screen-reader coverage signed off. Analytics + uptime monitor live.

---

## Phase 8 — Launch prep

Goal: go from "it works" to "real people can rely on it."

- [ ] Seed with verified real listings — aim for at least 20–30 well-researched entries across the metro, covering each `type`. Partner with existing orgs where possible.
- [ ] Finish Spanish translations for all UI strings + page content. Ideally have a native speaker review before launch.
- [ ] Write supporting docs: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, a brief governance note (who has merge rights, how disputes resolve, how a listing gets removed).
- [ ] Listings content license: CC BY-SA 4.0. Code license: MIT. Include both in `LICENSE` files.
- [ ] Set up a shared team inbox or a regular Issue-triage rhythm so contact-form submissions get responses.
- [ ] **Soft launch**: share the `pages.dev` URL with 2–3 partner orgs, collect feedback for ~1–2 weeks, fix what they find.
- [ ] **Public launch**: share broadly once soft-launch feedback is addressed.

**Exit criteria:** Site is live with real data, a11y pass is signed off, feedback channel is actively monitored.

---

## Deferred automation

Pick these up after v1 is live. None are launch-blockers — each replaces manual work with CI.

- **Repo → CF Pages GitHub integration** — auto-deploys on push to `main` plus preview URLs per PR. Replaces `pnpm deploy`. This is the natural first thing to turn on once volunteer editing is active, since otherwise a maintainer has to redeploy for every Decap commit to go live.
- **`.github/workflows/refresh-tiles.yml`** — monthly cron that downloads Protomaps, runs `pmtiles extract`, uploads to R2, retains the previous version under a dated key. Opens an `ops`-labeled Issue on failure.
- **`.github/workflows/ci.yml`** — axe-core + Playwright, Lighthouse CI, lychee link check on PRs.
- **Pa11y weekly audit** — posts results to a GitHub Issue trend thread.
- **Renovate (or Dependabot)** — weekly dependency updates.
- **Upgrade `/` → `/en/` redirect to a proper HTTP 301** via a `public/_redirects` file (`/` → `/en/` with status `301`). Astro currently generates a meta-refresh HTML page at `/`, which works on any host but is slightly slower and less SEO-friendly than a real redirect. Cloudflare Pages reads Netlify-style `_redirects` natively, so this is a one-file change.

---

## What each phase produces

| Phase | Key artifacts |
|---|---|
| 0 | Tools installed, repo, Astro scaffold, `pnpm deploy`, first deploy live |
| 1 | Zod schema, i18n config, seed listings, translation files |
| 2 | List view page with filters + Pagefind search |
| 3 | `.pmtiles` in R2 (uploaded manually), MapLibre map page with a11y fallbacks |
| 4 | Home, Contact, Accessibility Statement, shared layout + language switcher |
| 5 | OAuth App, Decap at `/admin/`, `functions/api/auth.ts`, geocode helper, CONTRIBUTING.md |
| 6 | GitHub App, `functions/api/contact.ts`, Turnstile integration |
| 7 | Manual a11y/perf/link checks signed off; Analytics + UptimeRobot wired |
| 8 | Real listings, translations reviewed, docs, soft + public launch |

## Sequencing notes

- **Phases 0–4 are strictly sequential.** Each depends on the previous.
- **Phases 5 and 6 can run in parallel** after Phase 4.
- **Phase 7 (manual quality pass)** can start partial checks as early as Phase 2; full sign-off after Phase 6.
- **Phase 8 is the last gate** — real data and translation review are launch-blockers.

## Risks to watch

- **Manual deploy + Decap commits.** Until the GitHub→Pages integration is turned on (deferred), Decap volunteer edits create commits but don't auto-publish — a maintainer has to `pnpm deploy`. Fine for pre-launch (the user is the only editor); becomes annoying once volunteers are active. Expect to promote the Pages integration from "deferred" to "done" soon after Phase 5.
- **Protomaps tile extraction complexity.** First time through, budget a half-day. If it becomes a maintenance burden, swap to MapTiler free tier (no code change, just config).
- **Spanish translation quality.** Machine translation is off the table for a trust-critical site. Line up a native-speaker reviewer before Phase 8.
- **Listings going stale.** The `last_verified_date` field + the "report a problem" contact path are the mitigations; sustained volunteer stewardship is the real answer.
