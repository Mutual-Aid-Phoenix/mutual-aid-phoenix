# Architecture

Visual overview of how the pieces described in [DECISIONS.md](./DECISIONS.md) and [PLAN.md](./PLAN.md) fit together at runtime.

---

## System overview

Shows every moving part and who talks to whom. Colors group components by trust boundary.

```mermaid
flowchart TB
    classDef user fill:#fde68a,stroke:#b45309,color:#1f2937
    classDef browser fill:#bae6fd,stroke:#0369a1,color:#1f2937
    classDef cf fill:#fed7aa,stroke:#c2410c,color:#1f2937
    classDef gh fill:#d9f99d,stroke:#4d7c0f,color:#1f2937
    classDef ext fill:#e5e7eb,stroke:#4b5563,color:#1f2937

    Visitor["👤 Visitor<br/>EN or ES"]:::user
    Volunteer["🛠️ Volunteer editor"]:::user

    subgraph Browser["Browser runtime"]
        Site["Astro static site<br/>/en/… /es/…"]:::browser
        Map["MapLibre GL JS<br/>vector map"]:::browser
        Decap["Decap CMS<br/>/admin/"]:::browser
        Turnstile["Turnstile widget"]:::browser
    end

    subgraph CF["Cloudflare (free tier)"]
        Pages["Pages<br/>static hosting + CDN<br/>pages.dev subdomain"]:::cf
        ContactFn["Pages Function<br/>functions/api/contact.ts"]:::cf
        AuthFn["Pages Function<br/>functions/api/auth.ts<br/>OAuth proxy"]:::cf
        R2["R2 bucket<br/>phoenix-metro.pmtiles"]:::cf
        Analytics["Web Analytics<br/>cookieless"]:::cf
        TurnstileAPI["Turnstile API<br/>token verification"]:::cf
    end

    subgraph GH["GitHub"]
        Repo["Repo<br/>Astro code +<br/>listings + i18n files"]:::gh
        OAuthApp["GitHub OAuth App<br/>volunteer login"]:::gh
        Actions["Actions<br/>CI + monthly cron"]:::gh
    end

    subgraph Ext["External"]
        Proto["Protomaps<br/>daily global .pmtiles"]:::ext
        Resend["Resend<br/>transactional email"]:::ext
        Inbox["Recipient inbox<br/>(configured in site.json)"]:::ext
    end

    Visitor --> Site
    Volunteer --> Decap

    Site -- loads assets --> Pages
    Decap -- loaded from --> Pages
    Site --> Map
    Map -- "HTTP range<br/>requests" --> R2
    Site --> Analytics
    Site -- embeds --> Turnstile

    Site -- "POST /api/contact" --> ContactFn
    ContactFn -- verify token --> TurnstileAPI
    ContactFn -- "POST /emails" --> Resend
    Resend -- deliver --> Inbox

    Decap -- "start OAuth" --> AuthFn
    AuthFn -- "authorize + exchange<br/>code for token" --> OAuthApp
    Decap -- "commit via<br/>GitHub API<br/>(user token)" --> Repo
    Repo -- webhook --> Pages
    Pages -- "pull + build" --> Repo

    Actions -- "PR CI:<br/>axe, Lighthouse,<br/>lychee, tests" --> Repo
    Actions -- "monthly cron:<br/>download" --> Proto
    Actions -- "upload<br/>clipped tiles" --> R2
```

---

## Flow: visitor loads the map view

The hot path for most users. Everything is static or cached; no backend involvement.

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor (browser)
    participant P as Cloudflare Pages
    participant ML as MapLibre (browser)
    participant R as Cloudflare R2

    V->>P: GET /en/map/
    P-->>V: HTML + JS + listings JSON<br/>(baked in at build time)
    V->>ML: hydrate map component
    ML->>R: GET phoenix-metro.pmtiles<br/>(HTTP range requests)
    R-->>ML: tile bytes for current viewport
    ML-->>V: rendered vector map
    Note over V,ML: Subsequent pan/zoom:<br/>more range requests to R2,<br/>cached by browser + CF edge
```

---

## Flow: volunteer edits a listing

Decap runs entirely in the browser; a tiny Pages Function proxies the OAuth token exchange so the client secret never leaves the server.

```mermaid
sequenceDiagram
    autonumber
    participant Vol as Volunteer
    participant D as Decap (/admin/)
    participant AuthFn as Pages Function<br/>/api/auth
    participant OAuth as GitHub OAuth App
    participant Repo as GitHub Repo
    participant Pages as Cloudflare Pages

    Vol->>D: visit /admin/
    D->>AuthFn: open popup → /api/auth
    AuthFn->>OAuth: redirect to authorize
    OAuth-->>Vol: GitHub login + consent
    Vol-->>OAuth: approve
    OAuth-->>AuthFn: callback with code
    AuthFn->>OAuth: exchange code for token<br/>(using client secret)
    OAuth-->>AuthFn: user access token
    AuthFn-->>D: postMessage token to opener

    Vol->>D: edit listing form
    D->>Repo: create branch + commit<br/>(via GitHub API, user token)
    D->>Repo: open PR (listings) or commit direct (pages/i18n)
    Repo-->>Pages: webhook: push to main / PR
    Pages->>Repo: git pull
    Pages->>Pages: npm run build (Astro)
    Pages-->>Pages: deploy to<br/>production or preview URL
