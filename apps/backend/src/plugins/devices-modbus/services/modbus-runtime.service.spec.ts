import { Repository } from 'typeorm';

import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_MODBUS_TYPE,
	ModbusBindingRole,
	ModbusByteOrder,
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
} from '../devices-modbus.constants';
import { UpdateModbusChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { ModbusConnectionError, ModbusEndpointUnavailableError, ModbusTimeoutError } from '../lib/errors';
import { EndpointConnection } from '../runtime/endpoint-connection';
import { ModbusReadRequest } from '../transport/modbus-transport';

import { ModbusBindingsService } from './modbus-bindings.service';
import { ModbusConnectionsService } from './modbus-connections.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';
import { ModbusRuntimeService } from './modbus-runtime.service';

interface PendingRead {
	request: ModbusReadRequest;
	resolve: (values: number[]) => void;
	reject: (error: Error) => void;
}

/** Answers every read with `value` per register unless `hold` is set, in which case reads stay pending. */
class FakeConnection {
	readonly pending: PendingRead[] = [];
	hold = false;
	value = 1;
	stopped = false;
	/** Number of upcoming reads that time out. */
	failures = 0;

	start = jest.fn();
	markOverloaded = jest.fn();
	getHealth = jest.fn(() => ({ state: 'connected' }));
	read = jest.fn((request: ModbusReadRequest): Promise<number[]> => {
		if (this.stopped) {
			return Promise.reject(new ModbusEndpointUnavailableError());
		}

		if (this.failures > 0) {
			this.failures--;

			return Promise.reject(new ModbusTimeoutError());
		}

		if (!this.hold) {
			return Promise.resolve(Array<number>(request.count).fill(this.value));
		}

		return new Promise<number[]>((resolve, reject) => this.pending.push({ request, resolve, reject }));
	});
	stop = jest.fn(() => {
		this.stopped = true;

		for (const entry of this.pending.splice(0)) {
			entry.reject(new ModbusConnectionError('Modbus endpoint connection stopped'));
		}

		return Promise.resolve();
	});

	constructor(readonly endpoint: ModbusEndpointEntity) {}
}

const endpointEntity = (id: string, overrides: Partial<ModbusEndpointEntity> = {}): ModbusEndpointEntity =>
	Object.assign(new ModbusEndpointEntity(), {
		id,
		name: id,
		host: '10.0.0.1',
		port: 502,
		framing: ModbusFraming.TCP,
		connectTimeoutMs: 2000,
		requestTimeoutMs: 1000,
		interRequestDelayMs: 0,
		maxInFlight: 1,
		enabled: true,
		...overrides,
	});

const deviceEntity = (id: string, overrides: Partial<ModbusDeviceEntity> = {}): ModbusDeviceEntity =>
	Object.assign(new ModbusDeviceEntity(), {
		id,
		name: id,
		enabled: true,
		modbusEndpointId: 'endpoint-a',
		modbusUnitId: 1,
		modbusPollIntervalMs: 1000,
		modbusByteOrder: ModbusByteOrder.BIG,
		modbusWordOrder: ModbusByteOrder.BIG,
		modbusMaxReadRegisters: 125,
		modbusMaxReadBits: 2000,
		modbusMaxReadGap: 0,
		...overrides,
	});

const bindingEntity = (
	deviceId: string,
	propertyId: string,
	overrides: Partial<ModbusBindingEntity> = {},
): ModbusBindingEntity =>
	({
		id: `binding-${propertyId}-${overrides.role ?? ModbusBindingRole.READ}`,
		deviceId,
		propertyId,
		role: ModbusBindingRole.READ,
		registerType: ModbusRegisterType.HOLDING_REGISTER,
		address: 0,
		dataType: ModbusDataType.UINT16,
		bit: null,
		byteOrder: null,
		wordOrder: null,
		scale: 1,
		offset: 0,
		invert: false,
		valueMap: null,
		writeFunction: null,
		pollIntervalMs: null,
		...overrides,
	}) as ModbusBindingEntity;

describe('ModbusRuntimeService', () => {
	let endpoints: ModbusEndpointEntity[];
	let devices: ModbusDeviceEntity[];
	let bindings: ModbusBindingEntity[];
	let connections: FakeConnection[];
	let properties: { reportSample: jest.Mock };
	let connectivity: { setConnectionState: jest.Mock };
	let bindingsService: { findByDevice: jest.Mock };
	let devicesService: { findOne: jest.Mock; findAll: jest.Mock };
	let connectionsService: ModbusConnectionsService;
	let runtime: ModbusRuntimeService;

	const connectionFor = (endpointId: string): FakeConnection[] =>
		connections.filter((connection) => connection.endpoint.id === endpointId);

	const states = (deviceId: string): ConnectionState[] =>
		connectivity.setConnectionState.mock.calls
			.filter(([id]) => id === deviceId)
			.map(([, state]) => (state as { state: ConnectionState }).state);

	const reports = (): Array<[string, unknown]> =>
		properties.reportSample.mock.calls.map(([id, dto]) => [
			id as string,
			(dto as UpdateModbusChannelPropertyDto).value,
		]);

	beforeEach(() => {
		jest.useFakeTimers();

		endpoints = [endpointEntity('endpoint-a')];
		devices = [deviceEntity('device-1')];
		bindings = [bindingEntity('device-1', 'p1')];
		connections = [];

		properties = { reportSample: jest.fn(() => Promise.resolve({})) };
		connectivity = { setConnectionState: jest.fn(() => Promise.resolve()) };

		const endpointsRepository = {
			find: jest.fn(() => Promise.resolve(endpoints.map((e) => Object.assign(new ModbusEndpointEntity(), e)))),
		};

		connectionsService = new ModbusConnectionsService(
			endpointsRepository as unknown as Repository<ModbusEndpointEntity>,
			(endpoint) => {
				const connection = new FakeConnection(endpoint);

				connections.push(connection);

				return connection as unknown as EndpointConnection;
			},
		);

		devicesService = {
			findOne: jest.fn((id: string) => Promise.resolve(devices.find((device) => device.id === id) ?? null)),
			findAll: jest.fn(() => Promise.resolve([...devices])),
		};
		bindingsService = {
			findByDevice: jest.fn((id: string) => Promise.resolve(bindings.filter((binding) => binding.deviceId === id))),
		};
		const endpointsService = {
			findOne: jest.fn((id: string) => Promise.resolve(endpoints.find((endpoint) => endpoint.id === id) ?? null)),
		};

		runtime = new ModbusRuntimeService(
			devicesService as unknown as DevicesService,
			bindingsService as unknown as ModbusBindingsService,
			endpointsService as unknown as ModbusEndpointsService,
			connectionsService,
			properties as unknown as ChannelsPropertiesService,
			connectivity as unknown as DeviceConnectivityService,
		);
	});

	afterEach(async () => {
		await runtime.stop();
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it('loads endpoints and devices on start and reports samples as live evidence', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		expect(runtime.getState()).toBe('started');
		expect(connections).toHaveLength(1);
		expect(connections[0].start).toHaveBeenCalledTimes(1);
		expect(states('device-1')).toEqual([ConnectionState.INIT, ConnectionState.CONNECTED]);
		expect(properties.reportSample).toHaveBeenCalledTimes(1);

		const [id, dto, evidence, options] = properties.reportSample.mock.calls[0] as [
			string,
			UpdateModbusChannelPropertyDto,
			{ sampledAt: Date; receivedAt: Date; observedAt: Date; provenance: string; isCurrent: () => boolean },
			{ skipUnchangedMetadata: boolean },
		];

		expect(id).toBe('p1');
		expect(dto).toBeInstanceOf(UpdateModbusChannelPropertyDto);
		expect(dto).toMatchObject({ type: DEVICES_MODBUS_TYPE, value: 1 });
		expect(evidence.provenance).toBe('live');
		expect(evidence.observedAt).toEqual(evidence.sampledAt);
		expect(evidence.receivedAt).toBeInstanceOf(Date);
		expect(evidence.isCurrent()).toBe(true);
		expect(options).toEqual({ skipUnchangedMetadata: true });
	});

	it('marks a device without read bindings as alert', async () => {
		bindings = [bindingEntity('device-1', 'p1', { role: ModbusBindingRole.WRITE })];

		await runtime.start();
		await jest.advanceTimersByTimeAsync(5000);

		expect(states('device-1')).toEqual([ConnectionState.ALERT]);
		expect(connectivity.setConnectionState.mock.calls[0]).toEqual([
			'device-1',
			{ state: ConnectionState.ALERT, reason: 'Device has no read bindings' },
		]);
		expect(connections[0].read).not.toHaveBeenCalled();
		expect(properties.reportSample).not.toHaveBeenCalled();
		// A write-only device can still be commanded
		expect(runtime.getConnection('device-1')).toBe(connections[0]);
	});

	it('marks a device whose endpoint is missing as alert and invalidates its read properties', async () => {
		devices = [deviceEntity('device-1', { modbusEndpointId: 'gone' })];

		await runtime.start();

		expect(states('device-1')).toEqual([ConnectionState.ALERT]);
		expect(reports()).toEqual([['p1', null]]);
		expect(runtime.getConnection('device-1')).toBeNull();
	});

	it('marks a device on a disabled endpoint as disconnected', async () => {
		endpoints = [endpointEntity('endpoint-a', { enabled: false })];

		await runtime.start();

		expect(connections).toHaveLength(0);
		expect(states('device-1')).toEqual([ConnectionState.DISCONNECTED]);
		expect(reports()).toEqual([['p1', null]]);
	});

	it('never reports properties without a read binding', async () => {
		// p-static stands for the device_information manufacturer/model/serial_number properties: no binding at all
		bindings = [
			bindingEntity('device-1', 'p1'),
			bindingEntity('device-1', 'p-write', { role: ModbusBindingRole.WRITE, address: 7 }),
		];

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		connections[0].read.mockRejectedValue(new ModbusConnectionError('down'));
		await jest.advanceTimersByTimeAsync(3000);

		expect(states('device-1')).toContain(ConnectionState.LOST);

		await runtime.stop();

		expect(new Set(reports().map(([id]) => id))).toEqual(new Set(['p1']));
	});

	it('loads a device idempotently', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		await Promise.all([
			runtime.loadDevice('device-1'),
			runtime.loadDevice('device-1'),
			runtime.onDeviceUpdated(devices[0]),
		]);

		// Exactly one poll timer is left: replaced pollers were stopped, not just orphaned
		expect(jest.getTimerCount()).toBe(1);

		connections[0].read.mockClear();
		await jest.advanceTimersByTimeAsync(3000);

		expect(connections[0].read).toHaveBeenCalledTimes(3);
	});

	it('does not resurrect a device deleted while it was loading', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		let release!: () => void;

		devicesService.findOne.mockImplementationOnce(
			(id: string) =>
				new Promise((resolve) => {
					release = () => resolve(devices.find((device) => device.id === id) ?? null);
				}),
		);

		const loading = runtime.loadDevice('device-1');

		await runtime.onDeviceDeleted(devices[0]);
		connectivity.setConnectionState.mockClear();
		connections[0].read.mockClear();

		release();
		await loading;
		await jest.advanceTimersByTimeAsync(3000);

		expect(connections[0].read).not.toHaveBeenCalled();
		expect(connectivity.setConnectionState).not.toHaveBeenCalled();
		expect(runtime.getConnection('device-1')).toBeNull();
	});

	it('keeps the newest load when an older one resolves last', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		let releaseOld!: () => void;

		devicesService.findOne.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					releaseOld = () => resolve(deviceEntity('device-1', { modbusUnitId: 9 }));
				}),
		);

		const older = runtime.loadDevice('device-1');
		const newer = runtime.loadDevice('device-1');

		await newer;
		releaseOld();
		await older;

		connections[0].read.mockClear();
		await jest.advanceTimersByTimeAsync(2000);

		expect(connections[0].read.mock.calls.map(([request]) => request.unitId)).toEqual([1, 1]);
	});

	it('loads a created device and ignores devices of other types', async () => {
		devices = [];
		await runtime.start();

		const other = Object.assign(new DeviceEntity(), { id: 'device-x' });
		const created = deviceEntity('device-2');

		devices.push(created);
		bindings.push(bindingEntity('device-2', 'p2'));

		await runtime.onDeviceCreated(other);
		await runtime.onDeviceCreated(created);
		await jest.advanceTimersByTimeAsync(0);

		expect(states('device-x')).toEqual([]);
		expect(states('device-2')).toEqual([ConnectionState.INIT, ConnectionState.CONNECTED]);
	});

	it('discards results after unload', async () => {
		await runtime.start();

		connections[0].hold = true;
		await jest.advanceTimersByTimeAsync(0);
		// The first poll already completed before `hold`; this one stays in flight
		await jest.advanceTimersByTimeAsync(1000);

		expect(connections[0].pending).toHaveLength(1);

		properties.reportSample.mockClear();
		connectivity.setConnectionState.mockClear();

		const deleted = devices[0];

		devices = [];
		await runtime.onDeviceDeleted(deleted);

		connections[0].pending[0].resolve([99]);
		await jest.advanceTimersByTimeAsync(5000);

		expect(properties.reportSample).not.toHaveBeenCalled();
		expect(connectivity.setConnectionState).not.toHaveBeenCalled();
		expect(runtime.getConnection('device-1')).toBeNull();
	});

	it('revokes the evidence of a report still in flight when the device is deleted', async () => {
		let settle!: () => void;

		properties.reportSample.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					settle = () => resolve({});
				}),
		);

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		const evidence = (properties.reportSample.mock.calls[0] as unknown[])[2] as { isCurrent: () => boolean };

		expect(evidence.isCurrent()).toBe(true);

		await runtime.onDeviceDeleted(devices[0]);

		expect(evidence.isCurrent()).toBe(false);

		settle();
		await jest.advanceTimersByTimeAsync(0);
	});

	it('discards results when a device is deleted while its poll fails', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		connections[0].hold = true;
		await jest.advanceTimersByTimeAsync(1000);

		properties.reportSample.mockClear();
		connectivity.setConnectionState.mockClear();

		await runtime.onDeviceDeleted(devices[0]);
		connections[0].pending[0].reject(new ModbusConnectionError('socket closed'));
		await jest.advanceTimersByTimeAsync(5000);

		expect(properties.reportSample).not.toHaveBeenCalled();
		expect(connectivity.setConnectionState).not.toHaveBeenCalled();
	});

	it('rebuilds the connection when an endpoint is edited while requests are in flight', async () => {
		devices.push(deviceEntity('device-2', { modbusUnitId: 2 }));
		bindings.push(bindingEntity('device-2', 'p2'));

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		const old = connections[0];

		// Two failed polls per device: one more counted failure would report them lost
		old.failures = 4;
		await jest.advanceTimersByTimeAsync(2000);

		old.hold = true;
		await jest.advanceTimersByTimeAsync(1000);

		expect(old.pending).toHaveLength(2);

		const inFlight = old.pending.map((entry) => {
			const settled = jest.fn();

			entry.reject = ((reject) => (error: Error) => {
				settled(error);
				reject(error);
			})(entry.reject);

			return settled;
		});

		properties.reportSample.mockClear();
		connectivity.setConnectionState.mockClear();

		endpoints[0].host = '10.0.0.2';
		await connectionsService.reconcile();
		// A device update arriving meanwhile must not add a second poller
		await runtime.onDeviceUpdated(devices[0]);

		for (const settled of inFlight) {
			expect(settled).toHaveBeenCalledWith(expect.any(ModbusConnectionError));
		}

		expect(old.stop).toHaveBeenCalledTimes(1);
		expect(connectionFor('endpoint-a')).toHaveLength(2);

		const fresh = connections[1];

		expect(fresh.endpoint.host).toBe('10.0.0.2');
		expect(fresh.start).toHaveBeenCalledTimes(1);
		expect(runtime.getConnection('device-1')).toBe(fresh);

		fresh.read.mockClear();
		await jest.advanceTimersByTimeAsync(3000);

		const reads = (unitId: number) => fresh.read.mock.calls.filter(([request]) => request.unitId === unitId).length;

		// Started poll plus three ticks, once per device
		expect(reads(1)).toBe(3);
		expect(reads(2)).toBe(3);
		expect(old.read).toHaveBeenCalledTimes(8);
		// The rejected in-flight polls were discarded, not counted as failures
		expect(states('device-1')).not.toContain(ConnectionState.LOST);
		expect(states('device-2')).not.toContain(ConnectionState.LOST);
	});

	it('keeps polling when reportSample rejects', async () => {
		properties.reportSample.mockRejectedValueOnce(new Error('Property not found'));

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		expect(properties.reportSample).toHaveBeenCalledTimes(1);

		connections[0].value = 2;
		await jest.advanceTimersByTimeAsync(1000);

		expect(properties.reportSample).toHaveBeenCalledTimes(2);
		expect(reports()[1]).toEqual(['p1', 2]);
	});

	it('keeps polling when setConnectionState rejects', async () => {
		connectivity.setConnectionState.mockRejectedValue(new Error('Device not found'));

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		connections[0].value = 5;
		await jest.advanceTimersByTimeAsync(1000);

		expect(reports()).toEqual([
			['p1', 1],
			['p1', 5],
		]);
	});

	it('flags the endpoint overloaded while any of its devices is', async () => {
		devices.push(deviceEntity('device-2', { modbusUnitId: 2 }));
		bindings.push(bindingEntity('device-2', 'p2'));

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		const connection = connections[0];
		const slow: { read: PendingRead | null } = { read: null };

		connection.read.mockImplementation((request: ModbusReadRequest) => {
			if (request.unitId === 1 && slow.read === null) {
				return new Promise<number[]>((resolve, reject) => {
					slow.read = { request, resolve, reject };
				});
			}

			return Promise.resolve([1]);
		});

		await jest.advanceTimersByTimeAsync(2000);

		expect(connection.markOverloaded).toHaveBeenLastCalledWith(true);

		// device-2 keeps completing in time, but device-1 is still overloaded
		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.markOverloaded).not.toHaveBeenCalledWith(false);

		slow.read?.resolve([1]);
		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.markOverloaded).toHaveBeenLastCalledWith(false);
	});

	it('reads back through the device poller', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		connections[0].read.mockClear();
		properties.reportSample.mockClear();

		await runtime.readBack('device-1', ['p1']);

		expect(connections[0].read).toHaveBeenCalledTimes(1);
		expect(reports()).toEqual([['p1', 1]]);
		await expect(runtime.readBack('unknown', ['p1'])).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
	});

	it('disconnects every device and stops all connections on stop', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		properties.reportSample.mockClear();

		await runtime.stop();

		expect(runtime.getState()).toBe('stopped');
		expect(states('device-1').at(-1)).toBe(ConnectionState.DISCONNECTED);
		expect(reports()).toEqual([['p1', null]]);
		expect(connections[0].stop).toHaveBeenCalledTimes(1);
		expect(runtime.getConnection('device-1')).toBeNull();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('does nothing while stopped', async () => {
		await runtime.loadDevice('device-1');
		await connectionsService.reconcile();

		expect(connections).toHaveLength(0);
		expect(connectivity.setConnectionState).not.toHaveBeenCalled();
	});

	it('survives a device that fails to load on start', async () => {
		devices.push(deviceEntity('device-2', { modbusUnitId: 2 }));
		bindings.push(bindingEntity('device-2', 'p2'));
		bindingsService.findByDevice.mockImplementation((id: string) =>
			id === 'device-1'
				? Promise.reject(new Error('database is busy'))
				: Promise.resolve(bindings.filter((binding) => binding.deviceId === id)),
		);

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		expect(runtime.getState()).toBe('started');
		expect(states('device-1')).toEqual([]);
		expect(states('device-2')).toEqual([ConnectionState.INIT, ConnectionState.CONNECTED]);
	});
});
