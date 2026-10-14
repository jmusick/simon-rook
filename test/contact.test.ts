/**
 * Local tests for functions/api/contact.ts — `npm test`.
 *
 * Runs on Node's built-in test runner with native TypeScript type stripping;
 * no Workers runtime and no network. `fetch` is replaced per test, so nothing
 * reaches Siteverify or Email Sending, and `console` is captured so the
 * structured log line can be checked for leaks.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { onRequest } from "../functions/api/contact.ts";

type Handler = (context: { request: Request; env: Record<string, string> }) => Promise<Response>;
const handler = onRequest as unknown as Handler;

const URL_CONTACT = "https://simonrook.com/api/contact";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SEND_PREFIX = "https://api.cloudflare.com/client/v4/accounts/";

// Recognisable values, so the leak check can look for each one in the logs.
const SECRETS = {
	TURNSTILE_SECRET_KEY: "turnstile-secret-value-xyz",
	CLOUDFLARE_API_TOKEN: "api-token-value-xyz",
	CLOUDFLARE_ACCOUNT_ID: "account-id-123",
};
const ENV = { ...SECRETS };

const VALID = {
	name: "Ada Visitor",
	email: "ada.visitor@example.org",
	subject: "Rights enquiry about translation",
	message: "Hello — this is a perfectly ordinary message body.",
	captchaToken: "turnstile-token-from-widget",
	website: "",
};
const SENSITIVE_STRINGS = [
	VALID.name,
	VALID.email,
	VALID.subject,
	VALID.message,
	VALID.captchaToken,
	...Object.values(SECRETS),
	"Bearer",
];

// --- fetch mock --------------------------------------------------------------

type Call = { url: string; init: RequestInit };
type Responder = (call: Call) => Promise<Response> | Response;

let calls: Call[] = [];
let verifyResponder: Responder;
let sendResponder: Responder;
const realFetch = globalThis.fetch;

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** What fetch rejects with when an `AbortSignal.timeout` fires. */
const timeoutError = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");

const verifyCalls = () => calls.filter((c) => c.url === SITEVERIFY);
const sendCalls = () => calls.filter((c) => c.url.startsWith(SEND_PREFIX));

// --- console capture ---------------------------------------------------------

let logs: { level: string; args: unknown[] }[] = [];
const realConsole = { log: console.log, warn: console.warn, error: console.error };

beforeEach(() => {
	calls = [];
	logs = [];
	verifyResponder = () => jsonResponse({ success: true });
	sendResponder = () => jsonResponse({ success: true, result: {} });

	globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url = String(input);
		const call = { url, init };
		calls.push(call);
		// Both upstream calls must carry a live deadline.
		assert.ok(init.signal instanceof AbortSignal, `no AbortSignal on ${url}`);
		assert.equal(init.signal.aborted, false);
		if (url === SITEVERIFY) return verifyResponder(call);
		if (url.startsWith(SEND_PREFIX)) return sendResponder(call);
		throw new Error(`unexpected fetch to ${url}`);
	}) as typeof fetch;

	for (const level of ["log", "warn", "error"] as const) {
		console[level] = (...args: unknown[]) => {
			logs.push({ level, args });
		};
	}
});

afterEach(() => {
	globalThis.fetch = realFetch;
	Object.assign(console, realConsole);
});

// --- helpers -----------------------------------------------------------------

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
	new Request(URL_CONTACT, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
		body,
		// Required by Node when the body is a stream.
		...(body instanceof ReadableStream ? { duplex: "half" } : {}),
	} as RequestInit);

const call = async (request: Request, env: Record<string, string> = ENV) => {
	const response = await handler({ request, env });
	assertApiHeaders(response);
	const body = (await response.json()) as Record<string, unknown>;
	return { response, body };
};

const submit = (fields: Record<string, unknown> = {}, env?: Record<string, string>) =>
	call(post(JSON.stringify({ ...VALID, ...fields })), env);

