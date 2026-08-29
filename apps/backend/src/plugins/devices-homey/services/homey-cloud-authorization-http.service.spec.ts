import { HomeyCloudAuthorizationStateError } from '../errors/homey-cloud-authorization.error';

import { HomeyCloudAuthorizationHttpService } from './homey-cloud-authorization-http.service';
import { HomeyCloudAuthorizationStateService } from './homey-cloud-authorization-state.service';
import { HomeyCloudAuthorizationService } from './homey-cloud-authorization.service';
import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';
import { HomeyCloudRuntimeService } from './homey-cloud-runtime.service';

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
		Pick<HomeyCloudAuthorizationStateService, 'cancel' | 'clear' | 'complete' | 'consume' | 'create'>
	>;
	let authorization: jest.Mocked<
		Pick<HomeyCloudAuthorizationService, 'exchangeAuthorizationCode' | 'listCandidateHomeys' | 'selectHomey'>
	>;
	let clientConfig: jest.Mocked<Pick<HomeyCloudClientConfigService, 'getConfiguration'>>;
	let grantMutations: jest.Mocked<
		Pick<
			HomeyCloudGrantMutationService,
			| 'cancelAuthorization'
			| 'disconnect'
			| 'disconnectRuntimeWithoutGrant'
			| 'getActiveGrantReference'
			| 'getAuthorizationContext'
			| 'hasActiveGrant'
		>
	>;
	let runtime: jest.Mocked<Pick<HomeyCloudRuntimeService, 'activateGrant'>>;
	let service: HomeyCloudAuthorizationHttpService;

	beforeEach(() => {
		authorizationState = {
			cancel: jest.fn(),
			clear: jest.fn().mockReturnValue(0),
			complete: jest.fn(),
			consume: jest.fn(),
			create: jest.fn(),
		};
		authorization = {
			exchangeAuthorizationCode: jest.fn(),
			listCandidateHomeys: jest.fn(),
			selectHomey: jest.fn(),
		};
		clientConfig = { getConfiguration: jest.fn() };
		grantMutations = {
			cancelAuthorization: jest.fn(),
			disconnect: jest.fn(),
			disconnectRuntimeWithoutGrant: jest.fn().mockResolvedValue(undefined),
			getAuthorizationContext: jest.fn(),
			getActiveGrantReference: jest.fn().mockResolvedValue(null),
			hasActiveGrant: jest.fn().mockResolvedValue(true),
		};
		runtime = {
			activateGrant: jest.fn(),
		};
		service = new HomeyCloudAuthorizationHttpService(
			authorizationState as unknown as HomeyCloudAuthorizationStateService,
			authorization as unknown as HomeyCloudAuthorizationService,
			clientConfig as unknown as HomeyCloudClientConfigService,
			grantMutations as unknown as HomeyCloudGrantMutationService,
			runtime as unknown as HomeyCloudRuntimeService,
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

	it('returns credential-free active grant status', async () => {
		grantMutations.getActiveGrantReference.mockResolvedValue({
			activatedById: 'admin-user',
			authorityGeneration: 4,
			configurationGeneration: 5,
			generation: 6,
			grantIdentifier: 'grant-1',
			selectedHomeyId: 'homey-1',
		});

		await expect(service.getStatus()).resolves.toEqual({ connected: true, selectedHomeyId: 'homey-1' });
		grantMutations.getActiveGrantReference.mockResolvedValue(null);
		await expect(service.getStatus()).resolves.toEqual({ connected: false, selectedHomeyId: null });
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
			expect(runtime.activateGrant).toHaveBeenCalledTimes(status === 'activated' ? 1 : 0);
			if (status === 'activated') {
				const shouldActivate = runtime.activateGrant.mock.calls[0]?.[0];
				if (!shouldActivate) throw new Error('Homey Cloud runtime activation guard was not registered');
				await expect(shouldActivate()).resolves.toBe(true);
			}
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

	it('rotates cloud runtime after an explicit Homey selection activates', async () => {
		const result = {
			status: 'activated' as const,
			homey: { id: 'homey-2', name: 'Second' },
			grant: {
				activatedById: 'admin-user',
				authorityGeneration: 4,
				configurationGeneration: 5,
				generation: 6,
				grantIdentifier: 'grant-2',
				selectedHomeyId: 'homey-2',
			},
		};
		authorization.selectHomey.mockResolvedValue(result);

		await expect(service.selectHomey('transaction-1', 'admin-user', 'homey-2')).resolves.toBe(result);
		expect(runtime.activateGrant).toHaveBeenCalledTimes(1);
		const shouldActivate = runtime.activateGrant.mock.calls[0]?.[0];
		if (!shouldActivate) throw new Error('Homey Cloud runtime activation guard was not registered');
		await expect(shouldActivate()).resolves.toBe(true);
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
		{ stateCancellation: { changed: true, matched: true }, grantCancelled: false, expected: true },
		{ stateCancellation: { changed: false, matched: true }, grantCancelled: true, expected: true },
		{ stateCancellation: { changed: false, matched: true }, grantCancelled: false, expected: false },
		{ stateCancellation: { changed: false, matched: false }, grantCancelled: false, expected: false },
	])(
		'invalidates both pre-callback state and staged credentials when cancelling',
		async ({ stateCancellation, grantCancelled, expected }) => {
			authorizationState.cancel.mockReturnValue(stateCancellation);
			grantMutations.cancelAuthorization.mockResolvedValue(grantCancelled);

			await expect(service.cancel('transaction-1', 'admin-user')).resolves.toBe(expected);
			expect(authorizationState.cancel).toHaveBeenCalledWith('transaction-1', 'admin-user');
			expect(grantMutations.cancelAuthorization).toHaveBeenCalledWith(
				'transaction-1',
				'admin-user',
				stateCancellation.matched,
			);
			expect(grantMutations.disconnectRuntimeWithoutGrant).toHaveBeenCalledTimes(grantCancelled ? 1 : 0);
		},
	);

	it('stops cloud runtime when cancellation removed the last active grant', async () => {
		authorizationState.cancel.mockReturnValue({ changed: false, matched: true });
		grantMutations.cancelAuthorization.mockResolvedValue(true);

		await expect(service.cancel('transaction-1', 'admin-user')).resolves.toBe(true);
		expect(grantMutations.disconnectRuntimeWithoutGrant).toHaveBeenCalledTimes(1);
	});

	it('preserves cancellation-marker intent when persistence is retried', async () => {
		authorizationState.cancel
			.mockReturnValueOnce({ changed: true, matched: true })
			.mockReturnValueOnce({ changed: false, matched: true });
		grantMutations.cancelAuthorization
			.mockRejectedValueOnce(new Error('temporary database failure'))
			.mockResolvedValueOnce(true);

		await expect(service.cancel('transaction-1', 'admin-user')).rejects.toThrow('temporary database failure');
		await expect(service.cancel('transaction-1', 'admin-user')).resolves.toBe(true);
		expect(grantMutations.cancelAuthorization).toHaveBeenNthCalledWith(1, 'transaction-1', 'admin-user', true);
		expect(grantMutations.cancelAuthorization).toHaveBeenNthCalledWith(2, 'transaction-1', 'admin-user', true);
	});

	it.each([
		{ grantChanged: true, stateCount: 0, expected: true },
		{ grantChanged: false, stateCount: 2, expected: true },
		{ grantChanged: false, stateCount: 0, expected: false },
	])(
		'reports disconnect changes across persisted and in-memory state',
		async ({ grantChanged, stateCount, expected }) => {
			grantMutations.disconnect.mockResolvedValue(grantChanged);
			authorizationState.clear.mockReturnValue(stateCount);

			await expect(service.disconnect('admin-user')).resolves.toBe(expected);
			expect(grantMutations.disconnect).toHaveBeenCalledWith('admin-user');
			expect(authorizationState.clear).toHaveBeenCalledTimes(1);
			expect(grantMutations.disconnectRuntimeWithoutGrant).toHaveBeenCalledTimes(1);
			expect(grantMutations.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
				authorizationState.clear.mock.invocationCallOrder[0],
			);
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
