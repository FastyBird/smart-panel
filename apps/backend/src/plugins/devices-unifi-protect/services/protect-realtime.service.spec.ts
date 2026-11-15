/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { readFileSync } from 'fs';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import { ProtectSubscription, ProtectSubscriptionHandlers } from '../client/protect-subscription';
import {
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_MAX_BUFFERED_FRAMES,
	ProtectSubscriptionTopic,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';

import { ProtectConsoleIdentity, ProtectSession, ProtectSessionEnd } from './protect-connector.service';
import {
	PROTECT_DEFAULT_REALTIME_TIMINGS,
	ProtectRealtimeService,
	ProtectRealtimeTimings,
} from './protect-realtime.service';
import { ProtectSynchronizerService } from './protect-synchronizer.service';

type Raw = Record<string, any>;

const FIXTURES = join(__dirname, '..', '__fixtures__');
const read = (name: string): any => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
const cameras = read('cameras.json') as Raw[];
const sensors = read('sensors.json') as Raw[];
const lights = read('lights.json') as Raw[];
const doorbells = read('cameras-doorbell.json') as Raw[];
const goldenDoorbell = read('expected/doorbell.json') as Raw;
const ringLine = readFileSync(join(FIXTURES, 'ws-events.jsonl'), 'utf8')
	.split('\n')
	.find((line) => line.includes('"id":"5f00000000000000000e0007"') && line.includes('"type":"add"'));

const IDENTITY: ProtectConsoleIdentity = { nvrId: '68b3ace392bf98c9fb76f70c', nvrMacKey: '0cea14003a69' };
const SENSOR_ID = sensors[0].id as string;

const frameText = (patch: Raw = {}): string =>
	JSON.stringify({ type: 'update', item: { id: SENSOR_ID, modelKey: 'sensor', isOpened: true, ...patch } });

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

interface FakeSubscription extends ProtectSubscription {
	handlers: ProtectSubscriptionHandlers;
	ping: jest.Mock;
	close: jest.Mock;
}

const failure = (category: ProtectErrorCategory, retryAfterMs: number | null = null): ProtectApiError =>
	new ProtectApiError(category, 'subscribe/devices', { retryAfterMs });

describe('ProtectRealtimeService', () => {
	let logged: string[];
	let order: string[];
	let subs: FakeSubscription[];
	let openError: Partial<Record<ProtectSubscriptionTopic, unknown>> | null;
	let openGate: Partial<Record<ProtectSubscriptionTopic, ReturnType<typeof deferred<void>>>>;
	let listGate: Partial<Record<'cameras' | 'sensors' | 'lights', ReturnType<typeof deferred<void>>>>;
	let listError: Partial<Record<'cameras' | 'sensors' | 'lights', unknown>>;
	let client: {
		openSubscription: jest.Mock;
		listCameras: jest.Mock;
		listSensors: jest.Mock;
		listLights: jest.Mock;
	};
	let listener: ((session: ProtectSession | null, reason: ProtectSessionEnd | null) => void) | null;
	let unsubscribe: jest.Mock;
	let connector: { onSessionChange: jest.Mock };
	let synchronizer: {
		applySnapshot: jest.Mock;
		enqueueFrame: jest.Mock;
		idle: jest.Mock;
		reset: jest.Mock;
		countIgnoredFrame: jest.Mock;
		getCounters: jest.Mock;
	};
	let notifications: { notify: jest.Mock; resolve: jest.Mock };
	let pollInterval: number;
	let config: { getPluginConfig: jest.Mock };
	let timings: ProtectRealtimeTimings;
	let service: ProtectRealtimeService;
	let sessionCounter: number;

	const build = (sync: unknown = synchronizer): ProtectRealtimeService => {
		const created = new ProtectRealtimeService(
			connector as never,
			sync as never,
			notifications as never,
			config as never,
			timings,
		);

		created.onModuleInit();

		return created;
	};
	const session = (): ProtectSession => ({ generation: ++sessionCounter, client: client as never, identity: IDENTITY });
	const connect = async (): Promise<ProtectSession> => {
		const next = session();

		listener?.(next, null);
		await service.settle();

		return next;
	};
	const sub = (topic: ProtectSubscriptionTopic, index = -1): FakeSubscription => {
		const matching = subs.filter((candidate) => candidate.topic === topic);

		return matching.at(index);
	};
	const opens = (topic: ProtectSubscriptionTopic): number =>
		client.openSubscription.mock.calls.filter((call) => call[0] === topic).length;
	const push = (topic: ProtectSubscriptionTopic, text: string, index = -1): void => {
		sub(topic, index).handlers.message(text);
	};

	beforeEach(() => {
		jest.useFakeTimers();
		logged = [];
		order = [];
		subs = [];
		openError = null;
		openGate = {};
		listGate = {};
		listError = {};
		sessionCounter = 0;
		listener = null;

		for (const level of ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
			});
		}

		const list = (name: 'cameras' | 'sensors' | 'lights', items: Raw[]) =>
			jest.fn(async () => {
				order.push(`list:${name}`);
				await listGate[name]?.promise;

				if (listError[name] !== undefined) {
					throw listError[name];
				}

				return items.map((item) => ({ id: item.id, raw: item }));
			});

		client = {
			openSubscription: jest.fn(async (topic: ProtectSubscriptionTopic, handlers: ProtectSubscriptionHandlers) => {
				order.push(`open:${topic}`);
				await openGate[topic]?.promise;

				if (openError !== null && openError[topic] !== undefined) {
					throw openError[topic];
				}

				const subscription: FakeSubscription = { topic, handlers, ping: jest.fn(), close: jest.fn() };

				subs.push(subscription);

				return subscription;
			}),
			listCameras: list('cameras', cameras),
			listSensors: list('sensors', sensors),
			listLights: list('lights', lights),
		};
		unsubscribe = jest.fn();
		connector = {
			onSessionChange: jest.fn((registered: typeof listener) => {
				listener = registered;

				return unsubscribe;
			}),
		};
		synchronizer = {
			applySnapshot: jest.fn(() => {
				order.push('applySnapshot');

				return Promise.resolve();
			}),
			enqueueFrame: jest.fn(() => {
				order.push('enqueueFrame');

				return true;
			}),
			idle: jest.fn(() => Promise.resolve()),
			reset: jest.fn(),
			countIgnoredFrame: jest.fn(),
			getCounters: jest.fn(() => ({ ignoredEventCount: 2 })),
		};
		notifications = {
			notify: jest.fn(() => Promise.resolve(null)),
			resolve: jest.fn(() => Promise.resolve(true)),
		};
		pollInterval = 5000;
		config = { getPluginConfig: jest.fn(() => ({ pollIntervalMs: pollInterval })) };
		timings = { ...PROTECT_DEFAULT_REALTIME_TIMINGS, reconnectDelay: (attempt) => 1000 * 2 ** attempt };
		service = build();
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	const failCycles = async (count: number): Promise<void> => {
		openError = {
			devices: failure(ProtectErrorCategory.UNAVAILABLE),
			events: failure(ProtectErrorCategory.UNAVAILABLE),
		};
		await connect();

		for (let index = 1; index < count; index++) {
			await jest.advanceTimersByTimeAsync(1000 * 2 ** (index - 1));
			await service.settle();
		}
	};
	const listReads = (): number => client.listCameras.mock.calls.length + client.listSensors.mock.calls.length;

	it('starts stopped and listens to the connector until destroyed', () => {
		expect(service.getState()).toBe('stopped');
		expect(connector.onSessionChange).toHaveBeenCalledTimes(1);

		service.onModuleDestroy();

		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('subscribes to both topics before it primes', async () => {
		await connect();

		expect(order).toEqual([
			'open:devices',
			'open:events',
			'list:cameras',
			'list:sensors',
			'list:lights',
			'applySnapshot',
		]);
		expect(synchronizer.applySnapshot).toHaveBeenCalledWith(IDENTITY, {
			complete: true,
			entries: expect.any(Array),
		});
		expect(service.getState()).toBe('streaming');
	});

	it('primes with the first entry per model key and id and skips nothing else', async () => {
		await connect();

		const snapshot = synchronizer.applySnapshot.mock.calls[0][1] as { entries: { modelKey: string; id: string }[] };
		const keys = snapshot.entries.map((entry) => `${entry.modelKey}:${entry.id}`);

		expect(new Set(keys).size).toBe(keys.length);
		expect(snapshot.entries.filter((entry) => entry.modelKey === 'sensor')).toHaveLength(
			new Set(sensors.map((item) => item.id as string)).size,
		);
		expect(snapshot.entries.some((entry) => entry.modelKey === 'nvr')).toBe(false);
	});

	it('applies frames received while priming after the snapshot, in arrival order', async () => {
		listGate.sensors = deferred<void>();

		const next = session();

		listener?.(next, null);
		await jest.advanceTimersByTimeAsync(0);

		expect(service.getState()).toBe('priming');

		push('events', frameText({ isOpened: true }));
		push('devices', frameText({ isOpened: false }));
		listGate.sensors.resolve();
		await service.settle();

		const calls = synchronizer.enqueueFrame.mock.calls as [ProtectConsoleIdentity, { item: Raw }][];

		expect(synchronizer.applySnapshot.mock.invocationCallOrder[0]).toBeLessThan(
			synchronizer.enqueueFrame.mock.invocationCallOrder[0],
		);
		expect(calls.map((call) => call[1].item.isOpened as boolean)).toEqual([true, false]);
		expect(calls[0][0]).toBe(IDENTITY);
		expect(service.getState()).toBe('streaming');
	});

	it('buffers the frames of a subscription while the other socket is still connecting', async () => {
		openGate.events = deferred<void>();
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);

		expect(service.getState()).toBe('connecting');

		push('devices', frameText());
		openGate.events.resolve();
		await service.settle();

		expect(order.indexOf('applySnapshot')).toBeLessThan(order.indexOf('enqueueFrame'));
		expect(synchronizer.enqueueFrame).toHaveBeenCalledTimes(1);
	});

	it('enqueues frames straight away while streaming and counts rejected frames', async () => {
		await connect();
		synchronizer.enqueueFrame.mockClear();
		push('devices', frameText());
		push('events', 'not json');

		expect(synchronizer.enqueueFrame).toHaveBeenCalledTimes(1);
		expect(synchronizer.countIgnoredFrame).toHaveBeenCalledTimes(1);
	});

	it('counts frames rejected while buffering', async () => {
		listGate.cameras = deferred<void>();
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);
		push('events', 'not json');

		expect(synchronizer.countIgnoredFrame).toHaveBeenCalledTimes(1);

		listGate.cameras.resolve();
		await service.settle();

		expect(synchronizer.enqueueFrame).not.toHaveBeenCalled();
	});

	it('drops a buffer that overflows and retries', async () => {
		listGate.cameras = deferred<void>();
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);

		for (let index = 0; index <= PROTECT_MAX_BUFFERED_FRAMES; index++) {
			push('events', frameText());
		}

		expect(sub('devices').close).toHaveBeenCalled();
		expect(sub('events').close).toHaveBeenCalled();
		expect(service.getState()).toBe('connecting');
		expect(
			logged.some((line) => line.includes('UniFi Protect realtime cycle failed (protocol); retry in 1000 ms')),
		).toBe(true);

		listGate.cameras.resolve();
		await jest.advanceTimersByTimeAsync(999);

		expect(opens('devices')).toBe(1);
		expect(synchronizer.applySnapshot).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);

		expect(opens('devices')).toBe(2);
		expect(opens('events')).toBe(2);
	});

	it('restarts with a fresh prime when the frame queue is full', async () => {
		await connect();
		synchronizer.enqueueFrame.mockReturnValueOnce(false);
		push('events', frameText());

		expect(sub('devices').close).toHaveBeenCalled();
		expect(sub('events').close).toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1000);
		await service.settle();

		expect(synchronizer.applySnapshot).toHaveBeenCalledTimes(2);
		expect(service.getState()).toBe('streaming');
	});

	it('restarts when the queue is full while draining the buffer', async () => {
		listGate.lights = deferred<void>();
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);
		push('events', frameText());
		synchronizer.enqueueFrame.mockReturnValueOnce(false);
		listGate.lights.resolve();
		await service.settle();

		expect(service.getState()).toBe('connecting');
		expect(sub('events').close).toHaveBeenCalled();
	});

	it('pings every 180 s and restarts when a pong is missing', async () => {
		await connect();
		await jest.advanceTimersByTimeAsync(179_999);

		expect(sub('devices').ping).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);

		expect(sub('devices').ping).toHaveBeenCalledTimes(1);
		expect(sub('events').ping).toHaveBeenCalledTimes(1);

		sub('devices').handlers.pong();
		await jest.advanceTimersByTimeAsync(29_999);

		expect(sub('devices').close).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);

		expect(sub('devices').close).toHaveBeenCalled();
		expect(sub('events').close).toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1000);
		await service.settle();

		expect(opens('devices')).toBe(2);
		expect(service.getState()).toBe('streaming');
	});

	it('keeps pinging while both pongs arrive', async () => {
		await connect();
		await jest.advanceTimersByTimeAsync(180_000);
		sub('devices').handlers.pong();
		sub('events').handlers.pong();
		await jest.advanceTimersByTimeAsync(30_000);

		expect(sub('devices').close).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(150_000);

		expect(sub('devices').ping).toHaveBeenCalledTimes(2);
	});

	it('restarts when a ping cannot be sent', async () => {
		await connect();
		sub('devices').ping.mockImplementation(() => {
			throw new Error('socket SENTINEL detail');
		});
		await jest.advanceTimersByTimeAsync(180_000);

		expect(sub('events').close).toHaveBeenCalled();
		expect(logged.join('\n')).not.toContain('SENTINEL');
	});

	it('re-primes after a socket drops', async () => {
		await connect();
		sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));

		expect(sub('devices').close).toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1000);
		await service.settle();

		expect(synchronizer.applySnapshot).toHaveBeenCalledTimes(2);
		expect(service.getState()).toBe('streaming');
		expect(synchronizer.reset).not.toHaveBeenCalled();
	});

	it('backs off with growing delays', async () => {
		openError = {
			devices: failure(ProtectErrorCategory.UNAVAILABLE),
			events: failure(ProtectErrorCategory.UNAVAILABLE),
		};
		await connect();

		expect(opens('devices')).toBe(1);
		expect(service.getState()).toBe('connecting');
		expect(
			logged.some((line) => line.includes('UniFi Protect realtime cycle failed (unavailable); retry in 1000 ms')),
		).toBe(true);

		await jest.advanceTimersByTimeAsync(999);

		expect(opens('devices')).toBe(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(opens('devices')).toBe(2);

		await jest.advanceTimersByTimeAsync(1999);

		expect(opens('devices')).toBe(2);

		await jest.advanceTimersByTimeAsync(1);

		expect(opens('devices')).toBe(3);

		await jest.advanceTimersByTimeAsync(3999);

		expect(opens('devices')).toBe(3);

		await jest.advanceTimersByTimeAsync(1);

		expect(opens('devices')).toBe(4);
	});

	it('honours Retry-After on a rate-limited upgrade', async () => {
		openError = { devices: failure(ProtectErrorCategory.RATE_LIMITED, 9000) };
		await connect();
		await jest.advanceTimersByTimeAsync(8999);

		expect(opens('devices')).toBe(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(opens('devices')).toBe(2);
	});

	it('caps Retry-After at 60 s', async () => {
		openError = { devices: failure(ProtectErrorCategory.RATE_LIMITED, 600_000) };
		await connect();

		expect(logged.some((line) => line.includes('retry in 60000 ms'))).toBe(true);
	});

	it('uses the plain backoff for a rate-limited upgrade without Retry-After', async () => {
		openError = { devices: failure(ProtectErrorCategory.RATE_LIMITED) };
		await connect();

		expect(logged.some((line) => line.includes('(rate_limited); retry in 1000 ms'))).toBe(true);
	});

	it('closes the other socket when one fails to open and fails the cycle with that error', async () => {
		openGate.devices = deferred<void>();
		openError = { events: failure(ProtectErrorCategory.UNAVAILABLE) };
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);

		expect(client.openSubscription.mock.calls[0][2]).toEqual({ signal: expect.any(AbortSignal) });
		expect((client.openSubscription.mock.calls[0][2] as { signal: AbortSignal }).signal.aborted).toBe(true);

		openGate.devices.resolve();
		await service.settle();

		// The socket that opened late is closed and never primes.
		expect(sub('devices').close).toHaveBeenCalled();
		expect(synchronizer.applySnapshot).not.toHaveBeenCalled();
	});

	it('treats an incomplete console read as a failed cycle', async () => {
		listError.sensors = new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'sensors');
		await connect();

		expect(synchronizer.applySnapshot).not.toHaveBeenCalled();
		expect(sub('devices').close).toHaveBeenCalled();
		expect(service.getState()).toBe('connecting');
		expect(logged.some((line) => line.includes('(unavailable); retry in 1000 ms'))).toBe(true);
	});

	it('discards a prime that finishes after the session ended', async () => {
		listGate.lights = deferred<void>();
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);
		listener?.(null, 'lost');
		listGate.lights.resolve();
		await service.settle();

		expect(synchronizer.applySnapshot).not.toHaveBeenCalled();
		expect(sub('devices').close).toHaveBeenCalled();
		expect(sub('events').close).toHaveBeenCalled();
		expect(service.getState()).toBe('stopped');
	});

	it('closes a socket that opens after the session ended', async () => {
		openGate.events = deferred<void>();
		listener?.(session(), null);
		await jest.advanceTimersByTimeAsync(0);
		listener?.(null, 'lost');
		openGate.events.resolve();
		await service.settle();

		expect(sub('events').close).toHaveBeenCalled();
		expect(synchronizer.applySnapshot).not.toHaveBeenCalled();
	});

	it('stops everything when the session ends', async () => {
		await connect();
		listener?.(null, 'lost');

		expect(sub('devices').close).toHaveBeenCalled();
		expect(sub('events').close).toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
		expect(service.getState()).toBe('stopped');
		expect(synchronizer.reset).not.toHaveBeenCalled();
	});

	it('clears a pending reconnect when the session ends', async () => {
		openError = { devices: failure(ProtectErrorCategory.UNAVAILABLE) };
		await connect();

		expect(jest.getTimerCount()).toBe(1);

		listener?.(null, 'lost');

		expect(jest.getTimerCount()).toBe(0);

		await jest.advanceTimersByTimeAsync(10_000);

		expect(opens('devices')).toBe(1);
	});

	it('resets the synchronizer when the connector stops, however often it is announced', async () => {
		await connect();
		listener?.(null, 'stopped');
		listener?.(null, 'stopped');

		expect(synchronizer.reset).toHaveBeenCalledTimes(2);
		expect(service.getState()).toBe('stopped');
		expect(jest.getTimerCount()).toBe(0);
		expect(sub('devices').close).toHaveBeenCalled();
	});

	it('resets the synchronizer when the module is destroyed', async () => {
		await connect();
		service.onModuleDestroy();

		expect(synchronizer.reset).toHaveBeenCalledTimes(1);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('starts a fresh cycle for a new session and ignores callbacks of the old one', async () => {
		await connect();

		const oldEvents = sub('events');

		await connect();

		expect(oldEvents.close).toHaveBeenCalled();
		expect(opens('events')).toBe(2);

		synchronizer.enqueueFrame.mockClear();
		oldEvents.handlers.message(frameText());
		oldEvents.handlers.pong();
		oldEvents.handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));

		expect(synchronizer.enqueueFrame).not.toHaveBeenCalled();
		expect(sub('events')).not.toBe(oldEvents);
		expect(sub('events').close).not.toHaveBeenCalled();
		expect(service.getState()).toBe('streaming');
	});

	it('keeps the connector listener alive when a handler throws', async () => {
		await connect();
		synchronizer.enqueueFrame.mockImplementation(() => {
			throw new Error('queue SENTINEL detail');
		});

		expect(() => push('events', frameText())).not.toThrow();
		expect(() => sub('events').handlers.pong()).not.toThrow();
		expect(logged.join('\n')).not.toContain('SENTINEL');
		expect(logged.some((line) => line.includes('UniFi Protect realtime handler failed'))).toBe(true);
	});

	it('unrefs every timer', async () => {
		const unref = jest.fn();
		const realSetTimeout = global.setTimeout;
		const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
			const timer = realSetTimeout(fn, ms);
			const original = timer.unref.bind(timer);

			timer.unref = () => {
				unref();

				return original() as NodeJS.Timeout;
			};

			return timer;
		}) as never);

		await connect();
		await jest.advanceTimersByTimeAsync(180_000);

		const created = spy.mock.calls.length;

		expect(created).toBeGreaterThan(0);
		expect(unref).toHaveBeenCalledTimes(created);

		listener?.(null, 'lost');
	});

	it('keeps the key and frame content out of the logs', async () => {
		openError = { devices: failure(ProtectErrorCategory.UNAVAILABLE) };
		await connect();
		push('events', 'rtsps://SENTINELALIAS');

		expect(logged.join('\n')).not.toContain('SENTINEL');
	});

	describe('degraded polling', () => {
		it('switches to polling after three failed cycles and notifies once', async () => {
			await failCycles(2);

			expect(service.getState()).toBe('connecting');
			expect(notifications.notify).not.toHaveBeenCalled();

			await jest.advanceTimersByTimeAsync(2000);
			await service.settle();

			expect(service.getState()).toBe('polling');
			expect(notifications.notify).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith({
				source: 'devices-unifi-protect-plugin',
				kind: 'issue',
				key: 'realtime',
				severity: 'warning',
				title: 'UniFi Protect real-time updates unavailable',
				message:
					'Smart Panel cannot keep the UniFi Protect event connection open and is polling device state instead. ' +
					'Motion, smart detections and doorbell rings are not received until the connection recovers.',
				actions: [
					expect.objectContaining({
						type: 'service',
						label: 'Restart service',
						extension_kind: 'plugin',
						extension_type: 'devices-unifi-protect-plugin',
						service_id: 'connector',
						operation: 'restart',
						primary: true,
					}),
					expect.objectContaining({
						type: 'link',
						label: 'Open UniFi Protect settings',
						url: '/extensions/devices-unifi-protect-plugin',
					}),
				],
			});

			await jest.advanceTimersByTimeAsync(4000);
			await service.settle();

			expect(opens('devices')).toBe(4);
			expect(service.getState()).toBe('polling');
			expect(notifications.notify).toHaveBeenCalledTimes(1);
		});

		it('polls the device lists at the configured interval', async () => {
			await failCycles(3);
			client.listCameras.mockClear();
			client.listSensors.mockClear();
			client.listLights.mockClear();
			synchronizer.applySnapshot.mockClear();
			openError = { devices: failure(ProtectErrorCategory.UNAVAILABLE) };

			await jest.advanceTimersByTimeAsync(4999);

			expect(listReads()).toBe(0);

			await jest.advanceTimersByTimeAsync(1);

			expect(client.listCameras).toHaveBeenCalledTimes(1);
			expect(client.listSensors).toHaveBeenCalledTimes(1);
			expect(client.listLights).toHaveBeenCalledTimes(1);
			expect(synchronizer.applySnapshot).toHaveBeenCalledWith(IDENTITY, {
				complete: true,
				entries: expect.any(Array),
			});

			pollInterval = 10_000;
			synchronizer.applySnapshot.mockClear();

			await jest.advanceTimersByTimeAsync(5000);

			expect(client.listCameras).toHaveBeenCalledTimes(2);
			expect(synchronizer.applySnapshot).toHaveBeenCalledTimes(1);

			await jest.advanceTimersByTimeAsync(9999);

			expect(client.listCameras).toHaveBeenCalledTimes(2);

			await jest.advanceTimersByTimeAsync(1);

			expect(client.listCameras).toHaveBeenCalledTimes(3);
		});

		it('keeps devices when a poll read fails', async () => {
			await failCycles(3);
			synchronizer.applySnapshot.mockClear();
			listError.sensors = failure(ProtectErrorCategory.UNAVAILABLE);

			await jest.advanceTimersByTimeAsync(5000);

			const [, snapshot] = synchronizer.applySnapshot.mock.calls[0] as [unknown, { complete: boolean; entries: any[] }];

			expect(snapshot.complete).toBe(false);
			expect(snapshot.entries.some((entry) => entry.modelKey === 'camera')).toBe(true);
			expect(snapshot.entries.some((entry) => entry.modelKey === 'light')).toBe(true);
			expect(snapshot.entries.some((entry) => entry.modelKey === 'sensor')).toBe(false);
			expect(logged.some((line) => line.includes('UniFi Protect poll failed (unavailable)'))).toBe(true);
		});

		it('resolves the notification and stops polling when the sockets recover', async () => {
			await failCycles(3);

			openError = null;
			await jest.advanceTimersByTimeAsync(4000);
			await service.settle();

			expect(service.getState()).toBe('streaming');
			expect(notifications.resolve).toHaveBeenCalledWith('devices-unifi-protect-plugin', 'realtime');

			client.listCameras.mockClear();
			await jest.advanceTimersByTimeAsync(5000);

			expect(client.listCameras).not.toHaveBeenCalled();
		});

		it('retries a failed resolve on the next recovery', async () => {
			await failCycles(3);
			notifications.resolve.mockRejectedValueOnce(new Error('storage down'));
			openError = null;
			await jest.advanceTimersByTimeAsync(4000);
			await service.settle();

			expect(notifications.resolve).toHaveBeenCalledTimes(1);

			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));
			await jest.advanceTimersByTimeAsync(8000);
			await service.settle();

			expect(service.getState()).toBe('streaming');
			expect(notifications.resolve).toHaveBeenCalledTimes(2);
		});

		it('resolves the notification when the connector stops', async () => {
			await failCycles(3);
			listener?.(null, 'stopped');
			await Promise.resolve();

			expect(notifications.resolve).toHaveBeenCalledWith('devices-unifi-protect-plugin', 'realtime');
			expect(jest.getTimerCount()).toBe(0);

			listener?.(null, 'stopped');

			expect(notifications.resolve).toHaveBeenCalledTimes(1);
		});

		it('stops polling when the session is lost', async () => {
			await failCycles(3);
			listener?.(null, 'lost');
			client.listCameras.mockClear();
			await jest.advanceTimersByTimeAsync(60_000);

			expect(client.listCameras).not.toHaveBeenCalled();
			expect(service.getState()).toBe('stopped');
		});

		it('discards a poll that finishes after the cycle reached streaming', async () => {
			await failCycles(3);
			synchronizer.applySnapshot.mockClear();

			const stale = deferred<void>();

			client.listSensors.mockImplementationOnce(async () => {
				await stale.promise;

				return sensors.map((item) => ({ id: item.id, raw: item }));
			});

			await jest.advanceTimersByTimeAsync(5000);

			expect(client.listSensors).toHaveBeenCalled();

			openError = null;
			await jest.advanceTimersByTimeAsync(7000);
			await service.settle();
			synchronizer.applySnapshot.mockClear();
			push('events', frameText());
			stale.resolve();
			await jest.advanceTimersByTimeAsync(0);

			expect(service.getState()).toBe('streaming');
			expect(synchronizer.applySnapshot).not.toHaveBeenCalled();
		});

		it('counts a streaming session that ends within 30 s as a failure', async () => {
			await connect();
			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));
			await jest.advanceTimersByTimeAsync(1000);
			await service.settle();
			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));

			expect(service.getState()).toBe('connecting');
			expect(opens('devices')).toBe(2);

			await jest.advanceTimersByTimeAsync(1999);

			expect(opens('devices')).toBe(2);

			await jest.advanceTimersByTimeAsync(1);
			await service.settle();

			expect(opens('devices')).toBe(3);

			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));

			expect(service.getState()).toBe('polling');
			expect(notifications.notify).toHaveBeenCalledTimes(1);
		});

		it('restarts from attempt 0 after a session that streamed for 30 s', async () => {
			await connect();
			await jest.advanceTimersByTimeAsync(30_000);
			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));
			await jest.advanceTimersByTimeAsync(1000);
			await service.settle();
			await jest.advanceTimersByTimeAsync(30_000);
			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));
			await jest.advanceTimersByTimeAsync(1000);
			await service.settle();

			expect(service.getState()).toBe('streaming');
			expect(notifications.notify).not.toHaveBeenCalled();
		});

		it('fails the cycle when the queue is full while draining the buffer', async () => {
			listGate.lights = deferred<void>();
			listener?.(session(), null);
			await jest.advanceTimersByTimeAsync(0);
			push('events', frameText());
			synchronizer.enqueueFrame.mockReturnValueOnce(false);
			listGate.lights.resolve();
			await service.settle();

			expect(
				logged.some((line) => line.includes('UniFi Protect realtime cycle failed (protocol); retry in 1000 ms')),
			).toBe(true);

			await jest.advanceTimersByTimeAsync(1000);
			await service.settle();
			synchronizer.enqueueFrame.mockReturnValueOnce(false);
			push('events', frameText());
			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));
			await jest.advanceTimersByTimeAsync(2000);
			await service.settle();
			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));

			expect(service.getState()).toBe('polling');
		});

		it('decorates the status with the degraded state and the realtime fields', async () => {
			const status = (state: string): any => ({ connectionState: state });

			expect(service.decorateStatus(status('connected'))).toMatchObject({
				connectionState: 'connected',
				realtimeState: 'stopped',
				ignoredEventCount: 2,
			});

			await failCycles(3);

			expect(service.decorateStatus(status('connected'))).toMatchObject({
				connectionState: 'degraded',
				realtimeState: 'polling',
			});
			expect(service.decorateStatus(status('disconnected')).connectionState).toBe('disconnected');
		});
	});

	it('exposes frozen defaults of 180 s, 30 s and three failures', () => {
		expect(PROTECT_DEFAULT_REALTIME_TIMINGS).toMatchObject({
			pingIntervalMs: 180_000,
			pongTimeoutMs: 30_000,
			degradedAfterFailures: 3,
		});
		expect(PROTECT_DEFAULT_REALTIME_TIMINGS.reconnectDelay(0)).toBeGreaterThanOrEqual(800);
	});

	describe('with the real synchronizer', () => {
		const DOORBELL_PANEL = '33333333-3333-4333-8333-333333333333';
		let real: ProtectSynchronizerService;
		let occurrences: { publishOccurrence: jest.Mock };

		beforeEach(() => {
			const stored = new Map<string, unknown>();
			const device = {
				id: DOORBELL_PANEL,
				type: DEVICES_UNIFI_PROTECT_TYPE,
				enabled: true,
				name: goldenDoorbell.name,
				identifier: goldenDoorbell.identifier,
				protectNvrId: goldenDoorbell.protectNvrId,
				protectDeviceId: goldenDoorbell.protectDeviceId,
				protectModelKey: goldenDoorbell.protectModelKey,
				channels: goldenDoorbell.channels.map((channel: Raw) => ({
					id: `${DOORBELL_PANEL}|${channel.identifier}`,
					identifier: channel.identifier,
					properties: channel.properties.map((property: Raw) => {
						const id = `${DOORBELL_PANEL}|${channel.identifier}|${property.mappingName}`;

						stored.set(id, property.value);

						return {
							id,
							identifier: property.identifier,
							type: DEVICES_UNIFI_PROTECT_TYPE,
							protectMappingName: property.mappingName,
						};
					}),
				})),
			};
			const loader = new ProtectMappingLoaderService();

			loader.onModuleInit();
			occurrences = { publishOccurrence: jest.fn(() => Promise.resolve({})) };
			real = new ProtectSynchronizerService(
				loader,
				{ findAll: jest.fn(() => Promise.resolve([device])), update: jest.fn(() => Promise.resolve({})) } as never,
				{ update: jest.fn(() => Promise.resolve({})) } as never,
				{ trySetConnectionState: jest.fn(() => Promise.resolve(true)) } as never,
				{
					readLatestPersisted: jest.fn((property: Raw) => Promise.resolve({ value: stored.get(property.id) ?? null })),
				} as never,
				{ notify: jest.fn(() => Promise.resolve(null)), resolve: jest.fn(() => Promise.resolve(true)) } as never,
				occurrences as never,
			);
			service.onModuleDestroy();
			service = build(real);
			client.listCameras.mockImplementation(() =>
				Promise.resolve(doorbells.map((item) => ({ id: item.id, raw: item }))),
			);
			client.listSensors.mockImplementation(() => Promise.resolve([]));
			client.listLights.mockImplementation(() => Promise.resolve([]));
		});

		afterEach(() => {
			real.reset();
		});

		it('re-primes after a drop and does not replay a ring', async () => {
			await connect();
			push('events', ringLine.replace('"_synthetic":true,', ''));
			await real.idle();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);

			sub('events').handlers.closed(failure(ProtectErrorCategory.UNREACHABLE));
			await jest.advanceTimersByTimeAsync(1000);
			await service.settle();
			push('events', ringLine.replace('"_synthetic":true,', ''));
			await real.idle();

			expect(opens('events')).toBe(2);
			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
		});
	});
});
