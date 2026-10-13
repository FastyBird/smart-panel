import { Device, RpcHandler, RpcParams, ShellyPlus1, ShellyPlus1Pm, ShellyPlusHt, Voltmeter } from 'shellies-ds9';

import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../src/modules/devices/services/channels.properties.service';
import { ChannelsService } from '../src/modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../src/modules/devices/services/device-connectivity.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { DelegatesManagerService } from '../src/plugins/devices-shelly-ng/delegates/delegates-manager.service';
import { ShellyDeviceDelegate } from '../src/plugins/devices-shelly-ng/delegates/shelly-device.delegate';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../src/plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import {
	MappingLoaderService,
	PropertyMappingStorageService,
	TransformerRegistry,
} from '../src/plugins/devices-shelly-ng/mappings';
import { ShellyNgDevicePlatform } from '../src/plugins/devices-shelly-ng/platforms/shelly-ng.device.platform';
import { DeviceAddressService } from '../src/plugins/devices-shelly-ng/services/device-address.service';
import { DeviceManagerService } from '../src/plugins/devices-shelly-ng/services/device-manager.service';
import { ShellyRpcClientService } from '../src/plugins/devices-shelly-ng/services/shelly-rpc-client.service';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../src/plugins/devices-zigbee2mqtt/entities/devices-zigbee2mqtt.entity';
import { Z2mDeviceStateMetadata } from '../src/plugins/devices-zigbee2mqtt/interfaces/zigbee2mqtt.interface';
import { Z2mBaseClientAdapter } from '../src/plugins/devices-zigbee2mqtt/services/base-client-adapter';
import { Z2mDeviceMapperService } from '../src/plugins/devices-zigbee2mqtt/services/device-mapper.service';

import {
	CommandEvidenceContract,
	FloorGuardContract,
	QualificationSample,
	sampleEligible,
} from './support/virtual-thermostat-contract';

/** Fake protocol boundary only: real library device/component and real plugin delegate are not mocked. */
class FixtureRpc extends RpcHandler {
	connected = true;
	readonly requests: Array<{ method: string; params?: RpcParams }> = [];
	response: (method: string, params?: RpcParams) => Promise<unknown> = () => Promise.resolve({ was_on: false });

	constructor() {
		super('qualification-fixture');
	}

	request<T>(method: string, params?: RpcParams): Promise<T> {
		this.requests.push({ method, params });
		this.emit('request', method, params);
		return this.response(method, params) as Promise<T>;
	}

	notify(values: Record<string, unknown>): void {
		this.emit('statusUpdate', { ts: 100, ...values });
	}

	destroy(): Promise<void> {
		this.connected = false;
		this.removeAllListeners();
		return Promise.resolve();
	}
}

/** Real packet routing/cache/provenance with MQTT networking replaced by explicit fixture packets. */
class FixtureMqtt extends Z2mBaseClientAdapter {
	constructor() {
		super('qualification-fixture');
	}
	connect(): Promise<void> {
		this.connected = true;
		return Promise.resolve();
	}
	disconnect(): Promise<void> {
		this.connected = false;
		this.setCallbacks({});
		return Promise.resolve();
	}
	publishCommand(): Promise<boolean> {
		return Promise.resolve(false);
	}
	requestState(): Promise<boolean> {
		return Promise.resolve(false);
	}
	setPermitJoin(): Promise<boolean> {
		return Promise.resolve(false);
	}
	feed(state: Record<string, unknown>, retained: boolean): void {
		this.handleMessage('zigbee2mqtt/ambient', JSON.stringify(state), false, retained);
	}
}

const createSwitch = (rpc: FixtureRpc): ShellyPlus1 =>
	new ShellyPlus1({ id: 'fixture-plus1', mac: '000000000001', model: ShellyPlus1.model }, rpc);

const createTemperature = (rpc: FixtureRpc): ShellyPlusHt =>
	new ShellyPlusHt({ id: 'fixture-ht', mac: '000000000002', model: ShellyPlusHt.model }, rpc);

const sample = (overrides: Partial<QualificationSample> = {}): QualificationSample => ({
	value: 25,
	sampledAt: 10_000,
	origin: 'live',
	valid: true,
	identity: 'probe-address',
	...overrides,
});

const absent = <T>(): T => ({}) as T;

beforeEach(() => {
	jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Live network forbidden in qualification spike'));
});

afterEach(() => {
	jest.restoreAllMocks();
});

