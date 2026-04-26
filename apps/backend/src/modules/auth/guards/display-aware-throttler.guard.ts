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

import { ACCESS_TOKEN_TYPE, TokenOwnerType } from '../auth.constants';

interface JwtPayload {
	sub?: string;
	type?: string;
}

/**
 * `ThrottlerGuard` variant that exempts requests authenticated as a
 * registered display.
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
 * after `AuthGuard` would let unauthenticated traffic to protected
 * endpoints short-circuit at 401 before the throttler runs, leaving
 * anonymous floods unthrottled. The throttler MUST run first to keep
 * that protection. To still know whether the caller is a display, this
 * guard does a lightweight JWT signature check (no DB lookup) on the
 * bearer token: if the signature verifies AND `payload.type` is
 * `TokenOwnerType.DISPLAY`, throttling is skipped. `AuthGuard` later
 * runs the full DB-backed validation (revocation, expiry, owner exists).
 *
 * **Trust boundary.** A revoked-but-not-yet-expired display token would
 * bypass throttling for the brief window before `AuthGuard` rejects with
 * 401. That's an acceptable trade — every such request still 401s, and
 * issuing a new display token requires physical access to the
 * registration flow. The bypass only widens the door for trusted
 * device-class clients holding signed tokens, not arbitrary attackers.
 *
 * Web admin sessions, long-live user tokens, anonymous traffic, missing
 * Authorization headers, non-Bearer schemes, and tokens with bad
 * signatures all fall through to the default throttle.
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
		const request = context.switchToHttp().getRequest<Request>();
		const token = this.extractTokenFromHeader(request);

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

	private extractTokenFromHeader(request: Request): string | undefined {
		const authHeader = request.headers.authorization;
		if (!authHeader) {
			return undefined;
		}
		const [type, token] = authHeader.split(' ');
		return type === ACCESS_TOKEN_TYPE ? token : undefined;
	}
}
