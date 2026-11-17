import { Logger } from '@nestjs/common';

import { ProtectRtspsStreams } from '../client/protect-api.types';
import {
	PROTECT_STREAM_AVAILABILITY_TTL_MS,
	PROTECT_STREAM_READ_DEADLINE_MS,
	PROTECT_STREAM_REFRESH_MAX_QUEUED,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectConsoleIdentity, ProtectSessionListener } from './protect-connector.service';
import { ProtectStreamAvailabilityService } from './protect-stream-availability.service';
import { ProtectStreamAvailabilityStore } from './protect-stream-availability.store';
import { ProtectDeviceObserver } from './protect-synchronizer.service';

const IDENTITY: ProtectConsoleIdentity = { nvrId: 'nvr', nvrMacKey: '0cea14003a69' };

const streams = (patch: Partial<ProtectRtspsStreams> = {}): ProtectRtspsStreams => ({
	high: 'rtsps://127.0.0.1:7441/SENTINELALIAShigh0123456789?enableSrtp',
	medium: null,
	low: null,
	package: null,
	...patch,
});

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

describe('ProtectStreamAvailabilityService', () => {
	let getRtspsStreams: jest.Mock;
	let client: { getRtspsStreams: jest.Mock } | null;
	let refreshDevice: jest.Mock;
	let adopted: Set<string>;
	let observer: ProtectDeviceObserver;
	let sessionListener: ProtectSessionListener;
	let store: ProtectStreamAvailabilityStore;
	let service: ProtectStreamAvailabilityService;
	let logs: string[];
	let unsubscribeObserver: jest.Mock;
	let unsubscribeSession: jest.Mock;

	const frame = (id: string, state: string, modelKey = 'camera'): void => observer(modelKey, id, { id, state });
	const settle = async (ms = 0): Promise<void> => {
		await jest.advanceTimersByTimeAsync(ms);
	};

	beforeEach(() => {
		jest.useFakeTimers();
		logs = [];

		for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
				logs.push(typeof message === 'string' ? message : '');
			});
		}

		getRtspsStreams = jest.fn().mockResolvedValue(streams());
		client = { getRtspsStreams };
		refreshDevice = jest.fn().mockResolvedValue(true);
		adopted = new Set(['cam1', 'cam2', 'cam3']);
		unsubscribeObserver = jest.fn();
		unsubscribeSession = jest.fn();
		store = new ProtectStreamAvailabilityStore();

		const connector = {
			getClient: () => client,
			getConsoleIdentity: () => IDENTITY,
			onSessionChange: (listener: ProtectSessionListener) => {
				sessionListener = listener;

				return unsubscribeSession;
			},
		};
		const synchronizer = {
			observeDevices: (next: ProtectDeviceObserver) => {
				observer = next;

				return unsubscribeObserver;
			},
			isAdopted: (modelKey: string, id: string) => modelKey === 'camera' && adopted.has(id),
			refreshDevice,
		};

		service = new ProtectStreamAvailabilityService(connector as never, synchronizer as never, store);
		service.onModuleInit();
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('reads each adopted camera once after a session starts', async () => {
		let running = 0;
		let maxRunning = 0;

		getRtspsStreams.mockImplementation(async () => {
			running += 1;
			maxRunning = Math.max(maxRunning, running);
			await new Promise((resolve) => setTimeout(resolve, 10));
			running -= 1;

			return streams();
		});

		frame('cam1', 'CONNECTED');
		frame('cam2', 'CONNECTED');
		frame('cam3', 'CONNECTED');
		frame('cam1', 'CONNECTED');
		await settle(100);

		expect(getRtspsStreams.mock.calls.map((call: unknown[]) => call[0])).toEqual(['cam1', 'cam2', 'cam3']);
		expect(maxRunning).toBe(1);
	});

	it('skips unadopted cameras and other model keys', async () => {
		frame('other', 'CONNECTED');
		frame('cam1', 'CONNECTED', 'light');
		await settle(10);

		expect(getRtspsStreams).not.toHaveBeenCalled();
	});

	it('does not read a camera that is not connected', async () => {
		frame('cam1', 'DISCONNECTED');
		await settle(10);

		expect(getRtspsStreams).not.toHaveBeenCalled();
	});

	it('reads availability when a camera reconnects', async () => {
		frame('cam1', 'CONNECTED');
		await settle(10);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		frame('cam1', 'DISCONNECTED');
		await settle(PROTECT_STREAM_AVAILABILITY_TTL_MS / 2);
		frame('cam1', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(2);

		frame('cam1', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
	});

	it('reads a skipped reconnect when the anti-flap window ends', async () => {
		frame('cam1', 'CONNECTED');
		await settle(10);
		frame('cam1', 'DISCONNECTED');
		await settle(2_000);
		frame('cam1', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		await settle(7_000);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		await settle(1_100);
		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
	});

	it('clears a deferred reconnect read when the session ends', async () => {
		frame('cam1', 'CONNECTED');
		await settle(10);
		frame('cam1', 'DISCONNECTED');
		frame('cam1', 'CONNECTED');
		expect(jest.getTimerCount()).toBeGreaterThan(0);

		sessionListener(null, 'lost');

		expect(jest.getTimerCount()).toBe(0);
		await settle(20_000);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);
	});

	it('does not retry a failing camera on every frame', async () => {
		getRtspsStreams.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream'));

		frame('cam1', 'CONNECTED');
		await settle(10);
		frame('cam1', 'CONNECTED');
		frame('cam1', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(1);
		expect(logs.filter((line) => line.includes('read failed (timeout)'))).toHaveLength(1);

		await settle(PROTECT_STREAM_AVAILABILITY_TTL_MS);
		frame('cam1', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
	});

	it('refreshes the camera status only when presence changed', async () => {
		await service.readStreams('cam1');
		await settle(0);
		expect(refreshDevice).toHaveBeenCalledTimes(1);
		expect(refreshDevice).toHaveBeenCalledWith(IDENTITY, 'camera', 'cam1');

		await service.readStreams('cam1');
		await settle(0);
		expect(refreshDevice).toHaveBeenCalledTimes(1);

		getRtspsStreams.mockResolvedValue(streams({ medium: 'rtsps://127.0.0.1:7441/SENTINELALIASmed0123456789' }));
		await service.readStreams('cam1');
		await settle(0);

		expect(refreshDevice).toHaveBeenCalledTimes(2);
	});

	it('serves a stale entry at once and refreshes it in the background', async () => {
		frame('cam1', 'CONNECTED');
		await settle(10);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		await settle(PROTECT_STREAM_AVAILABILITY_TTL_MS - 10 - 1);
		await service.getAvailability('cam1');
		await settle(0);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		await settle(1);

		const hang = deferred<ProtectRtspsStreams>();

		getRtspsStreams.mockReturnValue(hang.promise);

		const stale = await service.getAvailability('cam1');

		expect(stale?.availability.high).toBe(true);
		await settle(0);
		expect(getRtspsStreams).toHaveBeenCalledTimes(2);

		hang.resolve(streams());
		await settle(0);
	});

	it('does not refresh a stale entry of a camera that is not connected', async () => {
		store.set('cam1', { high: true, medium: false, low: false, package: false }, Date.now() - 5 * 60_000);
		frame('cam1', 'DISCONNECTED');

		expect((await service.getAvailability('cam1'))?.availability.high).toBe(true);
		await settle(10);

		expect(getRtspsStreams).not.toHaveBeenCalled();
	});

	it('refreshes a stale entry of a camera adopted after its last frame', async () => {
		store.set('cam1', { high: false, medium: false, low: false, package: false }, Date.now() - 5 * 60_000);

		expect((await service.getAvailability('cam1'))?.availability.high).toBe(false);
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(1);
		expect(store.get('cam1')?.availability.high).toBe(true);
	});

	it('joins a read already in flight', async () => {
		const hang = deferred<ProtectRtspsStreams>();

		getRtspsStreams.mockReturnValue(hang.promise);

		const first = service.getAvailability('cam1');
		const second = service.getAvailability('cam1');

		frame('cam1', 'CONNECTED');
		hang.resolve(streams());

		expect((await first)?.availability.high).toBe(true);
		expect((await second)?.availability.high).toBe(true);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);
	});

	it('keeps the last entry when a read fails', async () => {
		const failure = new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream');

		getRtspsStreams.mockRejectedValue(failure);
		await expect(service.getAvailability('cam1')).resolves.toBeNull();

		store.set('cam2', { high: true, medium: false, low: false, package: false }, Date.now() - 3 * 60_000);
		frame('cam2', 'CONNECTED');

		const entry = await service.getAvailability('cam2');

		expect(entry?.availability.high).toBe(true);
		await settle(10);

		expect(getRtspsStreams.mock.calls.map((call: unknown[]) => call[0])).toEqual(['cam1', 'cam2']);
		expect(logs.filter((line) => line.includes('read failed (timeout)'))).toHaveLength(1);
		expect(store.get('cam2')?.availability.high).toBe(true);
	});

	it('a failed read is not repeated by listings within 60 s', async () => {
		getRtspsStreams.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream'));

		await expect(service.getAvailability('cam1')).resolves.toBeNull();
		await expect(service.getAvailability('cam1')).resolves.toBeNull();
		await settle(PROTECT_STREAM_AVAILABILITY_TTL_MS - 1);
		await expect(service.getAvailability('cam1')).resolves.toBeNull();

		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		await settle(1);
		await expect(service.getAvailability('cam1')).resolves.toBeNull();

		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
	});

	it('logs only the class of an unexpected foreground failure', async () => {
		getRtspsStreams.mockRejectedValue(new TypeError('boom rtsps://127.0.0.1:7441/SENTINELALIASleak0123456789'));

		await service.getAvailability('cam1');

		expect(logs).toEqual([
			'[ProtectStreamAvailabilityService] UniFi Protect stream availability read failed (TypeError)',
		]);
	});

	it('never extends the read deadline', async () => {
		await service.readStreams('cam1', { deadlineMs: 20_000 });
		await service.readStreams('cam1', { deadlineMs: 3_000 });
		await service.readStreams('cam1');

		expect(getRtspsStreams.mock.calls.map((call: unknown[]) => (call[1] as { deadlineMs: number }).deadlineMs)).toEqual(
			[8_000, 3_000, 8_000],
		);
	});

	it('lets an aborted caller give up alone while the shared read continues', async () => {
		const hang = deferred<ProtectRtspsStreams>();
		const controller = new AbortController();

		getRtspsStreams.mockReturnValue(hang.promise);

		const aborted = service.getAvailability('cam1', { signal: controller.signal });
		const joiner = service.getAvailability('cam1');

		await settle(0);
		controller.abort();

		await expect(aborted).resolves.toBeNull();
		const used = (getRtspsStreams.mock.calls[0] as [string, { signal: AbortSignal }])[1].signal;

		expect(used).not.toBe(controller.signal);
		expect(used.aborted).toBe(false);

		hang.resolve(streams());

		expect((await joiner)?.availability.high).toBe(true);
		expect(getRtspsStreams).toHaveBeenCalledTimes(1);
		expect(store.get('cam1')?.availability.high).toBe(true);
	});

	it('does not mark a camera as failed when its initiator gives up', async () => {
		const controller = new AbortController();

		getRtspsStreams.mockImplementation(
			(_id: string, options: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					options.signal.addEventListener('abort', () =>
						reject(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'cameras/{id}/rtsps-stream')),
					);
				}),
		);

		const direct = service.readStreams('cam1', { signal: controller.signal });

		controller.abort();
		await expect(direct).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });

		getRtspsStreams.mockResolvedValue(streams());
		frame('cam1', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
		expect(store.get('cam1')).not.toBeNull();
	});

	it('retries a status refresh that did not happen on the next read', async () => {
		refreshDevice.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('queue'));

		await service.readStreams('cam1');
		await settle(0);
		expect(refreshDevice).toHaveBeenCalledTimes(1);

		await service.readStreams('cam1');
		await settle(0);
		expect(refreshDevice).toHaveBeenCalledTimes(2);

		await service.readStreams('cam1');
		await settle(0);
		expect(refreshDevice).toHaveBeenCalledTimes(3);

		await service.readStreams('cam1');
		await settle(0);
		expect(refreshDevice).toHaveBeenCalledTimes(3);
	});

	it('forgets a pending status refresh when the session ends', async () => {
		refreshDevice.mockResolvedValueOnce(false);
		await service.readStreams('cam1');
		await settle(0);

		sessionListener(null, 'lost');
		await service.readStreams('cam1');
		await settle(0);
		await service.readStreams('cam1');
		await settle(0);

		expect(refreshDevice).toHaveBeenCalledTimes(2);
	});

	it('does not read a flapping camera again within 10 s of a failed read', async () => {
		getRtspsStreams.mockRejectedValueOnce(
			new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream'),
		);

		frame('cam1', 'CONNECTED');
		await settle(10);
		frame('cam1', 'DISCONNECTED');
		await settle(1_000);
		frame('cam1', 'CONNECTED');
		await settle(5_000);

		expect(getRtspsStreams).toHaveBeenCalledTimes(1);

		await settle(4_100);
		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
	});

	it('restarts the background reads after a session change', async () => {
		const hang = deferred<ProtectRtspsStreams>();

		getRtspsStreams.mockReturnValueOnce(hang.promise);
		frame('cam1', 'CONNECTED');
		await settle(0);

		sessionListener(null, 'lost');
		frame('cam2', 'CONNECTED');
		await settle(10);

		expect(getRtspsStreams.mock.calls.map((call: unknown[]) => call[0])).toEqual(['cam1', 'cam2']);
		expect(store.get('cam2')).not.toBeNull();

		hang.resolve(streams());
		await settle(0);
		expect(store.get('cam1')).toBeNull();
	});

	it('throws a sanitized error without a client', async () => {
		client = null;

		await expect(service.readStreams('cam1')).rejects.toMatchObject({ category: ProtectErrorCategory.UNAVAILABLE });
		await expect(service.getAvailability('cam1')).resolves.toBeNull();
	});

	it("passes the deadline and the caller's signal", async () => {
		const controller = new AbortController();

		await service.readStreams('cam1', { signal: controller.signal });

		expect(getRtspsStreams).toHaveBeenCalledWith('cam1', {
			signal: controller.signal,
			deadlineMs: PROTECT_STREAM_READ_DEADLINE_MS,
		});
		expect(PROTECT_STREAM_READ_DEADLINE_MS).toBe(8_000);
	});

	it('forgets everything when the session ends', async () => {
		const hang = deferred<ProtectRtspsStreams>();

		await service.readStreams('cam1');
		expect(service.getStreamPorts('cam1')).toEqual({ high: 7441 });

		getRtspsStreams.mockReturnValue(hang.promise);
		frame('cam2', 'CONNECTED');
		frame('cam3', 'CONNECTED');
		await settle(0);
		expect(getRtspsStreams).toHaveBeenCalledTimes(2);

		sessionListener(null, 'lost');

		expect(store.get('cam1')).toBeNull();
		expect(service.getStreamPorts('cam1')).toBeNull();

		hang.resolve(streams());
		await settle(10);

		expect(store.get('cam2')).toBeNull();
		expect(service.getStreamPorts('cam2')).toBeNull();
		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
		expect(refreshDevice).toHaveBeenCalledTimes(1);
	});

	it('does not join a read of an earlier session', async () => {
		const old = deferred<ProtectRtspsStreams>();

		getRtspsStreams.mockReturnValueOnce(old.promise);
		void service.getAvailability('cam1');
		await settle(0);

		sessionListener(null, 'lost');

		const next = service.getAvailability('cam1');

		await settle(0);
		expect(getRtspsStreams).toHaveBeenCalledTimes(2);
		expect((await next)?.availability.high).toBe(true);

		old.resolve(streams({ high: null }));
		await settle(0);

		expect(store.get('cam1')?.availability.high).toBe(true);
	});

	it('bounds the background queue', async () => {
		const hang = deferred<ProtectRtspsStreams>();

		getRtspsStreams.mockReturnValue(hang.promise);

		const ids = Array.from({ length: PROTECT_STREAM_REFRESH_MAX_QUEUED + 1 }, (_, index) => `many${index}`);

		ids.forEach((id) => adopted.add(id));
		ids.forEach((id) => frame(id, 'CONNECTED'));
		await settle(0);

		expect(getRtspsStreams).toHaveBeenCalledTimes(1);
		expect(logs.filter((line) => line.includes('UniFi Protect stream availability queue is full'))).toHaveLength(1);

		hang.resolve(streams());
		await settle(10);

		// One running plus at most 255 waiting were read; the dropped camera was not.
		expect(getRtspsStreams).toHaveBeenCalledTimes(PROTECT_STREAM_REFRESH_MAX_QUEUED);
	});

	it('keeps only ports per quality', async () => {
		getRtspsStreams.mockResolvedValue(
			streams({
				medium: 'rtsps://127.0.0.1:7442/SENTINELALIASmed0123456789?enableSrtp',
				low: 'not a url SENTINELALIAS',
			}),
		);
		await service.readStreams('cam1');

		expect(service.getStreamPorts('cam1')).toEqual({ high: 7441, medium: 7442 });
		expect(JSON.stringify(store.get('cam1'))).not.toContain('SENTINELALIAS');
	});

	it('unsubscribes and stops timers on destroy', async () => {
		frame('cam1', 'CONNECTED');
		await settle(10);
		frame('cam1', 'DISCONNECTED');
		frame('cam1', 'CONNECTED');

		service.onModuleDestroy();

		expect(unsubscribeObserver).toHaveBeenCalled();
		expect(unsubscribeSession).toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('never logs or throws a stream address', async () => {
		getRtspsStreams.mockRejectedValue(new Error('failed rtsps://127.0.0.1:7441/SENTINELALIASleak0123456789'));

		await expect(service.getAvailability('cam1')).resolves.toBeNull();
		frame('cam2', 'CONNECTED');
		await settle(10);
		getRtspsStreams.mockResolvedValue(streams());
		await service.readStreams('cam3');

		expect(logs.length).toBeGreaterThan(0);
		expect(logs.join('\n')).not.toContain('SENTINELALIAS');
		expect(logs.join('\n')).not.toContain('rtsps://');
	});
});
