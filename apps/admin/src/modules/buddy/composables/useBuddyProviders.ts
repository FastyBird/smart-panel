import { type Ref, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';

export interface IProviderStatus {
	type: string;
	name: string;
	description: string;
	default_model: string;
	enabled: boolean;
	configured: boolean;
	selected: boolean;
}

interface IUseBuddyProviders {
	providerStatuses: Ref<IProviderStatus[]>;
	fetchProviderStatuses: () => Promise<void>;
}

export const useBuddyProviders = (): IUseBuddyProviders => {
	const backend = useBackend();

	const providerStatuses = ref<IProviderStatus[]>([]);

	const fetchProviderStatuses = async (): Promise<void> => {
		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/providers` as never);

			const responseData = (response as { data?: { data: IProviderStatus[] } }).data;

			if (typeof responseData !== 'undefined') {
				providerStatuses.value = responseData.data;
			}
		} catch {
			// Silently fail — provider statuses are non-critical
		}
	};

	return {
		providerStatuses,
		fetchProviderStatuses,
	};
};
