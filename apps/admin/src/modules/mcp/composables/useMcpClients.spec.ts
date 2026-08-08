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

vi.mock('../../../common', () => ({
	useBackend: () => ({ client: backendClient }),
	snakeToCamel: (value: unknown): unknown => value,
}));

const client = {
	id: '10000000-0000-4000-8000-000000000001',
	name: 'Test agent',
	description: null,
	enabled: true,
	capabilities: [McpCapability.read],
	createdById: null,
	tokenId: '20000000-0000-4000-8000-000000000001',
	credentialExpiresAt: '2030-01-01T00:00:00.000Z',
	credentialRevoked: false,
	lastUsedAt: null,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: null,
};

describe('useMcpClients', () => {
	beforeEach(() => vi.clearAllMocks());

	it('surfaces failed list requests instead of silently returning an empty list', async () => {
		backendClient.GET.mockResolvedValue({ data: undefined, response: { status: 503 } });
		const { fetchClients, error } = useMcpClients();

		await expect(fetchClients()).rejects.toBeInstanceOf(McpApiException);
		expect(error.value).toBeInstanceOf(McpApiException);
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
		expect(clients.value).toEqual([client]);
	});
});
