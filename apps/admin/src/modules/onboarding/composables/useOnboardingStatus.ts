import { computed, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';

export interface IOnboardingStatus {
	hasOwner: boolean;
	onboardingCompleted: boolean;
	devicesCount: number;
	spacesCount: number;
	displaysCount: number;
}

const status = ref<IOnboardingStatus | null>(null);
const isLoading = ref(false);
const lastFetched = ref<number | null>(null);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Standalone cache invalidation — safe to call outside Vue setup context.
 * Use this when you need to clear the onboarding status cache from services
 * that don't have access to the composable (e.g. SystemActionsService).
 */
export const invalidateOnboardingStatus = (): void => {
	status.value = null;
	lastFetched.value = null;
};

export const useOnboardingStatus = () => {
	const backend = useBackend();

	const needsOnboarding = computed(() => status.value !== null && !status.value.hasOwner);
	const isOnboardingCompleted = computed(() => status.value?.onboardingCompleted ?? false);

	const fetchStatus = async (force = false): Promise<IOnboardingStatus | null> => {
		if (!force && status.value && lastFetched.value) {
			const age = Date.now() - lastFetched.value;
			if (age < CACHE_TTL_MS) return status.value;
		}

		isLoading.value = true;

		try {
			const { data, error } = await backend.client.GET(`/${MODULES_PREFIX}/system/system/onboarding`);

			if (error || !data) {
				return null;
			}

			status.value = {
				hasOwner: data.data.has_owner,
				onboardingCompleted: data.data.onboarding_completed,
				devicesCount: data.data.devices_count,
				spacesCount: data.data.spaces_count,
				displaysCount: data.data.displays_count,
			};

			lastFetched.value = Date.now();

			return status.value;
		} catch {
			return null;
		} finally {
			isLoading.value = false;
		}
	};

	const invalidate = () => {
		status.value = null;
		lastFetched.value = null;
	};

	const markComplete = async (): Promise<boolean> => {
		try {
			const { error } = await backend.client.POST(`/${MODULES_PREFIX}/system/system/onboarding/complete`);

			if (error) return false;

			invalidate();
			await fetchStatus(true);

			return true;
		} catch {
			return false;
		}
	};

	return {
		status,
		isLoading,
		needsOnboarding,
		isOnboardingCompleted,
		fetchStatus,
		invalidate,
		markComplete,
	};
};
