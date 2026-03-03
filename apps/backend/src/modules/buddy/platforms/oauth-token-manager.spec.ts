/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { OAuthConfig, OAuthTokenManager, OAuthTokenManagerOptions } from './oauth-token-manager';

const TOKEN_URL = 'https://oauth.example.com/token';

function makeOptions(overrides: Partial<OAuthTokenManagerOptions> = {}): OAuthTokenManagerOptions {
	return {
		tokenUrl: overrides.tokenUrl ?? TOKEN_URL,
		providerLabel: overrides.providerLabel ?? 'TestProvider',
		ttlMs: overrides.ttlMs ?? 5_000,
		refreshTimeoutMs: overrides.refreshTimeoutMs ?? 2_000,
	};
}

function makeConfig(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
	return {
		accessToken: 'accessToken' in overrides ? overrides.accessToken : null,
		refreshToken: 'refreshToken' in overrides ? overrides.refreshToken : 'refresh-tok',
		clientId: 'clientId' in overrides ? overrides.clientId : 'client-123',
		clientSecret: 'clientSecret' in overrides ? overrides.clientSecret : 'secret-456',
	};
}

describe('OAuthTokenManager', () => {
	let manager: OAuthTokenManager;
	let fetchSpy: jest.SpyInstance;

	beforeEach(() => {
		manager = new OAuthTokenManager(makeOptions());

		fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ access_token: 'refreshed-token' }),
		} as Response);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		jest.restoreAllMocks();
	});

	describe('resolveAccessToken', () => {
		it('should return static access token when available in config', async () => {
			const config = makeConfig({ accessToken: 'static-token' });

			const token = await manager.resolveAccessToken(config);

			expect(token).toBe('static-token');
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('should refresh token when no static access token is present', async () => {
			const config = makeConfig({ accessToken: null });

			const token = await manager.resolveAccessToken(config);

			expect(token).toBe('refreshed-token');
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(fetchSpy).toHaveBeenCalledWith(
				TOKEN_URL,
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				}),
			);
		});

		it('should return cached token within TTL without fetching again', async () => {
			const config = makeConfig({ accessToken: null });

			const firstToken = await manager.resolveAccessToken(config);

			expect(firstToken).toBe('refreshed-token');
			expect(fetchSpy).toHaveBeenCalledTimes(1);

			const secondToken = await manager.resolveAccessToken(config);

			expect(secondToken).toBe('refreshed-token');
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});

		it('should re-fetch token after TTL expiry', async () => {
			jest.useFakeTimers();

			try {
				const shortTtlManager = new OAuthTokenManager(makeOptions({ ttlMs: 1_000 }));

				fetchSpy.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ access_token: 'token-1' }),
				} as Response);

				const config = makeConfig({ accessToken: null });

				const firstToken = await shortTtlManager.resolveAccessToken(config);

				expect(firstToken).toBe('token-1');
				expect(fetchSpy).toHaveBeenCalledTimes(1);

				// Advance past TTL
				jest.advanceTimersByTime(1_500);

				fetchSpy.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ access_token: 'token-2' }),
				} as Response);

				const secondToken = await shortTtlManager.resolveAccessToken(config);

				expect(secondToken).toBe('token-2');
				expect(fetchSpy).toHaveBeenCalledTimes(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('should deduplicate concurrent refresh calls', async () => {
			let resolveRefresh!: (value: Response) => void;

			fetchSpy.mockReturnValueOnce(
				new Promise<Response>((resolve) => {
					resolveRefresh = resolve;
				}),
			);

			const config = makeConfig({ accessToken: null });

			const promise1 = manager.resolveAccessToken(config);
			const promise2 = manager.resolveAccessToken(config);
			const promise3 = manager.resolveAccessToken(config);

			resolveRefresh({
				ok: true,
				json: async () => ({ access_token: 'deduped-token' }),
			} as Response);

			const [token1, token2, token3] = await Promise.all([promise1, promise2, promise3]);

			expect(token1).toBe('deduped-token');
			expect(token2).toBe('deduped-token');
			expect(token3).toBe('deduped-token');
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});

		it('should throw when refresh request fails with non-OK status', async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ error: 'invalid_grant' }),
			} as Response);

			const config = makeConfig({ accessToken: null });

			await expect(manager.resolveAccessToken(config)).rejects.toThrow('OAuth token refresh failed: 401');
		});

		it('should propagate abort/timeout errors', async () => {
			fetchSpy.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));

			const config = makeConfig({ accessToken: null });

			await expect(manager.resolveAccessToken(config)).rejects.toThrow('The operation was aborted.');
		});

		it('should return empty string when config is null', async () => {
			const token = await manager.resolveAccessToken(null);

			expect(token).toBe('');
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('should return empty string when no refresh token or client ID', async () => {
			const config = makeConfig({ accessToken: null, refreshToken: null, clientId: null });

			const token = await manager.resolveAccessToken(config);

			expect(token).toBe('');
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('should include client_secret in refresh body when present', async () => {
			const config = makeConfig({ accessToken: null, clientSecret: 'my-secret' });

			await manager.resolveAccessToken(config);

			const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;

			expect(body.get('client_secret')).toBe('my-secret');
		});

		it('should omit client_secret from refresh body when not present', async () => {
			const config = makeConfig({ accessToken: null, clientSecret: null });

			await manager.resolveAccessToken(config);

			const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;

			expect(body.has('client_secret')).toBe(false);
		});

		it('should allow a new refresh after a failed one', async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 500,
			} as Response);

			const config = makeConfig({ accessToken: null });

			await expect(manager.resolveAccessToken(config)).rejects.toThrow('OAuth token refresh failed: 500');

			// The inflight promise should be cleared, so a second call should trigger a new fetch
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: 'recovered-token' }),
			} as Response);

			const token = await manager.resolveAccessToken(config);

			expect(token).toBe('recovered-token');
			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});
	});
});
