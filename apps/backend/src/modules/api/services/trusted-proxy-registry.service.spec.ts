import { TrustedProxyRegistryService } from './trusted-proxy-registry.service';

describe('TrustedProxyRegistryService', () => {
	let registry: TrustedProxyRegistryService;

	beforeEach(() => {
		registry = new TrustedProxyRegistryService();
	});

	it('trusts nothing before any source is registered', () => {
		expect(registry.isTrusted('127.0.0.1')).toBe(false);
	});

	it('trusts an address registered as a bare IP', () => {
		registry.register({ id: 'env', addresses: () => ['198.51.100.4'] });

		expect(registry.isTrusted('198.51.100.4')).toBe(true);
		expect(registry.isTrusted('198.51.100.5')).toBe(false);
	});

	it('trusts an address inside a registered IPv4 CIDR range', () => {
		registry.register({ id: 'env', addresses: () => ['10.0.0.0/8'] });

		expect(registry.isTrusted('10.1.2.3')).toBe(true);
		expect(registry.isTrusted('11.0.0.1')).toBe(false);
	});

	it('trusts an address inside a registered IPv6 CIDR range', () => {
		registry.register({ id: 'env', addresses: () => ['fc00::/7'] });

		expect(registry.isTrusted('fc00::1234')).toBe(true);
		expect(registry.isTrusted('fe80::1')).toBe(false);
	});

	it('unions contributions from multiple registered sources', () => {
		registry.register({ id: 'env', addresses: () => ['198.51.100.4'] });
		registry.register({ id: 'remote-access', addresses: () => ['127.0.0.1', '::1'] });

		expect(registry.isTrusted('198.51.100.4')).toBe(true);
		expect(registry.isTrusted('127.0.0.1')).toBe(true);
		expect(registry.isTrusted('::1')).toBe(true);
		expect(registry.isTrusted('203.0.113.9')).toBe(false);
	});

	it('stops trusting a source once it is unregistered', () => {
		registry.register({ id: 'remote-access', addresses: () => ['127.0.0.1'] });
		expect(registry.isTrusted('127.0.0.1')).toBe(true);

		registry.unregister('remote-access');

		expect(registry.isTrusted('127.0.0.1')).toBe(false);
	});

	it('replaces a source re-registered under the same id', () => {
		registry.register({ id: 'remote-access', addresses: () => ['127.0.0.1'] });
		registry.register({ id: 'remote-access', addresses: () => ['::1'] });

		expect(registry.isTrusted('127.0.0.1')).toBe(false);
		expect(registry.isTrusted('::1')).toBe(true);
	});

	it('unregistering an id that was never registered is a no-op', () => {
		expect(() => registry.unregister('never-registered')).not.toThrow();
	});

	it('reads a source live rather than snapshotting it at registration time', () => {
		let current = ['127.0.0.1'];
		registry.register({ id: 'remote-access', addresses: () => current });

		expect(registry.isTrusted('10.0.0.1')).toBe(false);

		// Mutating what the closure returns (e.g. a provider reconnecting
		// with a new proxy address) must be picked up without re-registering.
		current = ['10.0.0.1'];

		expect(registry.isTrusted('10.0.0.1')).toBe(true);
		expect(registry.isTrusted('127.0.0.1')).toBe(false);
	});

	it('treats an empty peer as untrusted', () => {
		registry.register({ id: 'env', addresses: () => [''] });

		expect(registry.isTrusted('')).toBe(false);
	});
});
