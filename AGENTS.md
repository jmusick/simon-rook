# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

Author site for **Simon Rook**, who writes self-help / practical philosophy
books. Astro static site, deployed to Cloudflare Pages. See
[README.md](README.md) for design background and the list of placeholder values
that still need real ones — read it before touching copy or visual styling.

## Private project context — read this first

**This is a public repository. Author, editorial, and publishing context is
deliberately kept out of it** and lives in the private asset workspace:

```
C:\Users\JD\projects\simon-rook\
  README.md                    project hub and information ownership
  AGENTS.md                    private workspace conventions
  <book-slug>\README.md        per-book status and production map
  <book-slug>\planning\        editorial briefs, outlines, and progress
  <book-slug>\manuscript\      canonical text and editorial audits
```

Read that guidance and relevant editorial briefs before writing or editing any
author-facing copy — the About page, bios, author metadata, or anything describing
who Simon Rook is. They
carry constraints that this repo intentionally does not state. If the workspace
isn't available to you, ask rather than guessing, and don't infer the missing
context from what is or isn't in this repo.

Private editorial context must not be copied into this repo, commit messages,
published page copy, or public GitHub issues. The Obsidian vault has been retired;
do not require it or create new vault notes. Website implementation and deployment
guidance belongs here; editorial and production records belong in the asset workspace.

The bio on the About page is deliberately about the *work* — method, audience,
and boundaries — rather than biography. Don't invent life details, credentials,
academic history, or personal anecdotes to fill it out. If the page feels thin,
say so rather than fabricating.

## Stack

- **Astro** (static output), TypeScript, no UI framework — components are
  `.astro` files with inline `<style>`/`<script>`.
- Styling is hand-written CSS. Design tokens live in
  [public/universal.css](public/universal.css); the palette and type pairing
  are derived from the cover art of *The Stoic Mind for Overthinkers* (deep
  navy, bronze accent, bone text; Oswald display over a Source Serif 4 reading
  face, Inter for UI). Fonts are self-hosted in `public/fonts/` with their OFL
  licenses — no font CDN.
- Icons via `astro-icon` + `@iconify-json/simple-icons` / `lucide`.
- Deploy target: the Cloudflare Pages project **`simonrook`**, connected to
  `jmusick/simon-rook` with automatic deployments from `main`. **Pushing to
  `main` publishes** — there is no separate deploy step. `name` in
  `wrangler.toml` must match the project name exactly or Git builds break.

## Structure

- `src/pages/` — routes. `index.astro`, `books/index.astro`,
  `books/[slug].astro` (one page per book via `getStaticPaths`), `about.astro`,
  `contact.astro`, `privacy-policy.astro`, `404.astro`.
- `src/components/` — `SiteHeader.astro`, `SiteFooter.astro`, `BookCard.astro`,
  `CookieConsent.astro` (the consent banner, and the only loader of the Google tag).
- `src/layouts/Layout.astro` — shared page shell: meta, Open Graph/Twitter
  (`socialImageUrl`/`Alt`/`Width`/`Height`, `ogType`), a JSON-LD prop, and a
  `head` slot. See SEO below.
