import { Repository } from 'typeorm';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { CreateChannelInputOccurrenceDto } from '../../../modules/devices/dto/channel-input-occurrence.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
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

/**
 * Answers every read with `value` per register (`level` per coil or discrete input) unless `hold` is set, in which
 * case reads stay pending.
 */
class FakeConnection {
	readonly pending: PendingRead[] = [];
	hold = false;
	value = 1;
	level = false;
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
			const bits =
				request.registerType === ModbusRegisterType.COIL || request.registerType === ModbusRegisterType.DISCRETE_INPUT;

			return Promise.resolve(
				bits
					? (Array<boolean>(request.count).fill(this.level) as unknown as number[])
					: Array<number>(request.count).fill(this.value),
			);
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
		endpointId: 'endpoint-a',
		unitId: 1,
		pollIntervalMs: 1000,
		byteOrder: ModbusByteOrder.BIG,
		wordOrder: ModbusByteOrder.BIG,
		maxReadRegisters: 125,
		maxReadBits: 2000,
		maxReadGap: 0,
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
		longPressMs: null,
		...overrides,
	}) as ModbusBindingEntity;

/** A channel of a device as the core channels service returns it, with its properties. */
const channelEntity = (
	id: string,
	category: ChannelCategory,
	properties: Array<{ id: string; category: PropertyCategory; dataType: DataTypeType }>,
): ChannelEntity => ({ id, category, properties }) as unknown as ChannelEntity;

