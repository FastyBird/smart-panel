import { ConfigService } from '../../../modules/config/services/config.service';
import { HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS, HomeyConnectionMode } from '../devices-homey.constants';
import { HomeyConnectorErrorCategory } from '../errors/homey-connector.error';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyCloudRuntimeRegistryService } from './homey-cloud-runtime-registry.service';
import { HomeyCloudRuntimeService } from './homey-cloud-runtime.service';
import { HomeyService } from './homey.service';

describe('HomeyCloudRuntimeService', () => {
	let config: HomeyConfigModel;
	let homeyService: jest.Mocked<Pick<HomeyService, 'getState' | 'getStatus' | 'start' | 'stop'>>;
	let runtimeRegistry: jest.Mocked<Pick<HomeyCloudRuntimeRegistryService, 'register'>>;
	let service: HomeyCloudRuntimeService;

	beforeEach(() => {
		config = Object.assign(new HomeyConfigModel(), { enabled: true, mode: HomeyConnectionMode.CLOUD });
		homeyService = {
			getState: jest.fn().mockReturnValue('started'),
			getStatus: jest.fn().mockReturnValue({ lastErrorCategory: null }),
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
		};
		runtimeRegistry = { register: jest.fn() };
		service = new HomeyCloudRuntimeService(
			{ getPluginConfig: jest.fn().mockReturnValue(config) } as unknown as ConfigService,
			homeyService as unknown as HomeyService,
			runtimeRegistry as unknown as HomeyCloudRuntimeRegistryService,
		);
	});

	it('registers grant teardown with the post-commit runtime boundary', async () => {
		service.onModuleInit();
		const teardown = runtimeRegistry.register.mock.calls[0]?.[0];
		if (!teardown) throw new Error('Homey Cloud runtime teardown was not registered');

		await teardown(() => Promise.resolve(true));

		expect(homeyService.stop).toHaveBeenCalledTimes(1);
	});

	it('serializes replacement activation behind teardown and starts with the new grant', async () => {
		let resolveStopped = (): void => undefined;
		homeyService.stop.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveStopped = resolve;
				}),
		);

		service.activateGrant();
		await Promise.resolve();
		await Promise.resolve();
		expect(homeyService.stop).toHaveBeenCalledTimes(1);
		expect(homeyService.start).not.toHaveBeenCalled();

		resolveStopped();
		await service.disconnectGrant();
		expect(homeyService.start).toHaveBeenCalledTimes(1);
		expect(homeyService.stop).toHaveBeenCalledTimes(2);
	});

	it('retries a transient replacement restart while the committed grant remains active', async () => {
		jest.useFakeTimers();
		homeyService.stop.mockRejectedValueOnce(new Error('temporary stop failure')).mockResolvedValueOnce(undefined);
		const shouldActivate = jest.fn().mockResolvedValue(true);

		try {
			service.activateGrant(shouldActivate);
			await service.disconnectGrant(() => Promise.resolve(false));

			expect(homeyService.stop).toHaveBeenCalledTimes(1);
			expect(homeyService.start).not.toHaveBeenCalled();

			await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS);
			await service.disconnectGrant(() => Promise.resolve(false));

			expect(shouldActivate).toHaveBeenCalledTimes(2);
			expect(homeyService.stop).toHaveBeenCalledTimes(2);
			expect(homeyService.start).toHaveBeenCalledTimes(1);
		} finally {
			service.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('cancels a pending activation retry when the committed grant is removed', async () => {
		jest.useFakeTimers();
		homeyService.stop.mockRejectedValueOnce(new Error('temporary stop failure')).mockResolvedValueOnce(undefined);

		try {
			service.activateGrant(() => Promise.resolve(true));
			await service.disconnectGrant(() => Promise.resolve(false));
			await service.disconnectGrant(() => Promise.resolve(true));

			await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS);
			await service.disconnectGrant(() => Promise.resolve(false));

			expect(homeyService.stop).toHaveBeenCalledTimes(2);
			expect(homeyService.start).not.toHaveBeenCalled();
		} finally {
			service.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('does not retry a permanent committed-grant startup failure', async () => {
		jest.useFakeTimers();
		homeyService.start.mockRejectedValue(new Error('sanitized permanent startup failure'));
		homeyService.getStatus.mockReturnValue({
			lastErrorCategory: HomeyConnectorErrorCategory.AUTHENTICATION,
		} as ReturnType<HomeyService['getStatus']>);

		try {
			service.activateGrant(() => Promise.resolve(true));
			await service.disconnectGrant(() => Promise.resolve(false));

			await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS);
			await service.disconnectGrant(() => Promise.resolve(false));

			expect(homeyService.stop).toHaveBeenCalledTimes(1);
			expect(homeyService.start).toHaveBeenCalledTimes(1);
		} finally {
			service.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('retries an explicitly retryable committed-grant startup failure', async () => {
		jest.useFakeTimers();
		homeyService.start.mockRejectedValueOnce(new Error('sanitized transient startup failure')).mockResolvedValueOnce();
		homeyService.getStatus.mockReturnValue({
			lastErrorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
		} as ReturnType<HomeyService['getStatus']>);

		try {
			service.activateGrant(() => Promise.resolve(true));
			await service.disconnectGrant(() => Promise.resolve(false));
			await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS);
			await service.disconnectGrant(() => Promise.resolve(false));

			expect(homeyService.stop).toHaveBeenCalledTimes(2);
			expect(homeyService.start).toHaveBeenCalledTimes(2);
		} finally {
			service.onModuleDestroy();
			jest.useRealTimers();
		}
	});

	it('does not start disabled or local runtime after cloud authorization', async () => {
		config.enabled = false;
		service.activateGrant();
		await Promise.resolve();
		await Promise.resolve();

		config.enabled = true;
		config.mode = HomeyConnectionMode.LOCAL;
		service.activateGrant();
		await Promise.resolve();
		await Promise.resolve();

		expect(homeyService.stop).not.toHaveBeenCalled();
		expect(homeyService.start).not.toHaveBeenCalled();
	});

	it('awaits cloud connector shutdown before disconnect completes', async () => {
		await expect(service.disconnectGrant()).resolves.toBeUndefined();
		expect(homeyService.stop).toHaveBeenCalledTimes(1);
	});

	it('keeps a newly activated grant running when guarded teardown was queued afterward', async () => {
		service.activateGrant();
		await service.disconnectGrant(() => Promise.resolve(false));

		expect(homeyService.stop).toHaveBeenCalledTimes(1);
		expect(homeyService.start).toHaveBeenCalledTimes(1);
		expect(homeyService.stop.mock.invocationCallOrder[0]).toBeLessThan(homeyService.start.mock.invocationCallOrder[0]);
	});

	it('lets grant activation queued after guarded teardown win', async () => {
		const teardown = service.disconnectGrant(() => Promise.resolve(true));
		service.activateGrant();
		await teardown;
		await service.disconnectGrant(() => Promise.resolve(false));

		expect(homeyService.stop).toHaveBeenCalledTimes(2);
		expect(homeyService.start).toHaveBeenCalledTimes(1);
		expect(homeyService.stop.mock.invocationCallOrder[1]).toBeLessThan(homeyService.start.mock.invocationCallOrder[0]);
	});
});