/** Every response path must carry these, whatever the status. */
const assertApiHeaders = (response: Response) => {
	const h = response.headers;
	assert.equal(h.get("Content-Type"), "application/json");
	assert.equal(h.get("Cache-Control"), "no-store");
	assert.equal(h.get("X-Content-Type-Options"), "nosniff");
	assert.equal(h.get("Strict-Transport-Security"), "max-age=63072000; includeSubDomains; preload");
	assert.equal(h.get("Referrer-Policy"), "strict-origin-when-cross-origin");
	assert.equal(h.get("X-Frame-Options"), "DENY");
	assert.equal(h.get("Content-Security-Policy"), "default-src 'none'; frame-ancestors 'none'");
	assert.match(h.get("X-Request-Id") ?? "", /^[0-9a-f-]{36}$/);
	assert.equal(h.get("Access-Control-Allow-Origin"), null);
};

/** Exactly one structured event per request, with nothing sensitive in it. */
const loggedEvent = (): Record<string, unknown> => {
	assert.equal(logs.length, 1, `expected one log line, got ${logs.length}`);
	const [entry] = logs;
	assert.equal(entry.args.length, 1);
	const event = entry.args[0] as Record<string, unknown>;
	const serialized = JSON.stringify(event);
	for (const value of SENSITIVE_STRINGS) {
		assert.ok(!serialized.includes(value), `log leaked ${JSON.stringify(value)}: ${serialized}`);
	}
	const allowed = new Set([
		"event",
		"requestId",
		"status",
		"stage",
		"code",
		"timeout",
		"upstreamStatus",
		"upstreamCodes",
		"errorName",
	]);
	for (const key of Object.keys(event)) assert.ok(allowed.has(key), `unexpected log field ${key}`);
	assert.equal(event.event, "contact");
	return { ...event, level: entry.level };
};

const assertNoUpstream = () => assert.equal(calls.length, 0, "upstream services must not be called");

/** A stream that emits `chunks` and fails the test if pulled past them. */
const streamOf = (chunks: Uint8Array[]) => {
	let i = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (i < chunks.length) controller.enqueue(chunks[i++]);
			else controller.close();
		},
	});
};

// --- tests -------------------------------------------------------------------

describe("method", () => {
	for (const method of ["GET", "OPTIONS", "PUT"]) {
		test(`${method} answers 405 with Allow: POST`, async () => {
			const { response } = await call(new Request(URL_CONTACT, { method }));
			assert.equal(response.status, 405);
			assert.equal(response.headers.get("Allow"), "POST");
			assertNoUpstream();
			const event = loggedEvent();
			assert.equal(event.code, "method_not_allowed");
			assert.equal(event.level, "warn");
		});
	}
});

describe("body shape", () => {
	for (const [label, raw] of [
		["null", "null"],
		["number", "42"],
		["string", '"hello"'],
		["boolean", "true"],
		["array", JSON.stringify([VALID])],
	]) {
		test(`${label} body answers 400 without touching upstream`, async () => {
			const { response, body } = await call(post(raw));
			assert.equal(response.status, 400);
			assert.equal(body.error, "Malformed request.");
			assertNoUpstream();
			assert.equal(loggedEvent().code, "invalid_shape");
		});
	}

	test("malformed JSON answers 400", async () => {
		const { response, body } = await call(post('{"name": "Ada",'));
		assert.equal(response.status, 400);
		assert.equal(body.error, "Malformed request.");
		assertNoUpstream();
		assert.equal(loggedEvent().code, "malformed_json");
	});

	test("empty body answers 400", async () => {
		const { response } = await call(post(null));
		assert.equal(response.status, 400);
		assertNoUpstream();
	});

	test("invalid UTF-8 answers 400", async () => {
		const { response } = await call(post(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])));
		assert.equal(response.status, 400);
		assertNoUpstream();
		assert.equal(loggedEvent().code, "invalid_encoding");
	});

	for (const field of ["name", "email", "subject", "message", "captchaToken", "website"]) {
		test(`non-string ${field} answers 400`, async () => {
			const { response, body } = await submit({ [field]: { nested: true } });
			assert.equal(response.status, 400);
			assert.equal(body.error, "Malformed request.");
			assertNoUpstream();
			assert.equal(loggedEvent().code, "invalid_field_type");
		});
	}

	test("null fields are treated as absent", async () => {
		const { response } = await submit({ subject: null, website: null });
		assert.equal(response.status, 201);
	});
});

