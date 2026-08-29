import { AthomCloudAPI } from 'homey-api';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

import { HOMEY_CLOUD_CALLBACK_PATH, HOMEY_CLOUD_SCOPES } from '../devices-homey.constants';
import { HomeyCloudConfigurationError, HomeyCloudSelectionError } from '../errors/homey-cloud-authorization.error';

import { HomeySdkClientFactoryService } from './homey-sdk.client';

describe('HomeySdkClientFactoryService', () => {
	const originalBaseUrl = process.env.ATHOM_CLOUD_API_BASEURL;

	afterEach(() => {
		jest.restoreAllMocks();

		if (originalBaseUrl === undefined) {
			delete process.env.ATHOM_CLOUD_API_BASEURL;
		} else {
			process.env.ATHOM_CLOUD_API_BASEURL = originalBaseUrl;
		}
	});

	it('creates isolated provider clients for exchange and sanitized Homey access', async () => {
		const token = {
			token_type: 'bearer',
			access_token: 'provider-access-token',
			refresh_token: 'provider-refresh-token',
			expires_in: 3600,
			grant_type: 'authorization_code',
		};
		const fetchMock = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(
				new Response(JSON.stringify(token), { status: 200, headers: { 'Content-Type': 'application/json' } }),
			);
		const homeyApi = {
			disconnect: jest.fn().mockResolvedValue(undefined),
			destroy: jest.fn(),
		};
		const homey = {
			id: 'homey-one',
			name: 'Home',
			apiVersion: 3,
			platform: 'local',
			remoteUrl: 'https://homey-one.connect.athom.com',
			authenticate: jest.fn().mockResolvedValue(homeyApi),
		};
		jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
			getHomeys: () => [homey],
			getHomeyById: () => homey,
		} as unknown as AthomCloudAPI.User);
		const factory = new HomeySdkClientFactoryService();
		const provider = factory.createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		const candidateProvider = factory.createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			token: {
				tokenType: 'bearer',
				accessToken: token.access_token,
				refreshToken: token.refresh_token,
				expiresIn: token.expires_in,
				grantType: token.grant_type,
			},
		});

		const controller = new AbortController();

		await expect(provider.exchangeAuthorizationCode('authorization-code', controller.signal)).resolves.toEqual(token);
		await expect(candidateProvider.getHomeys(controller.signal)).resolves.toEqual([
			{ id: 'homey-one', name: 'Home', apiVersion: 3, platform: 'local' },
		]);
		await expect(candidateProvider.authenticateHomey('homey-one', controller.signal, false)).resolves.toBeUndefined();
		const [tokenUrl, tokenRequest] = fetchMock.mock.calls[0];

		expect(tokenUrl).toBe('https://api.athom.com/oauth2/token');
		expect(tokenRequest?.redirect).toBe('error');
		expect(tokenRequest?.signal).toBeInstanceOf(AbortSignal);
		expect(tokenRequest?.body).toBeInstanceOf(URLSearchParams);
		expect((tokenRequest?.body as URLSearchParams).toString()).toBe(
			'grant_type=authorization_code&code=authorization-code',
		);
		expect(homey.authenticate).toHaveBeenCalledWith({ strategy: 'cloud', reconnect: false });
		expect(homeyApi.disconnect).toHaveBeenCalledTimes(1);
		expect(homeyApi.destroy).toHaveBeenCalledTimes(1);
	});

	it('aborts the underlying authorization-code exchange when its caller cancels', async () => {
		let requestSignal: AbortSignal | null = null;
		jest.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
			requestSignal = init?.signal ?? null;

			return new Promise((_resolve, reject) => {
				requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
					once: true,
				});
			});
		});
		const factory = new HomeySdkClientFactoryService();
		const provider = factory.createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		const controller = new AbortController();
		const exchange = provider.exchangeAuthorizationCode('authorization-code', controller.signal);

		controller.abort();

		await expect(exchange).rejects.toMatchObject({ code: 'ABORTERROR' });
		expect(requestSignal?.aborted).toBe(true);
	});

	it('classifies token HTTP failures before attempting to parse their body', async () => {
		const response = new Response('not-json', { status: 429 });
		const cancelBody = jest.spyOn(response.body as ReadableStream, 'cancel');

		jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
		const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});

		await expect(
			provider.exchangeAuthorizationCode('authorization-code', new AbortController().signal),
		).rejects.toMatchObject({
			statusCode: 429,
		});
		expect(cancelBody).toHaveBeenCalledTimes(1);
	});

	it('keeps cancellation attached while the SDK consumes an account response body', async () => {
		let bodyAborted = false;

		jest.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
			const body = new ReadableStream({
				start(controller) {
					init?.signal?.addEventListener(
						'abort',
						() => {
							bodyAborted = true;
							controller.error(new DOMException('Aborted', 'AbortError'));
						},
						{ once: true },
					);
				},
			});

			return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'application/json' } }));
		});
		jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockImplementation(async function () {
			const executor = this as unknown as {
				onCallRequestExecute(input: {
					request: { body?: BodyInit; headers: HeadersInit; method: string; timeout?: number; url: string };
				}): Promise<Response>;
			};
			const response = await executor.onCallRequestExecute({
				request: {
					headers: {},
					method: 'GET',
					timeout: 60_000,
					url: 'https://api.athom.com/user/me',
				},
			});

			await response.json();

			throw new Error('The stalled SDK response body unexpectedly completed');
		});
		const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			token: {
				tokenType: 'bearer',
				accessToken: 'candidate-access-token',
				refreshToken: 'candidate-refresh-token',
				expiresIn: 3600,
				grantType: 'authorization_code',
			},
		});
		const controller = new AbortController();
		const listing = provider.getHomeys(controller.signal);

		controller.abort();

		await expect(listing).rejects.toMatchObject({ code: 'ABORTERROR' });
		expect(bodyAborted).toBe(true);
	});

	it('preserves timeout classification while consuming a token response body', async () => {
		const timeoutController = new AbortController();

		jest.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal);
		jest.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
			const body = new ReadableStream({
				start(controller) {
					init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), {
						once: true,
					});
				},
			});

			return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'application/json' } }));
		});
		const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
		});
		const exchange = provider.exchangeAuthorizationCode('authorization-code', new AbortController().signal);

		timeoutController.abort();

		await expect(exchange).rejects.toMatchObject({ statusCode: 408 });
	});

	it('rejects an untrusted child Homey cloud endpoint before authentication', async () => {
		const homey = {
			id: 'homey-one',
			name: 'Home',
			apiVersion: 3,
			platform: 'local',
			remoteUrl: 'http://127.0.0.1:8080',
			authenticate: jest.fn(),
		};

		jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
			getHomeys: () => [homey],
			getHomeyById: () => homey,
		} as unknown as AthomCloudAPI.User);
		const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			token: {
				tokenType: 'bearer',
				accessToken: 'candidate-access-token',
				refreshToken: 'candidate-refresh-token',
				expiresIn: 3600,
				grantType: 'authorization_code',
			},
		});

		await expect(provider.authenticateHomey('homey-one', new AbortController().signal, false)).rejects.toMatchObject({
			name: 'HomeyCloudSdkProtocolError',
		});
		expect(homey.authenticate.mock.calls).toHaveLength(0);
	});

	it('authenticates an API-v1 Homey without newer client lifecycle methods', async () => {
		const homey = {
			id: 'legacy-homey',
			name: 'Legacy Homey',
			apiVersion: 1,
			platform: 'local',
			authenticate: jest.fn().mockResolvedValue({}),
		};

		jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
			getHomeys: () => [homey],
			getHomeyById: () => homey,
		} as unknown as AthomCloudAPI.User);
		const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			token: {
				tokenType: 'bearer',
				accessToken: 'candidate-access-token',
				refreshToken: 'candidate-refresh-token',
				expiresIn: 3600,
				grantType: 'authorization_code',
			},
		});

		await expect(
			provider.authenticateHomey('legacy-homey', new AbortController().signal, false),
		).resolves.toBeUndefined();
		expect(homey.authenticate).toHaveBeenCalledWith({ strategy: 'cloud', reconnect: false });
	});

	it('rejects automatic authentication when the final inventory is no longer a singleton', async () => {
		const homey = {
			id: 'homey-one',
			name: 'Home',
			apiVersion: 3,
			platform: 'local',
			remoteUrl: 'https://homey-one.connect.athom.com',
			authenticate: jest.fn(),
		};

		jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
			getHomeys: () => [homey, { ...homey, id: 'homey-two', name: 'Other Homey' }],
			getHomeyById: () => homey,
		} as unknown as AthomCloudAPI.User);
		const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
			clientId: 'deployment-client-id',
			clientSecret: 'deployment-client-secret',
			redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			token: {
				tokenType: 'bearer',
				accessToken: 'candidate-access-token',
				refreshToken: 'candidate-refresh-token',
				expiresIn: 3600,
				grantType: 'authorization_code',
			},
		});

		await expect(provider.authenticateHomey('homey-one', new AbortController().signal, true)).rejects.toThrow(
			HomeyCloudSelectionError,
		);
		expect(homey.authenticate.mock.calls).toHaveLength(0);
	});

	it('preserves retryable HTTP status from child Homey SDK requests', async () => {
		const server = createServer((_request, response) => {
			response.writeHead(429, { 'Content-Type': 'text/plain' });
			response.end('private rate-limit response');
		});

		server.listen(0, '127.0.0.1');
		await once(server, 'listening');

		try {
			const address = server.address();

			if (address === null || typeof address === 'string') throw new Error('Test server address is unavailable');

			const sdkUtility = (
				createRequire(__filename)('homey-api') as {
					Util: {
						fetch(url: string, options: RequestInit, timeoutDuration: number): Promise<Response>;
					};
				}
			).Util;
			const homey = {
				id: 'homey-one',
				name: 'Home',
				apiVersion: 3,
				platform: 'local',
				remoteUrl: 'https://homey-one.connect.athom.com',
				authenticate: jest.fn(() => sdkUtility.fetch(`http://127.0.0.1:${address.port}/discovery`, {}, 60_000)),
			};

			jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
				getHomeys: () => [homey],
				getHomeyById: () => homey,
			} as unknown as AthomCloudAPI.User);
			const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
				clientId: 'deployment-client-id',
				clientSecret: 'deployment-client-secret',
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
				token: {
					tokenType: 'bearer',
					accessToken: 'candidate-access-token',
					refreshToken: 'candidate-refresh-token',
					expiresIn: 3600,
					grantType: 'authorization_code',
				},
			});

			await expect(provider.authenticateHomey('homey-one', new AbortController().signal, false)).rejects.toMatchObject({
				statusCode: 429,
			});
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			});
		}
	});

	it('propagates cancellation into the child Homey login requests', async () => {
		let requestStartedResolve: (() => void) | null = null;
		const requestStarted = new Promise<void>((resolve) => {
			requestStartedResolve = resolve;
		});
		const server = createServer(() => requestStartedResolve?.());

		server.listen(0, '127.0.0.1');
		await once(server, 'listening');

		try {
			const address = server.address();

			if (address === null || typeof address === 'string') throw new Error('Test server address is unavailable');

			const sdkUtility = (
				createRequire(__filename)('homey-api') as {
					Util: {
						fetch(url: string, options: RequestInit, timeoutDuration: number): Promise<Response>;
					};
				}
			).Util;
			const homey = {
				id: 'homey-one',
				name: 'Home',
				apiVersion: 3,
				platform: 'local',
				remoteUrl: 'https://homey-one.connect.athom.com',
				authenticate: jest.fn(async () => {
					await sdkUtility.fetch(`http://127.0.0.1:${address.port}/login`, {}, 60_000);

					throw new Error('The stalled test request unexpectedly completed');
				}),
			};

			jest.spyOn(AthomCloudAPI.prototype, 'getAuthenticatedUser').mockResolvedValue({
				getHomeys: () => [homey],
				getHomeyById: () => homey,
			} as unknown as AthomCloudAPI.User);
			const provider = new HomeySdkClientFactoryService().createCloudProviderClient({
				clientId: 'deployment-client-id',
				clientSecret: 'deployment-client-secret',
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
				token: {
					tokenType: 'bearer',
					accessToken: 'candidate-access-token',
					refreshToken: 'candidate-refresh-token',
					expiresIn: 3600,
					grantType: 'authorization_code',
				},
			});
			const controller = new AbortController();
			const authentication = provider.authenticateHomey('homey-one', controller.signal, false);

			await requestStarted;
			controller.abort();

			await expect(authentication).rejects.toMatchObject({ code: 'ABORTERROR' });
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
			});
		}
	});

	it('creates a Homey Cloud authorization URL without exposing the client secret', () => {
		const factory = new HomeySdkClientFactoryService();
		const clientSecret = 'deployment-client-secret';
		const redirectUrl = `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`;
		const state = 'single-use-random-state';
		const result = factory.createCloudAuthorizationUrl({
			clientId: 'deployment-client-id',
			clientSecret,
			redirectUrl,
			scopes: [...HOMEY_CLOUD_SCOPES],
			state,
		});
		const url = new URL(result);

		expect(url.origin + url.pathname).toBe('https://api.athom.com/oauth2/authorise');
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('client_id')).toBe('deployment-client-id');
		expect(url.searchParams.get('redirect_uri')).toBe(redirectUrl);
		expect(url.searchParams.get('scope')).toBe(HOMEY_CLOUD_SCOPES.join(','));
		expect(url.searchParams.get('state')).toBe(state);
		expect(result).not.toContain(clientSecret);
	});

	it('rejects authorization and provider clients redirected by the SDK base URL environment override', () => {
		process.env.ATHOM_CLOUD_API_BASEURL = 'https://untrusted.example.com';
		const factory = new HomeySdkClientFactoryService();

		expect(() =>
			factory.createCloudAuthorizationUrl({
				clientId: 'deployment-client-id',
				clientSecret: 'deployment-client-secret',
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
				scopes: [...HOMEY_CLOUD_SCOPES],
				state: 'single-use-random-state',
			}),
		).toThrow(HomeyCloudConfigurationError);
		expect(() =>
			factory.createCloudProviderClient({
				clientId: 'deployment-client-id',
				clientSecret: 'deployment-client-secret',
				redirectUrl: `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`,
			}),
		).toThrow(HomeyCloudConfigurationError);
	});
});
