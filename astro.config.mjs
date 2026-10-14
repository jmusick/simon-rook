// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import { execFileSync } from 'node:child_process';

/**
 * Sitemap `lastmod` from git: the newest commit touching a page's source files.
 *
 * That needs full history. Cloudflare Pages builds from a shallow clone, so
 * when the checkout is shallow the build fetches the rest first (the repo is
 * small; this takes seconds). If that fails too, lastmod is left out entirely —
 * a shallow history would stamp every page with the same latest commit, which
 * is worse than no date. No git at all also means no lastmod.
 */
function git(args, timeout = 10_000) {
	try {
		return execFileSync('git', args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout,
		}).trim();
	} catch {
		return '';
	}
}
// 'true' | 'false' | '' (not a git checkout, or git missing)
const shallowState = () => git(['rev-parse', '--is-shallow-repository']);
if (shallowState() === 'true') git(['fetch', '--unshallow', '--quiet'], 60_000);
const canDateFromGit = shallowState() === 'false';
function lastCommitDate(...files) {
	const iso = git(['log', '-1', '--format=%cI', '--', ...files]);
	return iso ? new Date(iso).toISOString() : undefined;
}

// Pathname → the source files its content or metadata comes from. Unlisted
// pages get no lastmod.
//
// Every page shares SHARED: titles/descriptions/canonical/social tags come from
// Layout.astro and site.ts (site name, tagline, author and WebSite JSON-LD,
// socials), so a change there really does change every page. Shared chrome
// (SiteHeader, SiteFooter, CookieConsent) is deliberately NOT listed: the
// footer prints the version, which changes every release, and that would stamp
// every page with each release date. Add a chrome file to a route only when its
// content is part of what that route says. README/AGENTS/docs are never sources.
const SHARED = ['src/config/site.ts', 'src/layouts/Layout.astro'];
const BOOK_DATA = 'src/data/books.ts';
const READER_NOTE = 'src/components/ReaderNote.astro';
const PAGE_SOURCES = {
	'/': ['src/pages/index.astro', BOOK_DATA, READER_NOTE, ...SHARED],
	'/about/': ['src/pages/about.astro', ...SHARED],
	'/books/': [
		'src/pages/books/index.astro',
		'src/components/BookCard.astro',
		BOOK_DATA,
		READER_NOTE,
		...SHARED,
	],
	'/contact/': ['src/pages/contact.astro', ...SHARED],
	'/privacy-policy/': ['src/pages/privacy-policy.astro', ...SHARED],
};
function sourcesFor(pathname) {
	if (PAGE_SOURCES[pathname]) return PAGE_SOURCES[pathname];
	if (pathname.startsWith('/books/')) {
		return ['src/pages/books/[slug].astro', BOOK_DATA, READER_NOTE, ...SHARED];
	}
	return undefined;
}

// https://astro.build/config
export default defineConfig({
	site: 'https://simonrook.com',
	server: {
		host: true,
		port: 4321,
	},
	vite: {
		// The VS Code launch config (.vscode/launch.json) attaches Firefox to a
		// hardcoded http://localhost:4321. Without strictPort, Astro quietly falls
		// back to 4322+ when 4321 is busy and the debugger attaches to nothing —
		// fail loudly instead so the real problem is visible. `strictPort` is a
		// Vite option; it has no effect under Astro's own `server` block.
		server: { strictPort: true },
	},
	integrations: [
		icon(),
		sitemap({
			serialize(item) {
				const files = canDateFromGit ? sourcesFor(new URL(item.url).pathname) : undefined;
				const lastmod = files && lastCommitDate(...files);
				return lastmod ? { ...item, lastmod } : item;
			},
		}),
	],
});