describe("body size", () => {
	test("declared Content-Length over budget answers 413 without reading the body", async () => {
		const request = post(streamOf([new Uint8Array(16)]), { "Content-Length": String(1024 * 1024) });
		const { response, body: result } = await call(request);
		assert.equal(response.status, 413);
		assert.equal(result.error, "Request too large.");
		assert.equal(request.bodyUsed, false, "body was read despite oversized Content-Length");
		assertNoUpstream();
		assert.equal(loggedEvent().code, "body_too_large_declared");
	});

	test("streamed body over budget with no Content-Length answers 413 and stops reading", async () => {
		const chunk = new Uint8Array(8 * 1024).fill(0x20);
		let pulls = 0;
		// 1 MiB in 8 KiB chunks. Finite so a regression fails rather than hangs
		// (an endless stream starves the event loop and defeats the test timeout).
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (pulls++ < 128) controller.enqueue(chunk);
				else controller.close();
			},
		});
		const request = post(body);
		assert.equal(request.headers.get("Content-Length"), null);
		const { response } = await call(request);
		assert.equal(response.status, 413);
		assert.ok(pulls <= 6, `kept reading after the budget (${pulls} chunks)`);
		assertNoUpstream();
		assert.equal(loggedEvent().code, "body_too_large");
	});

	test("understated Content-Length is caught by the streamed byte count", async () => {
		const big = JSON.stringify({ ...VALID, message: "x".repeat(40 * 1024) });
		const { response } = await call(post(streamOf([new TextEncoder().encode(big)]), { "Content-Length": "100" }));
		assert.equal(response.status, 413);
		assertNoUpstream();
	});

	test("worst-case legitimate UTF-8 submission fits the budget", async () => {
		// 3-byte characters at every cap, plus a maximum-length token.
		const wide = (n: number) => "語".repeat(n);
		const fields = {
			name: wide(100),
			email: `${wide(240)}@example.org`,
			subject: wide(150),
			message: wide(4000),
			captchaToken: "t".repeat(2048),
		};
		const raw = JSON.stringify({ ...VALID, ...fields });
		assert.ok(new TextEncoder().encode(raw).byteLength > 15_000);
		const { response } = await call(post(raw));
		assert.equal(response.status, 201);
		assert.equal(sendCalls().length, 1);
	});
});

describe("field limits", () => {
	test("email over 254 characters answers 400", async () => {
		const { response, body } = await submit({ email: `${"a".repeat(250)}@example.org` });
		assert.equal(response.status, 400);
		assert.match(String(body.error), /254/);
		assertNoUpstream();
		assert.equal(loggedEvent().code, "email_too_long");
	});

	test("email of exactly 254 characters is accepted", async () => {
		const email = `${"a".repeat(254 - "@example.org".length)}@example.org`;
		assert.equal(email.length, 254);
		const { response } = await submit({ email });
		assert.equal(response.status, 201);
	});

	test("token over 2048 characters answers 400 without calling Siteverify", async () => {
		const { response, body } = await submit({ captchaToken: "t".repeat(2049) });
		assert.equal(response.status, 400);
		assert.equal(body.error, "Verification failed. Please try again.");
		assertNoUpstream();
		assert.equal(loggedEvent().code, "token_too_long");
	});

	test("missing token answers 400 without calling Siteverify", async () => {
		const { response } = await submit({ captchaToken: "" });
		assert.equal(response.status, 400);
		assertNoUpstream();
	});

	test("over-long message answers 400", async () => {
		const { response } = await submit({ message: "x".repeat(4001) });
		assert.equal(response.status, 400);
		assertNoUpstream();
	});

	test("missing required fields answer 400", async () => {
		const { response } = await submit({ name: "   " });
		assert.equal(response.status, 400);
		assertNoUpstream();
	});
});

