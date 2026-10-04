import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../config/services/config.service';
import {
	IRemoteAccessProvider,
	RemoteAccessProviderStatus,
	RemoteAccessStatusReadOptions,
} from '../platforms/remote-access-provider.platform';
import { EventType, REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS } from '../remote-access.constants';
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
	let disabledTypes: Set<string>;
	let configService: { getPluginConfig: jest.Mock };
	let service: RemoteAccessStatusService;

	beforeEach(() => {
		registry = new RemoteAccessProviderRegistryService();
		disabledTypes = new Set<string>();
		configService = {
			getPluginConfig: jest.fn((type: string) => ({ type, enabled: !disabledTypes.has(type) })),
		};
		service = new RemoteAccessStatusService(registry, configService as unknown as ConfigService);
	});

	it('keeps a newer event when an older GET finishes afterwards (D4)', async () => {
		let resolveStatus!: (status: RemoteAccessProviderStatus) => void;
		registry.register(
			buildProvider(
				'remote-access-tailscale',
				() =>
					new Promise((resolve) => {
						resolveStatus = resolve;
					}),
			),
		);

		const pending = service.getProviderStatus('remote-access-tailscale');
		service.onProviderStatus(buildStatus({ state: 'disconnected', updatedAt: '2020-01-01T00:00:00Z' }));
		resolveStatus(buildStatus({ state: 'connected', updatedAt: '2030-01-01T00:00:00Z' }));

		expect((await pending).state).toBe('disconnected');
		expect(service.getCachedStatuses()[0].state).toBe('disconnected');
	});

	it('coalesces aggregate and individual reads into one observation', async () => {
		let resolveStatus!: (status: RemoteAccessProviderStatus) => void;
		const getStatus = jest.fn(
			() =>
				new Promise<RemoteAccessProviderStatus>((resolve) => {
					resolveStatus = resolve;
				}),
		);
		registry.register(buildProvider('remote-access-tailscale', getStatus));
		const aggregate = service.getAggregatedStatuses();
		const single = service.getProviderStatus('remote-access-tailscale');
		resolveStatus(buildStatus());
		expect((await aggregate)[0].revision).toBe((await single).revision);
		expect(getStatus).toHaveBeenCalledTimes(1);
	});

	it('commits before downstream listeners and publishes GET-discovered transitions', async () => {
		const emitter = new EventEmitter2();
		service = new RemoteAccessStatusService(registry, configService as unknown as ConfigService, emitter);
		registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));
		const consumed: string[] = [];
		emitter.on(EventType.PROVIDER_STATUS, (status: RemoteAccessProviderStatus) => {
			expect(service.getCachedStatuses()[0]).toEqual(status);
			consumed.push(status.state);
		});
		const first = await service.getProviderStatus('remote-access-tailscale');
		service.onProviderStatus(buildStatus({ state: 'disconnected' }));
		expect(consumed).toEqual(['connected', 'disconnected']);
		expect(service.getVersion().revision).toBeGreaterThan(first.revision);
		expect(service.getVersion().epoch).toBe(first.epoch);
		expect(
			new RemoteAccessStatusService(registry, configService as unknown as ConfigService).getVersion().epoch,
		).not.toBe(first.epoch);
	});

	it('accepts opaque metadata with its observation and never emits it to subscribers', async () => {
		const emitter = new EventEmitter2();
		const emit = jest.spyOn(emitter, 'emit');
		service = new RemoteAccessStatusService(registry, configService as unknown as ConfigService, emitter);
		registry.register({
			...buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())),
			getSnapshot: () => Promise.resolve({ status: buildStatus(), metadata: { ready: true } }),
		});
		const result = await service.getProviderSnapshot<{ ready: boolean }>('remote-access-tailscale');
		expect(result.metadata).toEqual({ ready: true });
		expect(emit.mock.calls[0][1]).not.toHaveProperty('metadata');
	});

	it('keeps ownership after the deadline until actual provider work settles', async () => {
		jest.useFakeTimers();
		try {
			let resolveStatus!: (status: RemoteAccessProviderStatus) => void;
			let signal: AbortSignal | undefined;
			const getStatus = jest.fn((options?: RemoteAccessStatusReadOptions) => {
				signal = options?.signal;
				return new Promise<RemoteAccessProviderStatus>((resolve) => {
					resolveStatus = resolve;
				});
			});
			registry.register(buildProvider('remote-access-tailscale', getStatus));
			const first = service.getProviderStatus('remote-access-tailscale');
			await jest.advanceTimersByTimeAsync(REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS);
			expect((await first).state).toBe('error');
			expect(signal?.aborted).toBe(true);
			for (let count = 0; count < 10; count++) {
				expect((await service.getProviderStatus('remote-access-tailscale')).state).toBe('error');
			}
			expect(getStatus).toHaveBeenCalledTimes(1);
			resolveStatus(buildStatus());
			await Promise.resolve();
			await Promise.resolve();
			expect(service.getCachedStatuses()[0].state).toBe('error');
			getStatus.mockImplementation(() => Promise.resolve(buildStatus({ state: 'disconnected' })));
			expect((await service.getProviderStatus('remote-access-tailscale')).state).toBe('disconnected');
			expect(getStatus).toHaveBeenCalledTimes(2);
		} finally {
			jest.useRealTimers();
		}
	});

	it('keeps disabled administrative details observable without URL or proxy contributions', async () => {
		const getStatus = jest.fn(() => Promise.resolve(buildStatus({ proxyAddresses: ['127.0.0.1'] })));
		registry.register(buildProvider('remote-access-tailscale', getStatus));
		disabledTypes.add('remote-access-tailscale');
		const snapshot = await service.getProviderSnapshot('remote-access-tailscale');
		expect(snapshot.status.state).toBe('disconnected');
		expect(snapshot.status.proxyAddresses).toEqual([]);
		expect(snapshot.status.epoch).toEqual(expect.any(String));
		expect(service.getCachedStatuses()).toEqual([]);
		expect(await service.getAggregatedStatuses()).toEqual([]);
		expect(getStatus).toHaveBeenCalledTimes(1);
	});

	it('invalidates administrative details and a delayed GET when configuration disables its provider', async () => {
		let resolveStatus!: (status: RemoteAccessProviderStatus) => void;
		registry.register(
			buildProvider(
				'remote-access-tailscale',
				() =>
					new Promise((resolve) => {
						resolveStatus = resolve;
					}),
			),
		);
		service.onProviderStatus(buildStatus());
		const pending = service.getProviderSnapshot('remote-access-tailscale');
		disabledTypes.add('remote-access-tailscale');
		service.onConfigUpdated({ type: 'plugin', source: 'remote-access-tailscale' });
		resolveStatus(buildStatus());
		expect((await pending).status.state).toBe('disconnected');
		expect(service.getCachedProviderSnapshot('remote-access-tailscale')?.status.state).toBe('disconnected');
		expect(service.getCachedStatuses()).toEqual([]);
	});

	it('copies provider-owned data and metadata at acceptance', async () => {
		const status = buildStatus({ details: { tailnet: 'original' } });
		const metadata = { requirements: { ready: true } };
		registry.register({
			...buildProvider('remote-access-tailscale', () => Promise.resolve(status)),
			getSnapshot: () => Promise.resolve({ status, metadata }),
		});
		const result = await service.getProviderSnapshot<typeof metadata>('remote-access-tailscale');
		status.details.tailnet = 'changed';
		metadata.requirements.ready = false;
		result.metadata.requirements.ready = false;
		expect(
			service.getCachedProviderSnapshot<typeof metadata>('remote-access-tailscale')?.metadata?.requirements.ready,
		).toBe(true);
		expect(service.getCachedStatuses()[0].details.tailnet).toBe('original');
	});

	it('publishes disabled ownership separately from disconnected observation', () => {
		const emitter = new EventEmitter2();
		const emit = jest.spyOn(emitter, 'emit');
		service = new RemoteAccessStatusService(registry, configService as unknown as ConfigService, emitter);
		registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));
		disabledTypes.add('remote-access-tailscale');
		service.onProviderStatus(buildStatus());
		expect(emit).toHaveBeenCalledWith(
			EventType.PROVIDER_STATUS,
			expect.objectContaining({ enabled: false, state: 'disconnected' }),
		);
		expect(service.getCachedProviderSnapshot('remote-access-tailscale')?.status.enabled).toBe(false);
		expect(service.getCachedStatuses()).toEqual([]);
		disabledTypes.delete('remote-access-tailscale');
		service.onProviderStatus(buildStatus({ state: 'disconnected' }));
		expect(service.getCachedStatuses()[0].enabled).toBe(true);
	});

	describe('getCachedStatuses', () => {
		it('starts empty', () => {
			expect(service.getCachedStatuses()).toEqual([]);
		});

		it('stores the full payload from a PROVIDER_STATUS event whose type is registered', () => {
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));
			const status = buildStatus();

			service.onProviderStatus(status);

			expect(service.getCachedStatuses()).toEqual([expect.objectContaining(status)]);
		});

		it('replaces the cached entry for the same provider type on a later event', () => {
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));

			service.onProviderStatus(buildStatus({ state: 'connecting' }));
			service.onProviderStatus(buildStatus({ state: 'connected' }));

			expect(service.getCachedStatuses()).toEqual([expect.objectContaining(buildStatus({ state: 'connected' }))]);
		});

		it('drops an event whose type does not resolve to a registered provider, without caching it (F6)', () => {
			// Nothing registered under 'remote-access-tailscale' in this test —
			// the event-fed cache must not trust a self-reported type it cannot
			// attribute to a real provider, otherwise a phantom entry would leak
			// into RemoteAccessUrlService/RemoteAccessPostureService/
			// RemoteAccessProxyContributionService, all of which read
			// getCachedStatuses() directly.
			const status = buildStatus();
			const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

			service.onProviderStatus(status);

			expect(service.getCachedStatuses()).toEqual([]);
			expect(debugSpy).toHaveBeenCalledWith(
				expect.stringContaining("Ignoring a Provider.Status event for 'remote-access-tailscale'"),
				expect.anything(),
			);
		});

		it('caches a later event once its type becomes registered, without needing to resubscribe', () => {
			const status = buildStatus();

			service.onProviderStatus(status);
			expect(service.getCachedStatuses()).toEqual([]);

			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(status)));
			service.onProviderStatus(status);

			expect(service.getCachedStatuses()).toEqual([expect.objectContaining(status)]);
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

			expect(service.getCachedStatuses()).toEqual([expect.objectContaining(status)]);
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

	describe('provider identity normalization', () => {
		// A provider is looked up (and its status cached) by the type it registered under; a status
		// payload that disagrees with that must not be trusted over the registry's own identity.
		it('uses the registered provider type, not a mismatched status.type, for the returned model', async () => {
			registry.register(
				buildProvider('remote-access-tailscale', () =>
					Promise.resolve(buildStatus({ type: 'remote-access-tailscale-legacy' })),
				),
			);

			const aggregated = await service.getAggregatedStatuses();
			expect(aggregated).toEqual([expect.objectContaining({ type: 'remote-access-tailscale' })]);

			const single = await service.getProviderStatus('remote-access-tailscale');
			expect(single).toEqual(expect.objectContaining({ type: 'remote-access-tailscale' }));
		});

		it('caches the status under the registered provider type, not the mismatched status.type', async () => {
			registry.register(
				buildProvider('remote-access-tailscale', () =>
					Promise.resolve(buildStatus({ type: 'remote-access-tailscale-legacy' })),
				),
			);

			await service.getAggregatedStatuses();

			const cached = service.getCachedStatuses();
			expect(cached).toHaveLength(1);
			expect(cached[0].type).toBe('remote-access-tailscale');
		});
	});

	describe('provider status timeout', () => {
		afterEach(() => {
			jest.useRealTimers();
		});

		it('bounds a hanging provider so aggregation still completes, reporting it as error, while other providers still return', async () => {
			jest.useFakeTimers();

			registry.register(buildProvider('remote-access-hanging', () => new Promise(() => undefined)));
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));

			const aggregating = service.getAggregatedStatuses();

			await jest.advanceTimersByTimeAsync(REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS);

			const result = await aggregating;

			const hanging = result.find((entry) => entry.type === 'remote-access-hanging');
			const other = result.find((entry) => entry.type === 'remote-access-tailscale');

			expect(hanging?.state).toBe('error');
			expect(hanging?.message).toBe(
				`Provider did not report a status within ${REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS}ms.`,
			);
			expect(other?.state).toBe('connected');
		});
	});
	describe('disabled provider plugins', () => {
		it('neither polls nor lists a provider whose plugin is disabled', async () => {
			const getStatus = jest.fn(() => Promise.resolve(buildStatus()));
			registry.register(buildProvider('remote-access-tailscale', getStatus));
			disabledTypes.add('remote-access-tailscale');

			await expect(service.getAggregatedStatuses()).resolves.toEqual([]);
			expect(getStatus).not.toHaveBeenCalled();
			expect(service.getCachedStatuses()).toEqual([]);
		});

		it('drops a cached status once its plugin is disabled', async () => {
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));

			await service.getAggregatedStatuses();
			expect(service.getCachedStatuses()).toHaveLength(1);

			disabledTypes.add('remote-access-tailscale');

			expect(service.getCachedStatuses()).toEqual([]);
		});

		it('ignores a PROVIDER_STATUS event from a disabled plugin', () => {
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));
			disabledTypes.add('remote-access-tailscale');

			service.onProviderStatus(buildStatus());

			expect(service.getCachedStatuses()).toEqual([]);
		});

		it('neither lists nor caches a provider whose plugin was disabled while its poll was in flight', async () => {
			let resolveStatus: (status: RemoteAccessProviderStatus) => void = () => undefined;
			registry.register(
				buildProvider(
					'remote-access-tailscale',
					() =>
						new Promise<RemoteAccessProviderStatus>((resolve) => {
							resolveStatus = resolve;
						}),
				),
			);

			const aggregate = service.getAggregatedStatuses();

			disabledTypes.add('remote-access-tailscale');
			resolveStatus(buildStatus());

			await expect(aggregate).resolves.toEqual([]);
			expect(service.getCachedStatuses()).toEqual([]);
		});

		it('treats a provider whose plugin config cannot be read as disabled', async () => {
			const getStatus = jest.fn(() => Promise.resolve(buildStatus()));
			registry.register(buildProvider('remote-access-tailscale', getStatus));
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('missing');
			});

			await expect(service.getAggregatedStatuses()).resolves.toEqual([]);
			expect(getStatus).not.toHaveBeenCalled();
		});

		it('reports whether a provider type is registered regardless of its enabled state', () => {
			registry.register(buildProvider('remote-access-tailscale', () => Promise.resolve(buildStatus())));
			disabledTypes.add('remote-access-tailscale');

			expect(service.hasProvider('remote-access-tailscale')).toBe(true);
			expect(service.hasProvider('remote-access-cloudflare-tunnel')).toBe(false);
		});
	});
});
