import { type Ref, ref } from 'vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';

export interface IVoiceProviderStatus {
	type: string;
	name: string;
	description: string;
	enabled: boolean;
	configured: boolean;
	selected: boolean;
}

interface IUseBuddyVoiceProviders {
	providerStatuses: Ref<IVoiceProviderStatus[]>;
	providerStatusesFetched: Ref<boolean>;
	providerFetchFailed: Ref<boolean>;
	fetchProviderStatuses: () => Promise<void>;
}

// Module-level singletons per kind so all callers share the same state
const stateMap = new Map<string, { statuses: Ref<IVoiceProviderStatus[]>; fetched: Ref<boolean>; failed: Ref<boolean> }>();

const getState = (kind: string) => {
	if (!stateMap.has(kind)) {
		stateMap.set(kind, {
			statuses: ref<IVoiceProviderStatus[]>([]),
			fetched: ref<boolean>(false),
			failed: ref<boolean>(false),
		});
	}

	return stateMap.get(kind)!;
};

export const useBuddyVoiceProviders = (kind: 'stt' | 'tts'): IUseBuddyVoiceProviders => {
	const backend = useBackend();
	const state = getState(kind);

	const fetchProviderStatuses = async (): Promise<void> => {
		state.failed.value = false;

		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/providers/${kind}` as never);

			const res = response as { data?: { data: IVoiceProviderStatus[] }; error?: unknown; response?: { status?: number } };
			const status = res.response?.status;

			if (status && status >= 400) {
				state.failed.value = true;

				return;
			}

			if (typeof res.data !== 'undefined') {
				state.statuses.value = res.data.data;
			} else {
				state.failed.value = true;
			}
		} catch {
			state.failed.value = true;
		} finally {
			state.fetched.value = true;
		}
	};

	return {
		providerStatuses: state.statuses,
		providerStatusesFetched: state.fetched,
		providerFetchFailed: state.failed,
		fetchProviderStatuses,
	};
};
