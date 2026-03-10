import type { RouteRecordRaw } from 'vue-router';

import type { IAppUser } from '../../../../app.types';
import { RouteNames } from '../../onboarding.constants';
import { useOnboardingStatus } from '../../composables/composables';

export const onboardingGuard = (
	_appUser: IAppUser | undefined,
	route: RouteRecordRaw,
): boolean | { name: string } => {
	const { needsOnboarding, isOnboardingCompleted, fetchStatus } = useOnboardingStatus();

	// Trigger a background fetch to keep the cache warm.
	// The guard uses the cached value synchronously; on the very first
	// load (cache empty) status is null so both computed flags are false
	// and we fall through to `return true`, which lets the normal auth
	// flow proceed. Once the fetch resolves the next navigation will
	// have a populated cache.
	void fetchStatus();

	const isOnboardingRoute = route.name === RouteNames.ONBOARDING;

	// App needs onboarding and user is NOT on the onboarding route → redirect to onboarding
	if (needsOnboarding.value && !isOnboardingRoute) {
		return { name: RouteNames.ONBOARDING };
	}

	// App doesn't need onboarding (or onboarding completed) and user IS on onboarding route → redirect away
	if (!needsOnboarding.value && isOnboardingRoute && isOnboardingCompleted.value) {
		return { name: 'app-root' };
	}

	return true;
};
