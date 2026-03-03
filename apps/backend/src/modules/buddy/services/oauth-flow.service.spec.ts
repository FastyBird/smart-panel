import { OAuthFlowParams, OAuthFlowService } from './oauth-flow.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeFlowParams(overrides: Partial<OAuthFlowParams> = {}): OAuthFlowParams {
	return {
		authorizeUrl: overrides.authorizeUrl ?? 'https://auth.example.com/authorize',
		tokenUrl: overrides.tokenUrl ?? 'https://auth.example.com/token',
		clientId: overrides.clientId ?? 'client-id-123',
		redirectUri: overrides.redirectUri ?? 'https://panel.local/oauth/callback',
		scopes: overrides.scopes ?? 'read write',
		pluginType: overrides.pluginType ?? 'buddy-claude-plugin',
		extraParams: overrides.extraParams,
		useJsonTokenExchange: overrides.useJsonTokenExchange,
	};
}

function makeTokenResponse(overrides: { access_token?: string; refresh_token?: string } = {}): Response {
	return {
		ok: true,
		status: 200,
		json: jest.fn().mockResolvedValue({
			access_token: overrides.access_token ?? 'access-token-abc',
			refresh_token: overrides.refresh_token ?? 'refresh-token-def',
		}),
		text: jest.fn().mockResolvedValue(''),
	} as unknown as Response;
}

function makeErrorResponse(status: number = 400, body: string = 'Bad Request'): Response {
	return {
		ok: false,
		status,
		json: jest.fn().mockRejectedValue(new Error('Not JSON')),
		text: jest.fn().mockResolvedValue(body),
	} as unknown as Response;
}

