/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: `expect(Logger.prototype.warn).toHaveBeenCalledWith(...)` reads the
mocked method off the prototype directly (the established pattern for
asserting on `createExtensionLogger` output in this codebase), which ESLint
otherwise flags as an unsafe unbound reference.
*/
import { Logger } from '@nestjs/common';

import { TrustedProxyRegistryService, TrustedProxySource } from '../../api/services/trusted-proxy-registry.service';
import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessProviderStatus } from '../platforms/remote-access-provider.platform';
import { REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS, REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

import { RemoteAccessProxyContributionService } from './remote-access-proxy-contribution.service';
import { RemoteAccessStatusService } from './remote-access-status.service';

const connectedStatus = (type: string, proxyAddresses: string[]): RemoteAccessProviderStatus => ({
	type,
	state: 'connected',
	endpoints: [],
	details: {},
	proxyAddresses,
	advisories: [],
	updatedAt: '2025-01-18T12:00:00Z',
});

describe('RemoteAccessProxyContributionService', () => {
	let trustedProxyRegistry: { register: jest.Mock; unregister: jest.Mock };
	let configService: { getModuleConfig: jest.Mock };
	let statusService: { getCachedStatuses: jest.Mock };
	let service: RemoteAccessProxyContributionService;

	beforeEach(() => {
		trustedProxyRegistry = { register: jest.fn(), unregister: jest.fn() };
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ enabled: true, trustForwardedHeaders: false, trustedProxies: [] }),
		};
		statusService = { getCachedStatuses: jest.fn().mockReturnValue([]) };

		service = new RemoteAccessProxyContributionService(
			trustedProxyRegistry as unknown as TrustedProxyRegistryService,
			configService as unknown as ConfigService,
			statusService as unknown as RemoteAccessStatusService,
		);

		// `jest.setup.ts` re-installs this spy every test but reuses the
		// same mock instance, so call history otherwise leaks across `it`
		// blocks within this file.
		(Logger.prototype.warn as jest.Mock).mockClear();
	});

	const registeredSource = (): TrustedProxySource => {
		return (trustedProxyRegistry.register.mock.calls[0] as [TrustedProxySource])[0];
	};

	it('registers a source under the module name', () => {
		service.onModuleInit();

		expect(trustedProxyRegistry.register).toHaveBeenCalledTimes(1);
		expect(registeredSource().id).toBe(REMOTE_ACCESS_MODULE_NAME);
	});

	it('contributes nothing when the module is disabled, even with forwarded-header trust on and a connected provider', () => {
		configService.getModuleConfig.mockReturnValue({
			enabled: false,
			trustForwardedHeaders: true,
			trustedProxies: ['10.0.0.0/8'],
		});
		statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['100.64.0.1'])]);
		service.onModuleInit();

		expect(registeredSource().addresses()).toEqual([]);
	});

	it('contributes nothing when forwarded-header trust is off and no provider is connected', () => {
		service.onModuleInit();

		expect(registeredSource().addresses()).toEqual([]);
	});

	it('contributes the configured trusted_proxies only when trust_forwarded_headers is true', () => {
		configService.getModuleConfig.mockReturnValue({
			enabled: true,
			trustForwardedHeaders: false,
			trustedProxies: ['10.0.0.0/8'],
		});
		service.onModuleInit();

		expect(registeredSource().addresses()).toEqual([]);

		configService.getModuleConfig.mockReturnValue({
			enabled: true,
			trustForwardedHeaders: true,
			trustedProxies: ['10.0.0.0/8'],
		});
		// The result is memoised — a config edit alone does not change what
		// addresses() returns until the module's own CONFIG_UPDATED event
		// invalidates the cache (see the "memoisation" describe block below).
		service.onConfigUpdated({ type: 'module', source: REMOTE_ACCESS_MODULE_NAME });

		expect(registeredSource().addresses()).toEqual(['10.0.0.0/8']);
	});

	it('contributes proxyAddresses from every connected provider', () => {
		statusService.getCachedStatuses.mockReturnValue([
			connectedStatus('remote-access-tailscale', ['100.64.0.1']),
			connectedStatus('remote-access-cloudflare-tunnel', ['127.0.0.2']),
		]);
		service.onModuleInit();

		expect(registeredSource().addresses()).toEqual(['100.64.0.1', '127.0.0.2']);
	});

	it('excludes proxyAddresses from a provider that is not connected', () => {
		statusService.getCachedStatuses.mockReturnValue([
			{ ...connectedStatus('remote-access-tailscale', ['100.64.0.1']), state: 'disconnected' },
		]);
		service.onModuleInit();

		expect(registeredSource().addresses()).toEqual([]);
	});

	it('combines config-driven and provider-driven addresses', () => {
		configService.getModuleConfig.mockReturnValue({
			enabled: true,
			trustForwardedHeaders: true,
			trustedProxies: ['10.0.0.0/8'],
		});
		statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['100.64.0.1'])]);
		service.onModuleInit();

		expect(registeredSource().addresses()).toEqual(['10.0.0.0/8', '100.64.0.1']);
	});

	it('recomputes after a Provider.Status event invalidates the cache, without re-registering', () => {
		service.onModuleInit();
		const addresses = registeredSource();

		expect(addresses.addresses()).toEqual([]);

		statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['100.64.0.1'])]);
		service.onProviderStatus();

		expect(trustedProxyRegistry.register).toHaveBeenCalledTimes(1);
		expect(addresses.addresses()).toEqual(['100.64.0.1']);
	});

	describe('memoisation (F2 — per-request config read is unguarded and re-validated on every request)', () => {
		it('calls getModuleConfig only once across two addresses() calls with no invalidating event in between', () => {
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(addresses.addresses()).toEqual([]);

			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);
		});

		it('recomputes after a PROVIDER_STATUS event', () => {
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);

			service.onProviderStatus();
			addresses.addresses();

			expect(configService.getModuleConfig).toHaveBeenCalledTimes(2);
		});

		it('recomputes after a CONFIG_UPDATED event for this module, but ignores other modules and plugins', () => {
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);

			service.onConfigUpdated({ type: 'module', source: 'weather-module' });
			addresses.addresses();
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);

			service.onConfigUpdated({ type: 'plugin', source: REMOTE_ACCESS_MODULE_NAME });
			addresses.addresses();
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);

			service.onConfigUpdated({ type: 'module', source: REMOTE_ACCESS_MODULE_NAME });
			addresses.addresses();
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(2);
		});

		it('fails closed (contributes []) when the config read throws, without crashing isTrusted()', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('config store unavailable');
			});
			service.onModuleInit();

			expect(registeredSource().addresses()).toEqual([]);
		});

		it('logs the config-read failure once, not on every addresses() call, then recovers cleanly once the config reads again', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('config store unavailable');
			});
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(addresses.addresses()).toEqual([]);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);

			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				trustForwardedHeaders: false,
				trustedProxies: [],
			});
			service.onProviderStatus();

			expect(addresses.addresses()).toEqual([]);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
		});

		it('does not retry a failed config read before the retry interval has passed (CodeRabbit #952 F2 follow-up)', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('config store unavailable');
			});
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);

			// Still well within the interval — a failed read must not be
			// memoised the same way a valid empty result is, but it also must
			// not retry on every single call, only once the interval passes.
			service['configReadFailedAt'] = Date.now() - (REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS - 1000);

			expect(addresses.addresses()).toEqual([]);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);
		});

		it('retries a failed config read once the retry interval has passed, and memoises the real result on success', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('config store unavailable');
			});
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(1);

			// Past the interval — the next addresses() call must retry the
			// read on its own, with no CONFIG_UPDATED/PROVIDER_STATUS event.
			service['configReadFailedAt'] = Date.now() - (REMOTE_ACCESS_CONFIG_READ_RETRY_INTERVAL_MS + 1000);
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				trustForwardedHeaders: true,
				trustedProxies: ['10.0.0.0/8'],
			});

			expect(addresses.addresses()).toEqual(['10.0.0.0/8']);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(2);

			// The retry succeeded: back to normal event-only memoisation, no
			// further reads until an invalidating event.
			expect(addresses.addresses()).toEqual(['10.0.0.0/8']);
			expect(configService.getModuleConfig).toHaveBeenCalledTimes(2);
		});
	});

	describe('provider-declared proxy address validation', () => {
		it('accepts a valid loopback entry', () => {
			statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['127.0.0.1'])]);
			service.onModuleInit();

			expect(registeredSource().addresses()).toEqual(['127.0.0.1']);
		});

		it('accepts a valid single-host IPv6 entry', () => {
			statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['2001:db8::1'])]);
			service.onModuleInit();

			expect(registeredSource().addresses()).toEqual(['2001:db8::1']);
		});

		it('rejects a CIDR entry and logs one warning across repeated evaluations', () => {
			statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['100.64.0.0/10'])]);
			service.onModuleInit();
			const addresses = registeredSource();

			expect(addresses.addresses()).toEqual([]);
			expect(addresses.addresses()).toEqual([]);
			expect(addresses.addresses()).toEqual([]);

			expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				"[RemoteAccessProxyContributionService] Provider 'remote-access-tailscale' declared an invalid proxy " +
					"address '100.64.0.0/10'; providers may declare only a loopback or single-host address, not a CIDR " +
					'range. Dropping it from the trusted-proxy set.',
				expect.objectContaining({ tag: REMOTE_ACCESS_MODULE_NAME }),
			);
		});

		it('rejects a malformed entry', () => {
			statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['not-an-ip'])]);
			service.onModuleInit();

			expect(registeredSource().addresses()).toEqual([]);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
		});

		it('keeps only the valid entries from a mixed list', () => {
			statusService.getCachedStatuses.mockReturnValue([
				connectedStatus('remote-access-tailscale', ['100.64.0.1', '100.64.0.0/10', 'not-an-ip', '2001:db8::1']),
			]);
			service.onModuleInit();

			expect(registeredSource().addresses()).toEqual(['100.64.0.1', '2001:db8::1']);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
		});

		it('logs two rejected entries separately even when a naive "type + value" join would collide', () => {
			// Under a plain-space-joined key, ('a b', 'c') and ('a', 'b c')
			// would both produce the string "a b c" and collide, silently
			// dropping the second warning. JSON.stringify([type, entry])
			// keeps them distinct: '["a b","c"]' vs '["a","b c"]'.
			statusService.getCachedStatuses.mockReturnValue([connectedStatus('a b', ['c']), connectedStatus('a', ['b c'])]);
			service.onModuleInit();

			expect(registeredSource().addresses()).toEqual([]);
			expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
		});
	});
});
