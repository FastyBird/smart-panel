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
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

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

	it('reflects a later provider status change without re-registering, since addresses() is read live', () => {
		service.onModuleInit();
		const addresses = registeredSource();

		expect(addresses.addresses()).toEqual([]);

		statusService.getCachedStatuses.mockReturnValue([connectedStatus('remote-access-tailscale', ['100.64.0.1'])]);

		expect(trustedProxyRegistry.register).toHaveBeenCalledTimes(1);
		expect(addresses.addresses()).toEqual(['100.64.0.1']);
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
	});
});
