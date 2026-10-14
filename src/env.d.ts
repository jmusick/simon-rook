interface ImportMetaEnv {
	/**
	 * Cloudflare Turnstile site key — public by design, but environment-supplied
	 * so it can differ per deployment. When unset, the Contact page omits the
	 * form entirely rather than shipping one with no spam protection.
	 */
	readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

/** Injected by the Turnstile script tag on the Contact page. */
interface Window {
	turnstile?: {
		reset: (widget?: string | HTMLElement) => void;
		render?: (
			container: string | HTMLElement,
			params: {
				sitekey: string;
				theme?: "light" | "dark" | "auto";
				appearance?: "always" | "execute" | "interaction-only";
				size?: "normal" | "flexible" | "compact";
			},
		) => string;
		remove?: (widget?: string | HTMLElement) => void;
	};
	/** Global `onload` callback named in the Turnstile api.js URL on the Contact page. */
	srTurnstileReady?: () => void;
}
