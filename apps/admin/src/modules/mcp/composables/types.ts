import type { ComputedRef, Ref } from 'vue';

import type { z } from 'zod';

import type { IMcpClient } from '../schemas/client.types';

import type { McpClientsFilterSchema } from './schemas';

export type IMcpClientsFilter = z.infer<typeof McpClientsFilterSchema>;

export type IMcpClientsSortBy = 'name' | 'status' | 'expires' | 'lastUsed';

export interface IUseMcpClientsDataSource {
	clients: ComputedRef<IMcpClient[]>;
	clientsPaginated: ComputedRef<IMcpClient[]>;
	totalRows: ComputedRef<number>;
	filters: Ref<IMcpClientsFilter>;
	filtersActive: ComputedRef<boolean>;
	sortBy: Ref<IMcpClientsSortBy | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	resetFilter: () => void;
}
