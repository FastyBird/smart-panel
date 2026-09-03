import { IRemoteAccessProvider } from '../platforms/remote-access-provider.platform';
import { RemoteAccessProviderAlreadyRegisteredException } from '../remote-access.exceptions';

import { RemoteAccessProviderRegistryService } from './remote-access-provider-registry.service';

const buildProvider = (type: string): IRemoteAccessProvider => ({
	type,
	kind: 'mesh',
	capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: false },
	getStatus: jest.fn(),
});

describe('RemoteAccessProviderRegistryService', () => {
	let registry: RemoteAccessProviderRegistryService;

	beforeEach(() => {
		registry = new RemoteAccessProviderRegistryService();
	});

	it('starts empty', () => {
		expect(registry.getAll()).toEqual([]);
	});

	it('registers a provider and returns it from getAll and get', () => {
		const provider = buildProvider('remote-access-tailscale');

		registry.register(provider);

		expect(registry.getAll()).toEqual([provider]);
		expect(registry.get('remote-access-tailscale')).toBe(provider);
	});

	it('registers multiple providers in registration order', () => {
		const first = buildProvider('remote-access-tailscale');
		const second = buildProvider('remote-access-cloudflare-tunnel');

		registry.register(first);
		registry.register(second);

		expect(registry.getAll()).toEqual([first, second]);
	});

	it('throws on a duplicate provider type', () => {
		registry.register(buildProvider('remote-access-tailscale'));

		expect(() => registry.register(buildProvider('remote-access-tailscale'))).toThrow(
			RemoteAccessProviderAlreadyRegisteredException,
		);
	});

	it('returns null for an unknown provider type', () => {
		expect(registry.get('unknown')).toBeNull();
	});
});
