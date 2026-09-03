import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessProviderStatus } from '../platforms/remote-access-provider.platform';

import { RemoteAccessPostureService } from './remote-access-posture.service';
import { RemoteAccessStatusService } from './remote-access-status.service';
import { RemoteAccessUrlService } from './remote-access-url.service';

describe('RemoteAccessPostureService', () => {
	let configService: { getModuleConfig: jest.Mock };
	let urlService: { getUrls: jest.Mock };
	let statusService: { getCachedStatuses: jest.Mock };
	let service: RemoteAccessPostureService;

	const baseConfig = () => ({
		enabled: true,
		internalUrl: null,
		externalUrl: null,
		trustForwardedHeaders: false,
		trustedProxies: [],
	});

	beforeEach(() => {
		configService = { getModuleConfig: jest.fn().mockReturnValue(baseConfig()) };
		urlService = {
			getUrls: jest.fn().mockReturnValue({ internal: 'http://localhost:3000', external: [], primaryExternalUrl: null }),
		};
		statusService = { getCachedStatuses: jest.fn().mockReturnValue([]) };

		service = new RemoteAccessPostureService(
			configService as unknown as ConfigService,
			urlService as unknown as RemoteAccessUrlService,
			statusService as unknown as RemoteAccessStatusService,
		);
	});

	it('reports no advisories for a quiet, private configuration', () => {
		expect(service.getAdvisories()).toEqual([]);
	});

	it('flags an insecure (HTTP) manual external URL', () => {
		configService.getModuleConfig.mockReturnValue({ ...baseConfig(), externalUrl: 'http://public.example.com' });

		const advisories = service.getAdvisories();

		expect(advisories).toContainEqual(expect.objectContaining({ code: 'external-url-insecure', severity: 'warning' }));
	});

	it('does not flag a secure (HTTPS) manual external URL', () => {
		configService.getModuleConfig.mockReturnValue({ ...baseConfig(), externalUrl: 'https://public.example.com' });

		expect(service.getAdvisories()).not.toContainEqual(expect.objectContaining({ code: 'external-url-insecure' }));
	});

	it('flags forwarded-header trust enabled with no trusted proxies configured', () => {
		configService.getModuleConfig.mockReturnValue({ ...baseConfig(), trustForwardedHeaders: true, trustedProxies: [] });

		expect(service.getAdvisories()).toContainEqual(
			expect.objectContaining({ code: 'forwarded-headers-without-proxies', severity: 'warning' }),
		);
	});

	it('does not flag forwarded-header trust when trusted proxies are configured', () => {
		configService.getModuleConfig.mockReturnValue({
			...baseConfig(),
			trustForwardedHeaders: true,
			trustedProxies: ['10.0.0.0/8'],
		});

		expect(service.getAdvisories()).not.toContainEqual(
			expect.objectContaining({ code: 'forwarded-headers-without-proxies' }),
		);
	});

	it('does not flag forwarded-header trust when the flag is off, even with an empty list', () => {
		configService.getModuleConfig.mockReturnValue({
			...baseConfig(),
			trustForwardedHeaders: false,
			trustedProxies: [],
		});

		expect(service.getAdvisories()).not.toContainEqual(
			expect.objectContaining({ code: 'forwarded-headers-without-proxies' }),
		);
	});

	it('flags public exposure when any ranked external endpoint is public', () => {
		urlService.getUrls.mockReturnValue({
			internal: 'http://localhost:3000',
			external: [{ url: 'https://node.tailnet.ts.net', scope: 'private', https: true, label: 'Tailscale' }],
			primaryExternalUrl: 'https://node.tailnet.ts.net',
		});

		expect(service.getAdvisories()).not.toContainEqual(expect.objectContaining({ code: 'public-exposure' }));

		urlService.getUrls.mockReturnValue({
			internal: 'http://localhost:3000',
			external: [{ url: 'https://funnel.example.ts.net', scope: 'public', https: true, label: 'Tailscale Funnel' }],
			primaryExternalUrl: 'https://funnel.example.ts.net',
		});

		expect(service.getAdvisories()).toContainEqual(
			expect.objectContaining({ code: 'public-exposure', severity: 'warning' }),
		);
	});

	it('passes through provider advisories, defaulting the provider field to the status type', () => {
		const status: RemoteAccessProviderStatus = {
			type: 'remote-access-tailscale',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [{ code: 'key-expiry', severity: 'warning', message: 'Node key expires in 3 days.' }],
			updatedAt: '2025-01-18T12:00:00Z',
		};
		statusService.getCachedStatuses.mockReturnValue([status]);

		expect(service.getAdvisories()).toContainEqual(
			expect.objectContaining({ code: 'key-expiry', provider: 'remote-access-tailscale' }),
		);
	});

	it('preserves an explicit provider field on a passed-through advisory', () => {
		const status: RemoteAccessProviderStatus = {
			type: 'remote-access-tailscale',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [{ code: 'sub-issue', severity: 'info', message: 'x', provider: 'remote-access-tailscale-ssh' }],
			updatedAt: '2025-01-18T12:00:00Z',
		};
		statusService.getCachedStatuses.mockReturnValue([status]);

		expect(service.getAdvisories()).toContainEqual(
			expect.objectContaining({ provider: 'remote-access-tailscale-ssh' }),
		);
	});
});
