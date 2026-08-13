import { HomeyConnector } from '../../src/plugins/devices-homey/connectors/homey-connector.interface';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../../src/plugins/devices-homey/errors/homey-connector.error';
import { HomeyCapabilityValue } from '../../src/plugins/devices-homey/models/homey-capability.model';
import { HomeyDevice } from '../../src/plugins/devices-homey/models/homey-device.model';
import { HomeyEvent } from '../../src/plugins/devices-homey/models/homey-event.model';
import { HomeySystemInfo } from '../../src/plugins/devices-homey/models/homey-system-info.model';
import { HomeyZone } from '../../src/plugins/devices-homey/models/homey-zone.model';

export interface HomeyConnectorContractFixtures {
	systemInfo: HomeySystemInfo;
	zones: readonly HomeyZone[];
	devices: readonly HomeyDevice[];
	events: readonly HomeyEvent[];
	writeTarget: {
		deviceId: string;
		capabilityId: string;
	};
}

export interface HomeyConnectorContractWrite {
	deviceId: string;
	capabilityId: string;
	value: unknown;
}

export interface HomeyConnectorContractHarness {
	connector: HomeyConnector;
	fixtures: HomeyConnectorContractFixtures;
	emit(event: HomeyEvent): Promise<void>;
	failNext(operation: HomeyConnectorOperation, category: HomeyConnectorErrorCategory): void;
	readonly writes: readonly HomeyConnectorContractWrite[];
	readonly subscriberCount: number;
	readonly connectCount: number;
	readonly disconnectCount: number;
	dispose(): Promise<void>;
}

type HomeyConnectorContractHarnessFactory = () =>
	| HomeyConnectorContractHarness
	| Promise<HomeyConnectorContractHarness>;

function invokeConnectorOperation(
	harness: HomeyConnectorContractHarness,
	operation: HomeyConnectorOperation,
): Promise<unknown> {
	switch (operation) {
		case HomeyConnectorOperation.CONNECT:
			return harness.connector.connect();
		case HomeyConnectorOperation.DISCONNECT:
			return harness.connector.disconnect();
		case HomeyConnectorOperation.GET_SYSTEM_INFO:
			return harness.connector.getSystemInfo();
		case HomeyConnectorOperation.GET_ZONES:
			return harness.connector.getZones();
		case HomeyConnectorOperation.GET_DEVICES:
			return harness.connector.getDevices();
		case HomeyConnectorOperation.GET_DEVICE:
			return harness.connector.getDevice(harness.fixtures.writeTarget.deviceId);
		case HomeyConnectorOperation.SET_CAPABILITY_VALUE:
			return harness.connector.setCapabilityValue(
				harness.fixtures.writeTarget.deviceId,
				harness.fixtures.writeTarget.capabilityId,
				true,
			);
		case HomeyConnectorOperation.SUBSCRIBE:
			return harness.connector.subscribe(() => undefined);
	}
}

