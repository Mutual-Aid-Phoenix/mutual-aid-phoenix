# Contributing

> This is a v1 stub. Phase 5 of [PLAN.md](./PLAN.md) fills in the rest — how volunteers get access, the listings schema, the geocode helper workflow, moderation, and the manual deploy step. For now this doc covers the one thing maintainers need that isn't derivable from the code: refreshing map tiles.

## Refreshing the map tiles

The base map is served from a [Protomaps](https://protomaps.com) `.pmtiles` extract clipped to the Greater Phoenix metro, uploaded to the public R2 bucket `phoenix-metro-tiles`. Tiles go stale slowly — OSM changes accrue over months, not days — so a refresh cadence of roughly once a month is plenty. Automation is deferred (see "Deferred automation" in PLAN.md); until then a maintainer does this by hand.

**Prerequisites:** `go-pmtiles` installed (`brew install protomaps/tap/go-pmtiles`), `pnpm wrangler login` already done, R2 bucket `phoenix-metro-tiles` already created with public read access enabled, and [CORS configured](#r2-cors-configuration) on the bucket.

1. **Download the latest daily Protomaps global build.** See <https://maps.protomaps.com/builds/> for the current URL.

   ```bash
   curl -L -o global.pmtiles "https://build.protomaps.com/<YYYYMMDD>.pmtiles"
   ```

2. **Clip to the Greater Phoenix metro bounding box.** The box matches the one enforced on listing coordinates in `src/content.config.ts` (`PHOENIX_METRO_BBOX`) — keep these in sync if either moves.

   ```bash
   pmtiles extract global.pmtiles phoenix-metro.pmtiles \
     --bbox=-113.0,33.0,-111.3,34.0
   ```

   Expected output size: ~200–400 MB.

3. **Upload to R2.**

   ```bash
   pnpm wrangler r2 object put phoenix-metro-tiles/phoenix-metro.pmtiles \
     --file phoenix-metro.pmtiles --remote
   ```

4. **Verify.** Open `/en/map/` locally (`pnpm dev`) or on the preview URL. Pins should render on a map of the Phoenix area.

5. **Delete the local `.pmtiles` files** — they're gitignored but not worth hanging onto. The R2 object is the source of truth.

Tiles are fetched by the browser via the `pmtiles://` protocol adapter (`pmtiles` npm package), which uses HTTP range requests so only the tiles in view are downloaded. The public URL of the object is inlined in `src/pages/[locale]/map.astro`; if the bucket URL changes (e.g., moving to a custom domain), update it there or set the `PUBLIC_PMTILES_URL` env var at build time.

### R2 CORS configuration

The public `r2.dev` URL doesn't send CORS headers by default, so the browser refuses range requests from the app origin. The policy lives in [`r2-cors.json`](./r2-cors.json) at the repo root — it whitelists `localhost:4321`, `127.0.0.1:4321`, and the `mutual-aid-phoenix.pages.dev` production + preview origins for `GET`/`HEAD` with `Range` headers.

Apply it via wrangler (preferred):

```bash
pnpm wrangler r2 bucket cors set phoenix-metro-tiles --file r2-cors.json
```

The Cloudflare dashboard (R2 → bucket → Settings → CORS policy) also accepts this JSON if CLI access isn't available.

When the app moves to a custom domain, add that origin to `r2-cors.json` and re-apply.