describe('ModbusRuntimeService', () => {
	let endpoints: ModbusEndpointEntity[];
	let devices: ModbusDeviceEntity[];
	let bindings: ModbusBindingEntity[];
	let channels: Map<string, ChannelEntity[]>;
	let connections: FakeConnection[];
	let properties: { reportSample: jest.Mock };
	let connectivity: { trySetConnectionState: jest.Mock };
	let bindingsService: { findByDevice: jest.Mock };
	let devicesService: { findOne: jest.Mock; findAll: jest.Mock };
	let channelsService: { findAll: jest.Mock; findOne: jest.Mock };
	let endpointsService: { findOne: jest.Mock };
	let occurrencesService: { publishOccurrence: jest.Mock };
	let connectionsService: ModbusConnectionsService;
	let runtime: ModbusRuntimeService;

	const connectionFor = (endpointId: string): FakeConnection[] =>
		connections.filter((connection) => connection.endpoint.id === endpointId);

	const states = (deviceId: string): ConnectionState[] =>
		connectivity.trySetConnectionState.mock.calls
			.filter(([id]) => id === deviceId)
			.map(([, state]) => (state as { state: ConnectionState }).state);

	const published = (): CreateChannelInputOccurrenceDto[] =>
		occurrencesService.publishOccurrence.mock.calls.map(([dto]) => dto as CreateChannelInputOccurrenceDto);

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
		channels = new Map();
		connections = [];

		properties = { reportSample: jest.fn(() => Promise.resolve({})) };
		connectivity = { trySetConnectionState: jest.fn(() => Promise.resolve(true)) };

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
		channelsService = {
			findAll: jest.fn((deviceId: string) => Promise.resolve(channels.get(deviceId) ?? [])),
			findOne: jest.fn((id: string) =>
				Promise.resolve(
					[...channels.entries()]
						.flatMap(([deviceId, list]) => list.map((channel) => ({ ...channel, device: { id: deviceId } })))
						.find((channel) => channel.id === id) ?? null,
				),
			),
		};
		occurrencesService = { publishOccurrence: jest.fn(() => Promise.resolve(null)) };
		endpointsService = {
			findOne: jest.fn((id: string) => Promise.resolve(endpoints.find((endpoint) => endpoint.id === id) ?? null)),
		};

		runtime = new ModbusRuntimeService(
			devicesService as unknown as DevicesService,
			bindingsService as unknown as ModbusBindingsService,
			endpointsService as unknown as ModbusEndpointsService,
			connectionsService,
			properties as unknown as ChannelsPropertiesService,
			connectivity as unknown as DeviceConnectivityService,
			channelsService as unknown as ChannelsService,
			occurrencesService as unknown as ChannelInputOccurrencesService,
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

	describe('button points and data types', () => {
		beforeEach(() => {
			bindings = [
				bindingEntity('device-1', 'humidity', { scale: 0.1 }),
				bindingEntity('device-1', 'button-event', {
					registerType: ModbusRegisterType.DISCRETE_INPUT,
					dataType: ModbusDataType.BOOL,
					address: 3,
				}),
			];
			channels.set('device-1', [
				channelEntity('channel-humidity', ChannelCategory.HUMIDITY, [
					{ id: 'humidity', category: PropertyCategory.HUMIDITY, dataType: DataTypeType.UCHAR },
				]),
				channelEntity('channel-button', ChannelCategory.BUTTON, [
					{ id: 'button-event', category: PropertyCategory.EVENT, dataType: DataTypeType.ENUM },
				]),
			]);
		});

		it('publishes occurrences through ChannelInputOccurrencesService', async () => {
			await runtime.start();
			await jest.advanceTimersByTimeAsync(0);

			expect(channelsService.findAll).toHaveBeenCalledTimes(1);
			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');

			connections[0].level = true;
			await jest.advanceTimersByTimeAsync(1000);

			expect(published()).toEqual([
				{
					deviceId: 'device-1',
					channelId: 'channel-button',
					propertyId: 'button-event',
					event: 'down',
					sourceOccurrenceId: expect.any(String) as string,
					sourceTimestamp: expect.any(String) as string,
				},
			]);

			const [down] = published();

			expect(new Date(down.sourceTimestamp ?? '').toISOString()).toBe(down.sourceTimestamp);

			connections[0].level = false;
			await jest.advanceTimersByTimeAsync(1000);

			expect(published().map((dto) => dto.event)).toEqual(['down', 'long_press', 'up']);
			// Every event has its own source identity, so the core never drops one as a redelivery.
			expect(new Set(published().map((dto) => dto.sourceOccurrenceId)).size).toBe(3);
			// Channels are resolved once per device load, not per poll.
			expect(channelsService.findAll).toHaveBeenCalledTimes(1);
		});

		it('rounds values of integer properties and never reports a button level as a sample', async () => {
			await runtime.start();
			await jest.advanceTimersByTimeAsync(0);

			connections[0].value = 456;
			await jest.advanceTimersByTimeAsync(1000);

			// Raw 1 and 456 at scale 0.1 are 0.1 and 45.6; the humidity property is a uchar.
			expect(reports()).toEqual([
				['humidity', 0],
				['humidity', 46],
			]);

			await runtime.stop();

			// Stopping invalidates the read properties, but a button level is not a sample to invalidate.
			expect(reports()).toEqual([
				['humidity', 0],
				['humidity', 46],
				['humidity', null],
			]);
		});

		it('treats an event property outside a button channel as a plain read', async () => {
			channels.set('device-1', [
				channelEntity('channel-humidity', ChannelCategory.HUMIDITY, [
					{ id: 'humidity', category: PropertyCategory.HUMIDITY, dataType: DataTypeType.UCHAR },
				]),
				channelEntity('channel-input', ChannelCategory.BINARY_INPUT, [
					{ id: 'button-event', category: PropertyCategory.EVENT, dataType: DataTypeType.BOOL },
				]),
			]);

			await runtime.start();
			await jest.advanceTimersByTimeAsync(0);

			expect(reports()).toContainEqual(['button-event', false]);
			expect(occurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});
	});

	it('stores connected on a later poll when the store did not take it', async () => {
		connectivity.trySetConnectionState
			.mockResolvedValueOnce(true) // init
			.mockResolvedValueOnce(false); // connected, e.g. the status property did not exist yet

		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		expect(states('device-1')).toEqual([ConnectionState.INIT, ConnectionState.CONNECTED]);

		await jest.advanceTimersByTimeAsync(1000);

		expect(states('device-1')).toEqual([ConnectionState.INIT, ConnectionState.CONNECTED, ConnectionState.CONNECTED]);

		// Stored now: identical states of later polls are deduplicated.
		await jest.advanceTimersByTimeAsync(3000);

		expect(states('device-1')).toEqual([ConnectionState.INIT, ConnectionState.CONNECTED, ConnectionState.CONNECTED]);
	});

	it('marks a device without read bindings as alert', async () => {
		bindings = [bindingEntity('device-1', 'p1', { role: ModbusBindingRole.WRITE })];

		await runtime.start();
		await jest.advanceTimersByTimeAsync(5000);

		expect(states('device-1')).toEqual([ConnectionState.ALERT]);
		expect(connectivity.trySetConnectionState.mock.calls[0]).toEqual([
			'device-1',
			{ state: ConnectionState.ALERT, reason: 'Device has no read bindings' },
		]);
		expect(connections[0].read).not.toHaveBeenCalled();
		expect(properties.reportSample).not.toHaveBeenCalled();
		// A write-only device can still be commanded
		expect(runtime.getConnection('device-1')).toBe(connections[0]);
	});

	it('marks a device whose endpoint is missing as alert and invalidates its read properties', async () => {
		devices = [deviceEntity('device-1', { endpointId: 'gone' })];

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

	describe('core structure events', () => {
		beforeEach(async () => {
			channels.set('device-1', [
				channelEntity('channel-1', ChannelCategory.HUMIDITY, [
					{ id: 'p1', category: PropertyCategory.HUMIDITY, dataType: DataTypeType.UCHAR },
				]),
			]);

			await runtime.start();
			await jest.advanceTimersByTimeAsync(0);

			channelsService.findAll.mockClear();
		});

		it('reloads a loaded device when a property of its channel is updated', async () => {
			await runtime.onChannelPropertyChanged({ id: 'p1', channel: 'channel-1' } as unknown as ChannelPropertyEntity);

			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');
		});

		it('reloads a loaded device when a property with a channel entity is deleted', async () => {
			await runtime.onChannelPropertyChanged({
				id: 'p1',
				channel: { id: 'channel-1' },
			} as unknown as ChannelPropertyEntity);

			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');
		});

		it('reloads a loaded device when a deleted property arrives without its channel', async () => {
			// The core removal emits the property row as loaded, without its channel relation.
			await runtime.onChannelPropertyChanged({ id: 'p1' } as unknown as ChannelPropertyEntity);

			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');
		});

		it('reloads a loaded device when a property arrives for a channel no load has cached yet', async () => {
			// The channel was created after the last load; the load it started has not cached it.
			channels.set('device-1', [
				...(channels.get('device-1') ?? []),
				channelEntity('channel-2', ChannelCategory.HUMIDITY, [
					{ id: 'p2', category: PropertyCategory.HUMIDITY, dataType: DataTypeType.UCHAR },
				]),
			]);

			await runtime.onChannelPropertyChanged({ id: 'p2', channel: 'channel-2' } as unknown as ChannelPropertyEntity);

			expect(channelsService.findOne).toHaveBeenCalledWith('channel-2');
			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');
		});

		it('supersedes a first load still reading when its channel or a property of it is removed', async () => {
			const releases: (() => void)[] = [];
			// The device is not cached yet: its first load waits on the endpoint lookup.
			const pendingLoad = async (): Promise<{ load: Promise<void> }> => {
				endpointsService.findOne.mockImplementationOnce(
					(id: string) =>
						new Promise((resolve) => {
							releases.push(() => resolve(endpoints.find((endpoint) => endpoint.id === id) ?? null));
						}),
				);

				const load = runtime.loadDevice('device-1');

				await jest.advanceTimersByTimeAsync(0);
				channelsService.findAll.mockClear();

				return { load };
			};

			await runtime.unloadDevice('device-1');

			const first = await pendingLoad();

			await runtime.onChannelChanged({ id: 'channel-1', device: 'device-1' } as unknown as ChannelEntity);

			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');

			await runtime.unloadDevice('device-1');

			const second = await pendingLoad();

			// A removed property arrives without its channel and no cache entry owns it.
			await runtime.onChannelPropertyChanged({ id: 'p-unknown' } as unknown as ChannelPropertyEntity);

			expect(channelsService.findAll).toHaveBeenCalledWith('device-1');

			releases.forEach((release) => release());
			await Promise.all([first.load, second.load]);
		});

		it('reloads a loaded device when a channel is created or deleted', async () => {
			await runtime.onChannelChanged({ id: 'channel-2', device: 'device-1' } as unknown as ChannelEntity);
			await runtime.onChannelChanged({ id: 'channel-1', device: { id: 'device-1' } } as unknown as ChannelEntity);

			expect(channelsService.findAll).toHaveBeenCalledTimes(2);
		});

		it('ignores events of an unrelated device', async () => {
			await runtime.onChannelPropertyChanged({ id: 'other', channel: 'channel-x' } as unknown as ChannelPropertyEntity);
			await runtime.onChannelChanged({ id: 'channel-x', device: 'device-2' } as unknown as ChannelEntity);

			expect(channelsService.findAll).not.toHaveBeenCalled();
		});
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
		connectivity.trySetConnectionState.mockClear();
		connections[0].read.mockClear();

		release();
		await loading;
		await jest.advanceTimersByTimeAsync(3000);

		expect(connections[0].read).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
		expect(runtime.getConnection('device-1')).toBeNull();
	});

	it('keeps the newest load when an older one resolves last', async () => {
		await runtime.start();
		await jest.advanceTimersByTimeAsync(0);

		let releaseOld!: () => void;

		devicesService.findOne.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					releaseOld = () => resolve(deviceEntity('device-1', { unitId: 9 }));
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
		connectivity.trySetConnectionState.mockClear();

		const deleted = devices[0];

		devices = [];
		await runtime.onDeviceDeleted(deleted);

		connections[0].pending[0].resolve([99]);
		await jest.advanceTimersByTimeAsync(5000);

		expect(properties.reportSample).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
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
		connectivity.trySetConnectionState.mockClear();

		await runtime.onDeviceDeleted(devices[0]);
		connections[0].pending[0].reject(new ModbusConnectionError('socket closed'));
		await jest.advanceTimersByTimeAsync(5000);

		expect(properties.reportSample).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
	});

	it('rebuilds the connection when an endpoint is edited while requests are in flight', async () => {
		devices.push(deviceEntity('device-2', { unitId: 2 }));
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
		connectivity.trySetConnectionState.mockClear();

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

	it('keeps polling when trySetConnectionState rejects', async () => {
		connectivity.trySetConnectionState.mockRejectedValue(new Error('Device not found'));

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
		devices.push(deviceEntity('device-2', { unitId: 2 }));
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
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
	});

	it('survives a device that fails to load on start', async () => {
		devices.push(deviceEntity('device-2', { unitId: 2 }));
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