/** All persistence/catalog dependencies are fixtures; production components remain real. */
const createManager = async (physical: ShellyPlus1 | ShellyPlus1Pm | ShellyPlusHt, analog = false) => {
	const device = Object.assign(new ShellyNgDeviceEntity(), { id: 'device', identifier: physical.id, enabled: true });
	const switchChannel = Object.assign(new ShellyNgChannelEntity(), { id: 'switch', identifier: 'switch:0', device });
	const temperatureChannel = Object.assign(new ShellyNgChannelEntity(), {
		id: 'temperature',
		identifier: 'temperature:0',
		device,
	});
	const inputChannel = Object.assign(new ShellyNgChannelEntity(), {
		id: 'input',
		identifier: 'input:0',
		category: ChannelCategory.ANALOG_INPUT,
		device,
	});
	const inputProperty = Object.assign(new ShellyNgChannelPropertyEntity(), {
		id: 'helper-value',
		category: PropertyCategory.VALUE,
		channel: inputChannel,
	});
	const switchProperty = Object.assign(new ShellyNgChannelPropertyEntity(), {
		id: 'output',
		identifier: 'output',
		channel: switchChannel,
	});
	const temperatureProperty = Object.assign(new ShellyNgChannelPropertyEntity(), {
		id: 'floor',
		identifier: 'tC',
		channel: temperatureChannel,
	});
	const writes = jest.fn().mockResolvedValue(temperatureProperty);
	physical.wifi.update({ sta_ip: 'fixture.invalid' });
	const module = await Test.createTestingModule({
		providers: [
			{
				provide: DelegatesManagerService,
				useFactory: () =>
					new DelegatesManagerService(
						{
							findOneBy: () => Promise.resolve(device),
							findOne: () => Promise.resolve(device),
						} as unknown as DevicesService,
						{
							findOneBy: (field: string, value: string) =>
								Promise.resolve(
									value === String(ChannelCategory.DEVICE_INFORMATION)
										? { id: 'info' }
										: field === 'identifier' && value === 'switch:0'
											? switchChannel
											: field === 'identifier' && value === 'temperature:0'
												? temperatureChannel
												: field === 'identifier' && value === 'input:0' && analog
													? inputChannel
													: null,
								),
						} as unknown as ChannelsService,
						{
							findOneBy: (_field: string, value: string) =>
								Promise.resolve(
									value === 'output'
										? switchProperty
										: value === 'tC'
											? temperatureProperty
											: value === String(PropertyCategory.VALUE) && analog
												? inputProperty
												: null,
								),
							update: writes,
						} as unknown as ChannelsPropertiesService,
						{ setConnectionState: () => Promise.resolve() } as unknown as DeviceConnectivityService,
						absent<DeviceManagerService>(),
						{ syncAddresses: () => Promise.resolve() } as unknown as DeviceAddressService,
						{ get: () => undefined } as unknown as PropertyMappingStorageService,
						absent<TransformerRegistry>(),
					),
			},
		],
	}).compile();
	const manager = module.get(DelegatesManagerService);
	await manager.insert(physical);
	writes.mockClear();
	return { module, manager, device, switchChannel, switchProperty, writes };
};

