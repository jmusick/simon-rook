import type { ImageMetadata } from "astro";
import stoicMindCover from "../assets/stoic-mind-cover.png";
import stoicMindSocial from "../assets/stoic-mind-og.png";

/**
 * Book catalogue — the single source of truth for every title.
 *
 * The Home, Books, and book detail pages all read from here. Don't hardcode
 * title, subtitle, retailer links, or structure in components.
 *
 * Facts below are taken from the book project at
 * `C:\Users\JD\Projects\Simon Rook\<title>\` — the outline, the canonical
 * manuscript, and the vault note. Keep them in sync with that source rather
 * than editing them here to taste.
 */

export interface Retailer {
	/** Display name of the store. */
	label: string;
	href: string;
	icon: string;
	/** The one link rendered as the primary call to action. Exactly one per book. */
	primary?: boolean;
}

export interface BookPart {
	name: string;
	chapters: string[];
	/** Shown instead of a chapter list for parts that aren't chaptered. */
	note?: string;
}

export interface Book {
	slug: string;
	title: string;
	subtitle: string;
	/** Shown under the title in listings and as the meta description. */
	blurb: string;
	/** Longer description, one paragraph per entry. */
	description: string[];
	/** What the reader can do by the end — drawn from the book's reader promise. */
	promises: string[];
	cover: ImageMetadata;
	coverAlt: string;
	/**
	 * Landscape share card (1200×630) for the book page's Open Graph / Twitter
	 * image. Optional: without one the page shares the cover itself, which
	 * platforms crop to fit their landscape frame.
	 */
	socialImage?: ImageMetadata;
	/** Describes `socialImage`. Falls back to `coverAlt` when there's no card. */
	socialImageAlt?: string;
	/** ISO date the edition went on sale. */
	published: string;
	format: string;
	/**
	 * The schema.org `bookFormat` for the JSON-LD on the book page. Separate
	 * from `format`, which is the display string.
	 */
	schemaFormat: "EBook" | "Paperback" | "Hardcover" | "AudiobookFormat";
	asin: string;
	/** Verified against the canonical manuscript, rounded down. */
	wordCount: string;
	/**
	 * Intro paragraph above the chapter list on the book page. Rendered as
	 * HTML (so `<em>` works): trusted catalogue data only, never user input.
	 */
	contentsIntro: string;
	parts: BookPart[];
	/** Pull quote on the home page when this is the featured book. */
	pullquote: { text: string; cite: string };
	retailers: Retailer[];
	/**
	 * Verbatim from the manuscript's reader note. This is a health-adjacent
	 * book — keep this disclaimer on any page that describes the content.
	 */
	readerNote: string;
	/** Set false for a title that is announced but not yet on sale. */
	available: boolean;
}

export const BOOKS: Book[] = [
	{
		slug: "the-stoic-mind-for-overthinkers",
		title: "The Stoic Mind for Overthinkers",
		subtitle:
			"A 21-Day Practical Guide to Making Decisions, Releasing What You Cannot Control, and Taking Action Without Perfect Certainty",
		blurb:
			"A problem-focused, exercise-driven introduction to Stoic practice for people caught in cycles of indecision and rumination.",
		description: [
			"Overthinking rarely looks like a problem from the inside. It looks like responsibility. You replay the conversation because you want to get it right. You research the decision because you want to choose well. You wait one more night because acting too soon would be careless. Hours of genuine mental effort pass without producing a decision, a plan, or a single new fact.",
			"This book is about recognizing the point where thinking stops serving life and starts postponing it — and, more importantly, about knowing what to do next. The Stoics were unusually well equipped for that problem. They separated an event from our judgment about it, distinguished what depends on our choices from what remains exposed to chance and other people, and asked how a person could act well while outcomes stayed uncertain.",
			"Instead of asking how to make things turn out exactly as you want, Stoicism asks a smaller and far more useful question: what is mine to do, and how can I do it well? Across twelve chapters and a twenty-one-day practice, this is a beginner-friendly system for answering it — no prior knowledge of philosophy assumed, and no promise of a life without discomfort.",
		],
		promises: [
			"Tell useful reflection apart from repetitive rumination.",
			"Separate facts from assumptions, predictions, and judgments.",
			"Identify what is actually under your control in a hard situation.",
			"Make sound decisions without waiting for total certainty.",
			"Handle mistakes, criticism, rejection, and disappointing outcomes.",
			"Interrupt people-pleasing and reassurance-seeking habits.",
			"Convert anxious mental energy into deliberate action.",
			"Keep a simple morning and evening Stoic practice.",
		],
		cover: stoicMindCover,
		coverAlt:
			"Cover of The Stoic Mind for Overthinkers by Simon Rook: a marble bust in profile against a deep navy field, with tangled bronze threads behind the head resolving into clean parallel lines.",
		socialImage: stoicMindSocial,
		socialImageAlt:
			"The cover of The Stoic Mind for Overthinkers beside the title and the line: A practical guide to acting without perfect certainty.",
		published: "2026-08-14",
		format: "Kindle ebook",
		schemaFormat: "EBook",
		asin: "B0HF5K9Q2L",
		wordCount: "About 33,000 words",
		contentsIntro:
			"Every chapter opens with a recognizable modern situation, introduces one Stoic idea in plain language, says clearly what that idea does <em>not</em> mean, and ends with a concrete exercise you can do the same day.",
		parts: [
			{
				name: "Part I — Understand the Loop",
				chapters: [
					"When Thinking Stops Being Useful",
					"Facts, Stories, and First Impressions",
					"The Control Test",
				],
			},
			{
				name: "Part II — Choose Without Perfect Certainty",
				chapters: [
					"Decide by Values, Not by Fear",
					"Give Thought a Deadline",
					"Rehearse Adversity Without Living in It",
				],
			},
			{
				name: "Part III — Live With Other People's Opinions",
				chapters: [
					"Stop Holding Trials in Other People's Minds",
					"People-Pleasing, Guilt, and the Courage to Disappoint",
					"The Past Is Not a Problem You Can Still Solve",
				],
			},
			{
				name: "Part IV — Turn Clarity Into Action",
				chapters: [
					"Make the Next Action Smaller",
					"Practice Discomfort on Purpose",
					"Build a Mind That Returns",
				],
			},
			{
				name: "Part V — The 21-Day Stoic Mind Practice",
				chapters: [],
				note:
					"Three weeks — See Clearly, Choose Deliberately, Act With Courage. About fifteen minutes a day, each with a lesson, a written practice, an action, and a one-minute evening review.",
			},
		],
		pullquote: {
			text: "Instead of asking, “How can I make this turn out exactly as I want?” Stoicism asks, “What is mine to do, and how can I do it well?”",
			cite: "From the introduction",
		},
		retailers: [
			{
				label: "Amazon Kindle",
				href: "https://www.amazon.com/dp/B0HF5K9Q2L",
				icon: "simple-icons:amazon",
				primary: true,
			},
		],
		readerNote:
			"This book presents philosophical ideas and practical exercises for ordinary overthinking. It is not medical advice or a substitute for qualified care. If persistent anxiety, compulsive behavior, depression, trauma, or loss of sleep is interfering with daily life, consider speaking with an appropriate professional.",
		available: true,
	},
];

/** The title featured on the home page — most recently published first. */
export const FEATURED_BOOK: Book = BOOKS[0]!;

export function primaryRetailer(book: Book): Retailer | undefined {
	return book.retailers.find((r) => r.primary) ?? book.retailers[0];
}

/** "August 14, 2026" — parsed as UTC so the date doesn't shift by timezone. */
export function formatPublished(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}
