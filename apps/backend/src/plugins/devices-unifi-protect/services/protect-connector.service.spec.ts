import { Logger } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ProtectApiClientFactory } from '../client/protect-api-client.factory';
import { ProtectNvr } from '../client/protect-api.types';
import {
	DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID,
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	ProtectConnectionState,
} from '../devices-unifi-protect.constants';
import { PROTECT_ERROR_MESSAGES, ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectConfigModel, ProtectTlsConfigModel } from '../models/config.model';

import { ProtectConnectorService } from './protect-connector.service';

const SENTINEL_KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
const NVR: ProtectNvr = { id: 'nvr-1', name: 'Console', modelKey: 'nvr', mac: null, raw: {} };

interface FakeClient {
	getMetaInfo: jest.Mock<Promise<{ applicationVersion: string }>, []>;
	getNvr: jest.Mock<Promise<ProtectNvr>, []>;
	close: jest.Mock<void, []>;
}

const fakeClient = (version: string | Error = '7.3.74'): FakeClient => ({
	getMetaInfo: jest.fn(() =>
		version instanceof Error ? Promise.reject(version) : Promise.resolve({ applicationVersion: version }),
	),
	getNvr: jest.fn(() => Promise.resolve(NVR)),
	close: jest.fn<void, []>(),
});

const apiError = (category: ProtectErrorCategory): ProtectApiError => new ProtectApiError(category, 'meta/info');

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

