# Mutual Aid in Phoenix

A community-run website for discovering mutual aid resources across the Greater Phoenix metro — fridges, distros, free tables, meals, and non-food resources. Inspired by [mutual-aid-in-philly.netlify.app](https://mutual-aid-in-philly.netlify.app/).

The project is pre-implementation. Planning docs live at the repo root.

## Key documents

### [ANALYSIS.md](./ANALYSIS.md)
Full analysis of the Philly reference site and the proposed stack for Phoenix. Read this first to understand the design space.

Contents:
- **Part 1** — Page-by-page breakdown of the reference site (purpose, features, implementation, pros/cons for each page).
- **Part 2** — Proposed stack for the Phoenix site (framework, map, content layer, hosting, forms, i18n, search, a11y tooling, analytics, CI/CD, monitoring, domain/email) with the reasoning behind each recommendation.
- **Part 3** — Additional ideas to consider (open-now filter, geolocation sort, PWA, accessibility filters, heat-emergency banner, governance, licensing, etc.).
- **Part 4** — Technologies at a glance (flat list of everything proposed).
- **Part 5** — Open questions that need decisions before implementation.

Treat ANALYSIS.md as a reference snapshot. Once a decision is made it's recorded in DECISIONS.md — the analysis doc isn't rewritten each time.

### [DECISIONS.md](./DECISIONS.md)
Running log of decisions that have been made, with dates, reasoning, and downstream implications. Open questions are kept at the bottom so they stay visible until resolved. When implementing, DECISIONS.md is the authoritative source for "what did we pick?" — ANALYSIS.md is where the tradeoffs are documented.

When a new decision is made:
1. Move the item from "Still open" to "Decided" in DECISIONS.md.
2. Add the date, the choice, the reasoning, and implementation implications.
3. Leave ANALYSIS.md alone unless the option space itself changed.

### [PLAN.md](./PLAN.md)
Step-by-step implementation plan for v1, written as a **GitHub-flavored checkbox list** so progress can be checked off inline. Phases 0–8 cover the build; a "Deferred automation" section at the bottom lists items (auto-deploys, CI gates, tile refresh cron) intentionally pushed past launch. Each phase has goals, concrete steps, exit criteria, and risk notes. Assumes all settled items in DECISIONS.md.

When implementing, work through PLAN.md phase by phase. Check off boxes as steps complete. Update it if phases get resequenced, new risks emerge, or scope changes — it should reflect the current intent, not the original intent.

### [ARCHITECTURE.md](./ARCHITECTURE.md)
Mermaid diagrams showing the runtime architecture: a system-overview flowchart plus sequence diagrams for five key flows (visitor loads map, volunteer edits a listing, volunteer adds a new listing with geocoding, contact form submission, monthly tile refresh). Also documents trust boundaries, secrets, and what the architecture buys us.

Keep ARCHITECTURE.md in sync when components are added/removed or flows change. If a phase in PLAN.md introduces a new component, update the relevant diagram in the same PR.

### [DATA_MODEL.md](./DATA_MODEL.md)
Canonical schema for the `Listing` entity — fields, enums, the `schedule` tagged union, and the invariants that must be enforced at build time. This is the authoritative shape; the Astro Content Collection's Zod schema and Decap CMS's `config.yml` both mirror it and must stay in sync with it.

When a field, enum value, or invariant changes, update DATA_MODEL.md first, then propagate to the Zod schema and Decap config in the same PR.

## Tooling & conventions

- **Package manager:** pnpm (enabled via corepack — `corepack enable && corepack prepare pnpm@latest --activate`). All commands use `pnpm` / `pnpm dlx`, never `npm` / `npx`.
- **Node:** 22 (current LTS; pinned via `.nvmrc`).
- **Wrangler:** installed as a dev dependency (`pnpm add -D wrangler`), run via `pnpm wrangler …`. Not installed globally.
- **Deploys (v1):** manual from laptop via `pnpm deploy` (`pnpm build && wrangler pages deploy ./dist`). GitHub → Pages auto-deploy is intentionally deferred until after Phase 5 — see PLAN.md's "Deferred automation" section.
- **Secrets:** stored as encrypted Cloudflare Pages env vars via `pnpm wrangler pages secret put …`. Never committed. Two distinct GitHub integrations: an OAuth App for volunteer CMS login, and a separate GitHub App for server-side Issue creation from the contact form.

## Working on this project

- When the user asks a design question, check DECISIONS.md first — don't relitigate settled choices.
- When the user asks about tradeoffs, ANALYSIS.md has the full menu.
- When implementing, PLAN.md is the authoritative "what do we do next" — stick to the current phase unless the user explicitly redirects. Check off completed items as you go.
- Do not use `npm` / `npx` in commands or docs — use `pnpm` / `pnpm dlx`.
