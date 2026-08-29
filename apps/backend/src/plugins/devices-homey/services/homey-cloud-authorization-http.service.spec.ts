import { HomeyCloudAuthorizationStateError } from '../errors/homey-cloud-authorization.error';

import { HomeyCloudAuthorizationHttpService } from './homey-cloud-authorization-http.service';
import { HomeyCloudAuthorizationStateService } from './homey-cloud-authorization-state.service';
import { HomeyCloudAuthorizationService } from './homey-cloud-authorization.service';
import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';

describe('HomeyCloudAuthorizationHttpService', () => {
	const context = {
		activeGrantGeneration: 3,
		authorityGeneration: 4,
		configurationGeneration: 5,
		initiatingUserId: 'admin-user',
	};
	const consumed = {
		...context,
		expiresAt: new Date('2026-08-29T12:05:00.000Z'),
		redirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
		transactionId: 'transaction-1',
	};
	let authorizationState: jest.Mocked<
		Pick<HomeyCloudAuthorizationStateService, 'cancel' | 'complete' | 'consume' | 'create'>
	>;
	let authorization: jest.Mocked<
		Pick<HomeyCloudAuthorizationService, 'exchangeAuthorizationCode' | 'listCandidateHomeys' | 'selectHomey'>
	>;
	let clientConfig: jest.Mocked<Pick<HomeyCloudClientConfigService, 'getConfiguration'>>;
	let grantMutations: jest.Mocked<
		Pick<HomeyCloudGrantMutationService, 'cancelAuthorization' | 'disconnect' | 'getAuthorizationContext'>
	>;
	let service: HomeyCloudAuthorizationHttpService;

	beforeEach(() => {
		authorizationState = { cancel: jest.fn(), complete: jest.fn(), consume: jest.fn(), create: jest.fn() };
		authorization = {
			exchangeAuthorizationCode: jest.fn(),
			listCandidateHomeys: jest.fn(),
			selectHomey: jest.fn(),
		};
		clientConfig = { getConfiguration: jest.fn() };
		grantMutations = {
			cancelAuthorization: jest.fn(),
			disconnect: jest.fn(),
			getAuthorizationContext: jest.fn(),
		};
		service = new HomeyCloudAuthorizationHttpService(
			authorizationState as unknown as HomeyCloudAuthorizationStateService,
			authorization as unknown as HomeyCloudAuthorizationService,
			clientConfig as unknown as HomeyCloudClientConfigService,
			grantMutations as unknown as HomeyCloudGrantMutationService,
		);
	});

	it('binds a new authorization state to the current privileged-user generations', async () => {
		const flow = {
			authorizeUrl: 'https://api.athom.com/oauth2/authorise?state=secret',
			expiresAt: new Date('2026-08-29T12:05:00.000Z'),
			transactionId: 'transaction-1',
		};

		grantMutations.getAuthorizationContext.mockResolvedValue(context);
		authorizationState.create.mockReturnValue(flow);

		await expect(service.start('admin-user')).resolves.toBe(flow);
		expect(authorizationState.create).toHaveBeenCalledWith(context);
	});

	it.each(['activated', 'selection_required'] as const)(
		'consumes state before exchanging the provider code and returns %s',
		async (status) => {
			authorizationState.consume.mockReturnValue(consumed);
			authorization.exchangeAuthorizationCode.mockResolvedValue(
				status === 'activated'
					? {
							status,
							homey: { id: 'homey-1', name: 'Homey' },
							grant: {
								activatedById: 'admin-user',
								authorityGeneration: 4,
								configurationGeneration: 5,
								generation: 4,
								grantIdentifier: 'grant-1',
								selectedHomeyId: 'homey-1',
							},
						}
					: {
							status,
							expiresAt: new Date('2026-08-29T12:10:00.000Z'),
							homeys: [
								{ id: 'homey-1', name: 'First' },
								{ id: 'homey-2', name: 'Second' },
							],
							transactionId: 'transaction-1',
						},
			);

			await expect(
				service.completeCallback({ code: 'provider-code', providerError: false, state: 'single-use-state' }),
			).resolves.toBe(status);
			expect(authorizationState.consume).toHaveBeenCalledWith('single-use-state');
			expect(authorizationState.complete).toHaveBeenCalledWith(consumed.transactionId, consumed.initiatingUserId);
			expect(authorization.exchangeAuthorizationCode).toHaveBeenCalledWith({ ...consumed, code: 'provider-code' });
		},
	);

	it('consumes provider-error state without attempting a code exchange', async () => {
		authorizationState.consume.mockReturnValue(consumed);

		await expect(
			service.completeCallback({ code: 'ignored-code', providerError: true, state: 'single-use-state' }),
		).resolves.toBe('failed');
		expect(authorizationState.consume).toHaveBeenCalledWith('single-use-state');
		expect(authorizationState.complete).toHaveBeenCalledWith(consumed.transactionId, consumed.initiatingUserId);
		expect(authorization.exchangeAuthorizationCode).not.toHaveBeenCalled();
	});

	it('rejects missing, invalid, and replayed state before provider exchange without exposing an error', async () => {
		authorizationState.consume.mockImplementation(() => {
			throw new HomeyCloudAuthorizationStateError();
		});

		await expect(
			service.completeCallback({ code: 'provider-code', providerError: false, state: 'replayed-state' }),
		).resolves.toBe('failed');
		expect(authorization.exchangeAuthorizationCode).not.toHaveBeenCalled();
		expect(authorizationState.complete).not.toHaveBeenCalled();
	});

	it.each([
		{ stateCancelled: true, candidateCancelled: false, expected: true },
		{ stateCancelled: false, candidateCancelled: true, expected: true },
		{ stateCancelled: false, candidateCancelled: false, expected: false },
	])(
		'invalidates both pre-callback state and staged credentials when cancelling',
		async ({ stateCancelled, candidateCancelled, expected }) => {
			authorizationState.cancel.mockReturnValue(stateCancelled);
			grantMutations.cancelAuthorization.mockResolvedValue(candidateCancelled);

			await expect(service.cancel('transaction-1', 'admin-user')).resolves.toBe(expected);
			expect(authorizationState.cancel).toHaveBeenCalledWith('transaction-1', 'admin-user');
			expect(grantMutations.cancelAuthorization).toHaveBeenCalledWith('transaction-1', 'admin-user', stateCancelled);
		},
	);

	it('uses a fixed same-origin result URL and falls back to a relative URL when configuration is absent', () => {
		clientConfig.getConfiguration.mockReturnValue({
			clientId: 'client-id',
			clientSecret: 'client-secret',
			redirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
		});

		expect(service.getResultUrl()).toBe('https://panel.example.com/config/plugins/devices-homey-plugin');

		clientConfig.getConfiguration.mockImplementation(() => {
			throw new Error('not configured');
		});

		expect(service.getResultUrl()).toBe('/config/plugins/devices-homey-plugin');
	});
});
