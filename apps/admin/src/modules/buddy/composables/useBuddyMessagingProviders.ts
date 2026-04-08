import { type Ref, ref } from 'vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';

export interface IMessagingProviderStatus {
	type: string;
	name: string;
	description: string;
	enabled: boolean;
	configured: boolean;
}

interface IUseBuddyMessagingProviders {
	messagingProviderStatuses: Ref<IMessagingProviderStatus[]>;
	messagingProviderStatusesFetched: Ref<boolean>;
	messagingProviderFetchFailed: Ref<boolean>;
	fetchMessagingProviderStatuses: () => Promise<void>;
}

// Module-level singletons so all callers share the same state
const messagingProviderStatuses = ref<IMessagingProviderStatus[]>([]);
const messagingProviderStatusesFetched = ref<boolean>(false);
const messagingProviderFetchFailed = ref<boolean>(false);

export const useBuddyMessagingProviders = (): IUseBuddyMessagingProviders => {
	const backend = useBackend();

	const fetchMessagingProviderStatuses = async (): Promise<void> => {
		messagingProviderFetchFailed.value = false;

		try {
			const { data: responseData, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/providers/messaging`,
			);

			if (apiError || !responseData) {
				messagingProviderFetchFailed.value = true;

				return;
			}

			messagingProviderStatuses.value = responseData.data as IMessagingProviderStatus[];
		} catch {
			messagingProviderFetchFailed.value = true;
		} finally {
			messagingProviderStatusesFetched.value = true;
		}
	};

	return {
		messagingProviderStatuses,
		messagingProviderStatusesFetched,
		messagingProviderFetchFailed,
		fetchMessagingProviderStatuses,
	};
};
