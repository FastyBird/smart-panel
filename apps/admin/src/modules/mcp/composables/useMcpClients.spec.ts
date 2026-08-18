import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpCapability } from '../mcp.constants';
import { McpApiException } from '../mcp.exceptions';

import { useMcpClients } from './useMcpClients';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');

	// The real converter, so the fixture below can be the snake_case the API
	// actually returns rather than a shape that merely matches the schema.
	return { useBackend: () => ({ client: backendClient }), snakeToCamel: actual.snakeToCamel };
});

// Exactly what the API returns, per the generated OpenAPI types.
const client = {
	id: '10000000-0000-4000-8000-000000000001',
	name: 'Test agent',
	description: null,
	enabled: true,
	capabilities: [McpCapability.read],
	created_by_id: null,
	token_id: '20000000-0000-4000-8000-000000000001',
	credential_expires_at: '2030-01-01T00:00:00.000Z',
	credential_revoked: false,
	last_used_at: null,
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: null,
};
const parsedClient = {
	id: client.id,
	name: client.name,
	description: client.description,
	enabled: client.enabled,
	capabilities: client.capabilities,
	createdById: client.created_by_id,
	tokenId: client.token_id,
	credentialExpiresAt: client.credential_expires_at,
	credentialRevoked: client.credential_revoked,
	lastUsedAt: client.last_used_at,
	createdAt: client.created_at,
	updatedAt: client.updated_at,
};

describe('useMcpClients', () => {
	beforeEach(() => vi.clearAllMocks());

	it('surfaces failed list requests instead of silently returning an empty list', async () => {
		backendClient.GET.mockResolvedValue({ data: undefined, response: { status: 503 } });
		const { fetchClients, error } = useMcpClients();

		await expect(fetchClients()).rejects.toBeInstanceOf(McpApiException);
		expect(error.value).toBeInstanceOf(McpApiException);
	});

	it('validates a listed client against the api contract', async () => {
		backendClient.GET.mockResolvedValue({ data: { data: [client] }, response: { status: 200 } });

		const { fetchClients, clients } = useMcpClients();

		await fetchClients();

		expect(clients.value).toEqual([parsedClient]);
	});

	it('rejects a listed client whose shape does not match the contract', async () => {
		// A field the backend renames must be reported as a contract mismatch
		// rather than reaching the store as a missing property.
		const withoutRevoked: Record<string, unknown> = { ...client };
		delete withoutRevoked.credential_revoked;

		backendClient.GET.mockResolvedValue({ data: { data: [withoutRevoked] }, response: { status: 200 } });

		const { fetchClients } = useMcpClients();

		await expect(fetchClients()).rejects.toThrow();
	});

	it('creates a finite capability-scoped credential and stores its client', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: { client, token: 'one-time-secret' } },
			response: { status: 201 },
		});
		const { createClient, clients } = useMcpClients();

		const credential = await createClient({
			name: 'Test agent',
			description: null,
			capabilities: [McpCapability.read],
			expiresInDays: 30,
		});

		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/clients', {
			body: {
				data: {
					name: 'Test agent',
					description: null,
					capabilities: [McpCapability.read],
					expires_in_days: 30,
				},
			},
		});
		expect(credential.token).toBe('one-time-secret');
		expect(clients.value).toEqual([parsedClient]);
	});
});
