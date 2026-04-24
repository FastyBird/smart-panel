import { Request } from 'express';

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
	InjectThrottlerOptions,
	InjectThrottlerStorage,
	ThrottlerGuard,
	ThrottlerModuleOptions,
	ThrottlerStorage,
} from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';

import { TokenOwnerType } from '../auth.constants';
import { extractAccessTokenFromHeader, hashToken } from '../utils/token.utils';

interface JwtPayload {
	sub?: string;
	type?: string;
}

/**
 * In-memory cache of `hashToken(token) → verified-display-or-not` for
 * tokens we've already signature-checked. Keeps the hot-path cost of a
 * legitimate display burst flat (one verify per token per TTL window)
 * AND blunts the DoS amplification vector where a flood of forged
 * Bearer tokens with `type: "display"` would otherwise force a fresh
 * `verifyAsync` per request.
 *
 * Bounded LRU semantics: once we hit `MAX_ENTRIES` we drop the oldest
 * insertion. An attacker with millions of distinct forged tokens still
 * pays the verify cost on each new token, but they also pay the cost of
 * GENERATING that many distinct JWTs — the attack stops being
 * asymmetric.
 */
const VERIFY_CACHE_TTL_MS = 60_000;
const VERIFY_CACHE_MAX_ENTRIES = 1_000;
type VerifyCacheEntry = { ok: boolean; expiresAt: number };

/**
 * Process-wide token-bucket cap on `verifyAsync` calls per second.
 *
 * Closes the residual DoS amplification vector where an attacker
 * rotates the Bearer token string per request — each new token is a
 * cache miss, the cheap-decode pre-filter passes (the attacker
 * controls the unsigned payload and stamps `type: "display"`), so
 * `verifyAsync` would fire on every request. The token-bucket bounds
 * worst-case crypto throughput to `MAX_VERIFY_PER_SEC` regardless of
 * attacker token-rotation strategy or distribution across IPs.
 *
 * Sized 200/sec — comfortably above any legitimate-display footprint
 * (each display verifies once per `VERIFY_CACHE_TTL_MS` window;
 * hundreds of displays cold-booting in lockstep would still fit) but
 * far below any plausible CPU-saturation threshold.
 */
const MAX_VERIFY_PER_SEC = 200;

/**
 * `ThrottlerGuard` variant that exempts requests authenticated as a
 * registered display from the **default** global throttle.
 *
 * Displays are paired into the installation via the registration flow
 * (`POST /modules/displays/register`) and intentionally burst N+M reads on
 * cold-boot to warm their local cache (devices → device controls → channels
 * → channel controls → validation, plus weather/system/spaces/scenes/etc.).
 * The default `30 req / 60s` budget is sized for unauthenticated and
 * human/admin traffic; without an exemption the cache-warm waterfall trips
 * the throttle on any non-trivial install and the panel surfaces opaque
 * `null - null` errors that propagate up as a hard init failure.
 *
 * **Why this guard does its own token check** (instead of reading
 * `request.auth` populated by `AuthGuard`): registering the throttler
 * after `AuthGuard` lets unauthenticated traffic to protected endpoints
 * short-circuit at 401 before the throttler runs, leaving anonymous
 * floods unthrottled. The throttler MUST run first to keep that
 * protection. To still know whether the caller is a display, this guard
 * does a lightweight JWT signature check (no DB lookup) on the bearer
 * token.
 *
 * **Why we cheap-decode before verifying.** `shouldSkip` runs in the
 * pre-accounting phase of `ThrottlerGuard.canActivate`, BEFORE the rate
 * limiter has a chance to 429 the request. Naively calling
 * `verifyAsync()` on every Bearer token would force expensive signature
 * crypto on every flooded request, turning the throttler's "cheap DoS
 * gate" role into an asymmetric amplification vector. Three defenses
 * stack:
 *   1. `JwtService.decode()` (pure base64, no crypto) reads the
 *      unverified `type` claim. If it isn't `display`, we never call
 *      `verifyAsync` — forged "user-shaped" floods cost ~0.
 *   2. A bounded LRU cache (`hashToken(token) → verdict`, 60s TTL,
 *      1000 entries) memoizes the verdict for both legitimate display
 *      bursts and repeated-forged-token floods.
 *   3. A process-wide token bucket caps `verifyAsync` calls at
 *      `MAX_VERIFY_PER_SEC` so an attacker who rotates the Bearer
 *      string per request (defeating the per-token cache) still can't
 *      drive crypto cost beyond a fixed ceiling. When the bucket is
 *      drained, requests fall through to the parent throttler counter
 *      without paying for verification.
 *
 * **What this guard never bypasses:**
 * - Routes with explicit `@Throttle({ ... })` overrides — e.g.
 *   `auth.controller.ts` uses `@Throttle({ default: { limit: 5 } })` for
 *   brute-force protection on `/login`, `/register`, `/refresh`, etc.
 *   A stolen display token must NOT unlock unbounded credential probing
 *   on those endpoints, so any per-route/class limit override defers to
 *   the parent `ThrottlerGuard` behavior.
 * - Routes with explicit `@SkipThrottle()` — already opted out at the
 *   route level; defer to the parent.
 * - Non-HTTP execution contexts (WebSocket `@SubscribeMessage`, RPC).
 *   `context.switchToHttp().getRequest()` returns the underlying socket
 *   for those, which has no `.headers` property and would crash; defer
 *   to the parent (which already handles WebSocket via `@SkipThrottle()`
 *   on `WebsocketGateway`).
 *
 * **Trust boundary.** A revoked-but-not-yet-expired display token would
 * bypass the default throttle for the brief window before `AuthGuard`
 * rejects with 401. That's an acceptable trade — every such request
 * still 401s, and issuing a new display token requires physical access
 * to the registration flow. The bypass widens only for trusted
 * device-class clients holding signed tokens against the default
 * throttle, never against per-route stricter limits.
 *
 * **DoS posture.** The combined effect of (1) decode pre-filter, (2)
 * verify cache, and (3) global verify token-bucket is that worst-case
 * crypto throughput from this guard is bounded at `MAX_VERIFY_PER_SEC`
 * regardless of attacker token-rotation strategy or distribution
 * across IPs. Anything beyond that ceiling falls through to the
 * parent throttler counters (per-IP `30 req / 60s` by default) and
 * eventually returns 429 without paying for `verifyAsync`.
 */
