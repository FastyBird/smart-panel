import { IncomingMessage, ServerResponse } from 'node:http';
import { DataSource } from 'typeorm';

import { McpAuditService } from '../services/mcp-audit.service';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';
import {
	McpOAuthEndpointRateLimitService,
	McpOAuthRateLimitedEndpoint,
} from '../services/mcp-oauth-endpoint-rate-limit.service';
import { McpOAuthPublicUrlService } from '../services/mcp-oauth-public-url.service';
import { McpSubscriptionRegistryService } from '../services/mcp-subscription-registry.service';

import { McpOAuthProviderFactory } from './mcp-oauth-provider.factory';
import { McpOAuthPublicUrls } from './mcp-oauth.types';

type ProviderDispatcher = (
	request: IncomingMessage,
	response: ServerResponse,
	providerCallback: (request: IncomingMessage, response: ServerResponse) => Promise<void>,
	urls: McpOAuthPublicUrls,
) => Promise<void>;

describe('McpOAuthProviderFactory artifact request gate', () => {
	const urls = {
		publicBaseUrl: 'https://panel.example',
		resource: 'https://panel.example/api/v1/modules/mcp',
		protectedResourceMetadata: 'https://panel.example/.well-known/oauth-protected-resource/api/v1/modules/mcp',
		issuer: 'https://panel.example/api/v1/modules/mcp/oauth',
		authorizationServerMetadata:
			'https://panel.example/.well-known/oauth-authorization-server/api/v1/modules/mcp/oauth',
		authorizationEndpoint: 'https://panel.example/api/v1/modules/mcp/oauth/authorize',
		tokenEndpoint: 'https://panel.example/api/v1/modules/mcp/oauth/token',
		revocationEndpoint: 'https://panel.example/api/v1/modules/mcp/oauth/token/revocation',
	} satisfies McpOAuthPublicUrls;
	let subscriptions: McpSubscriptionRegistryService;
	let dispatch: ProviderDispatcher;
	let consumeRateLimit: jest.MockedFunction<McpOAuthEndpointRateLimitService['consume']>;
	const createRequest = (): IncomingMessage =>
		({
			method: 'GET',
			url: '/api/v1/modules/mcp/oauth/authorize',
			headers: {},
			aborted: false,
			socket: { remoteAddress: '192.0.2.25' },
		}) as IncomingMessage;
	const createResponse = (): ServerResponse =>
		({
			closed: false,
			destroyed: false,
			writableEnded: false,
		}) as ServerResponse;

	beforeEach(() => {
		const audit = { recordSubscriptionClosed: jest.fn(), recordSubscriptionOpened: jest.fn() };
		subscriptions = new McpSubscriptionRegistryService(audit as unknown as McpAuditService);
		consumeRateLimit = jest.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
		const factory = new McpOAuthProviderFactory(
			{} as DataSource,
			{} as McpOAuthClientService,
			{} as McpOAuthPublicUrlService,
			subscriptions,
			{ consume: consumeRateLimit } as unknown as McpOAuthEndpointRateLimitService,
		);
		const target = factory as unknown as { dispatchProviderRequest: ProviderDispatcher };
		dispatch = (...args) => target.dispatchProviderRequest(...args);
	});

	it('rejects a blocked provider endpoint before entering the artifact mutation gate', async () => {
		consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
		const request = createRequest();
		request.headers['x-forwarded-for'] = '198.51.100.40';
		const setHeader = jest.fn();
		const end = jest.fn();
		const response = {
			closed: false,
			destroyed: false,
			writableEnded: false,
			setHeader,
			end,
		} as unknown as ServerResponse;
		const providerCallback = jest.fn(() => Promise.resolve());

		await dispatch(request, response, providerCallback, urls);

		expect(consumeRateLimit).toHaveBeenCalledWith(McpOAuthRateLimitedEndpoint.AUTHORIZE, '192.0.2.25');
		expect(providerCallback).not.toHaveBeenCalled();
		expect(response.statusCode).toBe(429);
		expect(setHeader).toHaveBeenCalledWith('retry-after', '17');
		expect(setHeader).toHaveBeenCalledWith('cache-control', 'no-store');
		expect(end).toHaveBeenCalledWith(
			JSON.stringify({ error: 'temporarily_unavailable', error_description: 'Too many OAuth requests' }),
		);
	});

	it.each([
		['/api/v1/modules/mcp/oauth/authorize', McpOAuthRateLimitedEndpoint.AUTHORIZE],
		['/api/v1/modules/mcp/oauth/token', McpOAuthRateLimitedEndpoint.TOKEN],
		['/api/v1/modules/mcp/oauth/token/revocation', McpOAuthRateLimitedEndpoint.REVOCATION],
		['/auth', McpOAuthRateLimitedEndpoint.AUTHORIZE],
		['/auth/provider-resume', McpOAuthRateLimitedEndpoint.AUTHORIZE],
		['/token', McpOAuthRateLimitedEndpoint.TOKEN],
		['/token/revocation', McpOAuthRateLimitedEndpoint.REVOCATION],
	] as const)('maps %s to its dedicated endpoint budget', async (pathname, endpoint) => {
		const request = createRequest();
		request.url = pathname;
		const providerCallback = jest.fn(() => Promise.resolve());

		await dispatch(request, createResponse(), providerCallback, urls);

		expect(consumeRateLimit).toHaveBeenCalledWith(endpoint, '192.0.2.25');
		expect(providerCallback).toHaveBeenCalledTimes(1);
	});

	it('does not apply an OAuth endpoint budget to an unrelated provider path', async () => {
		const request = createRequest();
		request.url = '/api/v1/modules/mcp/oauth/unregistered';
		const providerCallback = jest.fn(() => Promise.resolve());

		await dispatch(request, createResponse(), providerCallback, urls);

		expect(consumeRateLimit).not.toHaveBeenCalled();
		expect(providerCallback).toHaveBeenCalledTimes(1);
	});

	it('lets provider work that wins the gate commit before the following invalidation', async () => {
		let providerStarted = (): void => undefined;
		const started = new Promise<void>((resolve) => {
			providerStarted = resolve;
		});
		let releaseProvider = (): void => undefined;
		const release = new Promise<void>((resolve) => {
			releaseProvider = resolve;
		});
		let artifactCommitted = false;
		let invalidationObservedArtifact = false;
		const providerCallback = jest.fn(async () => {
			providerStarted();
			await release;
			artifactCommitted = true;
		});
		const providerRequest = dispatch(createRequest(), createResponse(), providerCallback, urls);

		await started;
		const invalidation = subscriptions.closeAllOAuth(() => {
			invalidationObservedArtifact = artifactCommitted;

			return Promise.resolve();
		});
		await Promise.resolve();
		expect(invalidationObservedArtifact).toBe(false);

		releaseProvider();
		await providerRequest;
		await invalidation;

		expect(artifactCommitted).toBe(true);
		expect(invalidationObservedArtifact).toBe(true);
	});

	it('makes provider work queued behind invalidation observe the advanced state', async () => {
		let invalidationStarted = (): void => undefined;
		const started = new Promise<void>((resolve) => {
			invalidationStarted = resolve;
		});
		let releaseInvalidation = (): void => undefined;
		const release = new Promise<void>((resolve) => {
			releaseInvalidation = resolve;
		});
		let generation = 0;
		const invalidation = subscriptions.closeAllOAuth(async () => {
			generation += 1;
			invalidationStarted();
			await release;
		});

		await started;
		const providerCallback = jest.fn(() =>
			generation === 0 ? Promise.resolve() : Promise.reject(new Error('stale OAuth authorization generation')),
		);
		const providerRequest = dispatch(createRequest(), createResponse(), providerCallback, urls);
		await Promise.resolve();
		expect(providerCallback).not.toHaveBeenCalled();

		releaseInvalidation();
		await invalidation;
		await expect(providerRequest).rejects.toThrow('stale OAuth authorization generation');
		expect(providerCallback).toHaveBeenCalledTimes(1);
	});

	it('skips provider processing when a queued request disconnects before the gate opens', async () => {
		let invalidationStarted = (): void => undefined;
		const started = new Promise<void>((resolve) => {
			invalidationStarted = resolve;
		});
		let releaseInvalidation = (): void => undefined;
		const release = new Promise<void>((resolve) => {
			releaseInvalidation = resolve;
		});
		const invalidation = subscriptions.closeAllOAuth(async () => {
			invalidationStarted();
			await release;
		});

		await started;
		const request = createRequest();
		const providerCallback = jest.fn(() => Promise.resolve());
		const providerRequest = dispatch(request, createResponse(), providerCallback, urls);
		request.aborted = true;
		releaseInvalidation();

		await invalidation;
		await providerRequest;
		expect(providerCallback).not.toHaveBeenCalled();
	});

	it('processes a completed request stream while its response connection remains open', async () => {
		const request = createRequest();
		request.destroyed = true;
		const providerCallback = jest.fn(() => Promise.resolve());

		await dispatch(request, createResponse(), providerCallback, urls);

		expect(providerCallback).toHaveBeenCalledTimes(1);
	});
});