describe('VD2-1 real Shelly library/delegate protocol evidence', () => {
	let rpc: FixtureRpc;
	let physical: Device;
	let delegate: ShellyDeviceDelegate | undefined;
	let module: TestingModule | undefined;
	let manager: DelegatesManagerService | undefined;

	beforeEach(() => {
		jest.useFakeTimers();
		rpc = new FixtureRpc();
		physical = createSwitch(rpc);
	});

	afterEach(async () => {
		await manager?.detach();
		manager = undefined;
		await module?.close();
		module = undefined;
		delegate?.destroy();
		delegate = undefined;
		physical.removeAllListeners();
		await rpc.destroy();
		jest.useRealTimers();
	});

	it('real Switch.set serializes timed ON and absolute OFF without flip-back; acceptance is not output feedback', async () => {
		const device = physical as ShellyPlus1;
		device.switch0.update({ output: false });
		delegate = new ShellyDeviceDelegate(device);
		const values = jest.fn();
		delegate.on('value', values);
		// was_on describes the previous state, not confirmation of the requested output.
		await expect(device.switch0.set(true, 30)).resolves.toEqual({ was_on: false });
		await device.switch0.set(false);
		expect(rpc.requests).toEqual([
			{ method: 'Switch.Set', params: { id: 0, on: true, toggle_after: 30 } },
			{ method: 'Switch.Set', params: { id: 0, on: false, toggle_after: undefined } },
		]);
		expect(JSON.parse(JSON.stringify(rpc.requests[1].params))).not.toHaveProperty('toggle_after');
		expect(device.switch0.output).toBe(false);
		expect(values).not.toHaveBeenCalled();
		rpc.notify({ 'switch:0': { output: true } });
		expect(values).toHaveBeenCalledWith('switch:0', 'output', true, 'notify');
	});

	it('NO-GO: current real plugin dispatch accepts ON but supplies no device-side timer', async () => {
		const fixture = await createManager(physical as ShellyPlus1);
		module = fixture.module;
		manager = fixture.manager;
		const platform = new ShellyNgDevicePlatform(fixture.manager);
		await expect(
			platform.processBatch([
				{ device: fixture.device, channel: fixture.switchChannel, property: fixture.switchProperty, value: true },
			]),
		).resolves.toBe(true);
		expect(rpc.requests.at(-1)).toEqual({ method: 'Switch.Set', params: { id: 0, on: true, toggle_after: undefined } });
		await expect(
			platform.processBatch([
				{ device: fixture.device, channel: fixture.switchChannel, property: fixture.switchProperty, value: false },
			]),
		).resolves.toBe(true);
		expect(rpc.requests.at(-1)).toEqual({
			method: 'Switch.Set',
			params: { id: 0, on: false, toggle_after: undefined },
		});
		expect(fixture.writes).not.toHaveBeenCalled();
	});

	it('NO-GO: failed RPC propagates and late ON feedback is accepted after a newer accepted OFF', async () => {
		const device = physical as ShellyPlus1;
		device.switch0.update({ output: false });
		delegate = new ShellyDeviceDelegate(device);
		const values = jest.fn();
		delegate.on('value', values);
		rpc.response = () => Promise.reject(new Error('RPC timeout; not cancellation'));
		await expect(device.switch0.set(true, 30)).rejects.toThrow('RPC timeout');
		rpc.response = () => Promise.resolve({ was_on: false });
		await device.switch0.set(false);
		rpc.notify({ 'switch:0': { output: true } });
		expect(values).toHaveBeenLastCalledWith('switch:0', 'output', true, 'notify');
		const evidence = new CommandEvidenceContract();
		evidence.reserveOn('timed-out-on');
		evidence.observeOutput(false);
		expect(evidence.permitsOpposedOutput).toBe(false);
		const restarted = new CommandEvidenceContract(evidence.snapshot());
		expect(restarted.permitsOpposedOutput).toBe(false);
		// A simulated reboot/off report establishes output only, not cancellation of an old command.
		rpc.notify({ 'switch:0': { output: false, source: 'init' } });
		restarted.observeOutput(false);
		expect(restarted.permitsOpposedOutput).toBe(false);
		restarted.confirmReleased(['timed-out-on'], false);
		expect(restarted.permitsOpposedOutput).toBe(true);
	});

	it('real delegate forwards equal notifications and fences an older poll, but equal polls are currently suppressed', async () => {
		const device = physical as ShellyPlus1;
		device.switch0.update({ output: false });
		delegate = new ShellyDeviceDelegate(device);
		const values = jest.fn();
		delegate.on('value', values);
		let finishPoll: (value: unknown) => void;
		rpc.response = () =>
			new Promise((resolve) => {
				finishPoll = resolve;
			});
		const poll = delegate.pollStatus();
		rpc.notify({ 'switch:0': { output: false } });
		finishPoll({ 'switch:0': { output: true } });
		await expect(poll).resolves.toBe(true);
		expect(device.switch0.output).toBe(false);
		expect(values).toHaveBeenCalledTimes(1);
		expect(values).toHaveBeenCalledWith('switch:0', 'output', false, 'notify');
		values.mockClear();
		rpc.response = () => Promise.resolve({ 'switch:0': { output: false } });
		await delegate.pollStatus();
		expect(values).not.toHaveBeenCalled(); // NO-GO for polling-only sample freshness.
	});

	it('real RPC client preserves peripheral address evidence, but does not bind it as a qualified floor role', async () => {
		const payload = { ds18b20: { 'temperature:100': { addr: '40:255:100:6:199:204:149:177' } } };
		const fetchFixture = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ result: payload })));
		const client = new ShellyRpcClientService();
		const evidence = await client.call<typeof payload>('fixture.invalid', 'SensorAddon.GetPeripherals');
		expect(evidence.ds18b20['temperature:100'].addr).toBe(payload.ds18b20['temperature:100'].addr);
		const [url, request] = fetchFixture.mock.calls[0];
		expect(url).toBe('http://fixture.invalid/rpc');
		expect(typeof request.body).toBe('string');
		expect(JSON.parse(request.body as string)).toMatchObject({ method: 'SensorAddon.GetPeripherals' });
		expect(request.headers).not.toHaveProperty('Authorization');
		// Retrieving a response is not an existing production floor-role binding or identity check.
		const guard = new FloorGuardContract(evidence.ds18b20['temperature:100'].addr, 30, 1, 1_000);
		expect(guard.allowsHeating(sample({ identity: 'different-address' }), 10_000)).toBe(false);
	});

	it('discovers temperature:100 with real adoption logic but Plus1 runtime ignores that add-on component', async () => {
		const rpcClient = {
			getDeviceInfo: () => Promise.resolve({ id: 'fixture-plus1', model: ShellyPlus1.model }),
			getComponents: () => Promise.resolve([{ key: 'switch:0' }, { key: 'temperature:100' }]),
			getSystemConfig: () => Promise.resolve({ device: { name: 'fixture' } }),
		};
		module = await Test.createTestingModule({
			providers: [
				{
					provide: DeviceManagerService,
					useFactory: () =>
						new DeviceManagerService(
							rpcClient as unknown as ShellyRpcClientService,
							absent(),
							absent(),
							absent(),
							absent<MappingLoaderService>(),
							absent(),
							absent(),
							absent(),
							absent(),
						),
				},
			],
		}).compile();
		const discovered = await module.get(DeviceManagerService).getDeviceInfo('fixture.invalid', undefined);
		expect(discovered.components).toContainEqual({ type: 'temperature', ids: [100] });
		delegate = new ShellyDeviceDelegate(physical);
		const values = jest.fn();
		delegate.on('value', values);
		for (const reading of [{ tC: 25 }, { tC: 25 }, { tC: 31 }, { tC: null, errors: ['read'] }]) {
			rpc.notify({ 'temperature:100': reading });
		}
		expect(delegate.temperature.has(100)).toBe(false);
		expect(values).not.toHaveBeenCalled(); // NO-GO: adoption does not imply ongoing floor observation.
	});

	it('NO-GO: real library launders null into old temperature, and raw null still lacks guard invalidation', async () => {
		physical.removeAllListeners();
		rpc.removeAllListeners();
		physical = createTemperature(rpc);
		const fixture = await createManager(physical as ShellyPlusHt);
		module = fixture.module;
		manager = fixture.manager;
		delegate = fixture.manager.get(physical.id);
		const values = jest.fn();
		delegate.on('value', values);
		rpc.notify({ 'temperature:0': { tC: 25 } });
		await jest.advanceTimersByTimeAsync(250);
		rpc.notify({ 'temperature:0': { tC: 25 } });
		await jest.advanceTimersByTimeAsync(250);
		expect(
			values.mock.calls.filter(
				([component, characteristic]) => component === 'temperature:0' && characteristic === 'tC',
			),
		).toHaveLength(2);
		expect(fixture.writes).toHaveBeenCalledTimes(2);
		fixture.writes.mockClear();
		values.mockClear();
		rpc.notify({ 'temperature:0': { tC: null, errors: ['read'] } });
		await jest.advanceTimersByTimeAsync(250);
		expect(values).toHaveBeenCalledWith('temperature:0', 'tC', 25, 'notify');
		expect(values).toHaveBeenCalledWith('temperature:0', 'errors', ['read'], 'notify');
		expect(values).not.toHaveBeenCalledWith('temperature:0', 'tC', null, 'notify');
		expect(delegate.temperature.get(0).tC).toBe(25);
		expect(fixture.writes).toHaveBeenCalledTimes(1); // Pinned Component.update keeps old tC for null.
		const [, staleUpdate] = fixture.writes.mock.calls[0] as [string, { value: unknown }];
		expect(staleUpdate.value).toBe(25);
		fixture.writes.mockClear();
		delegate.emitNotificationValue('temperature:0', 'tC', null); // Raw path bypasses the library bug.
		await jest.advanceTimersByTimeAsync(250);
		expect(values).toHaveBeenCalledWith('temperature:0', 'tC', null, 'notify');
		expect(fixture.writes).toHaveBeenCalledTimes(1);
		expect(fixture.writes).toHaveBeenCalledWith('floor', { type: 'devices-shelly-ng', value: 0 });
		// Manager numeric coercion converts raw null to 0; neither path invalidates control quality.
	});
});

