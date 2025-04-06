import { ref } from 'vue';

import { injectBackendClient } from '../services/backend';

import type { IUseBackend } from './types';

export const useBackend = (): IUseBackend => {
	const client = injectBackendClient();

	const pendingRequests = ref<number>(0);

	return {
		pendingRequests,
		client,
	};
};
