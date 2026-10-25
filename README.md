# Simon Rook — author site

Static marketing site for the author **Simon Rook**, built with Astro 7 and
deployed to Cloudflare Pages. Live domain: `simonrook.com`. Requires Node
22.12 or newer.

Companion to the private book workspace at `C:\Users\JD\projects\simon-rook`, which
holds the manuscripts, covers, and publishing files. This repo holds only the
website.

## Quick start

```bash
npm install
npm run dev       # http://localhost:4321 — pages only, no Functions
npm run build     # -> dist/
npm run preview   # serve the built output

npm run build && npx wrangler pages dev dist   # includes /api/contact
```

Use the last one to exercise the contact form; `astro dev` doesn't serve Pages
Functions, so submissions 404 there.

## Deploy

The Cloudflare Pages project `simonrook` is connected to this repository with
automatic deployments from `main`, so **pushing to `main` deploys**. There is no
manual step, and `npx wrangler pages deploy dist` is only a fallback for
publishing a local build. `main` has no branch protection or required checks
yet ([#5](https://github.com/jmusick/simon-rook/issues/5)), so check
`npm run build` before pushing.

Production configuration is split between committed plaintext configuration and
dashboard secrets:

| Location | Type | Name |
| --- | --- | --- |
| `wrangler.toml` `[vars]` | Text | `CLOUDFLARE_ACCOUNT_ID` |
| Pages dashboard | Secret | `CLOUDFLARE_API_TOKEN` — Email Sending: Edit scope |
| Pages dashboard | Secret | `TURNSTILE_SECRET_KEY` |

With this project's `wrangler.toml`, Cloudflare ignores dashboard plaintext
variables while still applying dashboard secrets. Do not move the account ID
back to the dashboard or put either secret in the committed file.

The Turnstile *site* key is committed in
[src/config/site.ts](src/config/site.ts) rather than set here — it is public and
ships in the HTML, and a missing build variable silently produced a form-less
Contact page on the first deploy. `PUBLIC_TURNSTILE_SITE_KEY` still overrides it
if a deployment needs a different widget.

`EMAIL_FROM_CONTACT` and `CONTACT_TO_EMAIL` are optional; the defaults compiled
into the Function already match the live addresses. Preview deployments keep a
separate set of variables — they need their own copies to run the form.

## Security headers

[public/_headers](public/_headers) gives static responses a Content-Security-Policy,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Cross-Origin-Opener-Policy` and `Permissions-Policy`, long-caches the hashed
`/_astro/*` files, and caches `/fonts/*` for 30 days. Pages applies it on deploy; `astro dev` and
`astro preview` don't, so use `wrangler pages dev dist` to see it locally.

`_headers` covers static responses only; Pages never applies it to Function
responses. `/api/contact` sets its own headers in the Function (nosniff,
HSTS, Referrer-Policy, X-Frame-Options, a JSON-only CSP, `no-store`), so check
it separately:

```bash
curl -i https://simonrook.com/api/contact   # 405, with the API headers
```

When the contact form fails, every response carries an `X-Request-Id` that
matches one structured log line in the Function. Stream the logs with
`npx wrangler pages deployment tail --project-name simonrook` while
reproducing; Pages keeps no log history. [AGENTS.md](AGENTS.md) lists the
logged fields and what never gets logged.

The CSP allows only Cloudflare Turnstile, Cloudflare Web Analytics and Google
Analytics; fonts are self-hosted, so `font-src` is `'self'`. Cloudflare Web
Analytics isn't in the source: a `simonrook.com` zone setting injects its
beacon at the edge, so it doesn't appear on `*.pages.dev` previews. It's
cookieless and runs without consent; GA stays opt-in. Adding a new third-party
script, font, or embed means adding its origin there too. After a deploy that
touches the policy:

```bash
curl -I https://simonrook.com/
```

Then accept the cookie banner and check the console for CSP violations —
the analytics tag only loads after consent, so that's the one path a
too-tight policy breaks without anyone noticing.

## Releases and dependencies

The version in `package.json` is shown in the site footer. A release is a single
commit titled `vX.Y.Z - <summary>` with an annotated `vX.Y.Z` tag; merging to
`main` deploys it.

`npm audit` is clean as of v1.5.1 (Astro 7.3.8). Dependabot alerts and security
updates, CodeQL code scanning, secret scanning and push protection are
enabled. Upgrade deliberately rather than with
`npm audit fix --force`, and review any new dependency's install scripts —
`allowScripts` in `package.json` is the lifecycle-script allowlist and is
currently empty.

A GitHub Actions workflow (`build`) installs from the lockfile, runs
`npm audit`, tests (if present) and builds on every PR and push to `main`. The
`main` ruleset should require that check and block force-push and deletion;
no reviews are required since there is one maintainer. Repository admins can
bypass the ruleset for release commits and emergencies, and Cloudflare Pages
can roll back to a previous deployment if a bad build ships. Action versions
are pinned to commit SHAs and kept current by Dependabot.

The build prints a harmless astro-icon warning that `src/icons` doesn't exist.

## Debugging in VS Code

Run & Debug → **Launch Astro dev in Firefox**. The `dev server` task in
[.vscode/tasks.json](.vscode/tasks.json) starts `npm run dev` first and waits
for Astro's "watching for file changes" line, then
[.vscode/launch.json](.vscode/launch.json) opens Firefox at
`http://localhost:4321` with the debugger attached — breakpoints in client
`<script>` blocks and source-mapped CSS both work.

Requires the `firefox-devtools.vscode-firefox-debug` extension (recommended in
[.vscode/extensions.json](.vscode/extensions.json)).

The launch URL is hardcoded to port 4321, so `astro.config.mjs` sets
`vite.server.strictPort` — a busy port fails loudly rather than silently
starting on 4322, where the debugger would attach to nothing. If you'd rather
have the fallback, drop the `vite` block and stop the stale process instead.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Author positioning, featured book, reader promises |
| `/books/` | Catalogue — one card per title |
| `/books/<slug>/` | Book detail: description, promises, contents, reader note, buy link |
| `/about/` | Who Simon Rook is, how the books are written, what they won't do |
| `/contact/` | Contact form for reader mail, press, and rights |
| `/privacy-policy/` | Accurate description of what the site does and doesn't collect |
| `/404` | Not found |

Sitemap and `robots.txt` are generated/served automatically.

## SEO

[src/layouts/Layout.astro](src/layouts/Layout.astro) emits the title,
description, canonical, robots, Open Graph and Twitter tags for every page,
including `og:image:width`/`height` and `twitter:site`/`creator` (the handle is
read from the X entry in `SOCIALS`). Pages pass an optional JSON-LD object:

| Page | Structured data |
| --- | --- |
| `/` | `WebSite` + `Person` |
| `/about/` | `ProfilePage` → the same `Person` |
| `/books/` | `ItemList` of the titles |
| `/books/<slug>/` | `Book` (author → the `Person`) + `BreadcrumbList`; `og:type` is `book` |

The `Person` node is defined once in [src/config/site.ts](src/config/site.ts)
(`PERSON_SCHEMA`, `@id` `https://simonrook.com/#person`) and referenced by
`@id` everywhere else, so search engines see one author. Book pages share the
book's `socialImage` card (1200×630) when it has one, otherwise the cover; the
`Book` schema image is always the cover. All four page types validate with 0
errors on the Schema.org validator (checked 2026-09-28).

The sitemap's `lastmod` comes from the newest git commit touching each page's
source files (`PAGE_SOURCES` in `astro.config.mjs`): the page itself, the book
data and book components it renders, and the shared metadata sources
`src/config/site.ts` and `src/layouts/Layout.astro`, which every page lists.
`SiteHeader`, `SiteFooter` and `CookieConsent` are deliberately left out — the
footer prints the version, so listing it would re-date every page on every
release — and README, AGENTS and docs edits never move a date. Cloudflare
Pages builds from a shallow clone, so the build unshallows it first (`git fetch --unshallow`); if that
fails, `lastmod` is omitted rather than stamping every page with the same date.

One server-side route, `POST /api/contact`
([functions/api/contact.ts](functions/api/contact.ts)), backs the contact form —
it verifies Turnstile and sends mail through the Cloudflare Email Sending REST
API. Everything else is static. See [AGENTS.md](AGENTS.md) for the integration
details worth knowing before touching it.

## Design

The palette and typography are taken from the cover of *The Stoic Mind for
Overthinkers* so the site and the book read as one object:

| Token | Value | Role |
| --- | --- | --- |
| `--night` | `#0a1120` | Page field |
| `--surface` | `#131d30` | Panels, cards |
| `--bronze` | `#c08b4f` | Accent, rules, primary button |
| `--bone-1` | `#f2ece1` | Primary text |
| `--marble` | `#d8d2c6` | Statue-tone neutral |

Type: **Oswald** (condensed sans) for display, echoing the cover title;
**Source Serif 4** for reading copy, echoing the cover subtitle; **Inter** for
UI chrome (nav, buttons, labels). All three are self-hosted from
[public/fonts/](public/fonts/) (variable woff2, latin + latin-ext, SIL OFL —
licenses alongside), declared at the top of `universal.css`.

All tokens and component rules are in
[public/universal.css](public/universal.css). There is no CSS framework and no
build step for styles.

## Content status

Everything below is a real, verified value except where marked.

Verified against the book project on disk:

- Title, subtitle, publication date (August 14, 2026), ASIN `B0HF5K9Q2L`,
  format, and Amazon URL — published catalogue metadata in `src/data/books.ts`;
  verify future changes against the KDP listing and private publishing records.
- Chapter titles and part structure — from `manuscript/MANUSCRIPT.md`.
- Word count "about 33,000" — measured from the manuscript (33,217).
- The Part V description (three weeks, ~15 minutes a day) — from the
  manuscript's Part V introduction.
- The reader note — quoted verbatim from the manuscript.
- Reader promises on the home and book pages — from
  `planning/BOOK_OUTLINE.md`'s reader promise section.

Live and verified:

- `hello@simonrook.com` receives mail, and `contact@simonrook.com` is a verified
  Email Sending sender. Neither address is published on the site — the contact
  form is the only route, and the address surfaces only as a fallback when no
  Turnstile key is configured.
- Turnstile widget `simonrook-contact-form` is live. The account ID is committed
  in `wrangler.toml`; the API token and Turnstile secret are Pages secrets. The
  sender and destination use the verified defaults compiled into the Function.
- Google Analytics 4 (`GA_MEASUREMENT_ID` in
  [src/config/site.ts](src/config/site.ts)) is live in production builds only,
  and behind an opt-in consent banner — the tag isn't fetched until a visitor
  accepts.
- Cloudflare Web Analytics (cookieless, no consent needed) is enabled on the
  `simonrook.com` zone and counts every visit. It's configured in the dashboard,
  not in this repo.

**Remaining optional profiles and replaceable assets:**

- `SOCIALS` in [src/config/site.ts](src/config/site.ts): X, Facebook, Instagram,
  and TikTok are live. The Amazon entry points at the featured book, not an
  author page. Goodreads and BookBub are still `href: null` and render nothing
  until a URL is filled in — the entries are slots, not claims that the profiles
  exist.
- `public/favicon.png` is a generated bronze-on-navy `SR` monogram — a
  legible stand-in, not a designed mark; `public/apple-touch-icon.png` is the
  same mark at 180×180. `public/og.png` (the site-wide share image) is
  composited from the book cover, and `src/assets/stoic-mind-og.png` is a copy
  of it used as the book's own share card. All were generated, not designed,
  and can be replaced with real brand assets at any time.

## Project context

This public repository at `C:\Users\JD\source\simon-rook` owns the website
source, build and deployment configuration, README, agent instructions, and
technical audit findings tracked in GitHub Issues.

The private workspace at `C:\Users\JD\projects\simon-rook` owns manuscripts,
editorial briefs and research, publishing records and exports, production tools,
and durable brand assets. Start with its README and AGENTS.md before changing
author-facing copy; see [AGENTS.md](AGENTS.md) for source-of-truth paths.
Its folders use kebab-case; book files keep their established filenames.
The Obsidian vault is retired. Private context and unpublished material must
stay out of this repository and its public issues.

## Possible next steps

The [October 12, 2026 technical audit](docs/audits/2026-10-12.md) records SEO,
security, and accessibility findings, priorities, validation coverage, and
GitHub issue links. Open findings live in
[GitHub Issues](https://github.com/jmusick/simon-rook/issues); the dependency
finding ([#3](https://github.com/jmusick/simon-rook/issues/3)) shipped in
v1.5.1.

Not built, deliberately — the current scope is a lean author landing site.

- **Email list.** No signup exists and the privacy policy says so. Adding one
  (Kit/ConvertKit embed, or a Cloudflare D1 handler like HiddenLodgeWebsite
  uses) means updating the privacy policy in the same change.
- **Rate limiting.** `/api/contact` has Turnstile, a honeypot and per-field
  length caps but no request cap. A Cloudflare WAF rate-limiting rule would close that if abuse appears.
- **Geo-gating the consent banner.** Everyone sees it today, which costs some
  analytics coverage outside the EU/UK where it isn't required. A small Pages
  Function reporting `request.cf.country` could show it only where it's needed.
- **A second title.** Append a `Book` to [src/data/books.ts](src/data/books.ts)
  and drop its cover in `src/assets/` — plus, optionally, a 1200×630
  `socialImage` card, without which shares use the cover. The routes, cards,
  structured data, and sitemap follow automatically.
