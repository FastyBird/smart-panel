import { ref } from 'vue';

import type { OpenApiPaths } from '../../openapi.constants';
import { injectBackendClient } from '../services/backend';

import type { IUseBackend } from './types';

export const useBackend = <Paths extends object = OpenApiPaths>(): IUseBackend<Paths> => {
	const client = injectBackendClient<Paths>();

	const pendingRequests = ref<number>(0);

	return {
		pendingRequests,
		client,
	};
};
