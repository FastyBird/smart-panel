import { ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CameraStreamProviderRegistryService } from './camera-stream-provider.registry.service';

const provider = (type: string): ICameraStreamProvider => ({
	getType: () => type,
	listProfiles: jest.fn(),
	resolveSource: jest.fn(),
	getSnapshot: jest.fn(),
});

describe('CameraStreamProviderRegistryService', () => {
	let registry: CameraStreamProviderRegistryService;

	beforeEach(() => {
		registry = new CameraStreamProviderRegistryService();
	});

	it('returns the provider registered for a device type', () => {
		const p = provider('devices-a');

		registry.register(p);

		expect(registry.get({ type: 'devices-a' })).toBe(p);
		expect(registry.has({ type: 'devices-a' })).toBe(true);
		expect(registry.has({ type: 'devices-b' })).toBe(false);
		expect(registry.get({ type: 'devices-b' })).toBeNull();
	});

	it('refuses a second provider for the same type and keeps the first', () => {
		const first = provider('devices-a');

		registry.register(first);

		expect(registry.register(provider('devices-a'))).toBeNull();
		expect(registry.get({ type: 'devices-a' })).toBe(first);
	});

	it('dispose removes only its own registration', () => {
		const handle = registry.register(provider('devices-a'));

		handle.dispose();

		const second = provider('devices-a');

		registry.register(second);
		handle.dispose();

		expect(registry.get({ type: 'devices-a' })).toBe(second);
	});

	it('is empty after module destroy and accepts no registration', () => {
		registry.register(provider('devices-a'));
		registry.onModuleDestroy();

		expect(registry.list()).toEqual([]);
		expect(registry.register(provider('devices-b'))).toBeNull();
	});
});
