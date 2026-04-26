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
 * Falls back to default throttle behavior whenever `request.auth` isn't
 * populated (e.g. if `AuthGuard` ever runs after this one due to a future
 * module-load order change). The fail-safe direction is "throttle still
 * applies", never "throttle accidentally removed".
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
