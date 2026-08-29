import { HomeyCloudRuntimeRegistryService } from './homey-cloud-runtime-registry.service';

describe('HomeyCloudRuntimeRegistryService', () => {
	it('forwards teardown only after a runtime registers', async () => {
		const service = new HomeyCloudRuntimeRegistryService();
		const teardown = jest.fn().mockResolvedValue(undefined);
		const shouldDisconnect = jest.fn().mockResolvedValue(true);

		await expect(service.disconnectGrant(shouldDisconnect)).rejects.toThrow('not registered');
		service.register(teardown);
		await expect(service.disconnectGrant(shouldDisconnect)).resolves.toBeUndefined();

		expect(teardown).toHaveBeenCalledTimes(1);
		expect(teardown).toHaveBeenCalledWith(shouldDisconnect);
		expect(() => service.register(teardown)).toThrow('already registered');
	});
});
