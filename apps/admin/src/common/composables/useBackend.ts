import { ref } from 'vue';

import { injectBackendClient } from '../services';

import type { IUseBackend } from './types';

export function useBackend(): IUseBackend {
	const client = injectBackendClient();

	const pendingRequests = ref<number>(0);

	return {
		pendingRequests,
		client,
	};
}