- `public/_headers` — Cloudflare Pages response headers (CSP etc.). See below.
- `src/config/site.ts` — single source of truth for site URL, name, tagline,
  `GA_MEASUREMENT_ID`, the delivery inbox, `SOCIALS`, and the shared JSON-LD
  nodes. `SOCIALS` entries with `href: null` are auto-hidden everywhere — just
  fill in the `href`. `PROFILE_URLS` is the subset valid as `sameAs` (the
  Amazon entry is `isProfile: false`: it's a book, not the author); `X_HANDLE`
  is derived from the X entry.
- `functions/api/contact.ts` — the only server-side code. See below.
- `src/env.d.ts` — ambient types for `PUBLIC_*` env vars and `window.turnstile`.
- `src/data/books.ts` — the book catalogue. Title, subtitle, blurb,
  description, reader promises, cover, publication date, format, ASIN, part and
  chapter structure, retailer links, and the reader note all live here, plus an
  optional 1200×630 `socialImage` share card. Adding a title is a matter of
  appending a `Book` and dropping its cover in `src/assets/` — no new page files.

## Source of truth for book facts

Book content facts come from the book project on disk, not from invention:

```
C:\Users\JD\projects\simon-rook\<book-slug>\
  planning\AUTHOR_BRIEF.md     audience, voice, boundaries
  planning\BOOK_OUTLINE.md     premise, reader promise, structure
  manuscript\MANUSCRIPT.md     canonical text, chapter titles, reader note
  assets\cover\               source artwork
```

Verify against those files before changing chapter titles, word counts, dates,
or the reader note. The `readerNote` field is quoted verbatim from the
manuscript — this is a health-adjacent topic, so keep the disclaimer on any
page that describes book content, and don't soften it.

## Commands

```bash
npm run dev       # astro dev, http://localhost:4321
npm run build     # astro build -> dist/
npm run preview   # serve the built output
```

No test suite or linter is configured. Verify changes with `npm run build`
and, for anything visual, `npm run dev` + a browser check. `astro.config.mjs`
sets `vite.server.strictPort` because the VS Code Firefox launch config is
hardcoded to port 4321 — don't remove it (see README).

## Contact form and email

The one exception to the static-only rule. `functions/api/contact.ts` is a
Pages Function backing the Contact form, because sending mail needs an API
token that can't ship to a browser. Mail goes out through the **Cloudflare
Email Sending REST API** (plain `fetch`, no SDK):

- `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send`,
  `Authorization: Bearer <token>`, token scoped to `Email Sending: Edit`.
- Reply-to is the snake_case top-level field **`reply_to`** — `replyTo` and a
  `headers: { 'Reply-To': … }` object both 400. Don't "correct" the casing.
- Check `data.success`, not just a 2xx status.
- `from` stays on the verified (dashboard-connected) domain; the submitter's
  address goes in `reply_to`. Putting it in `from` gets the domain flagged.

Configuration is split across two mechanisms that are easy to confuse:

| Where | Read at | Holds | Example file |
| --- | --- | --- | --- |
| `.env` | build time, by Astro | `PUBLIC_TURNSTILE_SITE_KEY` — optional override only | `.env.example` |
| `.dev.vars` | run time, by the Function | token, account ID, addresses, Turnstile secret | `.dev.vars.example` |

Both are gitignored; the `.example` files are not. Missing config makes the
endpoint answer `503` with a `code` (`turnstile_unconfigured` /
`email_unconfigured`, the latter naming the missing variables) — visitors see
only a generic message, but one `curl` diagnoses it.

- **With a `wrangler.toml`, Cloudflare ignores plaintext dashboard variables**
  (secrets still apply). Plaintext vars go in `wrangler.toml` `[vars]`; secrets
  in the dashboard or `wrangler pages secret put`, never in `[vars]`.
- The Turnstile **site key is committed** (`TURNSTILE_SITE_KEY` in `site.ts`;
  `PUBLIC_TURNSTILE_SITE_KEY` overrides). Env-only once silently shipped a
  form-less Contact page — don't revert.
- `astro dev` uses Turnstile's always-passes test key and serves no Functions
  (submissions 404). Test with `npm run build && npx wrangler pages dev dist`.
- Endpoint defenses, in case they look redundant: honeypot (returns 200 and
  discards), length/format validation, CRLF stripping on header values, no CORS.
  No rate limiting by design — add a WAF rule on `/api/contact` if needed.

## Security headers

For static responses, `public/_headers` sets CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy` and cache lifetimes (`/_astro/*`, `/fonts/*`). Only Pages or
`wrangler pages dev dist` applies it — not `astro dev`/`preview`. Pages Functions
must set their own headers; `_headers` does not apply to `/api/contact`.
The current API header gap is tracked in GitHub issue #7. The CSP allows
exactly Turnstile (`challenges.cloudflare.com`), Cloudflare Web Analytics
(`static.cloudflareinsights.com`, `cloudflareinsights.com`) and GA
(`www.googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`);
`font-src`/`style-src` are `'self'`. A new third-party origin must be added in
the same change or it's silently blocked. Web Analytics is injected at the edge
by a zone setting (not in the source, absent on `*.pages.dev`) and is
cookieless, so it runs outside the consent banner. GA is the trap: it loads only
after Accept, so test by accepting and watching the console. `'unsafe-inline'`
covers the consent script, JSON-LD and `style=""` attributes.

## SEO

- One author entity: `PERSON_SCHEMA` in `site.ts` (`@id` `…/#person`) is the
  full node on Home and About; everything else (a book's `author`) uses
  `PERSON_REF`. Home adds a `WebSite` (`…/#website`), About a `ProfilePage`,
  `/books/` an `ItemList`, book pages `Book` + `BreadcrumbList`. Don't create a
  second, unlinked `Person`.
- Book pages send `og:type=book`, the book's `socialImage` (else the cover) as
  the share image, and the cover as the `Book` schema image — both built via
  `getImage` and made absolute with `SITE_URL`.
- Sitemap `lastmod` is git-derived in `astro.config.mjs` (`PAGE_SOURCES` maps
  routes to source files — add new pages there). Cloudflare Pages builds from a
  shallow clone, so the config runs `git fetch --unshallow` first; if that
  fails, `lastmod` is omitted rather than giving every page the same date.

## Conventions

- Keep the site static apart from `functions/` — no other server runtime, no
  further API routes, no client-side data fetching. Content changes go through
  `src/config/site.ts` / `src/data/books.ts`, not component-level hardcoding.
- Analytics is Google Analytics 4, configured by `GA_MEASUREMENT_ID` in
  `src/config/site.ts`. Setting that to `null` removes the tag and the consent
  banner site-wide. `ANALYTICS_ID` in the same file is null outside production,
  so `astro dev` traffic never reaches the property.
- Consent is **opt-in and strict**: `CookieConsent.astro` is the only thing
  that loads `gtag.js`, from the accept path. Don't move the tag into
  `Layout.astro`'s head — that discloses visitor IPs to Google before consent.
  The choice lives in `localStorage`; withdrawing clears `_ga*` cookies and
  reloads. Any `data-cookie-preferences` element reopens the banner.
- Placeholder values are flagged inline with a `PLACEHOLDER:` comment (the
  Goodreads and BookBub slots). Don't quietly invent real-looking replacements —
  either leave the placeholder or ask.
- The Contact page publishes no email address: everything routes through the
  form. The address appears only as a fallback when no Turnstile key is
  configured, so the page is never a dead end. Don't reintroduce it elsewhere.
- `astro.config.mjs` `site`, `src/config/site.ts` `SITE_URL`, and
  `public/robots.txt`'s `Sitemap:` line must all point at the same domain
  (`simonrook.com`) — nothing else in the codebase hardcodes it.
- Retailer links are plain links; the privacy policy says so. Affiliate tagging
  would need the policy and disclosures updated in the same change.
- The privacy policy describes actual behavior. Adding a newsletter, embeds, or
  further third-party scripts means updating `src/pages/privacy-policy.astro`
  and its `lastUpdated` date — and the CSP in `public/_headers` — in the same
  change. It currently documents Google Analytics, Cloudflare Web Analytics, the
  contact form (name, email, optional subject, message), Turnstile, and
  Cloudflare hosting, and states that fonts are self-hosted — keep that true.
  Reintroducing a font CDN means updating the policy and the CSP.