describe("honeypot", () => {
	test("filled honeypot answers 200 and sends nothing", async () => {
		const { response, body } = await submit({ website: "https://spam.example" });
		assert.equal(response.status, 200);
		assert.equal(body.message, "Thanks — your message has been sent.");
		assertNoUpstream();
		const event = loggedEvent();
		assert.equal(event.code, "honeypot");
		assert.equal(event.level, "log");
	});
});

describe("configuration", () => {
	test("missing Turnstile secret answers 503 turnstile_unconfigured", async () => {
		const { TURNSTILE_SECRET_KEY: _omit, ...env } = ENV;
		const { response, body } = await submit({}, env);
		assert.equal(response.status, 503);
		assert.equal(body.code, "turnstile_unconfigured");
		assertNoUpstream();
	});

	test("missing email config answers 503 email_unconfigured after verification", async () => {
		const { CLOUDFLARE_API_TOKEN: _omit, ...env } = ENV;
		const { response, body } = await submit({}, env);
		assert.equal(response.status, 503);
		assert.equal(body.code, "email_unconfigured");
		assert.deepEqual(body.missing, ["CLOUDFLARE_API_TOKEN"]);
		assert.equal(sendCalls().length, 0);
		const event = loggedEvent();
		assert.equal(event.code, "email_unconfigured");
		assert.equal(event.level, "error");
	});
});

describe("Siteverify", () => {
	test("rejection answers 400 and never sends mail", async () => {
		verifyResponder = () => jsonResponse({ success: false, "error-codes": ["invalid-input-response", "<b>x</b>"] });
		const { response, body } = await submit();
		assert.equal(response.status, 400);
		assert.equal(body.error, "Verification failed. Please try again.");
		assert.equal(verifyCalls().length, 1);
		assert.equal(sendCalls().length, 0);
		const event = loggedEvent();
		assert.equal(event.code, "verify_rejected");
		// Only codes shaped like Siteverify's vocabulary survive.
		assert.deepEqual(event.upstreamCodes, ["invalid-input-response"]);
	});

	test("request carries secret, token and remote IP", async () => {
		await call(post(JSON.stringify(VALID), { "CF-Connecting-IP": "203.0.113.7" }));
		const params = new URLSearchParams(String(verifyCalls()[0].init.body));
		assert.equal(params.get("secret"), SECRETS.TURNSTILE_SECRET_KEY);
		assert.equal(params.get("response"), VALID.captchaToken);
		assert.equal(params.get("remoteip"), "203.0.113.7");
	});

	test("timeout answers 504, fails closed, and never sends mail", async () => {
		verifyResponder = () => Promise.reject(timeoutError());
		const { response, body } = await submit();
		assert.equal(response.status, 504);
		assert.equal(body.error, "Could not reach the verification service.");
		assert.equal(sendCalls().length, 0);
		const event = loggedEvent();
		assert.equal(event.code, "verify_timeout");
		assert.equal(event.timeout, true);
		assert.equal(event.level, "error");
	});

	test("HTTP error answers 502 and never sends mail", async () => {
		verifyResponder = () => new Response("<html>oops</html>", { status: 500 });
		const { response } = await submit();
		assert.equal(response.status, 502);
		assert.equal(sendCalls().length, 0);
		const event = loggedEvent();
		assert.equal(event.code, "verify_http_error");
		assert.equal(event.upstreamStatus, 500);
	});

	test("network failure answers 502 and never sends mail", async () => {
		verifyResponder = () => Promise.reject(new TypeError("fetch failed"));
		const { response } = await submit();
		assert.equal(response.status, 502);
		assert.equal(sendCalls().length, 0);
		const event = loggedEvent();
		assert.equal(event.code, "verify_unreachable");
		assert.equal(event.errorName, "TypeError");
	});

	test("non-JSON success answer fails closed", async () => {
		verifyResponder = () => new Response("not json", { status: 200 });
		const { response } = await submit();
		assert.equal(response.status, 502);
		assert.equal(sendCalls().length, 0);
	});
});