@Injectable()
export class DisplayAwareThrottlerGuard extends ThrottlerGuard {
	private readonly verifyCache = new Map<string, VerifyCacheEntry>();

	// Token-bucket state for the global `verifyAsync` rate limit.
	// `verifyTokens` is a fractional count refilled at
	// `MAX_VERIFY_PER_SEC` per second up to a max of `MAX_VERIFY_PER_SEC`.
	// Each `verifyAsync` call consumes 1 token; if the bucket is drained
	// the request defers to the parent throttler instead of paying for
	// signature crypto. See `tryConsumeVerifyToken`.
	private verifyTokens = MAX_VERIFY_PER_SEC;
	private verifyTokensRefilledAt = Date.now();

	constructor(
		@InjectThrottlerOptions() options: ThrottlerModuleOptions,
		@InjectThrottlerStorage() storageService: ThrottlerStorage,
		reflector: Reflector,
		private readonly jwtService: JwtService,
	) {
		super(options, storageService, reflector);
	}

	protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
		// Non-HTTP contexts (WebSocket, RPC) — `request.headers` doesn't
		// exist on the underlying transport object. Defer to parent which
		// honors `@SkipThrottle()` on the gateway.
		if (context.getType() !== 'http') {
			return super.shouldSkip(context);
		}

		// Routes with their own `@Throttle()` / `@SkipThrottle()` metadata
		// take precedence — never blanket-skip a stricter per-route limit
		// (auth endpoints rely on `@Throttle({ default: { limit: 5 } })`
		// for brute-force protection; a display-token-bearing client must
		// not unlock unbounded probing of those endpoints).
		const handler = context.getHandler();
		const classRef = context.getClass();
		const hasExplicitOverride = this.throttlers.some((throttler) => {
			const limit = this.reflector.getAllAndOverride<unknown>(THROTTLER_LIMIT + throttler.name, [handler, classRef]);
			const skip = this.reflector.getAllAndOverride<unknown>(THROTTLER_SKIP + throttler.name, [handler, classRef]);
			return limit !== undefined || skip !== undefined;
		});
		if (hasExplicitOverride) {
			return super.shouldSkip(context);
		}

		const request = context.switchToHttp().getRequest<Request>();
		const token = extractAccessTokenFromHeader(request);
		if (!token) {
			return super.shouldSkip(context);
		}

		// Cheap pre-filter: `decode` is just base64 — no crypto. If the
		// unsigned payload doesn't even claim to be a display, we never
		// pay for `verifyAsync`. Filters out the common case (user
		// access tokens, long-live tokens) and, critically, makes a
		// flood of forged "user-shaped" Bearer tokens a free pass-through
		// to the throttler counters instead of an amplification vector.
		const unverifiedPayload = this.safeDecode(token);
		if (
			!unverifiedPayload ||
			(unverifiedPayload.type as TokenOwnerType) !== TokenOwnerType.DISPLAY ||
			!unverifiedPayload.sub
		) {
			return super.shouldSkip(context);
		}

