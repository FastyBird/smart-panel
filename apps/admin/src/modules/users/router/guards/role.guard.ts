import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import type { IAppUser } from '../../../../app.types';

export const GUARD_NAME = 'roles';

const roleGuard = (appUser: IAppUser | undefined, to: RouteRecordRaw): Error | boolean | RouteLocationRaw => {
	const toGuards: string[] | Record<string, unknown> | null =
		to.meta && 'guards' in to.meta ? (to.meta.guards as string[] | Record<string, unknown>) : [];

	if (toGuards && typeof toGuards === 'object' && GUARD_NAME in toGuards && Array.isArray(toGuards[GUARD_NAME]) && toGuards[GUARD_NAME].length > 0) {
		if (typeof appUser !== 'undefined' && toGuards[GUARD_NAME].includes(appUser.role)) {
			return true;
		}

		return { name: AppRouteNames.ROOT };
	}

	return true;
};

export default roleGuard;