describe('VD2-1 Plus1PM native analog helper characterization', () => {
	let rpc: FixtureRpc;
	let physical: ShellyPlus1Pm;
	let delegate: ShellyDeviceDelegate | undefined;
	let module: TestingModule | undefined;
	let manager: DelegatesManagerService | undefined;

	beforeEach(() => {
		jest.useFakeTimers();
		rpc = new FixtureRpc();
		physical = new ShellyPlus1Pm({ id: 'fixture-plus1pm', mac: '000000000003', model: ShellyPlus1Pm.model }, rpc);
	});

	afterEach(async () => {
		await manager?.detach();
		manager = undefined;
		await module?.close();
		module = undefined;
		delegate?.destroy();
		delegate = undefined;
		physical.removeAllListeners();
		await rpc.destroy();
		jest.useRealTimers();
	});

	it.each([
		{ transformed: 25, value: 25, unit: '°C' },
		{ transformed: null, value: 50, unit: '%' },
		{ transformed: undefined, value: 50, unit: '%' },
	])(
		'NO-GO: adoption keeps helper as analog VALUE and falls back when unavailable %j',
		async ({ transformed, value, unit }) => {
			const device = Object.assign(new ShellyNgDeviceEntity(), {
				id: 'pilot',
				identifier: physical.id,
				hasEthernet: false,
			});
			const channels: ShellyNgChannelEntity[] = [];
			const properties: Array<{ channel: string; category: PropertyCategory; value?: unknown; identifier?: string }> =
				[];
			const requests: string[] = [];
			jest.spyOn(globalThis, 'fetch').mockImplementation((_url, request) => {
				const body = JSON.parse(request.body as string) as { method: string; params?: { id?: number } };
				requests.push(body.method);
				const payloads: Record<string, unknown> = {
					'Shelly.GetDeviceInfo': { id: physical.id, model: physical.model, ver: 'fixture-only' },
					'Shelly.GetComponents': { components: [{ key: 'input:100' }], offset: 0, total: 1 },
					'Sys.GetConfig': { device: { name: 'floor fixture' } },
					'WiFi.GetStatus': { rssi: -50 },
					'Input.GetConfig': {
						id: 100,
						name: 'floor',
						type: 'analog',
						enable: true,
						xpercent: { expr: 'x/2', unit: '°C' },
					},
					'Input.GetStatus': { id: 100, percent: 50, xpercent: transformed },
				};
				expect(Object.hasOwn(payloads, body.method)).toBe(true);
				if (body.method.startsWith('Input.')) expect(body.params).toEqual({ id: 100 });
				return Promise.resolve(new Response(JSON.stringify({ result: payloads[body.method] })));
			});
			module = await Test.createTestingModule({
				providers: [
					{
						provide: DeviceManagerService,
						useFactory: () =>
							new DeviceManagerService(
								new ShellyRpcClientService(),
								{ findOne: () => Promise.resolve(device) } as unknown as DevicesService,
								{
									findOneBy: () => Promise.resolve(null),
									create: (data: { category: ChannelCategory; identifier?: string }) => {
										const channel = Object.assign(
											new ShellyNgChannelEntity(),
											{ category: data.category, identifier: data.identifier },
											{
												id: `channel-${channels.length}`,
												device,
											},
										);
										channels.push(channel);
										return Promise.resolve(channel);
									},
									findAll: () => Promise.resolve(channels),
								} as unknown as ChannelsService,
								{
									findOneBy: () => Promise.resolve(null),
									findAll: () => Promise.resolve([]),
									create: (
										channel: string,
										data: { category: PropertyCategory; value?: unknown; identifier?: string },
									) => {
										properties.push({ channel, ...data });
										return Promise.resolve(
											Object.assign(new ShellyNgChannelPropertyEntity(), {
												category: data.category,
												identifier: data.identifier,
												id: `property-${properties.length}`,
											}),
										);
									},
								} as unknown as ChannelsPropertiesService,
								{ findMatchingMapping: () => null } as unknown as MappingLoaderService,
								absent(),
								absent(),
								{
									enqueue: (_id: string, task: () => Promise<ShellyNgDeviceEntity>) => task(),
								} as unknown as ConstructorParameters<typeof DeviceManagerService>[7],
								{
									getPreferredAddressOrMigrate: () => Promise.resolve('fixture.invalid'),
								} as unknown as DeviceAddressService,
							),
					},
				],
			}).compile();
			await module.get(DeviceManagerService).createOrUpdate(device.id);
			const floor = channels.find((channel) => channel.identifier === 'input:100');
			expect(floor.category).toBe(ChannelCategory.ANALOG_INPUT);
			expect(properties).toContainEqual(
				expect.objectContaining({ channel: floor.id, category: PropertyCategory.VALUE, value }),
			);
			expect(properties).toContainEqual(
				expect.objectContaining({ channel: floor.id, category: PropertyCategory.UNIT, value: unit }),
			);
			expect(
				properties.some(
					(property) => property.channel === floor.id && property.category === PropertyCategory.TEMPERATURE,
				),
			).toBe(false);
			expect(JSON.stringify(properties)).not.toContain('x/2'); // Expression/config identity is not persisted.
			expect(requests).not.toContain('SensorAddon.GetPeripherals'); // Physical IO identity is not adopted.
		},
	);

	it('real Input.GetConfig preserves helper expression/unit and peripheral IO without converting the result', async () => {
		const config = { id: 100, type: 'analog', enable: true, xpercent: { expr: 'x/2', unit: '°C' } };
		const peripherals = { analog_in: { 'input:100': { io: 0 } } };
		const client = new ShellyRpcClientService();
		const methods: string[] = [];
		jest.spyOn(globalThis, 'fetch').mockImplementation((_url, request) => {
			const body = JSON.parse(request.body as string) as { method: string; params: { id: number } };
			methods.push(body.method);
			const result = body.method === 'Input.GetConfig' ? config : peripherals;
			if (body.method === 'Input.GetConfig') expect(body.params).toEqual({ id: 100 });
			return Promise.resolve(new Response(JSON.stringify({ result })));
		});
		expect(await client.getInputConfig('fixture.invalid', 100)).toEqual(config);
		expect(await client.call('fixture.invalid', 'SensorAddon.GetPeripherals')).toEqual(peripherals);
		expect(methods).toEqual(['Input.GetConfig', 'SensorAddon.GetPeripherals']);
		// Synthetic expression is protocol data, not the installed thermistor calibration.
	});

	it('NO-GO: Plus1PM discovery sees dynamic analog and voltmeter IDs but runtime ignores helper reports', async () => {
		module = await Test.createTestingModule({
			providers: [
				{
					provide: DeviceManagerService,
					useFactory: () =>
						new DeviceManagerService(
							{
								getDeviceInfo: () => Promise.resolve({ id: physical.id, model: physical.model }),
								getComponents: () => Promise.resolve([{ key: 'input:100' }, { key: 'voltmeter:100' }]),
								getSystemConfig: () => Promise.resolve({ device: { name: 'fixture' } }),
							} as unknown as ShellyRpcClientService,
							absent(),
							absent(),
							absent(),
							absent(),
							absent(),
							absent(),
							absent(),
							absent(),
						),
				},
			],
		}).compile();
		const discovered = await module.get(DeviceManagerService).getDeviceInfo('fixture.invalid', undefined);
		expect(physical.model).toBe('SNSW-001P16EU');
		expect(discovered.components).toEqual([
			{ type: 'input', ids: [100] },
			{ type: 'voltmeter', ids: [100] },
		]);
		delegate = new ShellyDeviceDelegate(physical);
		const values = jest.fn();
		delegate.on('value', values);
		for (const transformed of [25, 25, 31, null]) {
			const status = {
				'input:100': { percent: 50, xpercent: transformed, ...(transformed === null ? { errors: ['read'] } : {}) },
				'voltmeter:100': { voltage: 2.5, xvoltage: transformed, ...(transformed === null ? { errors: ['read'] } : {}) },
			};
			rpc.notify(status);
			rpc.response = () => Promise.resolve(status);
			await delegate.pollStatus();
		}
		expect(delegate.inputs.has(100)).toBe(false);
		expect(values).not.toHaveBeenCalled();
	});

	it('NO-GO: known input prefers equal xpercent notifications but null/error repeats stale values and equal polls vanish', async () => {
		// input:0 deliberately exercises a known component, not the add-on's input:100.
		physical.input0.update({ percent: 50, xpercent: 25 });
		const fixture = await createManager(physical, true);
		module = fixture.module;
		manager = fixture.manager;
		delegate = manager.get(physical.id);
		const values = jest.fn();
		delegate.on('value', values);
		for (let i = 0; i < 2; i++) {
			rpc.notify({ 'input:0': { percent: 50, xpercent: 25 } });
			await jest.advanceTimersByTimeAsync(250);
		}
		expect(fixture.writes).toHaveBeenCalledTimes(2);
		expect(fixture.writes).toHaveBeenLastCalledWith('helper-value', { type: 'devices-shelly-ng', value: 25 });
		fixture.writes.mockClear();
		values.mockClear();
		rpc.response = () => Promise.resolve({ 'input:0': { percent: 50, xpercent: 25 } });
		await delegate.pollStatus();
		expect(values).not.toHaveBeenCalled();
		rpc.notify({ 'input:0': { percent: 62, xpercent: 31 } });
		await jest.advanceTimersByTimeAsync(250);
		expect(fixture.writes).toHaveBeenLastCalledWith('helper-value', { type: 'devices-shelly-ng', value: 31 });
		rpc.notify({ 'input:0': { percent: 60, xpercent: null, errors: ['read'] } });
		await jest.advanceTimersByTimeAsync(250);
		expect(values).toHaveBeenCalledWith('input:0', 'xpercent', 31, 'notify');
		expect(fixture.writes).toHaveBeenLastCalledWith('helper-value', { type: 'devices-shelly-ng', value: 31 });
		delegate.emitNotificationValue('input:0', 'xpercent', null);
		await jest.advanceTimersByTimeAsync(250);
		expect(fixture.writes).toHaveBeenLastCalledWith('helper-value', { type: 'devices-shelly-ng', value: 0 });
	});

	it('NO-GO: helper appearing after insertion leaves the known input bound to raw percent', async () => {
		physical.input0.update({ percent: 50 });
		const fixture = await createManager(physical, true);
		module = fixture.module;
		manager = fixture.manager;
		rpc.notify({ 'input:0': { percent: 60, xpercent: 30 } });
		await jest.advanceTimersByTimeAsync(250);
		expect(fixture.writes).toHaveBeenLastCalledWith('helper-value', { type: 'devices-shelly-ng', value: 60 });
		expect(fixture.writes).not.toHaveBeenCalledWith('helper-value', { type: 'devices-shelly-ng', value: 30 });
	});

	it('real pinned Voltmeter exposes xvoltage/config but a standalone component does not register Plus1PM runtime support', async () => {
		const component = new Voltmeter(physical, 100);
		const config = { id: 100, name: 'floor helper', report_thr: 0.1, range: 0, xvoltage: { expr: 'x*10', unit: '°C' } };
		rpc.response = () => Promise.resolve(config);
		expect(await component.getConfig()).toEqual(config);
		expect(rpc.requests.at(-1)).toEqual({ method: 'Voltmeter.GetConfig', params: { id: 100 } });
		component.update({ voltage: 2.5, xvoltage: 25 });
		expect(component.xvoltage).toBe(25);
		component.update({ voltage: 2.6, xvoltage: null, errors: ['read'] });
		expect(component.xvoltage).toBe(25); // NO-GO: same pinned null-retention behavior.
		expect(physical.getComponent('voltmeter:100')).toBeUndefined();
		component.removeAllListeners();
	});
});

