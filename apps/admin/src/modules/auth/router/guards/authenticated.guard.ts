import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import type { IStoresManager } from '../../../../common';
import { RouteNames } from '../../auth.constants';
import { sessionStoreKey } from '../../store/keys';

export const GUARD_NAME = 'authenticated';

const authenticatedGuard = (storesManager: IStoresManager, to: RouteRecordRaw): Error | boolean | RouteLocationRaw => {
	const sessionStore = storesManager.getStore(sessionStoreKey);
	const toGuards: string[] | Record<string, unknown> | null =
		to.meta && 'guards' in to.meta ? (to.meta.guards as string[] | Record<string, unknown>) : [];

	if (
		!sessionStore.isSignedIn() &&
		toGuards &&
		((Array.isArray(toGuards) && toGuards.includes(GUARD_NAME)) || (typeof toGuards === 'object' && GUARD_NAME in toGuards))
	) {
		const fullPath = 'fullPath' in to && typeof to.fullPath === 'string' ? to.fullPath : undefined;

		return {
			name: RouteNames.SIGN_IN,
			...(fullPath?.startsWith('/mcp-oauth-consent?') ? { query: { redirect: fullPath } } : {}),
		};
	}

	return true;
};

export default authenticatedGuard;
