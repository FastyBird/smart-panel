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
	providerStatusesFetched: Ref<boolean>;
	providerFetchFailed: Ref<boolean>;
	fetchProviderStatuses: () => Promise<void>;
}

export const useBuddyProviders = (): IUseBuddyProviders => {
	const backend = useBackend();

	const providerStatuses = ref<IProviderStatus[]>([]);
	const providerStatusesFetched = ref<boolean>(false);
	const providerFetchFailed = ref<boolean>(false);

	const fetchProviderStatuses = async (): Promise<void> => {
		providerFetchFailed.value = false;

		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/providers` as never);

			const responseData = (response as { data?: { data: IProviderStatus[] } }).data;

			if (typeof responseData !== 'undefined') {
				providerStatuses.value = responseData.data;
			}
		} catch {
			providerFetchFailed.value = true;
		} finally {
			providerStatusesFetched.value = true;
		}
	};

	return {
		providerStatuses,
		providerStatusesFetched,
		providerFetchFailed,
		fetchProviderStatuses,
	};
};
