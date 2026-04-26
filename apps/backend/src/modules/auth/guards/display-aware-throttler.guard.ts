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
import { extractAccessTokenFromHeader } from '../utils/token.utils';

interface JwtPayload {
	sub?: string;
	type?: string;
}

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
		if (token) {
			try {
				const payload: JwtPayload = await this.jwtService.verifyAsync(token);
				if ((payload.type as TokenOwnerType) === TokenOwnerType.DISPLAY && payload.sub) {
					return true;
				}
			} catch {
				// Invalid signature / expired / malformed — do NOT skip; let
				// the throttler apply normally so a flood of bad tokens still
				// counts toward the budget. AuthGuard will return the 401.
			}
		}

		return super.shouldSkip(context);
	}
}
