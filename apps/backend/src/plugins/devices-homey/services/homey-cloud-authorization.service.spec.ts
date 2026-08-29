import {
	HomeyCloudProviderClient,
	HomeyCloudProviderHomey,
	HomeySdkClientFactoryService,
} from '../connectors/homey-sdk.client';
import { HOMEY_CLOUD_PENDING_GRANT_TTL_MS, HOMEY_CLOUD_PROVIDER_TIMEOUT_MS } from '../devices-homey.constants';
import {
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudSelectionError,
} from '../errors/homey-cloud-authorization.error';
import { HomeyCloudGrantConflictError } from '../errors/homey-cloud-grant.error';

import { HomeyCloudAuthorizationService } from './homey-cloud-authorization.service';
import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import {
	HomeyCloudActiveGrantReference,
	HomeyCloudCandidateCredentials,
	HomeyCloudGrantMutationService,
} from './homey-cloud-grant-mutation.service';

describe('HomeyCloudAuthorizationService', () => {
	const now = Date.parse('2026-08-29T08:00:00.000Z');
	const configuration = {
		clientId: 'deployment-client-id',
		clientSecret: 'deployment-client-secret',
		redirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
	};
	const exchange = {
		activeGrantGeneration: 4,
		authorityGeneration: 2,
		configurationGeneration: 3,
		initiatingUserId: '11111111-1111-4111-8111-111111111111',
		transactionId: 'transaction-one',
		redirectUrl: configuration.redirectUrl,
		code: 'authorization-code',
	};
	const providerToken = {
		token_type: 'Bearer',
		access_token: 'candidate-access-token',
		refresh_token: 'candidate-refresh-token',
		expires_in: 3600,
		grant_type: 'authorization_code',
	};
	const persistedToken = {
		tokenType: 'bearer',
		accessToken: 'candidate-access-token',
		refreshToken: 'candidate-refresh-token',
		expiresIn: 3600,
		grantType: 'authorization_code',
		issuedAt: now,
	};
	const activeGrant: HomeyCloudActiveGrantReference = {
		grantIdentifier: 'active-grant',
		activatedById: exchange.initiatingUserId,
		authorityGeneration: exchange.authorityGeneration,
		generation: 5,
		configurationGeneration: exchange.configurationGeneration,
		selectedHomeyId: 'homey-one',
	};
	let exchangeClient: jest.Mocked<HomeyCloudProviderClient>;
	let candidateClient: jest.Mocked<HomeyCloudProviderClient>;
	let sdkClientFactory: jest.Mocked<Pick<HomeySdkClientFactoryService, 'createCloudProviderClient'>>;
	let grantMutations: jest.Mocked<
		Pick<
			HomeyCloudGrantMutationService,
			| 'activateCandidate'
			| 'cancelCandidate'
			| 'loadCandidateCredentials'
			| 'stageCandidate'
			| 'validateAuthorizationContext'
		>
	>;
	let service: HomeyCloudAuthorizationService;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(now);
		exchangeClient = providerClient();
		candidateClient = providerClient();
		exchangeClient.exchangeAuthorizationCode.mockResolvedValue(providerToken);
		candidateClient.getHomeys.mockResolvedValue([homey('homey-one', 'Home')]);
		sdkClientFactory = {
			createCloudProviderClient: jest.fn((options) => (options.token ? candidateClient : exchangeClient)),
		};
		grantMutations = {
			validateAuthorizationContext: jest.fn().mockResolvedValue(undefined),
			stageCandidate: jest.fn().mockResolvedValue({ expiresAt: now + HOMEY_CLOUD_PENDING_GRANT_TTL_MS }),
			loadCandidateCredentials: jest.fn().mockImplementation(() => Promise.resolve(candidate())),
			cancelCandidate: jest.fn().mockResolvedValue(true),
			activateCandidate: jest.fn().mockResolvedValue(activeGrant),
		};
		service = new HomeyCloudAuthorizationService(
			{ getConfiguration: jest.fn(() => configuration) } as unknown as HomeyCloudClientConfigService,
			sdkClientFactory as unknown as HomeySdkClientFactoryService,
			grantMutations as unknown as HomeyCloudGrantMutationService,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('stages exchanged tokens and returns only bounded eligible choices for multi-Homey accounts', async () => {
		candidateClient.getHomeys.mockResolvedValue([
			homey('homey-two', '  Upstairs\nHomey  '),
			homey('unsupported', 'Unsupported', { apiVersion: 4 }),
			homey('homey-one', 'Downstairs'),
		]);

		await expect(service.exchangeAuthorizationCode(exchange)).resolves.toEqual({
			status: 'selection_required',
			transactionId: exchange.transactionId,
			expiresAt: new Date(now + HOMEY_CLOUD_PENDING_GRANT_TTL_MS),
			homeys: [
				{ id: 'homey-one', name: 'Downstairs' },
				{ id: 'homey-two', name: 'Upstairs Homey' },
			],
		});
		expect(grantMutations.validateAuthorizationContext).toHaveBeenCalledWith(exchange);
		expect(grantMutations.stageCandidate).toHaveBeenCalledWith({
			activeGrantGeneration: exchange.activeGrantGeneration,
			authorityGeneration: exchange.authorityGeneration,
			configurationGeneration: exchange.configurationGeneration,
			initiatingUserId: exchange.initiatingUserId,
			redirectUrl: exchange.redirectUrl,
			transactionId: exchange.transactionId,
			expiresAt: now + HOMEY_CLOUD_PENDING_GRANT_TTL_MS,
			token: persistedToken,
		});
		expect(sdkClientFactory.createCloudProviderClient).toHaveBeenLastCalledWith({
			...configuration,
			token: persistedToken,
		});
		expect(grantMutations.activateCandidate).not.toHaveBeenCalled();
	});

	it('auto-selects the only eligible Homey after authenticating it', async () => {
		await expect(service.exchangeAuthorizationCode(exchange)).resolves.toEqual({
			status: 'activated',
			homey: { id: 'homey-one', name: 'Home' },
			grant: activeGrant,
		});
		expect(candidateClient.authenticateHomey.mock.calls).toEqual([['homey-one']]);
		expect(grantMutations.activateCandidate).toHaveBeenCalledWith(
			exchange.transactionId,
			exchange.initiatingUserId,
			'homey-one',
		);
	});

	it('clears a candidate when no eligible Homey is available', async () => {
		candidateClient.getHomeys.mockResolvedValue([homey('unsupported', 'Unsupported', { platform: 'unknown' })]);

		await expect(service.exchangeAuthorizationCode(exchange)).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.NO_ELIGIBLE_HOMEYS,
		});
		expect(grantMutations.cancelCandidate).toHaveBeenCalledWith(exchange.transactionId, exchange.initiatingUserId);
	});

	it('requires an exact transaction-bound selection without clearing a valid candidate', async () => {
		await expect(
			service.selectHomey(exchange.transactionId, exchange.initiatingUserId, 'another-homey'),
		).rejects.toThrow(HomeyCloudSelectionError);
		expect(candidateClient.authenticateHomey.mock.calls).toHaveLength(0);
		expect(grantMutations.activateCandidate).not.toHaveBeenCalled();
		expect(grantMutations.cancelCandidate).not.toHaveBeenCalled();
	});

	it('clears only the exact candidate after an invalid token response', async () => {
		candidateClient.getHomeys.mockRejectedValue(
			Object.assign(new Error('private provider response'), { statusCode: 401 }),
		);

		await expect(service.listCandidateHomeys(exchange.transactionId, exchange.initiatingUserId)).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.INVALID_TOKEN,
			retryable: false,
		});
		expect(grantMutations.cancelCandidate).toHaveBeenCalledWith(exchange.transactionId, exchange.initiatingUserId);
	});

	it('retains the candidate after a bounded retryable provider timeout', async () => {
		candidateClient.getHomeys.mockReturnValue(new Promise(() => undefined));
		const result = service.listCandidateHomeys(exchange.transactionId, exchange.initiatingUserId);
		const expectation = expect(result).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.TIMEOUT,
			retryable: true,
		});

		await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_PROVIDER_TIMEOUT_MS);

		await expectation;
		expect(grantMutations.cancelCandidate).not.toHaveBeenCalled();
	});

	it('retains the candidate when Homey rate-limits listing or selection', async () => {
		candidateClient.getHomeys.mockRejectedValue(
			Object.assign(new Error('private rate-limit response'), { statusCode: 429 }),
		);

		await expect(service.listCandidateHomeys(exchange.transactionId, exchange.initiatingUserId)).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.RATE_LIMITED,
			retryable: true,
		});

		candidateClient.getHomeys.mockResolvedValue([homey('homey-one', 'Home')]);
		candidateClient.authenticateHomey.mockRejectedValue(
			Object.assign(new Error('private rate-limit response'), { statusCode: 429 }),
		);

		await expect(
			service.selectHomey(exchange.transactionId, exchange.initiatingUserId, 'homey-one'),
		).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.RATE_LIMITED,
			retryable: true,
		});
		expect(grantMutations.cancelCandidate).not.toHaveBeenCalled();
	});

	it('maps raw exchange failures without retaining their private response', async () => {
		const privateValue = 'private-code-or-token';
		exchangeClient.exchangeAuthorizationCode.mockRejectedValue(
			Object.assign(new Error(privateValue), { statusCode: 400, body: privateValue }),
		);

		const error = await service.exchangeAuthorizationCode(exchange).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(HomeyCloudProviderError);
		expect(error).toMatchObject({ category: HomeyCloudProviderErrorCategory.INVALID_GRANT });
		expect(JSON.stringify(error)).not.toContain(privateValue);
		expect((error as Error).message).not.toContain(privateValue);
		expect(grantMutations.stageCandidate).not.toHaveBeenCalled();
	});

	it('rejects stale authorization context before sending the code to Homey', async () => {
		grantMutations.validateAuthorizationContext.mockRejectedValue(new HomeyCloudGrantConflictError());

		await expect(service.exchangeAuthorizationCode(exchange)).rejects.toThrow(HomeyCloudGrantConflictError);
		expect(sdkClientFactory.createCloudProviderClient.mock.calls).toHaveLength(0);
		expect(exchangeClient.exchangeAuthorizationCode.mock.calls).toHaveLength(0);
	});

	it('does not activate when cancellation or another mutation wins during Homey authentication', async () => {
		grantMutations.activateCandidate.mockRejectedValue(new HomeyCloudGrantConflictError());

		await expect(service.selectHomey(exchange.transactionId, exchange.initiatingUserId, 'homey-one')).rejects.toThrow(
			HomeyCloudGrantConflictError,
		);
		expect(candidateClient.authenticateHomey.mock.calls).toEqual([['homey-one']]);
		expect(grantMutations.cancelCandidate).not.toHaveBeenCalled();
	});

	it('rejects malformed token responses before persistence', async () => {
		exchangeClient.exchangeAuthorizationCode.mockResolvedValue({
			...providerToken,
			token_type: 'mac',
		});

		await expect(service.exchangeAuthorizationCode(exchange)).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.PROTOCOL,
		});
		expect(grantMutations.stageCandidate).not.toHaveBeenCalled();
	});

	it('rejects authorization codes containing whitespace before provider access', async () => {
		await expect(service.exchangeAuthorizationCode({ ...exchange, code: 'private code' })).rejects.toThrow(TypeError);
		expect(grantMutations.validateAuthorizationContext).not.toHaveBeenCalled();
		expect(sdkClientFactory.createCloudProviderClient).not.toHaveBeenCalled();
	});

	function providerClient(): jest.Mocked<HomeyCloudProviderClient> {
		return {
			exchangeAuthorizationCode: jest.fn(),
			getHomeys: jest.fn(),
			authenticateHomey: jest.fn().mockResolvedValue(undefined),
		};
	}

	function homey(id: string, name: string, overrides: Partial<HomeyCloudProviderHomey> = {}): HomeyCloudProviderHomey {
		return { id, name, apiVersion: 3, platform: 'local', ...overrides };
	}

	function candidate(): HomeyCloudCandidateCredentials {
		return {
			...exchange,
			token: persistedToken,
			expiresAt: now + HOMEY_CLOUD_PENDING_GRANT_TTL_MS,
		};
	}
});
