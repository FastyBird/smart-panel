import { computed, ref } from 'vue';

import { useBackend, useLogger } from '../../../common';
import { DISPLAYS_MODULE_PREFIX } from '../displays.constants';
import { DisplaysException } from '../displays.exceptions';

export interface IPermitJoinStatus {
	active: boolean;
	expiresAt: Date | null;
	remainingTime: number | null;
	deploymentMode: string;
	available: boolean;
}

export const usePermitJoin = () => {
	const backend = useBackend();
	const logger = useLogger();

	const status = ref<IPermitJoinStatus | null>(null);
	const loading = ref<boolean>(false);
	const activating = ref<boolean>(false);

	const isAvailable = computed<boolean>(() => {
		return status.value?.available ?? false;
	});

	const isActive = computed<boolean>(() => {
		return status.value?.active ?? false;
	});

	const deploymentMode = computed<string>(() => {
		return status.value?.deploymentMode ?? 'combined';
	});

	const remainingTime = computed<number | null>(() => {
		return status.value?.remainingTime ?? null;
	});

	const remainingTimeSeconds = computed<number>(() => {
		const time = remainingTime.value;
		if (time === null) {
			return 0;
		}
		return Math.ceil(time / 1000);
	});

	const fetchStatus = async (): Promise<void> => {
		try {
			loading.value = true;

			const {
				data: { data: statusData },
			} = await backend.client.GET(`/${DISPLAYS_MODULE_PREFIX}/displays/permit-join/status`);

			if (statusData) {
				status.value = {
					active: statusData.active ?? false,
					expiresAt: statusData.expires_at ? new Date(statusData.expires_at) : null,
					remainingTime: statusData.remaining_time ?? null,
					deploymentMode: statusData.deployment_mode ?? 'combined',
					available: statusData.available ?? false,
				};
			}
		} catch (error: unknown) {
			logger.error('Failed to fetch permit join status', error);

			throw new DisplaysException('Failed to fetch permit join status');
		} finally {
			loading.value = false;
		}
	};

	const activate = async (): Promise<void> => {
		try {
			activating.value = true;

			await backend.client.POST(`/${DISPLAYS_MODULE_PREFIX}/displays/permit-join`);

			// Refresh status after activation
			await fetchStatus();
		} catch (error: unknown) {
			logger.error('Failed to activate permit join', error);

			throw new DisplaysException('Failed to activate permit join');
		} finally {
			activating.value = false;
		}
	};

	return {
		status,
		loading,
		activating,
		isAvailable,
		isActive,
		deploymentMode,
		remainingTime,
		remainingTimeSeconds,
		fetchStatus,
		activate,
	};
};
