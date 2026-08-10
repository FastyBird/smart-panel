import { IncomingMessage, ServerResponse } from 'node:http';
import { DataSource } from 'typeorm';

import { McpAuditService } from '../services/mcp-audit.service';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';
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
	const request = {
		method: 'GET',
		url: '/api/v1/modules/mcp/oauth/authorize',
		headers: {},
	} as IncomingMessage;
	const response = {} as ServerResponse;
	let subscriptions: McpSubscriptionRegistryService;
	let dispatch: ProviderDispatcher;

	beforeEach(() => {
		const audit = { recordSubscriptionClosed: jest.fn(), recordSubscriptionOpened: jest.fn() };
		subscriptions = new McpSubscriptionRegistryService(audit as unknown as McpAuditService);
		const factory = new McpOAuthProviderFactory(
			{} as DataSource,
			{} as McpOAuthClientService,
			{} as McpOAuthPublicUrlService,
			subscriptions,
		);
		const target = factory as unknown as { dispatchProviderRequest: ProviderDispatcher };
		dispatch = (...args) => target.dispatchProviderRequest(...args);
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
		const providerRequest = dispatch(request, response, providerCallback, urls);

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
		const providerRequest = dispatch(request, response, providerCallback, urls);
		await Promise.resolve();
		expect(providerCallback).not.toHaveBeenCalled();

		releaseInvalidation();
		await invalidation;
		await expect(providerRequest).rejects.toThrow('stale OAuth authorization generation');
		expect(providerCallback).toHaveBeenCalledTimes(1);
	});
});