describe('VD2-1 real Zigbee mapper replay evidence', () => {
	let module: TestingModule;
	let writes: jest.Mock;
	beforeEach(async () => {
		const device = Object.assign(new Zigbee2mqttDeviceEntity(), {
			id: 'ambient-device',
			identifier: 'ambient',
			enabled: true,
		});
		const channel = Object.assign(new Zigbee2mqttChannelEntity(), {
			id: 'ambient-channel',
			category: ChannelCategory.TEMPERATURE,
			device,
		});
		const property = Object.assign(new Zigbee2mqttChannelPropertyEntity(), {
			id: 'ambient-value',
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			channel,
		});
		writes = jest.fn().mockResolvedValue(property);
		module = await Test.createTestingModule({
			providers: [
				{
					provide: Z2mDeviceMapperService,
					useFactory: () =>
						new Z2mDeviceMapperService(
							{ findOneBy: () => Promise.resolve(device) } as unknown as DevicesService,
							{ findAll: () => Promise.resolve([channel]) } as unknown as ChannelsService,
							{ findAll: () => Promise.resolve([property]), update: writes } as unknown as ChannelsPropertiesService,
							absent(),
							absent(),
							absent(),
							{ getDerivedPropertiesForChannel: () => [] } as unknown as ConstructorParameters<
								typeof Z2mDeviceMapperService
							>[6],
							absent(),
							absent(),
							absent(),
						),
				},
			],
		}).compile();
	});
	afterEach(async () => {
		await module.close();
	});

	it.each<Z2mDeviceStateMetadata>([{ isRetained: true }, { isCached: true }, { isRetained: false }])(
		'NO-GO: current mapper strips scalar sample provenance %j',
		async (metadata) => {
			await module.get(Z2mDeviceMapperService).updateDeviceState('ambient', { temperature: 21 }, metadata);
			expect(writes).toHaveBeenCalledTimes(1);
			const [, update] = writes.mock.calls[0] as [string, { value: unknown }];
			expect(update.value).toBe(21);
			expect(update).not.toHaveProperty('sampleOrigin');
			expect(update).not.toHaveProperty('sampledAt');
		},
	);

	it('real MQTT packet routing keeps retained metadata, but mapper loses it at scalar persistence', async () => {
		const mqtt = new FixtureMqtt();
		const pending: Promise<void>[] = [];
		const receipts: Z2mDeviceStateMetadata[] = [];
		mqtt.setCallbacks({
			onDeviceStateChanged: (name, state, metadata) => {
				receipts.push(metadata);
				pending.push(module.get(Z2mDeviceMapperService).updateDeviceState(name, state, metadata));
			},
		});
		try {
			await mqtt.connect();
			mqtt.feed({ temperature: 21 }, true);
			mqtt.feed({ temperature: 21 }, false);
			await Promise.all(pending);
			expect(receipts.map((receipt) => receipt.isRetained)).toEqual([true, false]);
			expect(writes).toHaveBeenCalledTimes(2);
			expect(mqtt.getCachedState('ambient')).toEqual({ temperature: 21 });
			const updates = (writes.mock.calls as Array<[string, unknown]>).map(([, update]) => update);
			expect(updates[0]).toEqual(updates[1]); // NO-GO: fresh packet and startup replay are indistinguishable downstream.
		} finally {
			await mqtt.disconnect();
		}
	});

	it('passes equal live temperatures twice, but does not refresh temperature when absent from the packet', async () => {
		const mapper = module.get(Z2mDeviceMapperService);
		await mapper.updateDeviceState('ambient', { temperature: 21 }, { isRetained: false });
		await mapper.updateDeviceState('ambient', { temperature: 21 }, { isRetained: false });
		await mapper.updateDeviceState('ambient', { battery: 80 }, { isRetained: false });
		expect(writes).toHaveBeenCalledTimes(2);
	});
});

