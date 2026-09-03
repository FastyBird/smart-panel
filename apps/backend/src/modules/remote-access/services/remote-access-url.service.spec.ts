import si from 'systeminformation';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessEndpoint } from '../platforms/remote-access-provider.platform';
import { EventType } from '../remote-access.constants';
import { NoUrlAvailableException } from '../remote-access.exceptions';

import { RemoteAccessStatusService } from './remote-access-status.service';
import { RemoteAccessUrlService } from './remote-access-url.service';

const httpsPublic: RemoteAccessEndpoint = {
	url: 'https://public.example.com',
	scope: 'public',
	https: true,
	label: 'HTTPS public',
};
const httpPublic: RemoteAccessEndpoint = {
	url: 'http://public.example.com',
	scope: 'public',
	https: false,
	label: 'HTTP public',
};
const httpsPrivate: RemoteAccessEndpoint = {
	url: 'https://node.tailnet.ts.net',
	scope: 'private',
	https: true,
	label: 'HTTPS private',
};
const httpPrivate: RemoteAccessEndpoint = {
	url: 'http://100.64.0.1',
	scope: 'private',
	https: false,
	label: 'HTTP private',
};

describe('RemoteAccessUrlService', () => {
	let configService: { getModuleConfig: jest.Mock };
	let nestConfigService: NestConfigService;
	let statusService: { getCachedStatuses: jest.Mock };
	let eventEmitter: { emit: jest.Mock };
	let service: RemoteAccessUrlService;

	const baseConfig = () => ({
		enabled: true,
		internalUrl: null,
		externalUrl: null,
		trustForwardedHeaders: false,
		trustedProxies: [],
	});

	const withEndpoints = (...endpoints: RemoteAccessEndpoint[]) => [
		{
			type: 'remote-access-tailscale',
			state: 'connected' as const,
			endpoints,
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: '2025-01-18T12:00:00Z',
		},
	];

	beforeEach(() => {
		configService = { getModuleConfig: jest.fn().mockReturnValue(baseConfig()) };
		nestConfigService = {
			get: jest.fn((key: string) => ({ FB_APP_HOST: 'http://localhost', FB_BACKEND_PORT: 3000 })[key]),
		} as unknown as NestConfigService;
		statusService = { getCachedStatuses: jest.fn().mockReturnValue([]) };
		eventEmitter = { emit: jest.fn() };

		service = new RemoteAccessUrlService(
			configService as unknown as ConfigService,
			nestConfigService,
			statusService as unknown as RemoteAccessStatusService,
			eventEmitter as unknown as EventEmitter2,
		);
	});

	describe('internal URL resolution', () => {
		it('derives the internal URL from FB_APP_HOST/FB_BACKEND_PORT when unset', () => {
			expect(service.getUrls().internal).toBe('http://localhost:3000');
		});

		it('uses the configured internal_url override when set', () => {
			configService.getModuleConfig.mockReturnValue({ ...baseConfig(), internalUrl: 'https://panel.local' });

			expect(service.getUrls().internal).toBe('https://panel.local');
		});
	});

	describe('external URL ranking', () => {
		it('ranks HTTPS before HTTP regardless of scope', () => {
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpPublic, httpsPrivate));

			expect(service.getUrls().external.map((e) => e.url)).toEqual([httpsPrivate.url, httpPublic.url]);
		});

		it('ranks public before private when HTTPS is equal', () => {
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpsPrivate, httpsPublic));

			expect(service.getUrls().external.map((e) => e.url)).toEqual([httpsPublic.url, httpsPrivate.url]);
		});

		it('falls back to registration order for equally ranked endpoints', () => {
			const first: RemoteAccessEndpoint = { ...httpsPublic, url: 'https://first.example.com' };
			const second: RemoteAccessEndpoint = { ...httpsPublic, url: 'https://second.example.com' };
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(first, second));

			expect(service.getUrls().external.map((e) => e.url)).toEqual([first.url, second.url]);
		});

		it('orders all four combinations HTTPS+public, HTTPS+private, HTTP+public, HTTP+private', () => {
			statusService.getCachedStatuses.mockReturnValue(
				withEndpoints(httpPrivate, httpsPrivate, httpPublic, httpsPublic),
			);

			expect(service.getUrls().external.map((e) => e.url)).toEqual([
				httpsPublic.url,
				httpsPrivate.url,
				httpPublic.url,
				httpPrivate.url,
			]);
		});

		it('includes the manual external_url as a public endpoint ranked by its own scheme', () => {
			configService.getModuleConfig.mockReturnValue({ ...baseConfig(), externalUrl: 'http://manual.example.com' });

			const urls = service.getUrls();

			expect(urls.external).toEqual([
				expect.objectContaining({ url: 'http://manual.example.com', scope: 'public', https: false }),
			]);
		});

		it('excludes endpoints from a provider that is not connected', () => {
			statusService.getCachedStatuses.mockReturnValue([
				{
					type: 'remote-access-tailscale',
					state: 'disconnected',
					endpoints: [httpsPublic],
					details: {},
					proxyAddresses: [],
					advisories: [],
					updatedAt: '2025-01-18T12:00:00Z',
				},
			]);

			expect(service.getUrls().external).toEqual([]);
		});

		it('sets primaryExternalUrl to the top-ranked entry, or null when there is none', () => {
			expect(service.getUrls().primaryExternalUrl).toBeNull();

			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpPublic, httpsPublic));

			expect(service.getUrls().primaryExternalUrl).toBe(httpsPublic.url);
		});
	});

	describe('module disabled', () => {
		it('reports no external URLs but still resolves the internal URL', () => {
			configService.getModuleConfig.mockReturnValue({
				...baseConfig(),
				enabled: false,
				externalUrl: 'https://x.example.com',
			});
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpsPublic));

			const urls = service.getUrls();

			expect(urls.internal).toBe('http://localhost:3000');
			expect(urls.external).toEqual([]);
			expect(urls.primaryExternalUrl).toBeNull();
		});
	});

	describe('getUrl option matrix', () => {
		beforeEach(() => {
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpPublic, httpsPublic));
		});

		it('defaults to the internal URL', () => {
			expect(service.getUrl()).toBe('http://localhost:3000');
		});

		it('prefers external when preferExternal is true', () => {
			expect(service.getUrl({ preferExternal: true })).toBe(httpsPublic.url);
		});

		it('requireHttps skips the internal HTTP URL and falls through to an HTTPS external candidate', () => {
			expect(service.getUrl({ requireHttps: true })).toBe(httpsPublic.url);
		});

		it('requirePublic skips the (always-private) internal URL', () => {
			expect(service.getUrl({ requirePublic: true })).toBe(httpsPublic.url);
		});

		it('allowInternal false with no external available throws NoUrlAvailableException', () => {
			statusService.getCachedStatuses.mockReturnValue([]);

			expect(() => service.getUrl({ allowInternal: false })).toThrow(NoUrlAvailableException);
		});

		it('allowExternal false ignores external candidates even when preferExternal is set', () => {
			expect(service.getUrl({ allowExternal: false, preferExternal: true })).toBe('http://localhost:3000');
		});

		it('throws NoUrlAvailableException when both internal and external are disallowed', () => {
			expect(() => service.getUrl({ allowInternal: false, allowExternal: false })).toThrow(NoUrlAvailableException);
		});

		it('throws NoUrlAvailableException when requireHttps has no HTTPS candidate at all', () => {
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpPublic));

			expect(() => service.getUrl({ requireHttps: true, allowInternal: false })).toThrow(NoUrlAvailableException);
		});
	});

	describe('getCandidates', () => {
		afterEach(() => {
			jest.restoreAllMocks();
		});

		it('lists non-internal LAN IPv4 addresses and the hostname.local candidate', async () => {
			jest
				.spyOn(si, 'networkInterfaces')
				.mockResolvedValue([
					{ ip4: '127.0.0.1', ip6: '', internal: true } as never,
					{ ip4: '192.168.1.50', ip6: '', internal: false } as never,
					{ ip4: '', ip6: 'fe80::1', internal: false } as never,
				]);

			const candidates = await service.getCandidates();

			expect(candidates).toEqual(
				expect.arrayContaining([expect.stringContaining('192.168.1.50'), expect.stringContaining('[fe80::1]')]),
			);
			expect(candidates.some((candidate) => candidate.endsWith('.local:3000'))).toBe(true);
			expect(candidates.some((candidate) => candidate.includes('127.0.0.1'))).toBe(false);
		});

		it('never throws when systeminformation rejects', async () => {
			jest.spyOn(si, 'networkInterfaces').mockRejectedValue(new Error('boom'));

			await expect(service.getCandidates()).resolves.toEqual(expect.any(Array));
		});
	});

	describe('reactive recompute and URLS_CHANGED', () => {
		it('emits URLS_CHANGED with the new snapshot when the ranked list changes', () => {
			service.refresh();

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.URLS_CHANGED, {
				internal: 'http://localhost:3000',
				external: [],
				primaryExternalUrl: null,
			});
		});

		it('does not emit again when refreshed with no change', () => {
			service.refresh();
			eventEmitter.emit.mockClear();

			service.refresh();

			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('recomputes and emits again on a subsequent PROVIDER_STATUS event', () => {
			service.refresh();
			eventEmitter.emit.mockClear();
			statusService.getCachedStatuses.mockReturnValue(withEndpoints(httpsPublic));

			service.onProviderStatus();

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.URLS_CHANGED,
				expect.objectContaining({ primaryExternalUrl: httpsPublic.url }),
			);
		});

		it('recomputes on a CONFIG_UPDATED event for this module, but ignores other modules', () => {
			service.refresh();
			eventEmitter.emit.mockClear();
			configService.getModuleConfig.mockReturnValue({ ...baseConfig(), internalUrl: 'https://panel.local' });

			service.onConfigUpdated({ source: 'weather-module', type: 'module' });
			expect(eventEmitter.emit).not.toHaveBeenCalled();

			service.onConfigUpdated({ source: 'remote-access-module', type: 'module' });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.URLS_CHANGED,
				expect.objectContaining({ internal: 'https://panel.local' }),
			);
		});
	});
});
