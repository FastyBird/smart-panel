import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import type { IStoresManager } from '../../../../common';
import { RouteNames } from '../../auth.constants';
import { sessionStoreKey } from '../../store';

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
		return { name: RouteNames.SIGN_IN };
	}

	return true;
};

export default authenticatedGuard;
