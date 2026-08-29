import { HomeyCloudSdkClientFactory, HomeySdkClientFactoryService } from '../connectors/homey-sdk.client';
import {
	HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS,
	HOMEY_CLOUD_CALLBACK_PATH,
	HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS,
	HOMEY_CLOUD_SCOPES,
} from '../devices-homey.constants';
import {
	HomeyCloudAuthorizationCapacityError,
	HomeyCloudAuthorizationStateError,
	HomeyCloudConfigurationError,
} from '../errors/homey-cloud-authorization.error';

import { HomeyCloudAuthorizationStateService } from './homey-cloud-authorization-state.service';
import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';

describe('HomeyCloudAuthorizationStateService', () => {
	const redirectUrl = `https://panel.example.com${HOMEY_CLOUD_CALLBACK_PATH}`;
	const configuration = {
		clientId: 'client-id',
		clientSecret: 'client-secret',
		redirectUrl,
	};
	const start = {
		activeGrantGeneration: 7,
		authorityGeneration: 3,
		configurationGeneration: 2,
		initiatingUserId: 'user-id',
	};

	let service: HomeyCloudAuthorizationStateService;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-28T12:00:00.000Z'));
		const sdkClientFactory: HomeyCloudSdkClientFactory = {
			createCloudAuthorizationUrl: jest.fn((options) => {
				const url = new URL('https://api.athom.com/oauth2/authorise');

				url.searchParams.set('response_type', 'code');
				url.searchParams.set('client_id', options.clientId);
				url.searchParams.set('redirect_uri', options.redirectUrl);
				url.searchParams.set('state', options.state);
				url.searchParams.set('scope', options.scopes.join(','));

				return url.toString();
			}),
			createCloudProviderClient: jest.fn(),
		};

		service = new HomeyCloudAuthorizationStateService(
			{
				getConfiguration: jest.fn(() => configuration),
			} as unknown as HomeyCloudClientConfigService,
			sdkClientFactory as HomeySdkClientFactoryService,
		);
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
	});

	it('creates an exact Homey authorization URL and consumes its state once', () => {
		const flow = service.create(start);
		const authorizeUrl = new URL(flow.authorizeUrl);
		const state = authorizeUrl.searchParams.get('state');

		expect(authorizeUrl.origin + authorizeUrl.pathname).toBe('https://api.athom.com/oauth2/authorise');
		expect(authorizeUrl.searchParams.get('response_type')).toBe('code');
		expect(authorizeUrl.searchParams.get('client_id')).toBe(configuration.clientId);
		expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(redirectUrl);
		expect(authorizeUrl.searchParams.get('scope')).toBe(HOMEY_CLOUD_SCOPES.join(','));
		expect(flow.authorizeUrl).not.toContain(configuration.clientSecret);
		expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(flow.transactionId).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(flow.expiresAt.getTime()).toBe(Date.now() + HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS);

		expect(service.consume(state)).toEqual({
			...start,
			expiresAt: flow.expiresAt,
			redirectUrl,
			transactionId: flow.transactionId,
		});
		expect(() => service.consume(state)).toThrow(HomeyCloudAuthorizationStateError);
	});

	it('creates independent state and transaction identities for concurrent administrators', () => {
		const first = service.create(start);
		const second = service.create({ ...start, initiatingUserId: 'other-admin' });

		expect(new URL(first.authorizeUrl).searchParams.get('state')).not.toBe(
			new URL(second.authorizeUrl).searchParams.get('state'),
		);
		expect(first.transactionId).not.toBe(second.transactionId);
	});

	it('cancels only the pending state matching both transaction and initiating user', () => {
		const flow = service.create(start);
		const state = new URL(flow.authorizeUrl).searchParams.get('state');

		expect(service.cancel(flow.transactionId, 'other-user')).toBe(false);
		expect(service.cancel('other-transaction', start.initiatingUserId)).toBe(false);
		expect(service.cancel(flow.transactionId, start.initiatingUserId)).toBe(true);
		expect(service.cancel(flow.transactionId, start.initiatingUserId)).toBe(false);
		expect(() => service.consume(state)).toThrow(HomeyCloudAuthorizationStateError);
	});

	it.each([
		['', start.initiatingUserId],
		['transaction-id', ''],
	])('rejects an invalid cancellation context', (transactionId, initiatingUserId) => {
		expect(() => service.cancel(transactionId, initiatingUserId)).toThrow(TypeError);
	});

	it('expires state independently of another request', () => {
		const state = new URL(service.create(start).authorizeUrl).searchParams.get('state');

		jest.advanceTimersByTime(HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS);

		expect(() => service.consume(state)).toThrow(HomeyCloudAuthorizationStateError);
	});

	it.each([
		{ ...start, initiatingUserId: '' },
		{ ...start, authorityGeneration: -1 },
		{ ...start, activeGrantGeneration: Number.NaN },
		{ ...start, configurationGeneration: -1 },
	])('rejects an invalid authorization context', (context) => {
		expect(() => service.create(context)).toThrow(TypeError);
	});

	it('uses a generic error for missing, malformed, and unknown state', () => {
		for (const state of ['', 'not-a-real-state', 'another-unknown-state']) {
			expect(() => service.consume(state)).toThrow('Homey Cloud authorization state is invalid or expired');
		}
	});

	it('bounds pending authorization state', () => {
		for (let index = 0; index < HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS; index += 1) {
			service.create({ ...start, initiatingUserId: `user-${index}` });
		}

		expect(() => service.create(start)).toThrow(HomeyCloudAuthorizationCapacityError);
	});

	it('does not reserve state capacity when authorization URL creation fails', () => {
		const failingService = new HomeyCloudAuthorizationStateService(
			{
				getConfiguration: jest.fn(() => configuration),
			} as unknown as HomeyCloudClientConfigService,
			{
				createCloudAuthorizationUrl: jest.fn(() => {
					throw new HomeyCloudConfigurationError('Homey Cloud authorization endpoint is invalid');
				}),
			} as unknown as HomeySdkClientFactoryService,
		);

		try {
			for (let index = 0; index <= HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS; index += 1) {
				expect(() => failingService.create(start)).toThrow(HomeyCloudConfigurationError);
			}
		} finally {
			failingService.onModuleDestroy();
		}
	});
});
