import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { RouteNames as AppRouteNames } from '../../../../app.constants';
import type { IAccountManager } from '../../../../common';
import { RouteNames } from '../../auth.constants';

export const GUARD_NAME = 'locked';

const lockedGuard = (accountManager: IAccountManager | undefined, to: RouteRecordRaw): Error | boolean | RouteLocationRaw => {
	if (!accountManager) {
		return true;
	}

	const isLocked = accountManager.isLocked.value;
	const isSignedIn = accountManager.isSignedIn.value;
	const isLockRoute = to.name === RouteNames.LOCK || to.name === RouteNames.LOCK_SCREEN;

	// If locked but session expired, clear stale lock and let the
	// authenticated guard redirect to sign-in
	if (isLocked && !isSignedIn) {
		accountManager.unlock?.();

		return true;
	}

	// If user is locked and signed in, redirect to lock screen (unless already there)
	if (isLocked && isSignedIn && !isLockRoute) {
		return { name: RouteNames.LOCK_SCREEN };
	}

	// If user is not locked and tries to access lock screen, redirect to root
	if (!isLocked && isLockRoute) {
		return { name: AppRouteNames.ROOT };
	}

	return true;
};

export default lockedGuard;
