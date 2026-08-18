import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpOAuthScope } from '../mcp.constants';

import { useMcpOAuthManagement } from './useMcpOAuthManagement';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');

	// The real converter, so the fixtures below can be the snake_case the API
	// actually returns rather than a shape that merely matches the schema.
	return { useBackend: () => ({ client: backendClient }), snakeToCamel: actual.snakeToCamel };
});

// Exactly what the API returns, per the generated OpenAPI types.
const client = {
	id: '10000000-0000-4000-8000-000000000001',
	client_id: 'public-client-id',
	name: 'Codex',
	redirect_uris: ['http://127.0.0.1:1455/callback'],
	maximum_scopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
	enabled: true,
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: null,
};
const parsedClient = {
	id: client.id,
	clientIdentifier: client.client_id,
	name: client.name,
	redirectUris: client.redirect_uris,
	maximumScopes: client.maximum_scopes,
	enabled: client.enabled,
	createdAt: client.created_at,
	updatedAt: client.updated_at,
};

const grant = {
	id: '20000000-0000-4000-8000-000000000001',
	client_id: client.id,
	client_name: client.name,
	approved_by_id: '30000000-0000-4000-8000-000000000001',
	approved_scopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
	expires_at: '2030-01-01T00:00:00.000Z',
	revoked_at: null,
	active: true,
	created_at: '2026-01-01T00:00:00.000Z',
};
const parsedGrant = {
	id: grant.id,
	clientId: grant.client_id,
	clientName: grant.client_name,
	approvedById: grant.approved_by_id,
	approvedScopes: grant.approved_scopes,
	expiresAt: grant.expires_at,
	revokedAt: grant.revoked_at,
	active: grant.active,
	createdAt: grant.created_at,
};
const family = {
	id: '40000000-0000-4000-8000-000000000001',
	client_id: client.id,
	client_name: client.name,
	grant_id: grant.id,
	expires_at: '2030-01-01T00:00:00.000Z',
	active_token_count: 1,
};
const accessToken = {
	id: '50000000-0000-4000-8000-000000000001',
	client_id: client.id,
	client_name: client.name,
	grant_id: grant.id,
	refresh_family_id: family.id,
	scopes: [McpOAuthScope.READ],
	expires_at: '2030-01-01T00:00:00.000Z',
};

const parsedFamily = {
	id: family.id,
	clientId: family.client_id,
	clientName: family.client_name,
	grantId: family.grant_id,
	expiresAt: family.expires_at,
	activeTokenCount: family.active_token_count,
};
const parsedAccessToken = {
	id: accessToken.id,
	clientId: accessToken.client_id,
	clientName: accessToken.client_name,
	grantId: accessToken.grant_id,
	refreshFamilyId: accessToken.refresh_family_id,
	scopes: accessToken.scopes,
	expiresAt: accessToken.expires_at,
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

		expect(management.clients.value).toEqual([parsedClient]);
		expect(management.grants.value).toEqual([parsedGrant]);
		expect(management.accessTokens.value).toEqual([parsedAccessToken]);
		expect(management.refreshFamilies.value).toEqual([parsedFamily]);
	});

	it('pre-registers a public client through the generated API contract', async () => {
		backendClient.POST.mockResolvedValue({ data: { data: client }, response: { status: 201 } });
		const management = useMcpOAuthManagement();

		await management.createClient({
			name: client.name,
			redirectUris: parsedClient.redirectUris,
			maximumScopes: parsedClient.maximumScopes,
		});

		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/oauth/clients', {
			body: {
				data: {
					name: client.name,
					redirect_uris: client.redirect_uris,
					maximum_scopes: client.maximum_scopes,
				},
			},
		});
		expect(management.clients.value).toEqual([parsedClient]);
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
		backendClient.POST.mockResolvedValue({ data: { data: { revoked: true } }, response: { status: 200, ok: true } });
		const management = useMcpOAuthManagement();
		await management.fetchAll();

		await management.revokeAll();

		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/oauth/revoke-all', {});
		expect(management.clients.value).toEqual([parsedClient]);
		expect(management.grants.value).toEqual([expect.objectContaining({ id: grant.id, active: false, revokedAt: expect.any(String) })]);
		expect(management.accessTokens.value).toEqual([]);
		expect(management.refreshFamilies.value).toEqual([]);
	});

	it('updates a grant through the reduction-only generated API contract', async () => {
		// The API echoes the updated record back in its own snake_case shape.
		const reduced = { ...grant, approved_scopes: [McpOAuthScope.READ] };
		const parsedReduced = { ...parsedGrant, approvedScopes: [McpOAuthScope.READ] };
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
		expect(management.grants.value).toEqual([parsedReduced]);
	});
});
