import { ref } from 'vue';

import type { paths } from '../../openapi';
import { injectBackendClient } from '../services/backend';

import type { IUseBackend } from './types';

export const useBackend = <Paths extends object = paths>(): IUseBackend<Paths> => {
	const client = injectBackendClient<Paths>();

	const pendingRequests = ref<number>(0);

	return {
		pendingRequests,
		client,
	};
};
