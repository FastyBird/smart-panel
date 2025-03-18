import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import type { IStoresManager } from '../../../../common';
import { sessionStoreKey } from '../../store';

export const GUARD_NAME = 'anonymous';

const anonymousGuard = (storesManager: IStoresManager, to: RouteRecordRaw): Error | boolean | RouteLocationRaw => {
	const sessionStore = storesManager.getStore(sessionStoreKey);
	const toGuards: string[] | Record<string, unknown> | null =
		to.meta && 'guards' in to.meta ? (to.meta.guards as string[] | Record<string, unknown>) : [];

	if (
		sessionStore.isSignedIn() &&
		toGuards &&
		((Array.isArray(toGuards) && toGuards.includes(GUARD_NAME)) || (typeof toGuards === 'object' && GUARD_NAME in toGuards))
	) {
		return { name: AppRouteNames.ROOT };
	}

	return true;
};

export default anonymousGuard;
