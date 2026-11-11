import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConnectionState, EventType as DevicesEventType } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyProducerQuality, PropertyValueState } from '../../devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { PropertyValueService } from '../../devices/services/property-value.service';
import { FakeTrackerClock } from '../testing/fake-tracker-clock';
import { StateFireData, StateWatchSpecError } from '../tracker/state-tracker';

import { AUTOMATION_TRACKER_CLOCK, AutomationStateTrackerService, toStateSnapshot } from './state-tracker.service';

type Value = string | number | boolean | null;

interface FakeProperty {
	id: string;
	deviceId: string;
	value: Value;
}

const flush = async (): Promise<void> => {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
};

describe('AutomationStateTrackerService', () => {
	let module: TestingModule;
	let service: AutomationStateTrackerService;
	let emitter: EventEmitter2;
	let clock: FakeTrackerClock;
	let fired: StateFireData[];

	let properties: Map<string, FakeProperty>;
	let connections: Map<string, ConnectionState>;
	let findOne: jest.Mock;
	let readLatest: jest.Mock;
	let readConnection: jest.Mock;

	const fire = (data: StateFireData): void => {
		fired.push(data);
	};

	const entity = (id: string, value: Value, quality?: PropertyProducerQuality): ChannelPropertyEntity => {
		const state = new PropertyValueState(value);

		if (quality) {
			state.producer = {
				quality,
				reasons: [],
				sampledAt: null,
				evaluatedAt: '2026-11-11T00:00:00.000Z',
				expiresAt: null,
				revision: 1,
			};
		}

		return { id, value: state } as ChannelPropertyEntity;
	};

	const addProperty = (id: string, value: Value, deviceId = `device-of-${id}`): void => {
		properties.set(id, { id, deviceId, value });
	};

	const valueSet = (id: string, value: Value): boolean =>
		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET, entity(id, value));

	const connectionChanged = (deviceId: string, state: ConnectionState): boolean =>
		emitter.emit(DevicesEventType.DEVICE_CONNECTION_CHANGED, { device: { id: deviceId }, state });

	beforeEach(async () => {
		clock = new FakeTrackerClock();
		fired = [];
		properties = new Map();
		connections = new Map();

		findOne = jest.fn((id: string) => {
			const property = properties.get(id);

			return Promise.resolve(
				property
					? ({ id, channel: { id: `channel-of-${id}`, device: { id: property.deviceId } } } as ChannelPropertyEntity)
					: null,
			);
		});
		readLatest = jest.fn((property: ChannelPropertyEntity) => {
			const known = properties.get(property.id);

			return Promise.resolve(known ? new PropertyValueState(known.value) : null);
		});
		readConnection = jest.fn((device: { id: string }) => {
			const status = connections.get(device.id) ?? ConnectionState.UNKNOWN;

			return Promise.resolve({ online: status === ConnectionState.CONNECTED, status, lastChanged: null });
		});

		module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [
				AutomationStateTrackerService,
				{ provide: ChannelsPropertiesService, useValue: { findOne } },
				{ provide: PropertyValueService, useValue: { readLatest } },
				{ provide: DeviceConnectionStateService, useValue: { readLatest: readConnection } },
				{ provide: AUTOMATION_TRACKER_CLOCK, useValue: clock },
			],
		}).compile();

		await module.init();

		service = module.get(AutomationStateTrackerService);
		emitter = module.get(EventEmitter2);
	});

	afterEach(async () => {
		await module.close();
	});

	it('holds exactly one listener per device event, whatever the number of watches', async () => {
		for (let i = 0; i < 40; i++) {
			service.watch({ propertyId: `p${i}`, to: true }, fire);
		}

		await service.settled();

		expect(emitter.listenerCount(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)).toBe(1);
		expect(emitter.listenerCount(DevicesEventType.CHANNEL_PROPERTY_UPDATED)).toBe(1);
		expect(emitter.listenerCount(DevicesEventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED)).toBe(1);
		expect(emitter.listenerCount(DevicesEventType.DEVICE_CONNECTION_CHANGED)).toBe(1);
		expect(service.trackedCount()).toBe(40);
	});

	it('reads the baseline when a property is first referenced, once, and does not fire for it', async () => {
		addProperty('occ', true);

		service.watch({ propertyId: 'occ', to: true }, fire);
		service.watch({ propertyId: 'occ', to: false }, fire);
		service.reference('occ');

		expect(service.read('occ')).toEqual({ status: 'unknown' });

		await service.settled();

		expect(findOne).toHaveBeenCalledTimes(1);
		expect(readLatest).toHaveBeenCalledTimes(1);
		expect(service.read('occ')).toEqual({ status: 'ok', value: true });
		expect(fired).toEqual([]);

		valueSet('occ', true); // same as the baseline

		expect(fired).toEqual([]);

		valueSet('occ', false);

		expect(fired).toEqual([{ propertyId: 'occ', from: true, to: false }]);
	});

	it('reads the baseline again when a property is referenced anew after it was released', async () => {
		addProperty('lux', 5);

		const release = service.reference('lux');

		await service.settled();
		release();

		expect(service.trackedCount()).toBe(0);

		properties.get('lux').value = 7;
		service.reference('lux');
		await service.settled();

		expect(findOne).toHaveBeenCalledTimes(2);
		expect(service.read('lux')).toEqual({ status: 'ok', value: 7 });
	});

	it('keeps values only for referenced properties', async () => {
		addProperty('occ', false);
		service.watch({ propertyId: 'occ', to: true }, fire);
		await service.settled();

		valueSet('other', true);

		expect(service.trackedCount()).toBe(1);
		expect(service.read('other')).toEqual({ status: 'unknown' });
	});

	it('routes a value-set event to the watches of that property only', async () => {
		addProperty('a', false);
		addProperty('b', false);

		const a: StateFireData[] = [];
		const b: StateFireData[] = [];

		service.watch({ propertyId: 'a', to: true }, (data) => a.push(data));
		service.watch({ propertyId: 'b', to: true }, (data) => b.push(data));
		await service.settled();

		valueSet('a', true);

		expect(a).toHaveLength(1);
		expect(b).toEqual([]);
	});

	it('picks up a value change delivered on the property-updated event', async () => {
		addProperty('occ', false);
		service.watch({ propertyId: 'occ', to: true }, fire);
		await service.settled();

		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_UPDATED, entity('occ', true));

		expect(fired).toHaveLength(1);
		expect(service.read('occ')).toEqual({ status: 'ok', value: true });

		valueSet('occ', true); // the follow-up plain report must not fire again
		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_UPDATED, entity('occ', true)); // metadata only

		expect(fired).toHaveLength(1);
	});

	it('takes value and quality from the value-state-changed event', async () => {
		addProperty('occ', true);
		service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
		await service.settled();

		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, entity('occ', false, 'good'));

		expect(service.pendingTimers()).toBe(1);

		clock.advanceSeconds(60);
		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, entity('occ', false, 'unavailable'));

		expect(service.pendingTimers()).toBe(0);
		expect(service.read('occ')).toEqual({ status: 'invalid', value: false });

		clock.advanceSeconds(600);

		expect(fired).toEqual([]);

		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, entity('occ', false, 'degraded'));
		clock.advanceSeconds(120);

		expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000 }]);
	});

	it('treats a report without a value as invalid', async () => {
		addProperty('occ', true);
		service.watch({ propertyId: 'occ', to: false }, fire);
		await service.settled();

		valueSet('occ', null);

		expect(service.read('occ')).toEqual({ status: 'invalid', value: null });

		valueSet('occ', true);

		expect(fired).toEqual([]);
	});

	it('keeps the tracked value when a property-updated event carries no value state', async () => {
		addProperty('occ', true, 'sensor');
		service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
		await service.settled();

		valueSet('occ', false);
		clock.advanceSeconds(60);

		// A metadata update whose value was not read back
		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_UPDATED, { id: 'occ', value: null } as ChannelPropertyEntity);

		expect(service.read('occ')).toEqual({ status: 'ok', value: false });
		expect(service.pendingTimers()).toBe(1);

		clock.advanceSeconds(60);

		expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000 }]);
	});

	it('still invalidates the value when a property-updated event carries a state without a value', async () => {
		addProperty('occ', true);
		service.watch({ propertyId: 'occ', to: false }, fire);
		await service.settled();

		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_UPDATED, entity('occ', null));

		expect(service.read('occ')).toEqual({ status: 'invalid', value: null });
	});

	it('learns the device from a property event when the baseline read failed', async () => {
		findOne.mockRejectedValueOnce(new Error('database is gone'));

		service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
		await service.settled();

		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET, {
			...entity('occ', true),
			channel: { id: 'channel', device: { id: 'sensor' } },
		} as ChannelPropertyEntity);
		emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET, {
			...entity('occ', false),
			channel: { id: 'channel', device: 'sensor' },
		} as ChannelPropertyEntity);

		expect(service.pendingTimers()).toBe(1);

		connectionChanged('sensor', ConnectionState.DISCONNECTED);

		expect(service.pendingTimers()).toBe(0);
		expect(service.read('occ')).toEqual({ status: 'offline', value: false });
	});

	it('cancels a "for" duration when the device goes offline and restarts it only on a fresh report', async () => {
		addProperty('occ', true, 'sensor');
		connections.set('sensor', ConnectionState.CONNECTED);
		service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
		await service.settled();

		valueSet('occ', false);
		clock.advanceSeconds(60);

		expect(service.pendingTimers()).toBe(1);

		connectionChanged('sensor', ConnectionState.DISCONNECTED);

		expect(service.pendingTimers()).toBe(0);
		expect(service.read('occ')).toEqual({ status: 'offline', value: false });

		clock.advanceSeconds(600);
		connectionChanged('sensor', ConnectionState.CONNECTED);
		clock.advanceSeconds(600);

		expect(fired).toEqual([]); // the sensor is back, but it has not reported yet

		valueSet('occ', false);
		clock.advanceSeconds(120);

		expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000 }]);
	});

	it('routes a connection change to the tracked properties of that device only', async () => {
		addProperty('a', 1, 'one');
		addProperty('b', 1, 'one');
		addProperty('c', 1, 'two');
		service.reference('a');
		service.reference('b');
		service.reference('c');
		await service.settled();

		connectionChanged('one', ConnectionState.LOST);
		connectionChanged('nobody', ConnectionState.LOST);

		expect(service.read('a').status).toBe('offline');
		expect(service.read('b').status).toBe('offline');
		expect(service.read('c').status).toBe('ok');
	});

	it('lets a connection change seen while the baseline is being read win over the status that was read', async () => {
		addProperty('a', 1, 'one');

		let resolveStatus: (status: ConnectionState) => void = () => undefined;

		readConnection.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveStatus = (status) =>
						resolve({ online: status === ConnectionState.CONNECTED, status, lastChanged: null });
				}),
		);

		service.reference('a');
		await flush(); // the property is loaded, its connection status is being read

		connectionChanged('one', ConnectionState.LOST);
		resolveStatus(ConnectionState.CONNECTED); // what the read saw before the change
		await service.settled();

		expect(service.read('a')).toEqual({ status: 'offline', value: 1 });
	});

	it('stops routing connection changes to a property that was released', async () => {
		addProperty('a', 1, 'one');

		const release = service.reference('a');

		await service.settled();
		release();

		service.reference('a');
		await service.settled();

		connectionChanged('one', ConnectionState.LOST);

		expect(service.read('a').status).toBe('offline'); // routed once, to the new reference

		connectionChanged('one', ConnectionState.CONNECTED);
		service.reference('b');
		await service.settled();

		expect(service.trackedCount()).toBe(2);
	});

	describe('startup and baseline', () => {
		it('starts a "for" duration from the baseline when the state already holds, marked as re-armed', async () => {
			addProperty('occ', false);
			service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);

			expect(service.pendingTimers()).toBe(0);

			await service.settled();

			expect(fired).toEqual([]);
			expect(service.pendingTimers()).toBe(1);

			clock.advanceSeconds(120);

			expect(fired).toEqual([{ propertyId: 'occ', to: false, heldForMs: 120_000, rearmed: true }]);
		});

		it('does not start a duration on the last known value of a device that is offline', async () => {
			addProperty('occ', false, 'sensor');
			connections.set('sensor', ConnectionState.DISCONNECTED);
			service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
			await service.settled();

			expect(service.read('occ')).toEqual({ status: 'offline', value: false });
			expect(service.pendingTimers()).toBe(0);
		});

		it('treats a device that never reported its connection as reachable', async () => {
			addProperty('occ', false, 'sensor');
			service.reference('occ');
			await service.settled();

			expect(service.read('occ')).toEqual({ status: 'ok', value: false });

			connectionChanged('sensor', ConnectionState.UNKNOWN);

			expect(service.read('occ').status).toBe('ok');
		});

		it('does not let the baseline replace a report that arrived while it was being read', async () => {
			addProperty('occ', false);
			service.watch({ propertyId: 'occ', to: true }, fire);

			valueSet('occ', true); // first report: no transition
			await service.settled();

			expect(service.read('occ')).toEqual({ status: 'ok', value: true });
			expect(fired).toEqual([]);
		});

		it('leaves a property without a stored value invalid, and its first value is not a transition', async () => {
			addProperty('occ', null);
			service.watch({ propertyId: 'occ', to: true }, fire);
			await service.settled();

			expect(service.read('occ')).toEqual({ status: 'invalid', value: null });

			valueSet('occ', true);

			expect(fired).toEqual([]);
		});

		it('leaves a property that does not exist unknown', async () => {
			service.watch({ propertyId: 'gone', to: true }, fire);
			await service.settled();

			expect(readLatest).not.toHaveBeenCalled();
			expect(service.read('gone')).toEqual({ status: 'unknown' });
		});

		it('survives a failing baseline read', async () => {
			findOne.mockRejectedValueOnce(new Error('database is gone'));

			service.watch({ propertyId: 'occ', to: true }, fire);
			await service.settled();

			valueSet('occ', false);
			valueSet('occ', true);

			expect(fired).toHaveLength(1);
		});

		it('drops a baseline that arrives after the property was released', async () => {
			addProperty('occ', false);

			const unwatch = service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);

			unwatch();
			await service.settled();

			expect(service.trackedCount()).toBe(0);
			expect(service.pendingTimers()).toBe(0);

			connectionChanged('device-of-occ', ConnectionState.LOST); // must not bring anything back

			expect(service.trackedCount()).toBe(0);
		});
	});

	it('never lets a failing watch reach the service that emitted the event', async () => {
		addProperty('occ', false);
		service.watch({ propertyId: 'occ', to: true }, () => {
			throw new Error('boom');
		});
		service.watch({ propertyId: 'occ', to: true }, fire);
		await service.settled();

		expect(() => valueSet('occ', true)).not.toThrow();
		expect(fired).toHaveLength(1);
	});

	it('ignores malformed event payloads', async () => {
		addProperty('occ', false);
		service.watch({ propertyId: 'occ', to: true }, fire);
		await service.settled();

		expect(() => {
			emitter.emit(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET, null);
			emitter.emit(DevicesEventType.CHANNEL_PROPERTY_UPDATED, {});
			emitter.emit(DevicesEventType.DEVICE_CONNECTION_CHANGED, null);
			emitter.emit(DevicesEventType.DEVICE_CONNECTION_CHANGED, {});
		}).not.toThrow();

		await flush();

		expect(fired).toEqual([]);
	});

	it('refuses a watch whose spec is not valid', () => {
		expect(() => service.watch({ propertyId: 'occ', forSeconds: 60 }, fire)).toThrow(StateWatchSpecError);
		expect(service.trackedCount()).toBe(0);
		expect(findOne).not.toHaveBeenCalled();
	});

	it('cancels every running duration when the module is destroyed', async () => {
		addProperty('occ', false);
		service.watch({ propertyId: 'occ', to: false, forSeconds: 120 }, fire);
		await service.settled();

		expect(clock.pending()).toBe(1);

		await module.close();

		expect(clock.pending()).toBe(0);

		clock.advanceSeconds(600);

		expect(fired).toEqual([]);
	});

	it('runs on the real monotonic clock when none is injected', async () => {
		jest.useFakeTimers();

		try {
			const real = new AutomationStateTrackerService(
				{ findOne } as unknown as ChannelsPropertiesService,
				{ readLatest } as unknown as PropertyValueService,
				{ readLatest: readConnection } as unknown as DeviceConnectionStateService,
			);

			real.watch({ propertyId: 'occ', to: false, forSeconds: 2 }, fire);
			real.handlePropertyValueSet(entity('occ', true));
			real.handlePropertyValueSet(entity('occ', false));

			await jest.advanceTimersByTimeAsync(1_999);

			expect(fired).toEqual([]);

			await jest.advanceTimersByTimeAsync(1);

			expect(fired).toHaveLength(1);
			expect(fired[0].heldForMs).toBe(2_000);

			real.onModuleDestroy();
		} finally {
			jest.useRealTimers();
		}
	});

	describe('toStateSnapshot', () => {
		it('marks a missing value and an unavailable derived value as invalid', () => {
			expect(toStateSnapshot(null)).toEqual({ value: null, valid: false });
			expect(toStateSnapshot(undefined)).toEqual({ value: null, valid: false });
			expect(toStateSnapshot(new PropertyValueState(null))).toEqual({ value: null, valid: false });
			expect(toStateSnapshot(new PropertyValueState(false))).toEqual({ value: false, valid: true });
			expect(toStateSnapshot(entity('p', 5, 'unavailable').value)).toEqual({ value: 5, valid: false });
			expect(toStateSnapshot(entity('p', 5, 'degraded').value)).toEqual({ value: 5, valid: true });
		});
	});
});
