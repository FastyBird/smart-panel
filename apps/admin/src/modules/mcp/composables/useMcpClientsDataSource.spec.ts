import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpCapability } from '../mcp.constants';
import type { IMcpClient } from '../schemas/client.types';

import { defaultMcpClientsFilter, defaultMcpClientsSort, useMcpClientsDataSource } from './useMcpClientsDataSource';

const build = (overrides: Partial<IMcpClient> & Pick<IMcpClient, 'id' | 'name'>): IMcpClient =>
	({
		description: null,
		enabled: true,
		capabilities: [McpCapability.read],
		createdById: null,
		tokenId: null,
		credentialExpiresAt: null,
		credentialRevoked: false,
		lastUsedAt: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: null,
		...overrides,
	}) as unknown as IMcpClient;

const active = build({ id: '1', name: 'Charlie', lastUsedAt: '2026-03-01T00:00:00.000Z' });
const revoked = build({ id: '2', name: 'alpha', credentialRevoked: true });
const expired = build({ id: '3', name: 'Bravo', credentialExpiresAt: '2020-01-01T00:00:00.000Z' });
const disabled = build({ id: '4', name: 'delta', enabled: false, capabilities: [McpCapability.write] });

const clients = ref<IMcpClient[]>([active, revoked, expired, disabled]);

const mockFilters = ref({ ...defaultMcpClientsFilter });
const mockPagination = ref<{ page?: number; size?: number }>({ page: 1, size: 25 });
const mockSort = ref([defaultMcpClientsSort]);

vi.mock('../../../common', () => ({
	useListQuery: vi.fn(() => ({
		filters: mockFilters,
		pagination: mockPagination,
		sort: mockSort,
		viewMode: ref('table'),
		reset: vi.fn(() => {
			mockFilters.value = { ...defaultMcpClientsFilter };
		}),
	})),
}));

describe('useMcpClientsDataSource', () => {
	beforeEach(() => {
		mockFilters.value = { ...defaultMcpClientsFilter };
		mockPagination.value = { page: 1, size: 25 };
		mockSort.value = [defaultMcpClientsSort];
		clients.value = [active, revoked, expired, disabled];
	});

	it('returns every client when no filter is applied', () => {
		const { clients: result, totalRows } = useMcpClientsDataSource(clients);

		expect(result.value).toHaveLength(4);
		expect(totalRows.value).toBe(4);
	});

	it('sorts by name case-insensitively rather than by raw code point', () => {
		const { clients: result } = useMcpClientsDataSource(clients);

		expect(result.value.map((client) => client.name)).toEqual(['alpha', 'Bravo', 'Charlie', 'delta']);
	});

	it('matches the search term against name and description', () => {
		clients.value = [build({ id: '5', name: 'Kitchen agent', description: 'reads the oven' }), active];
		mockFilters.value = { ...defaultMcpClientsFilter, search: 'oven' };

		const { clients: result } = useMcpClientsDataSource(clients);

		expect(result.value.map((client) => client.id)).toEqual(['5']);
	});

	it.each([
		['revoked', '2'],
		['expired', '3'],
		['active', '1'],
	])('filters by the %s status', (status, expectedId) => {
		mockFilters.value = { ...defaultMcpClientsFilter, status: status as 'revoked' | 'expired' | 'active' };

		const { clients: result } = useMcpClientsDataSource(clients);

		expect(result.value.map((client) => client.id)).toEqual([expectedId]);
	});

	it('treats a disabled client as disabled rather than active', () => {
		mockFilters.value = { ...defaultMcpClientsFilter, status: 'active' };

		const { clients: result } = useMcpClientsDataSource(clients);

		expect(result.value.map((client) => client.id)).not.toContain('4');
	});

	it('filters by capability', () => {
		mockFilters.value = { ...defaultMcpClientsFilter, capabilities: [McpCapability.write] };

		const { clients: result } = useMcpClientsDataSource(clients);

		expect(result.value.map((client) => client.id)).toEqual(['4']);
	});

	it('reports filters as active only once one differs from the default', () => {
		const { filtersActive } = useMcpClientsDataSource(clients);

		expect(filtersActive.value).toBe(false);

		mockFilters.value = { ...defaultMcpClientsFilter, status: 'revoked' };

		expect(filtersActive.value).toBe(true);
	});

	it('paginates the filtered rows', () => {
		mockPagination.value = { page: 1, size: 2 };

		const { clientsPaginated, totalRows } = useMcpClientsDataSource(clients);

		expect(clientsPaginated.value).toHaveLength(2);
		// The count drives the pager, so it must describe the whole filtered set.
		expect(totalRows.value).toBe(4);
	});

	it('sorts clients with no expiry last when sorting by expiry ascending', () => {
		mockSort.value = [{ by: 'expires', dir: 'asc' }];

		const { clients: result } = useMcpClientsDataSource(clients);

		// Only the expired client carries a date; the rest never expire and must
		// not be presented as expiring soonest.
		expect(result.value[0]?.id).toBe('3');
	});
});
