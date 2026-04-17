---
title: Accessibility Statement
description: Our commitment to accessibility and how to report barriers you encounter.
last_updated: 2026-04-17
---

Mutual Aid in Phoenix is built to be usable by as many people as possible, including people who use screen readers, keyboards, voice control, or high-contrast displays. We target **WCAG 2.2 Level AA** conformance.

If something on this site gets in your way, we want to hear about it. Your report helps us fix the site for everyone.

## How to report a barrier

- Use the [Contact page](/en/contact/) to send us a note. You can submit feedback without leaving a name or email.
- If you prefer, open an issue on our [GitHub repository](https://github.com/Mutual-Aid-Phoenix/mutual-aid-phoenix/issues/new).

When you contact us, it helps to know:

- What page you were on and what you were trying to do.
- The assistive technology you were using (screen reader, keyboard, voice control, magnifier, etc.).
- The browser and operating system, if you know them.

We'll respond as soon as a volunteer can. There's no SLA — this is a community project — but accessibility reports go to the top of the queue.

## What we've built in

- **Keyboard-first navigation**: every interactive element — filters, search, map pins, language switcher, theme toggle — is reachable and operable with a keyboard.
- **Skip links**: a "Skip to main content" link is the first focusable element on every page. The map page adds a "Skip the map" link so keyboard users can bypass the map canvas.
- **Visible focus**: every focusable element shows a high-contrast focus ring.
- **Semantic structure**: proper heading hierarchy, landmark regions (`<header>`, `<nav>`, `<main>`, `<footer>`), and labeled form controls.
- **Map accessibility**: map pins have accessible names ("Community fridge — Example Fridge"); popups trap focus and dismiss with `Esc`; a prominent **View as list** button gives anyone a one-click escape hatch. A `<noscript>` fallback points to the list view when JavaScript is unavailable.
- **List view parity**: every resource on the map is also on the [List view](/en/list/), with the same information, full-text search, and filter controls.
- **Stale-listing indicator**: listings not verified in the last 90 days are visually dimmed and marked so you can judge trust at a glance.
- **Color and contrast**: text meets WCAG AA contrast ratios in both light and dark themes. Color is never the only way information is conveyed — filter chips, tags, and status indicators all use text labels too.
- **Respects user preferences**: the theme toggle defaults to your operating-system setting (`prefers-color-scheme`). We don't set tracking cookies.
- **Language**: every page is available in English and Spanish. The language switcher keeps you on the same page when you toggle.
- **Responsive text**: layouts reflow at 200% zoom and support browser text-size preferences.

## Known limitations

- **The interactive map requires JavaScript.** We mitigate this with a parity List view that works without JS, a `<noscript>` message inside the map, and the prominent **View as list** button.
- **Map pin popups** have been manually tested with VoiceOver and NVDA but haven't yet been through a full independent audit.
- **Some volunteer-submitted listings** may have incomplete accessibility notes (wheelchair access, restroom availability, etc.). We ask editors to fill these in; report gaps via Contact.
- **Map tile performance** on older mobile devices can be slow on first load while ~20 MB of vector tiles fetch. The list view is the faster option on constrained connections.

## Testing

Before each release we run:

- `axe-core` CLI against every page in both locales.
- Manual keyboard-only walkthrough.
- Manual screen-reader passes with VoiceOver (Safari) and NVDA (Firefox).
- Lighthouse audits targeting ≥90 on the Accessibility category.

Continuous in-browser audits are on the roadmap (see our [implementation plan](https://github.com/Mutual-Aid-Phoenix/mutual-aid-phoenix/blob/main/PLAN.md)). Until then, reports from people using the site are our best signal.

## Standards & scope

- **Target:** WCAG 2.2 Level AA, plus selected AAA criteria where practical.
- **Scope:** all pages under `mutual-aid-phoenix.pages.dev`, in English and Spanish.
- **Out of scope:** third-party embedded content (e.g., map tiles served by OpenStreetMap/Protomaps, Google Maps directions links opened in a new tab). We link to these because they're useful, but we can't guarantee their accessibility.

This statement was last reviewed on the date above.
