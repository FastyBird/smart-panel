import { type Ref } from 'vue';

import { type IVoiceProviderStatus, useBuddyVoiceProviders } from './useBuddyVoiceProviders';

export type ITtsProviderStatus = IVoiceProviderStatus;

interface IUseBuddyTtsProviders {
	ttsProviderStatuses: Ref<ITtsProviderStatus[]>;
	ttsProviderStatusesFetched: Ref<boolean>;
	ttsProviderFetchFailed: Ref<boolean>;
	fetchTtsProviderStatuses: () => Promise<void>;
}

export const useBuddyTtsProviders = (): IUseBuddyTtsProviders => {
	const { providerStatuses, providerStatusesFetched, providerFetchFailed, fetchProviderStatuses } = useBuddyVoiceProviders('tts');

	return {
		ttsProviderStatuses: providerStatuses,
		ttsProviderStatusesFetched: providerStatusesFetched,
		ttsProviderFetchFailed: providerFetchFailed,
		fetchTtsProviderStatuses: fetchProviderStatuses,
	};
};
