import { type ComputedRef, type Ref, computed, ref, watch } from 'vue';

import { z } from 'zod';

import { type ISortEntry, useListQuery } from '../../../common';
import { MCP_MODULE_NAME } from '../mcp.constants';

export const McpOAuthTabFilterSchema = z.object({
	search: z.string().optional(),
	status: z.string().default('all'),
});

export type IMcpOAuthTabFilter = z.infer<typeof McpOAuthTabFilterSchema>;

const defaultFilter: IMcpOAuthTabFilter = { search: undefined, status: 'all' };

interface IUseMcpOAuthTabQueryOptions<T> {
	/** Distinguishes this tab's query state from the other tabs'. */
	key: string;
	items: Ref<T[]> | ComputedRef<T[]>;
	/** Values a search term is matched against, case-insensitively. */
	searchable: (item: T) => (string | null | undefined)[];
	/** Sortable columns, keyed by the `prop` the table column declares. */
	sortable: Record<string, (item: T) => string | number>;
	defaultSortBy: string;
	/** Omitted by tabs with no meaningful status axis, which then filter on search alone. */
	statusOf?: (item: T) => string;
}

export interface IUseMcpOAuthTabQuery<T> {
	items: ComputedRef<T[]>;
	filters: Ref<IMcpOAuthTabFilter>;
	filtersActive: ComputedRef<boolean>;
	sortBy: Ref<string | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

/**
 * Search, sort and optional status filtering for one OAuth tab.
 *
 * The four tabs hold different records but need identical behaviour, so the
 * differences are passed in rather than the composable being written four
 * times. Each tab keeps its own query state, so switching tabs does not carry
 * one tab's search across to another.
 */
export const useMcpOAuthTabQuery = <T>({
	key,
	items,
	searchable,
	sortable,
	defaultSortBy,
	statusOf,
}: IUseMcpOAuthTabQueryOptions<T>): IUseMcpOAuthTabQuery<T> => {
	const {
		filters,
		sort,
		reset: resetFilter,
	} = useListQuery<typeof McpOAuthTabFilterSchema>({
		key: `${MCP_MODULE_NAME}:oauth:${key}`,
		filters: {
			schema: McpOAuthTabFilterSchema,
			defaults: defaultFilter,
		},
		sort: {
			defaults: [{ by: defaultSortBy, dir: 'asc' }],
		},
		syncQuery: true,
		version: 1,
	});

	const filtersActive = computed<boolean>(
		(): boolean => filters.value.search !== defaultFilter.search || filters.value.status !== defaultFilter.status
	);

	const sortBy = ref<string | undefined>(sort.value.length > 0 ? sort.value[0]?.by : defaultSortBy);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? (sort.value[0]?.dir ?? null) : 'asc');

	const matches = (item: T): boolean => {
		const search = filters.value.search?.trim().toLowerCase();

		if (typeof search !== 'undefined' && search !== '') {
			const haystack = searchable(item)
				.filter((value): value is string => typeof value === 'string')
				.join(' ')
				.toLowerCase();

			if (!haystack.includes(search)) {
				return false;
			}
		}

		if (typeof statusOf !== 'undefined' && filters.value.status !== 'all' && statusOf(item) !== filters.value.status) {
			return false;
		}

		return true;
	};

	const filtered = computed<T[]>((): T[] => {
		const rows = items.value.filter(matches);
		const read = typeof sortBy.value === 'string' ? sortable[sortBy.value] : undefined;

		if (typeof read === 'undefined' || sortDir.value === null) {
			return rows;
		}

		const direction = sortDir.value === 'desc' ? -1 : 1;

		return [...rows].sort((a, b) => {
			const left = read(a);
			const right = read(b);

			if (typeof left === 'number' && typeof right === 'number') {
				return (left - right) * direction;
			}

			// Locale compare so names sort the way a reader expects rather than by
			// code point, which puts every capital ahead of every lowercase.
			return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' }) * direction;
		});
	});

	// `useListQuery` owns the URL-synced state, so both directions are wired:
	// inwards to restore a pasted link, outwards so sorting updates the address.
	watch(
		(): ISortEntry[] => sort.value,
		(val: ISortEntry[]): void => {
			sortBy.value = val.length > 0 ? val[0]?.by : undefined;
			sortDir.value = val.length > 0 ? (val[0]?.dir ?? null) : null;
		}
	);

	watch([sortBy, sortDir], (): void => {
		sort.value = typeof sortBy.value === 'undefined' || sortDir.value === null ? [] : [{ by: sortBy.value, dir: sortDir.value }];
	});

	return {
		items: filtered,
		filters,
		filtersActive,
		sortBy,
		sortDir,
		resetFilter,
	};
};