		// Cache hit on a previously-verified display token — common case
		// for the cache-warm waterfall this whole guard exists for.
		// A burst of N requests from one display verifies once and
		// fast-paths the next N-1 through a Map lookup.
		//
		// Two cache outcomes:
		// - `true` (verified display) → skip throttling, return `true`.
		// - `false` (forged / revoked / expired token, previously
		//   verified) → DON'T return `false` directly; defer to
		//   `super.shouldSkip(context)`. Every other "don't skip" path
		//   in this method does the same, so any logic the parent
		//   `ThrottlerGuard.shouldSkip` runs (now or after a future
		//   `@nestjs/throttler` upgrade — `skipIf`, `ignoreUserAgents`,
		//   etc.) stays honored for cached-negative tokens.
		const cached = this.readVerifyCache(token);
		if (cached === true) {
			return true;
		}
		if (cached === false) {
			return super.shouldSkip(context);
		}

		// Process-wide verify rate limit. Closes the residual attack
		// where an attacker rotates the Bearer string per request
		// (defeating the per-token cache) — once the bucket is drained
		// the request defers to the parent throttler counter without
		// paying for signature crypto. Legitimate display traffic
		// almost never hits this because each display verifies once
		// per `VERIFY_CACHE_TTL_MS` window.
		if (!this.tryConsumeVerifyToken()) {
			return super.shouldSkip(context);
		}

		// Cache miss + payload claims display + budget available —
		// pay the verify cost once and cache the verdict.
		try {
			const verified: JwtPayload = await this.jwtService.verifyAsync(token);
			const ok = (verified.type as TokenOwnerType) === TokenOwnerType.DISPLAY && !!verified.sub;
			this.writeVerifyCache(token, ok);
			if (ok) {
				return true;
			}
		} catch {
			// Invalid signature / expired / malformed — cache the
			// negative verdict too so a forged-token flood doesn't
			// re-verify the same token over and over. Throttler
			// counters still apply; AuthGuard will return the 401.
			this.writeVerifyCache(token, false);
		}

		return super.shouldSkip(context);
	}

	/**
	 * Token-bucket consumer. Refills `MAX_VERIFY_PER_SEC` tokens per
	 * second up to a `MAX_VERIFY_PER_SEC` cap, debits 1 token per
	 * `verifyAsync` call. Returns `false` (no token available) only
	 * when the process is already running at the configured ceiling.
	 */
	private tryConsumeVerifyToken(): boolean {
		const now = Date.now();
		const elapsedSec = (now - this.verifyTokensRefilledAt) / 1000;
		this.verifyTokens = Math.min(MAX_VERIFY_PER_SEC, this.verifyTokens + elapsedSec * MAX_VERIFY_PER_SEC);
		this.verifyTokensRefilledAt = now;
		if (this.verifyTokens < 1) {
			return false;
		}
		this.verifyTokens -= 1;
		return true;
	}

	private safeDecode(token: string): JwtPayload | null {
		try {
			// `JwtService.decode` is typed loosely (`any`); narrow through
			// `unknown` so the rest of the function deals in concrete types.
			const decoded: unknown = this.jwtService.decode(token);
			return typeof decoded === 'object' && decoded !== null ? (decoded as JwtPayload) : null;
		} catch {
			return null;
		}
	}

	private readVerifyCache(token: string): boolean | null {
		const key = hashToken(token);
		const entry = this.verifyCache.get(key);
		if (!entry) {
			return null;
		}
		if (entry.expiresAt <= Date.now()) {
			this.verifyCache.delete(key);
			return null;
		}
		return entry.ok;
	}

	private writeVerifyCache(token: string, ok: boolean): void {
		const key = hashToken(token);
		// Bounded LRU: drop the oldest entry once full. Map iteration
		// order is insertion order, so `keys().next()` is the oldest.
		if (this.verifyCache.size >= VERIFY_CACHE_MAX_ENTRIES && !this.verifyCache.has(key)) {
			// Drop the oldest entry. Iterate-and-break instead of
			// `.keys().next().value` because the latter's `IteratorResult`
			// return type widens to `any` under our strict ESLint rules.
			for (const oldestKey of this.verifyCache.keys()) {
				this.verifyCache.delete(oldestKey);
				break;
			}
		}
		this.verifyCache.set(key, { ok, expiresAt: Date.now() + VERIFY_CACHE_TTL_MS });
	}
}
