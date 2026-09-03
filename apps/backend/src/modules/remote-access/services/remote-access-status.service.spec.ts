import { IRemoteAccessProvider, RemoteAccessProviderStatus } from '../platforms/remote-access-provider.platform';
import { RemoteAccessProviderNotFoundException } from '../remote-access.exceptions';

import { RemoteAccessProviderRegistryService } from './remote-access-provider-registry.service';
import { RemoteAccessStatusService } from './remote-access-status.service';

const buildStatus = (overrides: Partial<RemoteAccessProviderStatus> = {}): RemoteAccessProviderStatus => ({
	type: 'remote-access-tailscale',
	state: 'connected',
	endpoints: [],
	details: {},
	proxyAddresses: [],
	advisories: [],
	updatedAt: '2025-01-18T12:00:00Z',
	...overrides,
});

const buildProvider = (type: string, getStatus: () => Promise<RemoteAccessProviderStatus>): IRemoteAccessProvider => ({
	type,
	kind: 'mesh',
	capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: false },
	getStatus,
});

describe('RemoteAccessStatusService', () => {
	let registry: RemoteAccessProviderRegistryService;
	let service: RemoteAccessStatusService;

	beforeEach(() => {
		registry = new RemoteAccessProviderRegistryService();
		service = new RemoteAccessStatusService(registry);
	});

	describe('getCachedStatuses', () => {
		it('starts empty', () => {
			expect(service.getCachedStatuses()).toEqual([]);
		});

		it('stores the full payload from a PROVIDER_STATUS event', () => {
			const status = buildStatus();

			service.onProviderStatus(status);

			expect(service.getCachedStatuses()).toEqual([status]);
		});

		it('replaces the cached entry for the same provider type on a later event', () => {
			service.onProviderStatus(buildStatus({ state: 'connecting' }));
			service.onProviderStatus(buildStatus({ state: 'connected' }));

			expect(service.getCachedStatuses()).toEqual([buildStatus({ state: 'connected' })]);
		});
	});

	describe('getAggregatedStatuses', () => {
		it('returns an empty array when no provider is registered', async () => {
			expect(await service.getAggregatedStatuses()).toEqual([]);
		});

		it('merges each provider live status with its static kind/capabilities', async () => {
			const status = buildStatus();
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(status)));

			const result = await service.getAggregatedStatuses();

			expect(result).toEqual([
				expect.objectContaining({
					type: 'remote-access-tailscale',
					kind: 'mesh',
					capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: false },
					state: 'connected',
				}),
			]);
		});

		it('updates the cache as a side effect', async () => {
			const status = buildStatus();
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(status)));

			await service.getAggregatedStatuses();

			expect(service.getCachedStatuses()).toEqual([status]);
		});

		it('synthesizes an error entry instead of throwing when a provider rejects', async () => {
			registry.register(buildProvider('remote-access-broken', () => Promise.reject(new Error('boom'))));

			const result = await service.getAggregatedStatuses();

			expect(result).toEqual([
				expect.objectContaining({
					type: 'remote-access-broken',
					state: 'error',
					endpoints: [],
				}),
			]);
		});
	});

	describe('getProviderStatus', () => {
		it('returns the merged status for a known provider type', async () => {
			const status = buildStatus();
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(status)));

			const result = await service.getProviderStatus('remote-access-tailscale');

			expect(result).toEqual(expect.objectContaining({ type: 'remote-access-tailscale', state: 'connected' }));
		});

		it('throws RemoteAccessProviderNotFoundException for an unknown provider type', async () => {
			await expect(service.getProviderStatus('unknown')).rejects.toThrow(RemoteAccessProviderNotFoundException);
		});
	});
});
