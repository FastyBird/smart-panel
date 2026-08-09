import { beforeEach, describe, expect, it, vi } from 'vitest';

import { McpOAuthScope } from '../mcp.constants';

import { useMcpOAuthInteraction } from './useMcpOAuthInteraction';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', () => ({
	useBackend: () => ({ client: backendClient }),
	snakeToCamel: (value: unknown): unknown => value,
}));

const interaction = {
	action: 'consent',
	installationName: 'Panel',
	installationId: '10000000-0000-4000-8000-000000000001',
	clientIdentifier: 'codex-client',
	clientName: 'Codex',
	redirectUri: 'http://127.0.0.1:1455/callback',
	requestedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.OFFLINE_ACCESS],
	accessExpiresInSeconds: 600,
	maximumGrantExpiresInDays: 90,
	physicalDeviceWarning: true,
};

describe('useMcpOAuthInteraction', () => {
	beforeEach(() => vi.clearAllMocks());

	it('loads the bounded consent disclosure', async () => {
		backendClient.GET.mockResolvedValue({ data: { data: interaction }, response: { status: 200 } });
		const { load } = useMcpOAuthInteraction();

		await expect(load('interaction-id')).resolves.toEqual(interaction);
		expect(backendClient.GET).toHaveBeenCalledWith('/modules/mcp/oauth/interactions/{uid}', {
			params: { path: { uid: 'interaction-id' } },
		});
	});

	it('submits only the selected scopes and finite grant lifetime', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: { redirectTo: '/auth/resume' } },
			response: { status: 200 },
		});
		const { approve } = useMcpOAuthInteraction();

		await expect(approve('interaction-id', [McpOAuthScope.READ], 30)).resolves.toEqual({
			redirectTo: '/auth/resume',
		});
		expect(backendClient.POST).toHaveBeenCalledWith('/modules/mcp/oauth/interactions/{uid}/approve', {
			params: { path: { uid: 'interaction-id' } },
			body: { data: { scopes: [McpOAuthScope.READ], expires_in_days: 30 } },
		});
	});

	it('returns the denial redirect from the provider', async () => {
		backendClient.POST.mockResolvedValue({
			data: { data: { redirectTo: 'http://127.0.0.1/callback?error=access_denied' } },
			response: { status: 200 },
		});
		const { deny } = useMcpOAuthInteraction();

		await expect(deny('interaction-id')).resolves.toEqual({
			redirectTo: 'http://127.0.0.1/callback?error=access_denied',
		});
	});
});
