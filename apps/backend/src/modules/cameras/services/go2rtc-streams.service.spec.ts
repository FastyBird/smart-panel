import { Logger } from '@nestjs/common';

import { FAKE_CAMERA_SECRET_URL, FakeCameraStreamProvider } from '../../../../test/support/fake-camera-stream.provider';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import {
	CameraOfflineException,
	CameraUpstreamException,
	CamerasNotFoundException,
	Go2rtcApiError,
	Go2rtcUnavailableException,
} from '../cameras.exceptions';

import { CamerasService } from './cameras.service';
import { Go2rtcApiClient } from './go2rtc-api.client';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';
import { Go2rtcStreamsService } from './go2rtc-streams.service';
import { Go2rtcRelayStatus } from './go2rtc.service';

const SENT_URL = FAKE_CAMERA_SECRET_URL.replace(/^rtsps/, 'rtspx');

describe('Go2rtcStreamsService', () => {
	const camera = { id: 'cam-1', category: 'camera', type: 'devices-fake' } as unknown as DeviceEntity;
	const installationId = 'abcd1234';
	const name = `smart-panel_${installationId}_${camera.id}_medium`;
	const foreignName = 'smart-panel_zzzz9999_cam-9_medium';

	let streams: Go2rtcStreamsService;
	let secrets: Go2rtcSecretsRegistry;
	let provider: FakeCameraStreamProvider;
	let client: {
		authorization: string | null;
		baseUrl: string;
		putStream: jest.Mock;
		deleteStream: jest.Mock;
		listStreamNames: jest.Mock;
		wsUrl: jest.Mock;
	};
	let status: Go2rtcRelayStatus;
	let relayClient: unknown;
	let listeners: Set<(status: Go2rtcRelayStatus) => void>;
	let unsubscribe: jest.Mock;
	let endedListeners: Set<(generation: number) => void>;
	let logSpies: jest.SpyInstance[];

	const flush = (): Promise<void> => jest.advanceTimersByTimeAsync(0);

	const fire = (patch: Partial<Go2rtcRelayStatus>): void => {
		status = { ...status, ...patch };

		if (status.state !== 'running') {
			relayClient = null;
		} else {
			relayClient = client;
		}

		for (const listener of [...listeners]) {
			listener({ ...status });
		}
	};

	/** The managed process of `generation` was confirmed gone (`Go2rtcService.onManagedRunEnded`). */
	const fireRunEnded = (generation: number): void => {
		for (const listener of [...endedListeners]) {
			listener(generation);
		}
	};

	const loggedCalls = (): string => JSON.stringify(logSpies.map((spy) => spy.mock.calls as unknown[][]));

	beforeEach(async () => {
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

		logSpies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(() => undefined),
		);

		client = {
			authorization: 'Basic c2VjcmV0',
			baseUrl: 'http://127.0.0.1:11984',
			putStream: jest.fn().mockResolvedValue(undefined),
			deleteStream: jest.fn().mockResolvedValue(undefined),
			listStreamNames: jest.fn().mockResolvedValue([]),
			wsUrl: jest.fn((n: string) => `ws://127.0.0.1:11984/api/ws?src=${n}`),
		};
		status = { mode: 'managed', state: 'running', reason: null, version: '1.9.9', generation: 1 };
		relayClient = client;
		listeners = new Set();
		unsubscribe = jest.fn();
		endedListeners = new Set();

		const go2rtc = {
			getClient: jest.fn(() => relayClient as Go2rtcApiClient | null),
			getStatus: jest.fn(() => ({ ...status })),
			getInstallationId: jest.fn(() => installationId),
			subscribe: jest.fn((listener: (s: Go2rtcRelayStatus) => void) => {
				listeners.add(listener);

				return () => {
					unsubscribe();
					listeners.delete(listener);
				};
			}),
			onManagedRunEnded: jest.fn((listener: (generation: number) => void) => {
				endedListeners.add(listener);

				return () => {
					endedListeners.delete(listener);
				};
			}),
		};

		provider = new FakeCameraStreamProvider('devices-fake');
		secrets = new Go2rtcSecretsRegistry();

		const cameras = new CamerasService(
			{ findAll: jest.fn(), findOne: jest.fn() } as never,
			{ get: jest.fn() } as never,
		);

		streams = new Go2rtcStreamsService(go2rtc as never, cameras, secrets);
		streams.onModuleInit();
		await flush();
	});

	afterEach(() => {
		void streams.onModuleDestroy();
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it('registers one go2rtc stream for two viewers of the same profile', async () => {
		const resolveSpy = jest.spyOn(provider, 'resolveSource');

		const [a, b] = await Promise.all([
			streams.acquire(camera, provider, 'medium'),
			streams.acquire(camera, provider, 'medium'),
		]);

		expect(client.putStream).toHaveBeenCalledTimes(1);
		expect(client.putStream).toHaveBeenCalledWith(name, 'rtspx://fake-console:7441/SENTINELALIAS0123456789?enableSrtp');
		expect(resolveSpy).toHaveBeenCalledTimes(1);
		expect(a.streamName).toBe(b.streamName);
		expect(a.streamName).toBe(name);
		expect(a.wsUrl).toBe(`ws://127.0.0.1:11984/api/ws?src=${name}`);
		expect(a.authorization).toBe('Basic c2VjcmV0');
	});

	it('logs registration and removal by stream name only', async () => {
		const lease = await streams.acquire(camera, provider, 'medium');

		expect(logSpies[0]).toHaveBeenCalledWith(
			expect.stringContaining(`go2rtc stream registered name=${name}`),
			expect.anything(),
		);

		lease.release();
		await jest.advanceTimersByTimeAsync(30_000);

		expect(logSpies[0]).toHaveBeenCalledWith(
			expect.stringContaining(`go2rtc stream removed name=${name}`),
			expect.anything(),
		);
	});

	it('removes the stream 30 s after the last viewer leaves', async () => {
		const lease = await streams.acquire(camera, provider, 'medium');

		lease.release();
		await jest.advanceTimersByTimeAsync(29_999);
		expect(client.deleteStream).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(1);
		expect(client.deleteStream).toHaveBeenCalledWith(name);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);
	});

	it('keeps the stream while another viewer is still watching', async () => {
		const a = await streams.acquire(camera, provider, 'medium');
		const b = await streams.acquire(camera, provider, 'medium');

		a.release();
		await jest.advanceTimersByTimeAsync(60_000);
		expect(client.deleteStream).not.toHaveBeenCalled();

		b.release();
		await jest.advanceTimersByTimeAsync(30_000);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);
	});

	it('reuses the stream, without a new PUT, when a viewer returns inside the grace period', async () => {
		const first = await streams.acquire(camera, provider, 'medium');

		first.release();
		await jest.advanceTimersByTimeAsync(20_000);

		const second = await streams.acquire(camera, provider, 'medium');

		expect(client.putStream).toHaveBeenCalledTimes(1);

		await jest.advanceTimersByTimeAsync(60_000);
		expect(client.deleteStream).not.toHaveBeenCalled();

		second.release();
		await jest.advanceTimersByTimeAsync(30_000);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);
	});

	it('survives twenty reload cycles with one PUT and no DELETE', async () => {
		for (let i = 0; i < 20; i++) {
			const lease = await streams.acquire(camera, provider, 'medium');

			lease.release();
			lease.release();

			await jest.advanceTimersByTimeAsync(1_000);
		}

		expect(client.putStream).toHaveBeenCalledTimes(1);
		expect(client.deleteStream).not.toHaveBeenCalled();
	});

	it('does not release a lease twice: the second viewer keeps the stream alive', async () => {
		const a = await streams.acquire(camera, provider, 'medium');
		const b = await streams.acquire(camera, provider, 'medium');

		a.release();
		a.release();
		a.release();

		await jest.advanceTimersByTimeAsync(60_000);
		expect(client.deleteStream).not.toHaveBeenCalled();

		b.release();
		await jest.advanceTimersByTimeAsync(30_000);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);
	});

	it('keeps separate entries for different profiles of the same camera', async () => {
		await streams.acquire(camera, provider, 'medium');
		await streams.acquire(camera, provider, 'low');

		expect(client.putStream).toHaveBeenCalledTimes(2);
		expect(client.putStream.mock.calls.map((call: string[]) => call[0]).sort()).toEqual([
			`smart-panel_${installationId}_${camera.id}_low`,
			name,
		]);
	});

	it('rejects every joiner and keeps no entry when PUT fails', async () => {
		client.putStream.mockRejectedValueOnce(new Go2rtcApiError(500));

		const results = await Promise.all([
			streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
			streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
		]);

		for (const result of results) {
			expect(result).toBeInstanceOf(CameraUpstreamException);
			expect((result as Error).message).toBe('Live stream could not be started');
		}

		expect(secrets.list()).toEqual([]);

		await expect(streams.acquire(camera, provider, 'medium')).resolves.toMatchObject({ streamName: name });
		expect(client.putStream).toHaveBeenCalledTimes(2);
	});

	it('sends no compensating DELETE when the PUT was answered with an HTTP error', async () => {
		client.putStream.mockRejectedValueOnce(new Go2rtcApiError(500));

		await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(CameraUpstreamException);
		await flush();

		expect(client.deleteStream).not.toHaveBeenCalled();
		expect(secrets.list()).toEqual([]);
	});

	describe('a PUT that fails without an HTTP status', () => {
		it('queues a compensating DELETE, keeps the source redactable until it is confirmed, then releases it', async () => {
			let confirmDelete!: () => void;

			client.putStream.mockRejectedValueOnce(new Go2rtcApiError(null));
			client.deleteStream.mockReturnValueOnce(
				new Promise<void>((resolve) => {
					confirmDelete = resolve;
				}),
			);

			await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(CameraUpstreamException);
			await flush();

			expect(client.deleteStream).toHaveBeenCalledWith(name);
			expect(secrets.list()).toContain(SENT_URL);

			confirmDelete();
			await flush();

			expect(secrets.list()).toEqual([]);
		});

		it('keeps the source retained when the compensating DELETE fails, until a later DELETE succeeds', async () => {
			client.putStream.mockRejectedValueOnce(new Go2rtcApiError(null));
			client.deleteStream.mockRejectedValueOnce(new Go2rtcApiError(null));

			await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(CameraUpstreamException);
			await flush();

			expect(client.deleteStream).toHaveBeenCalledTimes(1);
			expect(secrets.list()).toContain(SENT_URL);

			const lease = await streams.acquire(camera, provider, 'medium');

			expect(secrets.list()).toContain(SENT_URL);

			lease.release();
			await jest.advanceTimersByTimeAsync(30_000);

			expect(client.deleteStream).toHaveBeenCalledTimes(2);
			expect(secrets.list()).toEqual([]);
		});

		it('runs the compensating DELETE in the name queue, before the next registration of that name', async () => {
			const order: string[] = [];

			client.putStream.mockImplementation(() => {
				order.push('PUT');

				return order.length === 1 ? Promise.reject(new Go2rtcApiError(null)) : Promise.resolve();
			});
			client.deleteStream.mockImplementation(() => {
				order.push('DELETE');

				return Promise.resolve();
			});

			await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(CameraUpstreamException);
			await expect(streams.acquire(camera, provider, 'medium')).resolves.toMatchObject({ streamName: name });

			expect(order).toEqual(['PUT', 'DELETE', 'PUT']);
		});

		it('waits for the compensating DELETE on module destroy', async () => {
			client.putStream.mockRejectedValueOnce(new Go2rtcApiError(null));
			client.deleteStream.mockRejectedValueOnce(new Go2rtcApiError(null));

			await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(CameraUpstreamException);
			await streams.onModuleDestroy();

			expect(secrets.list()).toEqual([]);
		});
	});

	it('rejects every joiner and keeps no entry when the provider fails', async () => {
		jest.spyOn(provider, 'resolveSource').mockRejectedValueOnce(new CameraOfflineException('offline'));

		const results = await Promise.all([
			streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
			streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
		]);

		for (const result of results) {
			expect(result).toBeInstanceOf(CameraOfflineException);
		}

		expect(client.putStream).not.toHaveBeenCalled();
		expect(secrets.list()).toEqual([]);

		await expect(streams.acquire(camera, provider, 'medium')).resolves.toMatchObject({ streamName: name });
		expect(client.putStream).toHaveBeenCalledTimes(1);
	});

	it('drops the table when the relay generation changes, without a DELETE in managed mode', async () => {
		const lease = await streams.acquire(camera, provider, 'medium');

		fire({ generation: 2 });
		await flush();

		expect(client.deleteStream).not.toHaveBeenCalled();
		// The process of generation 1 is not confirmed gone: it may still print the source.
		expect(secrets.list()).toContain(SENT_URL);

		fireRunEnded(1);

		expect(secrets.list()).toEqual([]);

		await streams.acquire(camera, provider, 'medium');
		expect(client.putStream).toHaveBeenCalledTimes(2);

		lease.release();
		await jest.advanceTimersByTimeAsync(60_000);

		// The old lease must neither delete the new registration nor drop its count.
		expect(client.deleteStream).not.toHaveBeenCalled();
	});

	it('drops the table when the relay leaves the running state', async () => {
		await streams.acquire(camera, provider, 'medium');

		fire({ state: 'unavailable', reason: 'crashed' });
		await flush();

		expect(client.deleteStream).not.toHaveBeenCalled();
		expect(secrets.list()).toContain(SENT_URL);

		fireRunEnded(1);

		expect(secrets.list()).toEqual([]);

		await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(Go2rtcUnavailableException);
	});

	describe('an external relay that stops being usable', () => {
		const unreachable = { state: 'unavailable', reason: 'external_unreachable' } as const;

		beforeEach(async () => {
			fire({ mode: 'external', state: 'running', generation: 2 });
			await flush();
			client.listStreamNames.mockClear();
		});

		it('deletes every stream through the remembered client when the relay is disabled, though getClient() is null', async () => {
			await streams.acquire(camera, provider, 'medium');
			await streams.acquire(camera, provider, 'low');
			client.deleteStream.mockClear();

			fire({ state: 'disabled', reason: 'module_disabled' });
			await flush();

			expect(relayClient).toBeNull();
			expect(client.deleteStream.mock.calls.map((call: string[]) => call[0]).sort()).toEqual(
				[name, `smart-panel_${installationId}_${camera.id}_low`].sort(),
			);
			expect(secrets.list()).toEqual([]);
		});

		it('keeps the source redactable until the DELETE has settled', async () => {
			let finishDelete!: () => void;

			await streams.acquire(camera, provider, 'medium');
			client.deleteStream.mockReturnValue(
				new Promise<void>((resolve) => {
					finishDelete = resolve;
				}),
			);

			fire({ state: 'disabled', reason: 'module_disabled' });
			await flush();

			expect(client.deleteStream).toHaveBeenCalledWith(name);
			expect(secrets.list()).toContain(SENT_URL);

			finishDelete();
			await flush();

			expect(secrets.list()).toEqual([]);
		});

		it('deletes the streams when the mode changes to managed', async () => {
			await streams.acquire(camera, provider, 'medium');
			client.deleteStream.mockClear();

			fire({ mode: 'managed', state: 'starting', reason: null, generation: 3 });
			await flush();

			expect(client.deleteStream.mock.calls).toEqual([[name]]);
			expect(secrets.list()).toEqual([]);
		});

		it('deletes the streams when the relay becomes unreachable and sends nothing when none are registered', async () => {
			fire({ ...unreachable });
			await flush();
			expect(client.deleteStream).not.toHaveBeenCalled();

			fire({ state: 'running', reason: null, generation: 4 });
			await flush();
			await streams.acquire(camera, provider, 'medium');
			client.deleteStream.mockClear();

			fire({ ...unreachable });
			await flush();

			expect(client.deleteStream.mock.calls).toEqual([[name]]);
		});

		it('retains the secrets of a stream whose DELETE failed and releases them when the sweep deletes it later', async () => {
			await streams.acquire(camera, provider, 'medium');
			client.deleteStream.mockRejectedValue(new Go2rtcApiError(null));

			fire({ ...unreachable });
			await flush();

			expect(client.deleteStream).toHaveBeenCalledWith(name);
			expect(secrets.list()).toContain(SENT_URL);

			client.deleteStream.mockResolvedValue(undefined);
			client.listStreamNames.mockResolvedValue([name]);

			fire({ state: 'running', reason: null, generation: 4 });
			await flush();

			expect(client.deleteStream).toHaveBeenLastCalledWith(name);
			expect(secrets.list()).toEqual([]);
		});

		it('does not release a managed-generation retention on an external change', async () => {
			await streams.acquire(camera, provider, 'medium');
			client.deleteStream.mockRejectedValue(new Go2rtcApiError(null));

			fire({ ...unreachable });
			await flush();
			fire({ state: 'running', reason: null, generation: 4 });
			await flush();

			expect(secrets.list()).toContain(SENT_URL);
		});
	});

	describe('retained secrets of two external relays', () => {
		const clientFor = (baseUrl: string): typeof client => ({
			...client,
			baseUrl,
			putStream: jest.fn().mockResolvedValue(undefined),
			deleteStream: jest.fn().mockResolvedValue(undefined),
			listStreamNames: jest.fn().mockResolvedValue([]),
		});

		const switchTo = async (target: typeof client, patch: Partial<Go2rtcRelayStatus>): Promise<void> => {
			status = { ...status, ...patch };
			relayClient = status.state === 'running' ? target : null;

			for (const listener of [...listeners]) {
				listener({ ...status });
			}

			await flush();
		};

		it('does not release the secrets retained for relay A when the same stream is deleted on relay B', async () => {
			const relayA = clientFor('http://a.example:1984');
			const relayB = clientFor('http://b.example:1984');

			await switchTo(relayA, { mode: 'external', state: 'running', generation: 2 });

			await streams.acquire(camera, provider, 'medium');

			// Relay A goes away and the stream cannot be deleted there: its source stays redactable.
			relayA.deleteStream.mockRejectedValue(new Go2rtcApiError(null));
			await switchTo(relayA, { state: 'unavailable', reason: 'external_unreachable' });

			expect(relayA.deleteStream).toHaveBeenCalledWith(name);
			expect(secrets.list()).toContain(SENT_URL);

			// The same stream name is registered on relay B and deleted there.
			await switchTo(relayB, { state: 'running', reason: null, generation: 3 });

			const lease = await streams.acquire(camera, provider, 'medium');

			lease.release();
			await jest.advanceTimersByTimeAsync(30_000);

			expect(relayB.deleteStream).toHaveBeenCalledWith(name);
			expect(relayA.deleteStream).toHaveBeenCalledTimes(1);
			// B's own handles are released, A's are not.
			expect(secrets.list()).toContain(SENT_URL);

			// Only a confirmed DELETE on relay A releases them.
			relayA.deleteStream.mockResolvedValue(undefined);
			relayA.listStreamNames.mockResolvedValue([name]);
			await switchTo(relayB, { state: 'unavailable', reason: 'external_unreachable' });
			await switchTo(relayA, { state: 'running', reason: null, generation: 4 });

			expect(relayA.deleteStream).toHaveBeenCalledTimes(2);
			expect(secrets.list()).toEqual([]);
		});
	});

	it('rejects in-flight registrations when the relay stops', async () => {
		let resolveSource!: (value: { url: string; transport: 'rtsps-insecure' }) => void;

		jest.spyOn(provider, 'resolveSource').mockReturnValue(
			new Promise((resolve) => {
				resolveSource = resolve;
			}),
		);

		const pending = [
			streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
			streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
		];

		await flush();

		fire({ state: 'starting', reason: null });
		await flush();

		for (const result of await Promise.all(pending)) {
			expect(result).toBeInstanceOf(Go2rtcUnavailableException);
		}

		// A provider answering late must not register anything.
		resolveSource({ url: FAKE_CAMERA_SECRET_URL, transport: 'rtsps-insecure' });
		await flush();

		expect(client.putStream).not.toHaveBeenCalled();
		expect(secrets.list()).toEqual([]);
	});

	it('deletes the streams of a deleted device at once', async () => {
		const a = await streams.acquire(camera, provider, 'medium');
		const b = await streams.acquire(camera, provider, 'medium');

		streams.removeDevice({ id: camera.id });
		await flush();

		expect(client.deleteStream).toHaveBeenCalledTimes(1);
		expect(client.deleteStream).toHaveBeenCalledWith(name);
		expect(secrets.list()).toEqual([]);

		a.release();
		b.release();
		await jest.advanceTimersByTimeAsync(60_000);

		expect(client.deleteStream).toHaveBeenCalledTimes(1);
	});

	it('leaves the streams of other devices alone when a device is deleted', async () => {
		const other = { id: 'cam-2', category: 'camera', type: 'devices-fake' } as unknown as DeviceEntity;

		await streams.acquire(camera, provider, 'medium');
		await streams.acquire(other, provider, 'medium');

		streams.removeDevice({ id: other.id });
		await flush();

		expect(client.deleteStream.mock.calls).toEqual([[`smart-panel_${installationId}_${other.id}_medium`]]);
	});

	it('lease.release is a no-op after the entry was dropped and the count never goes negative', async () => {
		const stale = await streams.acquire(camera, provider, 'medium');

		fire({ generation: 2 });
		await flush();

		const fresh = await streams.acquire(camera, provider, 'medium');

		stale.release();
		stale.release();

		// The stale lease belongs to the dropped entry: the new entry still holds one viewer.
		await jest.advanceTimersByTimeAsync(60_000);
		expect(client.deleteStream).not.toHaveBeenCalled();

		fresh.release();
		await jest.advanceTimersByTimeAsync(30_000);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);
	});

	it('deletes orphaned smart-panel streams when an external relay comes up', async () => {
		client.listStreamNames.mockResolvedValue([`smart-panel_${installationId}_old_medium`, 'frigate_front']);

		fire({ mode: 'external', state: 'running', generation: 3 });
		await flush();

		expect(client.deleteStream.mock.calls).toEqual([[`smart-panel_${installationId}_old_medium`]]);
	});

	it('never deletes streams of another installation or of a hand-made smart-panel_ name', async () => {
		client.listStreamNames.mockResolvedValue([
			foreignName,
			'smart-panel_old_medium',
			'smart-panel_abcd12345_cam_medium',
			`smart-panel_${installationId}_old_medium`,
		]);

		fire({ mode: 'external', state: 'running', generation: 3 });
		await flush();

		expect(client.deleteStream.mock.calls).toEqual([[`smart-panel_${installationId}_old_medium`]]);
	});

	it('sweeps the streams of dropped entries too when an external relay comes back', async () => {
		fire({ mode: 'external', state: 'running', generation: 2 });
		await flush();

		await streams.acquire(camera, provider, 'medium');

		client.listStreamNames.mockResolvedValue([name, `smart-panel_${installationId}_old_medium`]);

		fire({ state: 'unavailable', reason: 'external_unreachable' });
		await flush();
		client.deleteStream.mockClear();

		fire({ state: 'running', reason: null, generation: 3 });
		await flush();

		expect(client.deleteStream.mock.calls.map((call: string[]) => call[0]).sort()).toEqual(
			[name, `smart-panel_${installationId}_old_medium`].sort(),
		);
	});

	it('does not sweep a stream that a viewer registered while the list was in flight', async () => {
		let finishList!: (names: string[]) => void;

		client.listStreamNames.mockReturnValue(
			new Promise<string[]>((resolve) => {
				finishList = resolve;
			}),
		);

		fire({ mode: 'external', state: 'running', generation: 2 });
		await flush();

		await streams.acquire(camera, provider, 'medium');

		finishList([name, `smart-panel_${installationId}_old_medium`]);
		await flush();

		expect(client.deleteStream.mock.calls).toEqual([[`smart-panel_${installationId}_old_medium`]]);
	});

	it('does not sweep when a managed relay comes up', async () => {
		fire({ state: 'starting' });
		fire({ state: 'running', generation: 2 });
		await flush();

		expect(client.listStreamNames).not.toHaveBeenCalled();
	});

	it('survives a failing orphan sweep', async () => {
		client.listStreamNames.mockRejectedValue(new Go2rtcApiError(500));

		fire({ mode: 'external', state: 'running', generation: 3 });
		await flush();

		expect(client.deleteStream).not.toHaveBeenCalled();
		expect(logSpies[1]).toHaveBeenCalled();
	});

	it('refuses an exec source before it reaches go2rtc', async () => {
		jest.spyOn(provider, 'resolveSource').mockResolvedValue({ url: 'exec:id', transport: 'rtsp' });

		const error = await streams.acquire(camera, provider, 'medium').catch((e: Error) => e);

		expect(error).toBeInstanceOf(CameraUpstreamException);
		expect(client.putStream).not.toHaveBeenCalled();
		expect(secrets.list()).toEqual([]);
	});

	it('throws Go2rtcUnavailableException while the relay is not running', async () => {
		fire({ state: 'unavailable', reason: 'crashed' });

		await expect(streams.acquire(camera, provider, 'medium')).rejects.toBeInstanceOf(Go2rtcUnavailableException);
		expect(client.putStream).not.toHaveBeenCalled();
	});

	it('refuses an invalid profile id without touching the provider or go2rtc', async () => {
		const resolveSpy = jest.spyOn(provider, 'resolveSource');

		await expect(streams.acquire(camera, provider, 'bad id/../x')).rejects.toMatchObject({
			name: 'CameraProfileUnavailableException',
		});
		expect(resolveSpy).not.toHaveBeenCalled();
		expect(client.putStream).not.toHaveBeenCalled();
	});

	it('keeps the source url only while the stream exists and never logs or throws it', async () => {
		const lease = await streams.acquire(camera, provider, 'medium');

		expect(secrets.list()).toContain(SENT_URL);
		expect(secrets.list()).toContain(FAKE_CAMERA_SECRET_URL);
		expect(secrets.list()).toContain('/SENTINELALIAS0123456789');

		lease.release();
		await jest.advanceTimersByTimeAsync(30_000);
		expect(secrets.list()).toEqual([]);

		client.putStream.mockRejectedValue(new Error(FAKE_CAMERA_SECRET_URL));

		const error = await streams.acquire(camera, provider, 'medium').catch((e: Error) => e);

		expect(error).toBeInstanceOf(CameraUpstreamException);
		expect(JSON.stringify([loggedCalls(), (error as Error).message])).not.toContain('SENTINELALIAS');
		expect(secrets.list()).toEqual([]);
	});

	it('does not register a path shorter than 8 characters and never lets the registry throw escape', async () => {
		jest.spyOn(provider, 'resolveSource').mockResolvedValue({ url: 'rtsp://cam.local/live', transport: 'rtsp' });

		await streams.acquire(camera, provider, 'medium');

		expect(secrets.list()).toEqual(['rtsp://cam.local/live']);

		await streams.acquire(camera, provider, 'low');
		jest.spyOn(secrets, 'add').mockImplementation(() => {
			throw new TypeError('Secret is too short to redact');
		});

		const other = { id: 'cam-9', category: 'camera', type: 'devices-fake' } as unknown as DeviceEntity;

		await expect(streams.acquire(other, provider, 'medium')).resolves.toMatchObject({
			streamName: `smart-panel_${installationId}_${other.id}_medium`,
		});
	});

	it('holds one registry handle per registration so that two cameras on one url keep it until both are gone', async () => {
		const other = { id: 'cam-2', category: 'camera', type: 'devices-fake' } as unknown as DeviceEntity;

		const a = await streams.acquire(camera, provider, 'medium');
		const b = await streams.acquire(other, provider, 'medium');

		a.release();
		await jest.advanceTimersByTimeAsync(30_000);

		expect(secrets.list()).toContain(SENT_URL);

		b.release();
		await jest.advanceTimersByTimeAsync(30_000);

		expect(secrets.list()).toEqual([]);
	});

	it('does not start a PUT before a DELETE of the same stream has finished', async () => {
		let finishDelete!: () => void;

		client.deleteStream.mockReturnValue(
			new Promise<void>((resolve) => {
				finishDelete = resolve;
			}),
		);

		const first = await streams.acquire(camera, provider, 'medium');

		first.release();
		await jest.advanceTimersByTimeAsync(30_000);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);

		const second = streams.acquire(camera, provider, 'medium');

		await flush();
		expect(client.putStream).toHaveBeenCalledTimes(1);

		finishDelete();
		await flush();
		await second;

		expect(client.putStream).toHaveBeenCalledTimes(2);
	});

	it('survives a rejected DELETE, keeps the source redactable and logs only the error name', async () => {
		client.deleteStream.mockRejectedValue(new Error(FAKE_CAMERA_SECRET_URL));

		const lease = await streams.acquire(camera, provider, 'medium');

		lease.release();
		await jest.advanceTimersByTimeAsync(30_000);

		expect(secrets.list()).toContain(SENT_URL);
		expect(logSpies[1]).toHaveBeenCalled();
		expect(loggedCalls()).not.toContain('SENTINELALIAS');

		await streams.acquire(camera, provider, 'medium');
		expect(client.putStream).toHaveBeenCalledTimes(2);
	});

	describe('a drop while the PUT is still outstanding', () => {
		let finishPut: Array<() => void>;
		let calls: string[];

		/** The first `count` PUTs stay pending until `finishPut[i]()`; later ones resolve at once. */
		const holdPuts = (count: number): void => {
			finishPut = [];
			calls = [];

			let held = 0;

			client.putStream.mockImplementation((n: string) => {
				calls.push(`put ${n}`);

				if (held++ >= count) {
					return Promise.resolve();
				}

				return new Promise<void>((resolve) => {
					finishPut.push(resolve);
				});
			});
			client.deleteStream.mockImplementation((n: string) => {
				calls.push(`delete ${n}`);

				return Promise.resolve();
			});
		};

		it('does not let the late DELETE of a dropped registration remove the stream of the next one', async () => {
			holdPuts(1);

			const first = streams.acquire(camera, provider, 'medium').catch((e: Error) => e);

			await flush();
			expect(calls).toEqual([`put ${name}`]);

			streams.removeDevice({ id: camera.id });

			const second = streams.acquire(camera, provider, 'medium');

			await flush();

			// The second registration waits for the outstanding PUT of the first one.
			expect(calls).toEqual([`put ${name}`]);

			finishPut[0]();
			await flush();

			expect(await first).toBeInstanceOf(CamerasNotFoundException);
			await expect(second).resolves.toMatchObject({ streamName: name });

			expect(calls[0]).toBe(`put ${name}`);
			expect(calls[calls.length - 1]).toBe(`put ${name}`);
			expect(calls.slice(1, -1).length).toBeGreaterThanOrEqual(1);
			expect(calls.slice(1, -1).every((call) => call === `delete ${name}`)).toBe(true);
		});

		it('sends the compensating DELETE and rejects a joiner that joined mid-PUT when the device is deleted', async () => {
			holdPuts(1);

			const results = [
				streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
				streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
			];

			await flush();

			streams.removeDevice({ id: camera.id });
			await flush();

			for (const result of await Promise.all(results)) {
				expect(result).toBeInstanceOf(CamerasNotFoundException);
				expect((result as Error).message).toBe('Camera not found');
			}

			// The PUT has not returned yet: nothing may be deleted before it, and the secrets are still held.
			expect(calls).toEqual([`put ${name}`]);

			finishPut[0]();
			await flush();

			expect(calls[0]).toBe(`put ${name}`);
			expect(calls.slice(1).length).toBeGreaterThanOrEqual(1);
			expect(calls.slice(1).every((call) => call === `delete ${name}`)).toBe(true);
			expect(secrets.list()).toEqual([]);

			// Nothing is left behind: the next viewer starts over.
			await expect(streams.acquire(camera, provider, 'medium')).resolves.toMatchObject({ streamName: name });
		});

		it('deletes the stream a late PUT created when an external relay reconnects mid-PUT', async () => {
			fire({ mode: 'external', state: 'running', generation: 2 });
			await flush();
			holdPuts(1);

			const pending = [
				streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
				streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
			];

			await flush();

			fire({ state: 'unavailable', reason: 'external_unreachable' });
			await flush();

			for (const result of await Promise.all(pending)) {
				expect(result).toBeInstanceOf(Go2rtcUnavailableException);
			}

			finishPut[0]();
			await flush();

			expect(calls).toContain(`delete ${name}`);
			expect(calls.indexOf(`delete ${name}`)).toBeGreaterThan(calls.indexOf(`put ${name}`));
			expect(secrets.list()).toEqual([]);
		});

		it('sends no compensating DELETE to a relay that is no longer the one that was PUT to', async () => {
			holdPuts(1);

			const pending = streams.acquire(camera, provider, 'medium').catch((e: Error) => e);

			await flush();

			fire({ generation: 2 });
			await flush();

			const successor = { ...client, deleteStream: jest.fn().mockResolvedValue(undefined) };

			relayClient = successor;

			finishPut[0]();
			await flush();

			expect(await pending).toBeInstanceOf(Go2rtcUnavailableException);
			expect(client.deleteStream).not.toHaveBeenCalled();
			expect(successor.deleteStream).not.toHaveBeenCalled();
			expect(secrets.list()).toContain(SENT_URL);

			fireRunEnded(1);

			expect(secrets.list()).toEqual([]);
		});

		it('rejects an in-flight registration on module destroy and deletes what the PUT created', async () => {
			holdPuts(1);

			const pending = [
				streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
				streams.acquire(camera, provider, 'medium').catch((e: Error) => e),
			];

			await flush();

			const destroyed = streams.onModuleDestroy();

			// The DELETE is queued behind the held PUT; destroy gives up on it after 2 s.
			await jest.advanceTimersByTimeAsync(2_000);
			await destroyed;

			for (const result of await Promise.all(pending)) {
				expect(result).toBeInstanceOf(Go2rtcUnavailableException);
			}

			expect(secrets.list()).toEqual([]);

			finishPut[0]();
			await flush();

			expect(calls).toContain(`delete ${name}`);
			expect(calls.indexOf(`delete ${name}`)).toBeGreaterThan(calls.indexOf(`put ${name}`));
		});

		it('does not PUT a registration that was dropped while it waited for an earlier call of its name', async () => {
			holdPuts(1);

			const first = streams.acquire(camera, provider, 'medium').catch((e: Error) => e);

			await flush();
			streams.removeDevice({ id: camera.id });

			const second = streams.acquire(camera, provider, 'medium').catch((e: Error) => e);

			await flush();
			streams.removeDevice({ id: camera.id });
			await flush();

			finishPut[0]();
			await flush();

			expect(await first).toBeInstanceOf(CamerasNotFoundException);
			expect(await second).toBeInstanceOf(CamerasNotFoundException);
			expect(calls.filter((call) => call.startsWith('put'))).toEqual([`put ${name}`]);
		});
	});

	it('unsubscribes and clears the grace timers on module destroy', async () => {
		const lease = await streams.acquire(camera, provider, 'medium');

		lease.release();
		client.deleteStream.mockClear();

		const destroyed = streams.onModuleDestroy();

		await jest.advanceTimersByTimeAsync(0);
		await destroyed;

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(listeners.size).toBe(0);

		// The destroy deleted the stream once; the cancelled grace timer must not delete it again.
		await jest.advanceTimersByTimeAsync(60_000);
		expect(client.deleteStream).toHaveBeenCalledTimes(1);
		expect(secrets.list()).toEqual([]);
	});

	describe('a DELETE that fails', () => {
		it('keeps the source redactable and releases it when a later DELETE of the name succeeds', async () => {
			client.deleteStream.mockRejectedValueOnce(new Go2rtcApiError(500));

			const first = await streams.acquire(camera, provider, 'medium');

			first.release();
			await jest.advanceTimersByTimeAsync(30_000);

			expect(client.deleteStream).toHaveBeenCalledTimes(1);
			expect(secrets.list()).toContain(SENT_URL);

			const second = await streams.acquire(camera, provider, 'medium');

			expect(secrets.list()).toContain(SENT_URL);

			second.release();
			await jest.advanceTimersByTimeAsync(30_000);

			expect(client.deleteStream).toHaveBeenCalledTimes(2);
			expect(secrets.list()).toEqual([]);
		});

		it('releases the retained source only when the managed process is confirmed gone', async () => {
			client.deleteStream.mockRejectedValue(new Go2rtcApiError(500));

			const lease = await streams.acquire(camera, provider, 'medium');

			lease.release();
			await jest.advanceTimersByTimeAsync(30_000);
			expect(secrets.list()).toContain(SENT_URL);

			fire({ generation: 2 });
			await flush();

			// A new generation says nothing about the old process: it is released by its own run-ended signal only.
			expect(secrets.list()).toContain(SENT_URL);

			fireRunEnded(2);

			expect(secrets.list()).toContain(SENT_URL);

			fireRunEnded(1);

			expect(secrets.list()).toEqual([]);
		});

		it('keeps the source of a stream dropped with an unavailable relay while its process end is unconfirmed', async () => {
			await streams.acquire(camera, provider, 'medium');

			// `stop()` rejected: the relay is reported crashed, but the child may be alive and print the source.
			fire({ state: 'error', reason: 'crashed' });
			await flush();
			fire({ state: 'unavailable', reason: 'crashed' });
			await flush();

			expect(client.deleteStream).not.toHaveBeenCalled();
			expect(secrets.list()).toContain(SENT_URL);

			// A later confirmed stop of that run.
			fireRunEnded(1);

			expect(secrets.list()).toEqual([]);
		});

		it('releases the source of a managed stream whose DELETE fails after its process was confirmed gone', async () => {
			let failDelete!: (error: Error) => void;

			client.deleteStream.mockReturnValue(
				new Promise<void>((_, reject) => {
					failDelete = reject;
				}),
			);

			const lease = await streams.acquire(camera, provider, 'medium');

			lease.release();
			await jest.advanceTimersByTimeAsync(30_000);
			expect(secrets.list()).toContain(SENT_URL);

			fire({ state: 'unavailable', reason: 'crashed' });
			fireRunEnded(1);
			failDelete(new Go2rtcApiError(null));
			await flush();

			expect(secrets.list()).toEqual([]);
		});

		it('keeps the source until module destroy has run its DELETEs, then releases it even though they failed', async () => {
			let failDelete!: (error: Error) => void;

			client.deleteStream.mockReturnValue(
				new Promise<void>((_, reject) => {
					failDelete = reject;
				}),
			);

			await streams.acquire(camera, provider, 'medium');

			const destroyed = streams.onModuleDestroy();

			await flush();

			expect(client.deleteStream).toHaveBeenCalledWith(name);
			expect(secrets.list()).toContain(SENT_URL);

			failDelete(new Go2rtcApiError(null));
			await destroyed;

			expect(secrets.list()).toEqual([]);
		});

		it('releases the source retained by an earlier failure when module destroy ends', async () => {
			client.deleteStream.mockRejectedValue(new Go2rtcApiError(null));

			const lease = await streams.acquire(camera, provider, 'medium');

			fire({ mode: 'external', state: 'running', generation: 2 });
			await flush();

			lease.release();
			await jest.advanceTimersByTimeAsync(30_000);

			await streams.onModuleDestroy();

			expect(secrets.list()).toEqual([]);
		});
	});

	it('bounds the best-effort DELETE on module destroy to 2 s', async () => {
		client.deleteStream.mockReturnValue(new Promise(() => undefined));

		await streams.acquire(camera, provider, 'medium');

		let done = false;
		const destroyed = Promise.resolve(streams.onModuleDestroy()).then(() => {
			done = true;
		});

		await jest.advanceTimersByTimeAsync(1_999);
		expect(done).toBe(false);

		await jest.advanceTimersByTimeAsync(1);
		await destroyed;

		expect(done).toBe(true);
		expect(client.deleteStream).toHaveBeenCalledWith(name);
	});
});
