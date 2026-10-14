# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

Author site for **Simon Rook**, who writes self-help / practical philosophy
books. Astro static site, deployed to Cloudflare Pages. See
[README.md](README.md) for design background, deployment setup and the list of
placeholder values that still need real ones — read it before touching copy or
visual styling.

## Private project context — read this first

**This is a public repository. Author, editorial, and publishing context is
deliberately kept out of it** and lives in the private asset workspace:

`C:\Users\JD\projects\simon-rook\` — its `README.md` (project hub) and
`AGENTS.md` (workspace conventions), plus per-book `<book-slug>\` folders with
`planning\` and `manuscript\`.

Read that guidance and the relevant editorial briefs before writing or editing
author-facing copy — the About page, bios, author metadata, or anything
describing who Simon Rook is. They carry constraints this repo intentionally
does not state. If the workspace isn't available to you, ask rather than
guessing, and don't infer the missing context from what is or isn't in this repo.

Private editorial context must not be copied into this repo, commit messages,
published page copy, or public GitHub issues. The Obsidian vault is retired; do
not require it or create new vault notes. Website implementation and deployment
guidance belongs here; editorial and production records belong in the workspace.

The bio on the About page is deliberately about the *work* — method, audience,
and boundaries — rather than biography. Don't invent life details, credentials,
academic history, or personal anecdotes to fill it out. If the page feels thin,
say so rather than fabricating.

## Stack

- **Astro 7** (static output), TypeScript, Node `>=22.12`. No UI framework —
  components are `.astro` files with inline `<style>`/`<script>`.
- Hand-written CSS; design tokens live in
  [public/universal.css](public/universal.css) (palette and fonts: see README).
  Fonts are self-hosted in `public/fonts/` — no font CDN.
- Icons via `astro-icon` + `@iconify-json/simple-icons` / `lucide`. The build
  warns that `src/icons` doesn't exist; that's harmless.
- Deploy target: the Cloudflare Pages project **`simonrook`**, connected to
  `jmusick/simon-rook` with automatic deployments from `main`. **Pushing to
  `main` publishes** — there is no separate deploy step. `name` in
  `wrangler.toml` must match the project name exactly or Git builds break.

## Structure

- `src/pages/` — routes: `index`, `books/index`, `books/[slug]` (one page per
  book via `getStaticPaths`), `about`, `contact`, `privacy-policy`, `404`.
- `src/components/` — `SiteHeader`, `SiteFooter` (shows `v{SITE_VERSION}`),
  `BookCard`, and `CookieConsent` (the consent banner, and the only loader of
  the Google tag).
- `src/layouts/Layout.astro` — shared shell: meta, Open Graph/Twitter
  (`socialImageUrl`/`Alt`/`Width`/`Height`, `ogType`), a JSON-LD prop, and a
  `head` slot.
- `src/config/site.ts` — single source of truth for site URL, name, tagline,
  `SITE_VERSION` (from `package.json`), `GA_MEASUREMENT_ID`, the Turnstile site
  key, `SOCIALS`, and the shared JSON-LD nodes. `SOCIALS` entries with
  `href: null` are hidden everywhere. `PROFILE_URLS` is the subset valid as
  `sameAs` (the Amazon entry is `isProfile: false`: a book, not the author).
- `src/data/books.ts` — the book catalogue: metadata, reader promises, cover,
  chapter structure, retailer links, reader note, optional 1200×630
  `socialImage`. Adding a title is appending a `Book` and dropping its cover in
  `src/assets/` — no new pages.
- `functions/api/contact.ts` — the only server-side code (see below).
- `src/env.d.ts` — ambient types for `PUBLIC_*` env vars and `window.turnstile`.
- `public/_headers` — Cloudflare Pages response headers (CSP etc.).
- `docs/audits/` — dated audit reports; findings are tracked as GitHub issues.

## Source of truth for book facts

Book content facts come from the book project on disk, not from invention:
`<book-slug>\planning\AUTHOR_BRIEF.md` (audience, voice), `BOOK_OUTLINE.md`
(premise, reader promise), `manuscript\MANUSCRIPT.md` (chapter titles, reader
note) and `assets\cover\` (artwork), under the workspace above.

Verify against those files before changing chapter titles, word counts, dates,
or the reader note. `readerNote` is quoted verbatim from the manuscript — this
is a health-adjacent topic, so keep the disclaimer on any page that describes
book content, and don't soften it.

## Commands

```bash
npm run dev       # astro dev, http://localhost:4321 (no Functions)
npm run build     # astro build -> dist/
npm run preview   # serve the built output
npm run build && npx wrangler pages dev dist   # Functions + _headers
```

No test suite or linter is configured. Verify changes with `npm run build`
and, for anything visual, `npm run dev` plus a browser check. `astro.config.mjs`
sets `vite.server.strictPort` because the VS Code Firefox launch config is
hardcoded to port 4321 — don't remove it (see README).

## Releases and dependencies

- Version lives in `package.json` (and the lockfile) and shows in the footer.
  A release is one commit, `vX.Y.Z - <summary>`, with an annotated `vX.Y.Z`
  tag. Merging to `main` deploys.
- Keep `npm audit` at zero; upgrade deliberately, never a blind
  `npm audit fix --force`. `allowScripts` in `package.json` is the lifecycle
  script allowlist (currently empty). Dependabot alerts are enabled.
- CI (`.github/workflows/build.yml`, job `build`) runs `npm ci`,
  `npm audit --audit-level=low`, `npm test --if-present` and `npm run build`
  on PRs to `main` and pushes to `main`. Third-party actions are pinned to
  full commit SHAs (Dependabot's `github-actions` ecosystem bumps them);
  workflow permissions stay `contents: read`.
- Intended `main` ruleset: require the `build` status check, block force-push
  and deletion, no required reviews (sole maintainer). Repository admins are a
  deliberate bypass actor so release commits can be pushed straight to `main`
  and emergencies can be handled. Recovery from a bad deploy: roll back to a
  previous deployment in Cloudflare Pages, then fix forward.

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
- Endpoint defenses, in case they look redundant: honeypot field `website`
  (returns 200 and discards), per-field length caps (`LIMITS`), email format
  check, CRLF stripping on header values, no CORS. No rate limiting by design —
  add a WAF rule on `/api/contact` if needed.

## Security headers

`public/_headers` applies only on Pages or `wrangler pages dev dist` — not
`astro dev`/`preview` — and not to Function responses, which must set their own
headers.

The CSP allows exactly Turnstile, Cloudflare Web Analytics and GA; `font-src`
and `style-src` are `'self'`. A new third-party origin must be added in the same
change or it's silently blocked. Web Analytics is injected at the edge by a
zone setting (not in the source, absent on `*.pages.dev`) and is cookieless, so
it runs outside the consent banner. GA loads only after Accept, so test by
accepting and watching the console. `'unsafe-inline'` covers the consent
script, JSON-LD and `style=""`.

## SEO

- One author entity: `PERSON_SCHEMA` in `site.ts` (`@id` `…/#person`) is the
  full node on Home and About; everything else (a book's `author`) uses
  `PERSON_REF`. Home adds a `WebSite` (`…/#website`), About a `ProfilePage`,
  `/books/` an `ItemList`, book pages `Book` + `BreadcrumbList`. Don't create a
  second, unlinked `Person`.
- Book pages use `og:type=book`, the book's `socialImage` (else the cover) as
  the share image, and the cover as the `Book` schema image.
- Sitemap `lastmod` is git-derived in `astro.config.mjs`: `PAGE_SOURCES` maps
  routes to source files — add new pages there. Details are in README.

## Conventions

- Keep the site static apart from `functions/` — no other server runtime, no
  further API routes, no client-side data fetching. Content changes go through
  `src/config/site.ts` / `src/data/books.ts`, not component-level hardcoding.
- Analytics is GA4 via `GA_MEASUREMENT_ID`; `null` removes the tag and consent
  banner site-wide. `ANALYTICS_ID` is null outside production, so `astro dev`
  traffic never reaches the property.
- Consent is **opt-in and strict**: `CookieConsent.astro` is the only thing
  that loads `gtag.js`, from the accept path. Don't move the tag into
  `Layout.astro`'s head — that discloses visitor IPs to Google before consent.
  The choice lives in `localStorage`; withdrawing clears `_ga*` cookies and
  reloads. Any `data-cookie-preferences` element reopens the banner.
- Placeholders carry a `PLACEHOLDER:` comment (the Goodreads and BookBub
  slots). Don't invent real-looking replacements — leave them or ask.
- The Contact page publishes no email address; everything routes through the
  form, and the address shows only as a no-Turnstile-key fallback. Don't
  reintroduce it elsewhere.
- `astro.config.mjs` `site`, `SITE_URL` in `site.ts`, and the `Sitemap:` line in
  `public/robots.txt` must all point at `simonrook.com`.
- Retailer links are plain links, and the privacy policy says so; affiliate
  tagging would need the policy updated in the same change.
- The privacy policy describes actual behavior. A newsletter, embed, new
  third-party script or font CDN means updating
  `src/pages/privacy-policy.astro` (and its `lastUpdated`) and the CSP in the
  same change.