```

---

## Flow: volunteer adds a new listing (with geocoding)

The one time an address turns into coordinates. Happens once per listing and never again.

```mermaid
sequenceDiagram
    autonumber
    participant Vol as Volunteer
    participant S as Decap (/admin/)
    participant G as Geocode helper<br/>(/admin/geocode.html)
    participant N as Nominatim<br/>(OSM, no key)
    participant R2 as Cloudflare R2<br/>(tiles for preview)
    participant Repo as GitHub Repo

    Vol->>S: "Add new listing"
    Vol->>G: open helper (new tab)
    Vol->>G: type street address
    G->>N: GET /search?q=<address>
    N-->>G: candidate results (top 5)
    Vol->>G: pick correct candidate
    G->>R2: load tiles for preview map
    R2-->>G: tiles
    G-->>Vol: pin shown on map
    Vol->>G: visually confirm
    Vol->>S: paste lat / lng into form fields
    Vol->>S: save
    S->>Repo: commit listing with lat/lng<br/>baked into frontmatter
    Note over Repo: Address + lat/lng stored<br/>together. No future<br/>geocoder calls.
```

---

## Flow: contact form submission

Only path in the system that runs server-side code at request time.

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor
    participant Form as Contact form (browser)
    participant TS as Turnstile (browser)
    participant F as Pages Function<br/>/api/contact
    participant TAPI as Turnstile API
    participant R as Resend API
    participant Inbox as Recipient inbox

    V->>Form: fill feedback form
    Form->>TS: render challenge
    TS-->>Form: client token
    V->>Form: submit

    Form->>F: POST form-data {name?, email?, feedback, token}
    F->>F: validate payload shape<br/>(read recipient from site.json)
    F->>TAPI: verify token (server-side)
    TAPI-->>F: valid
    F->>R: POST /emails<br/>(from: onboarding@resend.dev,<br/>to: site.contact_recipient_email,<br/>reply_to: submitter email if given)
    R-->>F: 200 + message id
    R-->>Inbox: deliver email
    F-->>Form: 200 OK
    Form-->>V: "thanks, we got it"
```

---

## Flow: monthly map tile refresh

Scheduled automation, no human in the loop unless it fails.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as GitHub Actions<br/>(monthly cron)
    participant Proto as Protomaps CDN
    participant PM as pmtiles CLI<br/>(in runner)
    participant R2 as Cloudflare R2

    Cron->>Proto: download global<br/>daily .pmtiles
    Proto-->>Cron: global file (~100 GB)
    Note over Cron,PM: Clip to<br/>Greater Phoenix bbox
    Cron->>PM: pmtiles extract<br/>--bbox ...
    PM-->>Cron: phoenix-metro.pmtiles<br/>(~200-400 MB)
    Cron->>R2: rename current ->  dated key<br/>(rollback copy)
    Cron->>R2: wrangler r2 object put<br/>phoenix-metro.pmtiles
    alt upload fails
        Cron->>Cron: open GitHub Issue<br/>(label: ops)
    end
```

---

## Trust boundaries & secrets

- **No user PII stored by the site.** The contact form submitter can stay anonymous. Any name/email they provide is emailed once to the configured recipient inbox and never persisted by our infrastructure.
- **Three shared secrets**, all encrypted Cloudflare Pages env vars, all rotatable in seconds:
  1. **`RESEND_API_KEY`** — used server-side by `functions/api/contact.ts` to POST feedback emails to Resend.
  2. **`TURNSTILE_SECRET`** — used server-side by `functions/api/contact.ts` to verify the client-issued Turnstile token before sending.
  3. **GitHub OAuth App client secret** — used server-side by `functions/api/auth.ts` to exchange volunteer login codes for user access tokens.
- **`PUBLIC_TURNSTILE_SITE_KEY`** is a plain (non-secret) Pages env var, baked into the built HTML for the Turnstile widget.
- **R2 bucket** is public-read for the tile file only. No write path reachable from the browser.
- **Cloudflare Web Analytics** is cookieless and stores no PII — no cookie banner required.

## What this architecture buys us

- **Zero always-on servers.** The only code that runs per-request is the contact Pages Function; everything else is static files served from the edge.
- **Compromise blast radius is small.** Losing a secret = rotate in the issuer (Resend / Cloudflare Turnstile / GitHub) and update the Pages env var. There's no user database to leak.
- **Costs don't scale with traffic.** CF Pages bandwidth is unlimited, R2 egress is free, Pages Functions have a generous free request quota. A viral moment doesn't produce a bill.
- **Every component is swappable.** R2 → any S3-compatible store. Protomaps → MapTiler. Decap → direct git editing or Sveltia. GitHub → GitLab. No component is load-bearing beyond what it directly does.
