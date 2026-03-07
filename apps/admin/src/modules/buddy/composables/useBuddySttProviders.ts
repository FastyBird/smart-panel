import { type Ref } from 'vue';

import { type IVoiceProviderStatus, useBuddyVoiceProviders } from './useBuddyVoiceProviders';

export type ISttProviderStatus = IVoiceProviderStatus;

interface IUseBuddySttProviders {
	sttProviderStatuses: Ref<ISttProviderStatus[]>;
	sttProviderStatusesFetched: Ref<boolean>;
	sttProviderFetchFailed: Ref<boolean>;
	fetchSttProviderStatuses: () => Promise<void>;
}

export const useBuddySttProviders = (): IUseBuddySttProviders => {
	const { providerStatuses, providerStatusesFetched, providerFetchFailed, fetchProviderStatuses } = useBuddyVoiceProviders('stt');

	return {
		sttProviderStatuses: providerStatuses,
		sttProviderStatusesFetched: providerStatusesFetched,
		sttProviderFetchFailed: providerFetchFailed,
		fetchSttProviderStatuses: fetchProviderStatuses,
	};
};
