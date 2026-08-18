import { type Ref, computed, ref, watch } from 'vue';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, useListQuery } from '../../../common';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { resolveMcpClientStatus } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';

import { McpClientsFilterSchema } from './schemas';
import type { IMcpClientsFilter, IUseMcpClientsDataSource } from './types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

export const defaultMcpClientsFilter: IMcpClientsFilter = {
	search: undefined,
	status: 'all',
	enabled: 'all',
	capabilities: [],
};

export const defaultMcpClientsSort: ISortEntry = {
	by: 'name',
	dir: 'asc',
};

/**
 * Clients are held in a ref owned by `useMcpClients`, not in a store, so the
 * list is passed in rather than fetched again here — calling the composable a
 * second time would otherwise produce a second, unsynchronised list.
 */
export const useMcpClientsDataSource = (clients: Ref<IMcpClient[]>): IUseMcpClientsDataSource => {
	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof McpClientsFilterSchema>({
		key: `${MCP_MODULE_NAME}:clients:list`,
		filters: {
			schema: McpClientsFilterSchema,
			defaults: defaultMcpClientsFilter,
		},
		sort: {
			defaults: [defaultMcpClientsSort],
		},
		pagination: {
			defaults: {
				page: DEFAULT_PAGE,
				size: DEFAULT_PAGE_SIZE,
			},
		},
		syncQuery: true,
		version: 1,
	});

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultMcpClientsFilter.search ||
			filters.value.status !== defaultMcpClientsFilter.status ||
			filters.value.enabled !== defaultMcpClientsFilter.enabled ||
			!isEqual(filters.value.capabilities, defaultMcpClientsFilter.capabilities)
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'status' | 'expires' | 'lastUsed' | undefined>(
		sort.value.length > 0 ? (sort.value[0]?.by as 'name' | 'status' | 'expires' | 'lastUsed') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? (sort.value[0]?.dir ?? null) : null);

	const matchesFilters = (client: IMcpClient): boolean => {
		const search = filters.value.search?.trim().toLowerCase();

		if (typeof search !== 'undefined' && search !== '') {
			const haystack = `${client.name} ${client.description ?? ''}`.toLowerCase();

			if (!haystack.includes(search)) {
				return false;
			}
		}

		if (filters.value.status !== 'all' && resolveMcpClientStatus(client) !== filters.value.status) {
			return false;
		}

		if (filters.value.enabled !== 'all' && client.enabled !== (filters.value.enabled === 'enabled')) {
			return false;
		}

		if (
			filters.value.capabilities.length > 0 &&
			!filters.value.capabilities.some((capability: McpCapability) => client.capabilities.includes(capability))
		) {
			return false;
		}

		return true;
	};

	const sortValue = (client: IMcpClient): string | number => {
		switch (sortBy.value) {
			case 'status':
				return resolveMcpClientStatus(client);
			case 'expires':
				// Nulls sort last ascending — a credential with no expiry is not
				// "expiring soonest".
				return client.credentialExpiresAt === null ? Number.MAX_SAFE_INTEGER : new Date(client.credentialExpiresAt).getTime();
			case 'lastUsed':
				return client.lastUsedAt === null ? 0 : new Date(client.lastUsedAt).getTime();
			default:
				return client.name;
		}
	};

	const clientsFiltered = computed<IMcpClient[]>((): IMcpClient[] => {
		return orderBy<IMcpClient>(
			clients.value.filter(matchesFilters),
			[(client: IMcpClient) => sortValue(client)],
			[sortDir.value === 'desc' ? 'desc' : 'asc']
		);
	});

	const clientsPaginated = computed<IMcpClient[]>((): IMcpClient[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;

		return clientsFiltered.value.slice(start, start + paginateSize.value);
	});

	// Counts what the list is showing, so the pager cannot disagree with the rows.
	const totalRows = computed<number>((): number => clientsFiltered.value.length);

	// `useListQuery` owns the URL-synced state, so every one of these pairs has to
	// run in both directions: inwards so a pasted link or the back button restores
	// the list, outwards so sorting or paging updates the address bar.
	watch(
		(): { page?: number; size?: number } => pagination.value,
		(val: { page?: number; size?: number }): void => {
			paginatePage.value = val.page ?? DEFAULT_PAGE;
			paginateSize.value = val.size ?? DEFAULT_PAGE_SIZE;
		},
		{ deep: true }
	);

	watch(
		(): number => paginatePage.value,
		(val: number): void => {
			pagination.value.page = val;
		}
	);

	watch(
		(): number => paginateSize.value,
		(val: number): void => {
			pagination.value.size = val;
		}
	);

	watch(
		(): ISortEntry[] => sort.value,
		(val: ISortEntry[]): void => {
			sortBy.value = val.length > 0 ? (val[0]?.by as 'name' | 'status' | 'expires' | 'lastUsed') : undefined;
			sortDir.value = val.length > 0 ? (val[0]?.dir ?? null) : null;
		}
	);

	watch(
		(): 'asc' | 'desc' | null => sortDir.value,
		(val: 'asc' | 'desc' | null): void => {
			sort.value = typeof sortBy.value === 'undefined' || val === null ? [] : [{ by: sortBy.value, dir: val }];
		}
	);

	watch(
		(): 'name' | 'status' | 'expires' | 'lastUsed' | undefined => sortBy.value,
		(val: 'name' | 'status' | 'expires' | 'lastUsed' | undefined): void => {
			sort.value = typeof val === 'undefined' || sortDir.value === null ? [] : [{ by: val, dir: sortDir.value }];
		}
	);

	// A filter change can leave the pager past the end of the new result set.
	watch(
		(): number => totalRows.value,
		(val: number): void => {
			const lastPage = Math.max(1, Math.ceil(val / paginateSize.value));

			if (paginatePage.value > lastPage) {
				paginatePage.value = lastPage;
				pagination.value = { ...pagination.value, page: lastPage };
			}
		}
	);

	return {
		clients: clientsFiltered,
		clientsPaginated,
		totalRows,
		filters,
		filtersActive,
		sortBy,
		sortDir,
		paginateSize,
		paginatePage,
		resetFilter,
	};
};