describe('OAuthFlowService', () => {
	let service: OAuthFlowService;

	beforeEach(() => {
		jest.useFakeTimers();

		service = new OAuthFlowService();
		mockFetch.mockReset();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('createFlow', () => {
		it('should create a PKCE flow with state and authorizeUrl', () => {
			const result = service.createFlow(makeFlowParams());

			expect(result.state).toBeDefined();
			expect(typeof result.state).toBe('string');
			expect(result.state.length).toBeGreaterThan(0);
			expect(result.authorizeUrl).toContain('https://auth.example.com/authorize');
		});

		it('should include PKCE code_challenge and code_challenge_method in authorize URL', () => {
			const result = service.createFlow(makeFlowParams());
			const url = new URL(result.authorizeUrl);

			expect(url.searchParams.get('code_challenge')).toBeDefined();
			expect(url.searchParams.get('code_challenge')).not.toBe('');
			expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		});

		it('should include response_type, client_id, redirect_uri, and state in authorize URL', () => {
			const result = service.createFlow(makeFlowParams());
			const url = new URL(result.authorizeUrl);

			expect(url.searchParams.get('response_type')).toBe('code');
			expect(url.searchParams.get('client_id')).toBe('client-id-123');
			expect(url.searchParams.get('redirect_uri')).toBe('https://panel.local/oauth/callback');
			expect(url.searchParams.get('state')).toBe(result.state);
		});

		it('should include scopes when provided', () => {
			const result = service.createFlow(makeFlowParams({ scopes: 'read write' }));
			const url = new URL(result.authorizeUrl);

			expect(url.searchParams.get('scope')).toBe('read write');
		});

		it('should not include scope when scopes is empty', () => {
			const result = service.createFlow(makeFlowParams({ scopes: '' }));
			const url = new URL(result.authorizeUrl);

			expect(url.searchParams.has('scope')).toBe(false);
		});

		it('should include extra params in authorize URL', () => {
			const result = service.createFlow(
				makeFlowParams({
					extraParams: { audience: 'https://api.example.com', prompt: 'consent' },
				}),
			);
			const url = new URL(result.authorizeUrl);

			expect(url.searchParams.get('audience')).toBe('https://api.example.com');
			expect(url.searchParams.get('prompt')).toBe('consent');
		});

		it('should generate unique state for each flow', () => {
			const result1 = service.createFlow(makeFlowParams());
			const result2 = service.createFlow(makeFlowParams());

			expect(result1.state).not.toBe(result2.state);
		});

		it('should clean up expired flows when creating a new flow', async () => {
			// Create first flow
			const result1 = service.createFlow(makeFlowParams());

			// Advance time past TTL (10 minutes)
			jest.advanceTimersByTime(11 * 60 * 1000);

			// Create second flow which triggers cleanup
			service.createFlow(makeFlowParams());

			// First flow should be expired and cleaned up
			mockFetch.mockResolvedValue(makeTokenResponse());

			await expect(service.exchangeCode(result1.state, 'code')).rejects.toThrow('Invalid or expired OAuth state');
		});
	});

	describe('exchangeCode', () => {
		it('should validate state against stored flows and return tokens', async () => {
			mockFetch.mockResolvedValue(makeTokenResponse());

			const flow = service.createFlow(makeFlowParams());
			const tokens = await service.exchangeCode(flow.state, 'auth-code-123');

			expect(tokens.accessToken).toBe('access-token-abc');
			expect(tokens.refreshToken).toBe('refresh-token-def');
			expect(tokens.clientId).toBe('client-id-123');
			expect(tokens.pluginType).toBe('buddy-claude-plugin');
		});

		it('should throw for invalid state', async () => {
			await expect(service.exchangeCode('non-existent-state', 'code')).rejects.toThrow(
				'Invalid or expired OAuth state',
			);
		});

		it('should throw for expired flow', async () => {
			const flow = service.createFlow(makeFlowParams());

			// Advance time past TTL (10 minutes)
			jest.advanceTimersByTime(11 * 60 * 1000);

			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('OAuth flow has expired');
		});

		it('should delete flow after successful exchange', async () => {
			mockFetch.mockResolvedValue(makeTokenResponse());

			const flow = service.createFlow(makeFlowParams());

			await service.exchangeCode(flow.state, 'code');

			// Second exchange with same state should fail
			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('Invalid or expired OAuth state');
		});

		it('should delete expired flow after expiry check', async () => {
			const flow = service.createFlow(makeFlowParams());

			jest.advanceTimersByTime(11 * 60 * 1000);

			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('OAuth flow has expired');

			// Flow should be deleted after expiry error
			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('Invalid or expired OAuth state');
		});

		it('should send form-urlencoded token request by default', async () => {
			mockFetch.mockResolvedValue(makeTokenResponse());

			const flow = service.createFlow(makeFlowParams());

			await service.exchangeCode(flow.state, 'auth-code');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://auth.example.com/token',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				}),
			);

			const fetchCall = mockFetch.mock.calls[0] as [string, { body: URLSearchParams; signal: AbortSignal }];
			const body = fetchCall[1].body;

			expect(body).toBeInstanceOf(URLSearchParams);
			expect(body.get('grant_type')).toBe('authorization_code');
			expect(body.get('code')).toBe('auth-code');
			expect(body.get('client_id')).toBe('client-id-123');
			expect(body.get('redirect_uri')).toBe('https://panel.local/oauth/callback');
			expect(body.get('code_verifier')).toBeDefined();
		});

		it('should send JSON token request when useJsonTokenExchange is true', async () => {
			mockFetch.mockResolvedValue(makeTokenResponse());

			const flow = service.createFlow(makeFlowParams({ useJsonTokenExchange: true }));

			await service.exchangeCode(flow.state, 'auth-code');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://auth.example.com/token',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
				}),
			);

			const fetchCall = mockFetch.mock.calls[0] as [string, { body: string; signal: AbortSignal }];
			const body = JSON.parse(fetchCall[1].body) as Record<string, string>;

			expect(body.grant_type).toBe('authorization_code');
			expect(body.code).toBe('auth-code');
			expect(body.client_id).toBe('client-id-123');
		});

		it('should throw when token endpoint returns error status', async () => {
			mockFetch.mockResolvedValue(makeErrorResponse(401, 'Unauthorized'));

			const flow = service.createFlow(makeFlowParams());

			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('Token exchange failed: 401');
		});

		it('should return null for accessToken when not present in response', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({}),
				text: jest.fn().mockResolvedValue(''),
			} as unknown as Response);

			const flow = service.createFlow(makeFlowParams());
			const tokens = await service.exchangeCode(flow.state, 'code');

			expect(tokens.accessToken).toBeNull();
			expect(tokens.refreshToken).toBeNull();
		});

		it('should handle fetch abort (timeout) error', async () => {
			mockFetch.mockImplementation(() => {
				const error = new Error('The operation was aborted');

				error.name = 'AbortError';

				throw error;
			});

			const flow = service.createFlow(makeFlowParams());

			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('The operation was aborted');
		});

		it('should include abort signal in fetch call', async () => {
			mockFetch.mockResolvedValue(makeTokenResponse());

			const flow = service.createFlow(makeFlowParams());

			await service.exchangeCode(flow.state, 'code');

			const fetchCall = mockFetch.mock.calls[0] as [string, { signal: AbortSignal }];

			expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal);
		});

		it('should handle text() failure when reading error response body', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				text: jest.fn().mockRejectedValue(new Error('Stream closed')),
			} as unknown as Response);

			const flow = service.createFlow(makeFlowParams());

			await expect(service.exchangeCode(flow.state, 'code')).rejects.toThrow('Token exchange failed: 500');
		});
	});
});
