import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpOAuthScope } from '../mcp.constants';

import { useMcpOAuthManagement } from './useMcpOAuthManagement';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
};

vi.mock('../../../common', () => ({
	useBackend: () => ({ client: backendClient }),
	snakeToCamel: (value: unknown): unknown => value,
}));

const client = {
	id: '10000000-0000-4000-8000-000000000001',
	clientIdentifier: 'public-client-id',
	name: 'Codex',
	redirectUris: ['http://127.0.0.1:1455/callback'],
	maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
	enabled: true,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: null,
};
const grant = {
	id: '20000000-0000-4000-8000-000000000001',
	clientId: client.id,
	clientName: client.name,
	approvedById: '30000000-0000-4000-8000-000000000001',
	approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
	expiresAt: '2030-01-01T00:00:00.000Z',
	revokedAt: null,
	active: true,
	createdAt: '2026-01-01T00:00:00.000Z',
};
const family = {
	id: '40000000-0000-4000-8000-000000000001',
	clientId: client.id,
	clientName: client.name,
	grantId: grant.id,
	expiresAt: '2030-01-01T00:00:00.000Z',
	activeTokenCount: 1,
};
const accessToken = {
	id: '50000000-0000-4000-8000-000000000001',
	clientId: client.id,
	clientName: client.name,
	grantId: grant.id,
	refreshFamilyId: family.id,
	scopes: [McpOAuthScope.READ],
	expiresAt: '2030-01-01T00:00:00.000Z',
};

describe('useMcpOAuthManagement', () => {
	beforeEach(() => vi.clearAllMocks());

	it('loads clients, grants, access tokens, and refresh families together', async () => {
		backendClient.GET.mockResolvedValueOnce({ data: { data: [client] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [grant] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [accessToken] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [family] }, response: { status: 200 } });
		const management = useMcpOAuthManagement();

		await management.fetchAll();

		expect(management.clients.value).toEqual([client]);
		expect(management.grants.value).toEqual([grant]);
		expect(management.accessTokens.value).toEqual([accessToken]);
		expect(management.refreshFamilies.value).toEqual([family]);
	});

	it('pre-registers a public client through the generated API contract', async () => {
		backendClient.POST.mockResolvedValue({ data: { data: client }, response: { status: 201 } });
		const management = useMcpOAuthManagement();

		await management.createClient({
			name: client.name,
			redirectUris: client.redirectUris,
			maximumScopes: client.maximumScopes,
		});

		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/oauth/clients', {
			body: {
				data: {
					name: client.name,
					redirect_uris: client.redirectUris,
					maximum_scopes: client.maximumScopes,
				},
			},
		});
		expect(management.clients.value).toEqual([client]);
	});

	it('removes a revoked refresh family and all access tokens issued from it', async () => {
		backendClient.GET.mockResolvedValueOnce({ data: { data: [client] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [grant] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [accessToken] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [family] }, response: { status: 200 } });
		backendClient.POST.mockResolvedValue({ data: undefined, response: { status: 204, ok: true } });
		const management = useMcpOAuthManagement();
		await management.fetchAll();

		await management.revokeRefreshFamily(family.id);

		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/oauth/refresh-families/{id}/revoke', {
			params: { path: { id: family.id } },
		});
		expect(management.refreshFamilies.value).toEqual([]);
		expect(management.accessTokens.value).toEqual([]);
	});

	it('revokes all OAuth authorization and preserves registered clients', async () => {
		backendClient.GET.mockResolvedValueOnce({ data: { data: [client] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [grant] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [accessToken] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [family] }, response: { status: 200 } });
		backendClient.POST.mockResolvedValue({ data: undefined, response: { status: 204, ok: true } });
		const management = useMcpOAuthManagement();
		await management.fetchAll();

		await management.revokeAll();

		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/oauth/revoke-all', {});
		expect(management.clients.value).toEqual([client]);
		expect(management.grants.value).toEqual([
			expect.objectContaining({ id: grant.id, active: false, revokedAt: expect.any(String) }),
		]);
		expect(management.accessTokens.value).toEqual([]);
		expect(management.refreshFamilies.value).toEqual([]);
	});

	it('updates a grant through the reduction-only generated API contract', async () => {
		const reduced = { ...grant, approvedScopes: [McpOAuthScope.READ] };
		backendClient.GET.mockResolvedValueOnce({ data: { data: [client] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [grant] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [accessToken] }, response: { status: 200 } })
			.mockResolvedValueOnce({ data: { data: [family] }, response: { status: 200 } });
		backendClient.PATCH.mockResolvedValue({ data: { data: reduced }, response: { status: 200 } });
		const management = useMcpOAuthManagement();
		await management.fetchAll();

		await management.updateGrant(grant.id, { approvedScopes: [McpOAuthScope.READ] });

		expect(backendClient.PATCH).toHaveBeenCalledWith('/modules/mcp/oauth/grants/{id}', {
			params: { path: { id: grant.id } },
			body: { data: { approved_scopes: [McpOAuthScope.READ] } },
		});
		expect(management.grants.value).toEqual([reduced]);
	});
});
