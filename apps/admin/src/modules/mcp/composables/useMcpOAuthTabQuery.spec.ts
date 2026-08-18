import { nextTick, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMcpOAuthTabQuery } from './useMcpOAuthTabQuery';

interface Row {
	id: string;
	clientName: string;
	status: string;
	count: number;
}

const rows = ref<Row[]>([
	{ id: '1', clientName: 'Charlie', status: 'active', count: 3 },
	{ id: '2', clientName: 'alpha', status: 'revoked', count: 10 },
	{ id: '3', clientName: 'Bravo', status: 'expired', count: 1 },
]);

const mockFilters = ref<{ search?: string; status: string }>({ search: undefined, status: 'all' });
const mockSort = ref<{ by: string; dir: 'asc' | 'desc' }[]>([{ by: 'clientName', dir: 'asc' }]);

vi.mock('../../../common', () => ({
	useListQuery: vi.fn(() => ({
		filters: mockFilters,
		sort: mockSort,
		pagination: ref({}),
		viewMode: ref('table'),
		reset: vi.fn(() => {
			mockFilters.value = { search: undefined, status: 'all' };
		}),
	})),
}));

const build = (withStatus = true) =>
	useMcpOAuthTabQuery<Row>({
		key: 'test',
		items: rows,
		searchable: (row) => [row.clientName],
		sortable: {
			clientName: (row) => row.clientName,
			count: (row) => row.count,
		},
		defaultSortBy: 'clientName',
		statusOf: withStatus ? (row) => row.status : undefined,
	});

describe('useMcpOAuthTabQuery', () => {
	beforeEach(() => {
		mockFilters.value = { search: undefined, status: 'all' };
		mockSort.value = [{ by: 'clientName', dir: 'asc' }];
	});

	it('returns every row when nothing is filtered', () => {
		expect(build().items.value).toHaveLength(3);
	});

	it('matches the search term case-insensitively', () => {
		mockFilters.value = { search: 'BRAVO', status: 'all' };

		expect(build().items.value.map((row) => row.id)).toEqual(['3']);
	});

	it('filters by status when the tab has a status axis', () => {
		mockFilters.value = { search: undefined, status: 'revoked' };

		expect(build().items.value.map((row) => row.id)).toEqual(['2']);
	});

	it('ignores the status filter on a tab without a status axis', () => {
		mockFilters.value = { search: undefined, status: 'revoked' };

		// Tabs like refresh families have nothing to filter on, so a stale status
		// in the URL must not empty the table.
		expect(build(false).items.value).toHaveLength(3);
	});

	it('sorts names without putting every capital first', () => {
		expect(build().items.value.map((row) => row.clientName)).toEqual(['alpha', 'Bravo', 'Charlie']);
	});

	it('sorts numeric columns numerically rather than as text', () => {
		mockSort.value = [{ by: 'count', dir: 'asc' }];

		// String ordering would put 10 before 3.
		expect(build().items.value.map((row) => row.count)).toEqual([1, 3, 10]);
	});

	it('reverses on a descending sort', () => {
		mockSort.value = [{ by: 'clientName', dir: 'desc' }];

		expect(build().items.value.map((row) => row.clientName)).toEqual(['Charlie', 'Bravo', 'alpha']);
	});

	it('writes a sort change back to the query state', async () => {
		const { sortBy, sortDir } = build();

		sortBy.value = 'count';
		sortDir.value = 'desc';
		await nextTick();

		expect(mockSort.value).toEqual([{ by: 'count', dir: 'desc' }]);
	});

	it('reports filters as active only once one differs from its default', () => {
		const query = build();

		expect(query.filtersActive.value).toBe(false);

		mockFilters.value = { search: 'x', status: 'all' };

		expect(query.filtersActive.value).toBe(true);
	});
});