export function describeHomeyConnectorContract(
	label: string,
	createHarness: HomeyConnectorContractHarnessFactory,
): void {
	describe(`${label} Homey connector contract`, () => {
		let harness: HomeyConnectorContractHarness;

		beforeEach(async () => {
			harness = await createHarness();
		});

		afterEach(async () => {
			await harness.dispose();
		});

		it('normalizes unavailable errors while disconnected and disconnects idempotently', async () => {
			await expect(harness.connector.disconnect()).resolves.toBeUndefined();
			await expect(harness.connector.disconnect()).resolves.toBeUndefined();

			const operations = [
				() => harness.connector.getSystemInfo(),
				() => harness.connector.getZones(),
				() => harness.connector.getDevices(),
				() => harness.connector.getDevice(harness.fixtures.writeTarget.deviceId),
				() =>
					harness.connector.setCapabilityValue(
						harness.fixtures.writeTarget.deviceId,
						harness.fixtures.writeTarget.capabilityId,
						true,
					),
				() => harness.connector.subscribe(() => undefined),
			];

			for (const operation of operations) {
				await expect(operation()).rejects.toMatchObject({
					name: 'HomeyConnectorError',
					category: HomeyConnectorErrorCategory.UNAVAILABLE,
					retryable: true,
				});
			}
		});

		it('connects idempotently and returns normalized inventory in source order', async () => {
			await Promise.all([harness.connector.connect(), harness.connector.connect()]);
			expect(harness.connectCount).toBe(1);

			await expect(harness.connector.getSystemInfo()).resolves.toStrictEqual(harness.fixtures.systemInfo);
			await expect(harness.connector.getZones()).resolves.toStrictEqual(harness.fixtures.zones);
			await expect(harness.connector.getDevices()).resolves.toStrictEqual(harness.fixtures.devices);
			await expect(harness.connector.getDevice(harness.fixtures.devices[0].id)).resolves.toStrictEqual(
				harness.fixtures.devices[0],
			);
			await expect(harness.connector.getDevice('missing-device')).resolves.toBeNull();
		});

		it('returns detached inventory snapshots', async () => {
			await harness.connector.connect();
			const devices = await harness.connector.getDevices();

			expect(devices).not.toBe(harness.fixtures.devices);
			expect(devices[0]).not.toBe(harness.fixtures.devices[0]);
			expect(devices[0].capabilities[0]).not.toBe(harness.fixtures.devices[0].capabilities[0]);
			expect(Object.prototype.toString.call(devices[0])).toBe('[object Object]');
		});

		it.each<HomeyCapabilityValue>([false, 0, '', null])(
			'preserves full capability IDs and the value %p',
			async (value) => {
				await harness.connector.connect();

				await harness.connector.setCapabilityValue(
					harness.fixtures.writeTarget.deviceId,
					harness.fixtures.writeTarget.capabilityId,
					value,
				);

				expect(harness.writes).toStrictEqual([
					{
						deviceId: harness.fixtures.writeTarget.deviceId,
						capabilityId: harness.fixtures.writeTarget.capabilityId,
						value,
					},
				]);
			},
		);

		it('delivers events once and in order to independent subscribers', async () => {
			await harness.connector.connect();

			const firstEvents: HomeyEvent[] = [];
			const secondEvents: HomeyEvent[] = [];
			const unsubscribeFirst = await harness.connector.subscribe((event) => {
				firstEvents.push(event);
			});
			const unsubscribeSecond = await harness.connector.subscribe((event) => {
				secondEvents.push(event);
			});

			for (const event of harness.fixtures.events) {
				await harness.emit(event);
			}

			expect(firstEvents).toStrictEqual(harness.fixtures.events);
			expect(secondEvents).toStrictEqual(harness.fixtures.events);
			expect(harness.subscriberCount).toBe(2);

			await unsubscribeFirst();
			await unsubscribeFirst();
			await harness.emit(harness.fixtures.events[0]);

			expect(firstEvents).toStrictEqual(harness.fixtures.events);
			expect(secondEvents).toStrictEqual([...harness.fixtures.events, harness.fixtures.events[0]]);
			expect(harness.subscriberCount).toBe(1);

			await unsubscribeSecond();
		});

		it('isolates listener failures from independent subscribers', async () => {
			await harness.connector.connect();
			const events: HomeyEvent[] = [];
			await harness.connector.subscribe(() => {
				throw new Error('consumer failed');
			});
			await harness.connector.subscribe((event) => {
				events.push(event);
			});

			await expect(harness.emit(harness.fixtures.events[0])).resolves.toBeUndefined();
			expect(events).toStrictEqual([harness.fixtures.events[0]]);
		});

		it('drops subscriptions during disconnect and keeps cleanup callbacks safe', async () => {
			await harness.connector.connect();
			const listener = jest.fn();
			const unsubscribe = await harness.connector.subscribe(listener);

			await harness.connector.disconnect();
			await harness.connector.disconnect();
			await unsubscribe();
			await unsubscribe();
			await harness.emit(harness.fixtures.events[0]);

			expect(harness.subscriberCount).toBe(0);
			expect(harness.disconnectCount).toBe(1);
			expect(listener).not.toHaveBeenCalled();
		});

		it('cleans local resources when transport disconnect fails', async () => {
			await harness.connector.connect();
			const listener = jest.fn();
			await harness.connector.subscribe(listener);
			harness.failNext(HomeyConnectorOperation.DISCONNECT, HomeyConnectorErrorCategory.UNAVAILABLE);

			await expect(harness.connector.disconnect()).rejects.toStrictEqual(
				new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.DISCONNECT),
			);
			await harness.emit(harness.fixtures.events[0]);

			expect(harness.subscriberCount).toBe(0);
			expect(listener).not.toHaveBeenCalled();
			await expect(harness.connector.getDevices()).rejects.toMatchObject({
				category: HomeyConnectorErrorCategory.UNAVAILABLE,
			});
		});

		it('consumes a normalized transport failure exactly once', async () => {
			harness.failNext(HomeyConnectorOperation.CONNECT, HomeyConnectorErrorCategory.AUTHENTICATION);

			await expect(harness.connector.connect()).rejects.toBeInstanceOf(HomeyConnectorError);
			await expect(harness.connector.connect()).resolves.toBeUndefined();
		});

		it.each(
			Object.values(HomeyConnectorOperation).filter((operation) => operation !== HomeyConnectorOperation.DISCONNECT),
		)('exposes a normalized error for the %s operation', async (operation) => {
			if (operation !== HomeyConnectorOperation.CONNECT) {
				await harness.connector.connect();
			}

			harness.failNext(operation, HomeyConnectorErrorCategory.PROTOCOL);

			await expect(invokeConnectorOperation(harness, operation)).rejects.toStrictEqual(
				new HomeyConnectorError(HomeyConnectorErrorCategory.PROTOCOL, operation),
			);
		});
	});
}