describe('ProtectConnectorService', () => {
	let config: ProtectConfigModel;
	let configService: { getPluginConfig: jest.Mock };
	let clients: FakeClient[];
	let factory: { create: jest.Mock };
	let service: ProtectConnectorService;
	let logged: string[];

	const makeConfig = (overrides: Partial<ProtectConfigModel> = {}, tls: Partial<ProtectTlsConfigModel> = {}) =>
		Object.assign(new ProtectConfigModel(), {
			enabled: true,
			host: 'protect.example.com',
			apiKey: 'key-1',
			...overrides,
			tls: Object.assign(new ProtectTlsConfigModel(), tls),
		});

	/** Each create() hands out the next scripted client, then plain healthy ones. */
	const queue = (...scripted: FakeClient[]): void => {
		clients = scripted;
	};

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-11-14T10:00:00.000Z'));
		jest.spyOn(Math, 'random').mockReturnValue(0.5);

		logged = [];
		for (const level of ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
			});
		}

		config = makeConfig();
		configService = { getPluginConfig: jest.fn(() => config) };
		clients = [];
		factory = { create: jest.fn(() => clients.shift() ?? fakeClient()) };
		service = new ProtectConnectorService(
			configService as unknown as ConfigService,
			factory as unknown as ProtectApiClientFactory,
		);
	});

	afterEach(async () => {
		await service.stop();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('identifies itself as the plugin connector service', () => {
		expect(service.owner).toEqual({ kind: 'plugin', type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME });
		expect(service.serviceId).toBe(DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID);
		expect(service.getState()).toBe('stopped');
	});

	it('connects, gates the version and reports the NVR', async () => {
		const client = fakeClient();

		queue(client);
		await service.start();
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: 'connected',
			enabled: true,
			configured: true,
			healthy: true,
			host: 'protect.example.com',
			tlsMode: 'verify',
			applicationVersion: '7.3.74',
			minimumVersion: '7.2.105',
			nvrId: 'nvr-1',
			nvrName: 'Console',
			lastConnectedAt: '2026-11-14T10:00:00.000Z',
			lastErrorCategory: null,
			lastError: null,
			reconnectAttempt: 0,
			nextRetryAt: null,
		});
		expect(service.getClient()).toBe(client);
		await expect(service.isHealthy()).resolves.toBe(true);
		expect(factory.create).toHaveBeenCalledWith({
			host: 'protect.example.com',
			port: 443,
			apiKey: 'key-1',
			tls: { mode: 'verify', serverName: null, fingerprintSha256: null },
		});
		expect(logged.some((line) => line.includes('UniFi Protect connected (Protect 7.3.74)'))).toBe(true);
	});

	it('passes the pinned TLS settings to the client', async () => {
		const fingerprint = 'ab'.repeat(32);

		config = makeConfig({ host: '10.0.0.2' }, { mode: 'pinned', fingerprintSha256: fingerprint });
		await service.start();
		await service.settle();

		expect(factory.create).toHaveBeenCalledWith(
			expect.objectContaining({ tls: { mode: 'pinned', serverName: null, fingerprintSha256: fingerprint } }),
		);
		expect(service.getStatus().tlsMode).toBe('pinned');
	});

	it('reports connecting while the first attempt is in flight', async () => {
		const meta = deferred<{ applicationVersion: string }>();
		const client = fakeClient();

		client.getMetaInfo.mockReturnValue(meta.promise);
		queue(client);
		await service.start();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: 'connecting',
			healthy: false,
		});
		expect(service.getClient()).toBeNull();

		meta.resolve({ applicationVersion: '7.3.74' });
		await service.settle();

		expect(service.getStatus().connectionState).toBe('connected');
	});

	it('reports version_unsupported for 7.2.104 and schedules nothing', async () => {
		const client = fakeClient('7.2.104');

		queue(client);
		await service.start();
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			connectionState: ProtectConnectionState.VERSION_UNSUPPORTED,
			healthy: false,
			applicationVersion: '7.2.104',
			lastErrorCategory: 'version_unsupported',
			lastError: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.VERSION_UNSUPPORTED],
		});
		expect(jest.getTimerCount()).toBe(0);
		expect(service.getClient()).toBeNull();
		expect(client.close).toHaveBeenCalled();
		expect(client.getNvr).not.toHaveBeenCalled();
	});

	it('treats an unparsable version as unsupported', async () => {
		queue(fakeClient('not-a-version'));
		await service.start();
		await service.settle();

		expect(service.getStatus().connectionState).toBe('version_unsupported');
		expect(jest.getTimerCount()).toBe(0);
	});

	it.each([
		[ProtectErrorCategory.AUTHENTICATION, 'auth_failed'],
		[ProtectErrorCategory.AUTHORIZATION, 'auth_failed'],
		[ProtectErrorCategory.TLS_UNTRUSTED, 'error'],
		[ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'error'],
		[ProtectErrorCategory.VALIDATION, 'error'],
		[ProtectErrorCategory.NOT_FOUND, 'error'],
		[ProtectErrorCategory.BAD_REQUEST, 'error'],
		[ProtectErrorCategory.UNSUPPORTED, 'error'],
		[ProtectErrorCategory.CANCELLED, 'error'],
	])('stops retrying after %s', async (category, state) => {
		const client = fakeClient(apiError(category));

		queue(client);
		await expect(service.start()).resolves.toBeUndefined();
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: state,
			healthy: false,
			lastErrorCategory: category,
			lastError: PROTECT_ERROR_MESSAGES[category],
			nextRetryAt: null,
		});
		expect(jest.getTimerCount()).toBe(0);
		expect(client.close).toHaveBeenCalled();
		expect(service.getClient()).toBeNull();
		expect(logged.some((line) => line.includes(`UniFi Protect connection stopped (${category})`))).toBe(true);

		await jest.advanceTimersByTimeAsync(120_000);

		expect(factory.create).toHaveBeenCalledTimes(1);
	});

	it.each([
		ProtectErrorCategory.UNREACHABLE,
		ProtectErrorCategory.TIMEOUT,
		ProtectErrorCategory.UNAVAILABLE,
		ProtectErrorCategory.RATE_LIMITED,
		ProtectErrorCategory.PROTOCOL,
	])('keeps reconnecting after the retryable category %s', async (category) => {
		queue(fakeClient(apiError(category)));
		await service.start();
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			connectionState: 'disconnected',
			lastErrorCategory: category,
			lastError: PROTECT_ERROR_MESSAGES[category],
			reconnectAttempt: 1,
			nextRetryAt: '2026-11-14T10:00:01.000Z',
		});
		expect(jest.getTimerCount()).toBe(1);
		expect(
			logged.some((line) => line.includes(`UniFi Protect connection failed (${category}); retry in 1000 ms`)),
		).toBe(true);
	});

	it('retries an unreachable console with growing delays and recovers', async () => {
		queue(
			fakeClient(apiError(ProtectErrorCategory.UNREACHABLE)),
			fakeClient(apiError(ProtectErrorCategory.UNREACHABLE)),
			fakeClient(),
		);
		await service.start();
		await service.settle();

		expect(factory.create).toHaveBeenCalledTimes(1);
		expect(service.getStatus().reconnectAttempt).toBe(1);

		await jest.advanceTimersByTimeAsync(999);

		expect(factory.create).toHaveBeenCalledTimes(1);

		await jest.advanceTimersByTimeAsync(1);
		await service.settle();

		expect(factory.create).toHaveBeenCalledTimes(2);
		expect(service.getStatus()).toMatchObject({ connectionState: 'disconnected', reconnectAttempt: 2 });
		expect(
			logged.some((line) => line.includes('UniFi Protect connection failed (unreachable); retry in 2000 ms')),
		).toBe(true);

		await jest.advanceTimersByTimeAsync(1999);

		expect(factory.create).toHaveBeenCalledTimes(2);

		await jest.advanceTimersByTimeAsync(1);
		await service.settle();

		expect(factory.create).toHaveBeenCalledTimes(3);
		expect(service.getStatus()).toMatchObject({
			connectionState: 'connected',
			reconnectAttempt: 0,
			nextRetryAt: null,
			lastErrorCategory: null,
			lastError: null,
		});
	});

	it('shows connecting while a reconnect attempt runs', async () => {
		const meta = deferred<{ applicationVersion: string }>();
		const second = fakeClient();

		second.getMetaInfo.mockReturnValue(meta.promise);
		queue(fakeClient(apiError(ProtectErrorCategory.TIMEOUT)), second);
		await service.start();
		await service.settle();
		await jest.advanceTimersByTimeAsync(1000);

		expect(service.getStatus()).toMatchObject({ connectionState: 'connecting', nextRetryAt: null });

		meta.resolve({ applicationVersion: '7.3.74' });
		await service.settle();

		expect(service.getStatus().connectionState).toBe('connected');
	});

	it('doubles the delay and caps it at 60 s', async () => {
		queue(...Array.from({ length: 8 }, () => fakeClient(apiError(ProtectErrorCategory.UNREACHABLE))));
		await service.start();
		await service.settle();

		for (let attempt = 0; attempt < 7; attempt++) {
			await jest.advanceTimersToNextTimerAsync();
			await service.settle();
		}

		const delays = logged.map((line) => /retry in (\d+) ms/.exec(line)?.[1]).filter((delay) => delay !== undefined);

		expect(delays.map(Number)).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]);
		expect(service.getStatus().reconnectAttempt).toBe(8);
	});

	it.each(Object.values(ProtectErrorCategory))(
		'never throws from start for the console outcome %s and keeps the service started',
		async (category) => {
			queue(fakeClient(apiError(category)));

			await expect(service.start()).resolves.toBeUndefined();
			await service.settle();

			expect(service.getState()).toBe('started');
			expect(service.getStatus().lastErrorCategory).toBe(category);
			expect(service.getStatus().lastError).toBe(PROTECT_ERROR_MESSAGES[category]);
		},
	);

	it('maps a non-Protect error to an unavailable retry', async () => {
		queue(fakeClient(new Error('socket exploded')));
		await service.start();
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			connectionState: 'disconnected',
			lastErrorCategory: 'unavailable',
			lastError: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.UNAVAILABLE],
		});
		expect(jest.getTimerCount()).toBe(1);
	});

	it('survives a client factory that throws', async () => {
		factory.create.mockImplementationOnce(() => {
			throw apiError(ProtectErrorCategory.VALIDATION);
		});

		await expect(service.start()).resolves.toBeUndefined();
		await service.settle();

		expect(service.getStatus()).toMatchObject({ connectionState: 'error', lastErrorCategory: 'validation' });
		expect(service.getState()).toBe('started');
	});

	it('does not start for a config that is not ready and reports the fixed readiness text', async () => {
		config = makeConfig({ host: '10.0.0.2' });

		await service.start();
		await service.settle();

		expect(factory.create).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
		expect(service.getStatus()).toMatchObject({
			connectionState: 'disconnected',
			enabled: true,
			configured: true,
			healthy: false,
			lastErrorCategory: 'validation',
			lastError: 'TLS server name is required when the host is an IP address',
		});
	});

	it('reports the readiness text even when the manager never started the service', () => {
		config = makeConfig({ host: null });

		expect(service.getStatus()).toMatchObject({
			serviceState: 'stopped',
			connectionState: 'disconnected',
			configured: false,
			lastErrorCategory: 'validation',
			lastError: 'UniFi Protect host is required',
		});
	});

	it('reports nothing for a disabled, unconfigured plugin', () => {
		config = makeConfig({ enabled: false, host: null, apiKey: null });

		expect(service.getStatus()).toMatchObject({
			enabled: false,
			configured: false,
			host: null,
			lastErrorCategory: null,
			lastError: null,
		});
	});

	it('keeps the service started with a validation error when the saved config cannot be read', async () => {
		configService.getPluginConfig.mockImplementation(() => {
			throw new Error(`corrupted ${SENTINEL_KEY}`);
		});

		await expect(service.start()).resolves.toBeUndefined();
		await service.settle();

		expect(factory.create).not.toHaveBeenCalled();
		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: 'error',
			enabled: false,
			configured: false,
			host: null,
			tlsMode: 'verify',
			lastErrorCategory: 'validation',
		});
		expect(JSON.stringify([service.getStatus(), logged])).not.toContain(SENTINEL_KEY);
	});

	it('does not start a second time while started', async () => {
		await service.start();
		await service.settle();
		await service.start();
		await service.settle();

		expect(factory.create).toHaveBeenCalledTimes(1);
	});

	it('discards a superseded attempt and closes its client', async () => {
		const firstMeta = deferred<{ applicationVersion: string }>();
		const first = fakeClient();
		const second = fakeClient();

		first.getMetaInfo.mockReturnValue(firstMeta.promise);
		queue(first, second);

		await service.start();
		await service.stop();

		config = makeConfig({ apiKey: 'new' });

		await service.start();
		await service.settle();

		firstMeta.resolve({ applicationVersion: '7.3.74' });
		await service.settle();
		await Promise.resolve();

		expect(first.close).toHaveBeenCalled();
		expect(first.getNvr).not.toHaveBeenCalled();
		expect(factory.create).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'new' }));
		expect(service.getClient()).toBe(second);
		expect(second.close).not.toHaveBeenCalled();
		expect(service.getStatus().connectionState).toBe('connected');
	});

	it('discards a late failure from a superseded attempt without scheduling a retry', async () => {
		const first = fakeClient();
		const late = deferred<{ applicationVersion: string }>();

		first.getMetaInfo.mockReturnValue(late.promise);
		queue(first, fakeClient());

		await service.start();
		await service.stop();
		await service.start();
		await service.settle();

		const timersBefore = jest.getTimerCount();

		late.reject(apiError(ProtectErrorCategory.UNREACHABLE));
		await service.settle();
		await Promise.resolve();

		expect(first.close).toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(timersBefore);
		expect(service.getStatus()).toMatchObject({
			connectionState: 'connected',
			lastErrorCategory: null,
			reconnectAttempt: 0,
		});
	});

	it('discards the result of an attempt that finishes after stop', async () => {
		const meta = deferred<{ applicationVersion: string }>();
		const client = fakeClient();

		client.getMetaInfo.mockReturnValue(meta.promise);
		queue(client);
		await service.start();
		await service.stop();

		meta.resolve({ applicationVersion: '7.3.74' });
		await service.settle();
		await Promise.resolve();

		expect(client.close).toHaveBeenCalled();
		expect(service.getClient()).toBeNull();
		expect(service.getStatus()).toMatchObject({ serviceState: 'stopped', connectionState: 'disconnected' });
		expect(jest.getTimerCount()).toBe(0);
	});

	it('re-gates the version on the 60 s health check', async () => {
		const client = fakeClient();

		queue(client);
		await service.start();
		await service.settle();

		expect(jest.getTimerCount()).toBe(1);

		client.getMetaInfo.mockResolvedValue({ applicationVersion: '7.2.0' });
		await jest.advanceTimersByTimeAsync(59_999);

		expect(client.getMetaInfo).toHaveBeenCalledTimes(1);

		await jest.advanceTimersByTimeAsync(1);
		await service.settle();

		expect(client.getMetaInfo).toHaveBeenCalledTimes(2);
		expect(service.getStatus()).toMatchObject({
			connectionState: 'version_unsupported',
			healthy: false,
			applicationVersion: '7.2.0',
			lastErrorCategory: 'version_unsupported',
		});
		expect(client.close).toHaveBeenCalled();
		expect(service.getClient()).toBeNull();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('keeps checking every 60 s while the console stays supported', async () => {
		const client = fakeClient();

		queue(client);
		await service.start();
		await service.settle();
		await jest.advanceTimersByTimeAsync(60_000);
		await service.settle();
		await jest.advanceTimersByTimeAsync(60_000);
		await service.settle();

		expect(client.getMetaInfo).toHaveBeenCalledTimes(3);
		expect(service.getStatus().connectionState).toBe('connected');
		expect(service.getClient()).toBe(client);
		expect(jest.getTimerCount()).toBe(1);
	});

	it('moves to disconnected and reconnects when the health check fails retryably', async () => {
		const first = fakeClient();
		const second = fakeClient();

		queue(first, second);
		await service.start();
		await service.settle();

		first.getMetaInfo.mockRejectedValue(apiError(ProtectErrorCategory.UNREACHABLE));
		await jest.advanceTimersByTimeAsync(60_000);
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			connectionState: 'disconnected',
			healthy: false,
			lastErrorCategory: 'unreachable',
			reconnectAttempt: 1,
		});
		expect(first.close).toHaveBeenCalled();
		expect(service.getClient()).toBeNull();

		await jest.advanceTimersByTimeAsync(1000);
		await service.settle();

		expect(factory.create).toHaveBeenCalledTimes(2);
		expect(service.getStatus()).toMatchObject({ connectionState: 'connected', reconnectAttempt: 0 });
		expect(service.getClient()).toBe(second);
	});

	it('moves to error without a backoff loop when the health check fails permanently', async () => {
		const client = fakeClient();

		queue(client);
		await service.start();
		await service.settle();

		client.getMetaInfo.mockRejectedValue(apiError(ProtectErrorCategory.BAD_REQUEST));
		await jest.advanceTimersByTimeAsync(60_000);
		await service.settle();

		expect(service.getStatus()).toMatchObject({
			connectionState: 'error',
			lastErrorCategory: 'bad_request',
			nextRetryAt: null,
		});
		expect(client.close).toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);

		await jest.advanceTimersByTimeAsync(300_000);

		expect(factory.create).toHaveBeenCalledTimes(1);
	});

	it('moves to auth_failed when the health check is refused', async () => {
		const client = fakeClient();

		queue(client);
		await service.start();
		await service.settle();

		client.getMetaInfo.mockRejectedValue(apiError(ProtectErrorCategory.AUTHENTICATION));
		await jest.advanceTimersByTimeAsync(60_000);
		await service.settle();

		expect(service.getStatus().connectionState).toBe('auth_failed');
		expect(jest.getTimerCount()).toBe(0);
	});

	it('ignores a health check that finishes after stop', async () => {
		const client = fakeClient();
		const meta = deferred<{ applicationVersion: string }>();

		queue(client);
		await service.start();
		await service.settle();

		client.getMetaInfo.mockReturnValue(meta.promise);
		await jest.advanceTimersByTimeAsync(60_000);
		await service.stop();

		meta.resolve({ applicationVersion: '7.2.0' });
		await service.settle();
		await Promise.resolve();

		expect(service.getStatus()).toMatchObject({ serviceState: 'stopped', connectionState: 'disconnected' });
		expect(jest.getTimerCount()).toBe(0);
	});

	describe('onConfigChanged', () => {
		it.each([
			['host', { host: 'other.example.com' }, {}, true],
			['port', { port: 8443 }, {}, true],
			['apiKey', { apiKey: 'rotated' }, {}, true],
			['tls.mode', {}, { mode: 'pinned' as const }, true],
			['tls.serverName', {}, { serverName: 'abc.id.ui.direct' }, true],
			['tls.fingerprintSha256', {}, { fingerprintSha256: 'cd'.repeat(32) }, true],
			['snapshotMinIntervalMs', { snapshotMinIntervalMs: 5000 }, {}, false],
			['pollIntervalMs', { pollIntervalMs: 60000 }, {}, false],
			['defaultStreamQuality', { defaultStreamQuality: 'low' as const }, {}, false],
			['streamHostOverride', { streamHostOverride: 'cams.example.com' }, {}, false],
		])('for %s requires restart: %s', async (_field, overrides, tls, expected) => {
			await service.start();
			await service.settle();

			config = makeConfig(overrides, tls);

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: expected });
		});

		it('requires no restart when the service is not started', async () => {
			config = makeConfig({ host: 'other.example.com' });

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: false });
		});

		it('requires a restart when the saved config became unreadable', async () => {
			await service.start();
			await service.settle();
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('corrupted');
			});

			await expect(service.onConfigChanged()).resolves.toEqual({ restartRequired: true });
		});
	});

	it('stop closes the client and clears every timer', async () => {
		const client = fakeClient();

		queue(client);
		await service.start();
		await service.settle();

		expect(jest.getTimerCount()).toBe(1);

		await service.stop();

		expect(client.close).toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
		expect(service.getClient()).toBeNull();
		expect(service.getState()).toBe('stopped');
		expect(service.getStatus()).toMatchObject({
			serviceState: 'stopped',
			connectionState: 'disconnected',
			healthy: false,
			applicationVersion: null,
			nvrId: null,
			lastConnectedAt: null,
		});
		await expect(service.isHealthy()).resolves.toBe(false);
	});

	it('stop clears a pending reconnect timer', async () => {
		queue(fakeClient(apiError(ProtectErrorCategory.UNREACHABLE)));
		await service.start();
		await service.settle();

		expect(jest.getTimerCount()).toBe(1);

		await service.stop();
		await jest.advanceTimersByTimeAsync(120_000);

		expect(jest.getTimerCount()).toBe(0);
		expect(factory.create).toHaveBeenCalledTimes(1);
		expect(service.getStatus()).toMatchObject({ reconnectAttempt: 0, nextRetryAt: null, lastError: null });
	});

	it('stop closes the client of an attempt that is still running', async () => {
		const client = fakeClient();

		client.getMetaInfo.mockReturnValue(new Promise(() => undefined));
		queue(client);
		await service.start();
		await service.stop();

		expect(client.close).toHaveBeenCalled();
	});

	it('unrefs its timers so they never keep the process alive', async () => {
		const unref = jest.fn();
		const realSetTimeout = global.setTimeout;
		const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((...args: Parameters<typeof setTimeout>) => {
			const timer = realSetTimeout(...args);

			jest.spyOn(timer, 'unref').mockImplementation(() => {
				unref();

				return timer;
			});

			return timer;
		}) as typeof setTimeout);

		await service.start();
		await service.settle();

		expect(spy).toHaveBeenCalled();
		expect(unref).toHaveBeenCalled();
	});

	it('keeps the key out of status and logs', async () => {
		config = makeConfig({ apiKey: SENTINEL_KEY });
		queue(fakeClient(new Error(`boom ${SENTINEL_KEY}`)));

		await service.start();
		await service.settle();

		const afterFirstFailure = service.getStatus();

		expect(afterFirstFailure.lastError).toBe(PROTECT_ERROR_MESSAGES[ProtectErrorCategory.UNAVAILABLE]);

		await jest.advanceTimersByTimeAsync(1000);
		await service.settle();

		const afterReconnect = service.getStatus();

		await service.stop();

		expect(logged.length).toBeGreaterThan(0);
		expect(afterReconnect.connectionState).toBe('connected');
		expect(JSON.stringify([afterFirstFailure, afterReconnect, service.getStatus(), logged])).not.toContain(
			'PROTECT_SENTINEL_KEY',
		);
		expect(Object.keys(afterReconnect)).not.toContain('apiKey');
		expect(Object.keys(afterReconnect)).not.toContain('warnings');
	});
});
