import { type Ref, ref } from 'vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';

export interface ITtsProviderStatus {
	type: string;
	name: string;
	description: string;
	enabled: boolean;
	configured: boolean;
	selected: boolean;
}

interface IUseBuddyTtsProviders {
	ttsProviderStatuses: Ref<ITtsProviderStatus[]>;
	ttsProviderStatusesFetched: Ref<boolean>;
	ttsProviderFetchFailed: Ref<boolean>;
	fetchTtsProviderStatuses: () => Promise<void>;
}

// Module-level singletons so all callers share the same state
const ttsProviderStatuses = ref<ITtsProviderStatus[]>([]);
const ttsProviderStatusesFetched = ref<boolean>(false);
const ttsProviderFetchFailed = ref<boolean>(false);

export const useBuddyTtsProviders = (): IUseBuddyTtsProviders => {
	const backend = useBackend();

	const fetchTtsProviderStatuses = async (): Promise<void> => {
		ttsProviderFetchFailed.value = false;

		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/providers/tts` as never);

			const res = response as { data?: { data: ITtsProviderStatus[] }; error?: unknown; response?: { status?: number } };
			const status = res.response?.status;

			if (status && status >= 400) {
				ttsProviderFetchFailed.value = true;

				return;
			}

			if (typeof res.data !== 'undefined') {
				ttsProviderStatuses.value = res.data.data;
			} else {
				ttsProviderFetchFailed.value = true;
			}
		} catch {
			ttsProviderFetchFailed.value = true;
		} finally {
			ttsProviderStatusesFetched.value = true;
		}
	};

	return {
		ttsProviderStatuses,
		ttsProviderStatusesFetched,
		ttsProviderFetchFailed,
		fetchTtsProviderStatuses,
	};
};