describe("email sending", () => {
	test("success answers 201 with one well-formed send", async () => {
		const { response, body } = await submit();
		assert.equal(response.status, 201);
		assert.equal(body.message, "Thanks — your message has been sent.");
		assert.equal(verifyCalls().length, 1);
		assert.equal(sendCalls().length, 1);

		const [send] = sendCalls();
		assert.equal(send.url, `${SEND_PREFIX}${SECRETS.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`);
		assert.equal((send.init.headers as Record<string, string>).Authorization, `Bearer ${SECRETS.CLOUDFLARE_API_TOKEN}`);
		const payload = JSON.parse(String(send.init.body));
		// snake_case on purpose; camelCase is rejected by the API (see AGENTS.md).
		assert.equal(payload.reply_to, VALID.email);
		assert.equal(payload.replyTo, undefined);
		assert.equal(payload.from, "contact@simonrook.com");
		assert.equal(payload.to, "hello@simonrook.com");

		const event = loggedEvent();
		assert.equal(event.code, "sent");
		assert.equal(event.status, 201);
		assert.equal(event.level, "log");
		assert.equal(event.requestId, response.headers.get("X-Request-Id"));
	});

	test("provider failure answers 502 and logs only numeric error codes", async () => {
		sendResponder = () =>
			jsonResponse(
				{ success: false, errors: [{ code: 10001, message: `bad reply_to ${VALID.email}` }, { code: "x" }] },
				400,
			);
		const { response, body } = await submit();
		assert.equal(response.status, 502);
		assert.equal(body.error, "Could not send your message. Please try again in a moment.");
		assert.equal(sendCalls().length, 1);
		const event = loggedEvent();
		assert.equal(event.code, "send_rejected");
		assert.equal(event.upstreamStatus, 400);
		assert.deepEqual(event.upstreamCodes, [10001]);
	});

	test("2xx without success: true is a failure", async () => {
		sendResponder = () => jsonResponse({ success: false }, 200);
		const { response } = await submit();
		assert.equal(response.status, 502);
	});

	test("timeout answers 504 and is not retried", async () => {
		sendResponder = () => Promise.reject(timeoutError());
		const { response, body } = await submit();
		assert.equal(response.status, 504);
		assert.match(String(body.error), /couldn't confirm/);
		assert.equal(sendCalls().length, 1, "an ambiguous send must not be retried");
		const event = loggedEvent();
		assert.equal(event.code, "send_timeout");
		assert.equal(event.timeout, true);
	});

	test("timeout while reading the response body is still a timeout", async () => {
		sendResponder = () =>
			new Response(
				new ReadableStream({
					pull(controller) {
						controller.error(timeoutError());
					},
				}),
				{ status: 200 },
			);
		const { response } = await submit();
		assert.equal(response.status, 504);
		assert.equal(sendCalls().length, 1);
		assert.equal(loggedEvent().code, "send_timeout");
	});

	test("network failure answers 502", async () => {
		sendResponder = () => Promise.reject(new TypeError("fetch failed"));
		const { response } = await submit();
		assert.equal(response.status, 502);
		assert.equal(sendCalls().length, 1);
		assert.equal(loggedEvent().code, "send_unreachable");
	});
});

describe("unexpected failure", () => {
	test("an exception answers a generic 500 with the API headers", async () => {
		const broken = {
			method: "POST",
			headers: {
				get() {
					throw new RangeError(`boom ${VALID.email}`);
				},
			},
		} as unknown as Request;
		const { response, body } = await call(broken);
		assert.equal(response.status, 500);
		assert.equal(body.error, "Something went wrong. Please try again in a moment.");
		assertNoUpstream();
		const event = loggedEvent();
		assert.equal(event.code, "unhandled");
		assert.equal(event.errorName, "RangeError");
	});
});