describe('VD2-1 test-only application contract simulator (not production qualification)', () => {
	it.each(['cached', 'retained'] as const)(
		'replayed %s floor/ambient samples cannot authorize control at startup',
		(origin) => {
			expect(sampleEligible(sample({ origin }), 10_000, 1_000)).toBe(false);
		},
	);

	it.each([
		{ value: null },
		{ value: Number.NaN },
		{ value: Number.POSITIVE_INFINITY },
		{ valid: false },
		{ sampledAt: null },
		{ sampledAt: 11_000 },
		{ sampledAt: 9_000 },
	])('invalid/missing/future/expired sample is ineligible: %j', (overrides) => {
		expect(sampleEligible(sample(overrides), 10_000, 1_000)).toBe(false);
	});

	it('floor protection trips at the threshold, fails closed and recovers strictly below hysteresis with the same probe', () => {
		const guard = new FloorGuardContract('probe-address', 30, 1, 1_000);
		expect(guard.allowsHeating(sample({ value: 30 }), 10_000)).toBe(false);
		expect(guard.allowsHeating(sample({ value: 29 }), 10_000)).toBe(false);
		expect(guard.allowsHeating(sample({ value: 28.9, valid: false }), 10_000)).toBe(false);
		expect(guard.allowsHeating(sample({ value: 28.9, identity: 'replacement-probe' }), 10_000)).toBe(false);
		expect(guard.allowsHeating(sample({ value: 28.9 }), 10_000)).toBe(true);
		expect(guard.allowsHeating(sample({ sampledAt: 8_000 }), 10_000)).toBe(false);
	});
});
