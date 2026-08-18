import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import type { IAppUser } from '../../../../app.types';
import { RouteNames } from '../../mcp.constants';

type RouteGuard = (appUser: IAppUser | undefined, route: RouteRecordRaw) => Error | boolean | RouteLocationRaw;

/** Only the flag matters here; the rest of the module config is irrelevant. */
type OAuthFlag = { oauthEnabled?: boolean } | null;

const OAUTH_ROUTES: string[] = [RouteNames.OAUTH_MANAGEMENT, RouteNames.OAUTH_CONSENT];

/**
 * Keeps the OAuth pages out of reach while the provider is switched off.
 *
 * `oauth_enabled` decides whether the backend mounts the provider's endpoints
 * at all — with it off, grants, access tokens and refresh families can never be
 * created and the consent flow cannot complete, so the pages could only ever
 * show empty tables.
 *
 * The flag is read through a callback rather than captured, so toggling it in
 * settings takes effect without a reload. Registered with the shared router
 * guard, which is consulted both when building the menu and when navigating,
 * so one registration hides the item and blocks the URL.
 */
const oauthEnabledGuard =
	(readConfig: () => OAuthFlag): RouteGuard =>
	(_appUser: IAppUser | undefined, route: RouteRecordRaw): Error | boolean | RouteLocationRaw => {
		if (typeof route.name !== 'string' || !OAUTH_ROUTES.includes(route.name)) {
			return true;
		}

		const config = readConfig();

		// Not loaded yet — a deep link can arrive before the config fetch
		// resolves, and redirecting on an unknown value would be wrong.
		if (config === null) {
			return true;
		}

		return config.oauthEnabled === true ? true : { name: AppRouteNames.ROOT };
	};

export default oauthEnabledGuard;
