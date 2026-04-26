import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { TokenOwnerType } from '../auth.constants';

import { AuthenticatedRequest } from './auth.guard';

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
 * Web admin sessions, long-live user tokens, and unauthenticated traffic
 * still hit the default throttle, so this only widens the door for trusted
 * device-class clients — it doesn't disable rate-limiting globally.
 *
 * **Ordering invariant.** This guard depends on `AuthGuard` having
 * populated `request.auth` first. That ordering is enforced by registering
 * both guards as `APP_GUARD` providers inside `AuthModule.providers`, with
 * `AuthGuard` declared *before* this one — within a single module, NestJS
 * executes `APP_GUARD` providers in declared array order. Do not move
 * either registration to a different module; the cross-module load order
 * isn't stable enough to rely on.
 *
 * Even with that invariant the check is conservative: if `request.auth`
 * is somehow `undefined`, the call falls through to `super.shouldSkip()`
 * and the default throttle applies. The fail-safe direction is "throttle
 * still applies", never "throttle accidentally removed".
 */
@Injectable()
export class DisplayAwareThrottlerGuard extends ThrottlerGuard {
	protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const auth = request.auth;

		if (auth?.type === 'token' && auth.ownerType === TokenOwnerType.DISPLAY) {
			return true;
		}

		return super.shouldSkip(context);
	}
}
