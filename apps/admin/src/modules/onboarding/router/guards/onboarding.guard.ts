import type { RouteRecordRaw } from 'vue-router';

import type { IAppUser } from '../../../../app.types';
import { RouteNames } from '../../onboarding.constants';
import { useOnboardingStatus } from '../../composables/composables';

export const onboardingGuard = async (
	_appUser: IAppUser | undefined,
	route: RouteRecordRaw,
): Promise<boolean | { name: string }> => {
	const { needsOnboarding, isOnboardingCompleted, fetchStatus } = useOnboardingStatus();

	try {
		await fetchStatus();
	} catch {
		// If backend is unreachable, allow navigation
		return true;
	}

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
