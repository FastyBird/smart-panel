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
 * gate" role into an asymmetric amplification vector. Two defenses:
 *   1. `JwtService.decode()` (pure base64, no crypto) reads the
 *      unverified `type` claim. If it isn't `display`, we never call
 *      `verifyAsync` — forged "user-shaped" floods cost ~0.
 *   2. A bounded LRU cache (`hashToken(token) → verdict`, 60s TTL,
 *      1000 entries) memoizes the verdict for both legitimate display
 *      bursts and repeated-forged-token floods. An attacker has to
 *      generate a new JWT per request to keep paying the verify cost.
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
 */
@Injectable()
export class DisplayAwareThrottlerGuard extends ThrottlerGuard {
	private readonly verifyCache = new Map<string, VerifyCacheEntry>();

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
		const cached = this.readVerifyCache(token);
		if (cached !== null) {
			return cached;
		}

		// Cache miss + payload claims display — pay the verify cost
		// once and cache the verdict. A flood of distinct forged
		// "display-shaped" tokens still triggers verifyAsync on each
		// new token, but the attacker has to GENERATE each token, so
		// the cost is no longer asymmetric.
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
