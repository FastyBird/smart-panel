import { type Ref, ref } from 'vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';

export interface ISttProviderStatus {
	type: string;
	name: string;
	description: string;
	enabled: boolean;
	configured: boolean;
	selected: boolean;
}

interface IUseBuddySttProviders {
	sttProviderStatuses: Ref<ISttProviderStatus[]>;
	sttProviderStatusesFetched: Ref<boolean>;
	sttProviderFetchFailed: Ref<boolean>;
	fetchSttProviderStatuses: () => Promise<void>;
}

// Module-level singletons so all callers share the same state
const sttProviderStatuses = ref<ISttProviderStatus[]>([]);
const sttProviderStatusesFetched = ref<boolean>(false);
const sttProviderFetchFailed = ref<boolean>(false);

export const useBuddySttProviders = (): IUseBuddySttProviders => {
	const backend = useBackend();

	const fetchSttProviderStatuses = async (): Promise<void> => {
		sttProviderFetchFailed.value = false;

		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/providers/stt` as never);

			const res = response as { data?: { data: ISttProviderStatus[] }; error?: unknown; response?: { status?: number } };
			const status = res.response?.status;

			if (status && status >= 400) {
				sttProviderFetchFailed.value = true;

				return;
			}

			if (typeof res.data !== 'undefined') {
				sttProviderStatuses.value = res.data.data;
			} else {
				sttProviderFetchFailed.value = true;
			}
		} catch {
			sttProviderFetchFailed.value = true;
		} finally {
			sttProviderStatusesFetched.value = true;
		}
	};

	return {
		sttProviderStatuses,
		sttProviderStatusesFetched,
		sttProviderFetchFailed,
		fetchSttProviderStatuses,
	};
};
