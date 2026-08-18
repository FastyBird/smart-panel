import { describe, expect, it, vi } from 'vitest';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import { RouteNames } from '../../mcp.constants';

import oauthEnabledGuard from './oauth-enabled.guard';

const route = (name: string) => ({ name }) as never;

describe('oauthEnabledGuard', () => {
	it('lets unrelated routes through untouched', () => {
		const guard = oauthEnabledGuard(() => ({ oauthEnabled: false }));

		expect(guard(undefined, route(RouteNames.CLIENTS))).toBe(true);
		expect(guard(undefined, route('some-other-route'))).toBe(true);
	});

	it('allows the oauth routes while oauth is enabled', () => {
		const guard = oauthEnabledGuard(() => ({ oauthEnabled: true }));

		expect(guard(undefined, route(RouteNames.OAUTH_MANAGEMENT))).toBe(true);
		expect(guard(undefined, route(RouteNames.OAUTH_CONSENT))).toBe(true);
	});

	it('redirects the oauth routes away while oauth is disabled', () => {
		// The provider's endpoints are not mounted when oauth is off, so the page
		// can only ever show empty tables and the consent flow cannot complete.
		const guard = oauthEnabledGuard(() => ({ oauthEnabled: false }));

		expect(guard(undefined, route(RouteNames.OAUTH_MANAGEMENT))).toEqual({ name: AppRouteNames.ROOT });
		expect(guard(undefined, route(RouteNames.OAUTH_CONSENT))).toEqual({ name: AppRouteNames.ROOT });
	});

	it('does not redirect before the module config has loaded', () => {
		// A deep link can arrive before the config fetch resolves; bouncing the
		// user away on a value that is merely not known yet would be wrong.
		const guard = oauthEnabledGuard(() => null);

		expect(guard(undefined, route(RouteNames.OAUTH_MANAGEMENT))).toBe(true);
	});

	it('reads the flag fresh on every call', () => {
		const read = vi.fn().mockReturnValueOnce({ oauthEnabled: false }).mockReturnValueOnce({ oauthEnabled: true });
		const guard = oauthEnabledGuard(read);

		expect(guard(undefined, route(RouteNames.OAUTH_MANAGEMENT))).toEqual({ name: AppRouteNames.ROOT });
		// Toggling the flag in settings must take effect without a reload.
		expect(guard(undefined, route(RouteNames.OAUTH_MANAGEMENT))).toBe(true);
	});
});
