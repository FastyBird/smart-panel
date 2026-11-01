import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { NativeClimateUnit } from '../../../modules/devices/platforms/native-climate.contract';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';

import { Z2mBaseClientAdapter } from './base-client-adapter';
import { Z2mMqttClientAdapterService } from './mqtt-client-adapter.service';
import { ZigbeeNativeClimateAdapterService } from './native-climate-adapter.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';
import { ZigbeeSampleSourcesService } from './zigbee-sample-sources.service';

/** Actual shared registry/packet/lease boundary, without opening transport or actuating equipment. */
class PacketAdapter extends Z2mBaseClientAdapter {
	readonly send = jest.fn<Promise<boolean>, [string, unknown, (() => boolean)?]>().mockResolvedValue(true);
	constructor() {
		super('NativeClimateFixture');
	}
	connect(): Promise<void> {
		this.connected = true;
		return Promise.resolve();
	}
	disconnect(): Promise<void> {
		this.resetState();
		return Promise.resolve();
	}
	publishCommand(...args: Parameters<Z2mBaseClientAdapter['publishCommand']>): Promise<boolean> {
		return this.send(...args);
	}
	requestState(): Promise<boolean> {
		return Promise.resolve(true);
	}
	setPermitJoin(): Promise<boolean> {
		return Promise.resolve(true);
	}
	feed(topic: string, payload: unknown, retained = false): void {
		this.handleMessage(`zigbee2mqtt/${topic}`, JSON.stringify(payload), false, retained);
	}
}
const definition = () => ({
	model: 'fixture-simple-trv',
	vendor: 'protocol-fixture',
	exposes: [
		{
			type: 'climate',
			features: [
				{ type: 'enum', property: 'system_mode', access: 3, values: ['off', 'heat', 'auto', 'heat_cool'] },
				{
					type: 'numeric',
					property: 'occupied_heating_setpoint',
					access: 3,
					unit: '°C',
					value_min: 5,
					value_max: 30,
					value_step: 0.5,
				},
				{ type: 'numeric', property: 'local_temperature', access: 1, unit: '°C' },
				{ type: 'enum', property: 'running_state', access: 1, values: ['idle', 'heat'] },
			],
		},
	],
});
const registry = (def = definition(), software_build_id = 'fixture-v1') => [
	{
		ieee_address: '0x00124b0000000001',
		friendly_name: 'trv',
		type: 'EndDevice',
		supported: true,
		disabled: false,
		software_build_id,
		definition: def,
	},
];

describe('Zigbee native climate production profile', () => {
	let adapter: PacketAdapter;
	let service: ZigbeeNativeClimateAdapterService;
	let device: Zigbee2mqttDeviceEntity;
	let unit: NativeClimateUnit;
	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-10-31T12:00:00Z'));
		adapter = new PacketAdapter();
		await adapter.connect();
		adapter.feed('bridge/state', { state: 'online' });
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		adapter.feed('bridge/devices', registry());
		device = Object.assign(new Zigbee2mqttDeviceEntity(), { id: 'device', identifier: 'trv', enabled: true });
		service = new ZigbeeNativeClimateAdapterService(
			{ getActiveAdapter: () => adapter } as unknown as Zigbee2mqttService,
			{
				prepareDispatch: () =>
					Promise.resolve({
						bound: true,
						allowed: true,
						observedAfter: new Date(Date.now() - 1000),
						isCurrent: () => true,
					}),
			} as unknown as ZigbeeSampleSourcesService,
			{
				findAll: () =>
					Promise.resolve([
						{ id: 'heater', category: ChannelCategory.HEATER },
						{ id: 'thermostat', category: ChannelCategory.THERMOSTAT },
					]),
			} as unknown as ChannelsService,
			{
				findAll: (id: string) => Promise.resolve([{ id: `${id}-on` }, { id: `${id}-setpoint` }]),
			} as unknown as ChannelsPropertiesService,
		);
		unit = (await service.capture(device))!;
	});
	afterEach(() => jest.useRealTimers());

	it('dispatches exact native settings and snapshots the original request', async () => {
		expect(unit.physicalIdentity).toBe('zigbee2mqtt:0x00124b0000000001:default');
		expect(unit.ownedPropertyIds).toContain('heater-on');
		const request = { heatingSetpoint: 21.5 };
		const prepared = unit.prepare(request);
		request.heatingSetpoint = 29;
		expect(await prepared.dispatch(() => true)).toEqual([
			{ operation: 'heatingSetpoint', outcome: 'accepted', confirmed: false },
		]);
		expect(adapter.send).toHaveBeenCalledWith('trv', { occupied_heating_setpoint: 21.5 }, expect.any(Function));
	});

	it('preserves uncertain publication outcomes and never replays a consumed preparation', async () => {
		adapter.send.mockRejectedValueOnce(new Error('socket lost after write'));
		const prepared = unit.prepare({ mode: 'heat' });
		expect((await prepared.dispatch(() => true))[0]).toMatchObject({ outcome: 'unknown', confirmed: false });
		expect((await prepared.dispatch(() => true))[0].outcome).toBe('refused');
		expect(adapter.send).toHaveBeenCalledTimes(1);
	});

	it('refuses auto, compound, off-grid and nonfinite requests before publication', () => {
		for (const request of [
			{ mode: 'auto' as const },
			{ mode: 'heat' as const, heatingSetpoint: 20 },
			{ heatingSetpoint: 21.25 },
			{ heatingSetpoint: NaN },
			{ heatingSetpoint: 31 },
		])
			expect(unit.prepare(request)).toBeNull();
		expect(adapter.send).not.toHaveBeenCalled();
	});

	it('fences a prepared command on admission withdrawal, firmware change and offline/online cycle', async () => {
		const prepared = unit.prepare({ mode: 'heat' });
		expect((await prepared.dispatch(() => false))[0].outcome).toBe('refused');
		adapter.feed('bridge/devices', registry(definition(), 'fixture-v2'));
		expect(prepared.isCurrent()).toBe(false);
		adapter.feed('bridge/devices', registry());
		adapter.feed('trv/availability', { state: 'offline' });
		adapter.feed('trv/availability', { state: 'online' });
		expect((await prepared.dispatch(() => true))[0].outcome).toBe('refused');
		expect(adapter.send).not.toHaveBeenCalled();
	});

	it('uses explicit live packet fields; mode does not prove activity and missing temperature is not merged', () => {
		adapter.feed('trv', { local_temperature: 20, running_state: 'heat' });
		expect(unit.observe()).toMatchObject({ available: true, temperature: 20, activity: 'heating' });
		adapter.feed('trv', { system_mode: 'heat' });
		expect(unit.observe()).toMatchObject({ available: true, temperature: null, activity: null, mode: 'heat' });
		adapter.feed('trv', { local_temperature: 20 }, true);
		expect(unit.observe().available).toBe(false);
		adapter.feed('trv', { local_temperature: 20 });
		jest.advanceTimersByTime(120_001);
		expect(unit.observe().available).toBe(false);
	});

	it('preserves an older explicit measurement timestamp instead of renewing it at packet receipt', () => {
		adapter.feed('trv', { local_temperature: 20, last_seen: '2026-10-31T11:59:15Z' });
		const observed = unit.observe();
		expect(observed).toMatchObject({ available: true, temperature: 20, observedAt: '2026-10-31T11:59:15.000Z' });
		expect(observed.isCurrent()).toBe(true);
		jest.advanceTimersByTime(75_001);
		expect(observed.isCurrent()).toBe(false);
	});

	it('does not upgrade cache-merged packets or stale source timestamps', () => {
		adapter.feed('bridge/info', { config: { advanced: { cache_state: true } } });
		adapter.feed('trv', { local_temperature: 20 });
		expect(unit.observe().available).toBe(false);
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		adapter.feed('trv', { local_temperature: 20, last_seen: '2026-10-30T12:00:00Z' });
		expect(unit.observe().available).toBe(false);
	});

	it('refuses ambiguous endpoints and invalid units', async () => {
		const def = definition();
		Object.assign(def.exposes[0], { endpoint: 'left' });
		adapter.feed('bridge/devices', registry(def));
		expect(await service.capture(device)).toBeNull();
		const fahrenheit = definition();
		Object.assign(fahrenheit.exposes[0].features[1], { unit: '°F' });
		adapter.feed('bridge/devices', registry(fahrenheit));
		const limited = await service.capture(device);
		expect(limited?.capabilities.heating).toBeNull();
		expect(limited?.prepare({ heatingSetpoint: 20 })).toBeNull();
	});
});

/** Exercise the actual MQTT publisher too, replacing only the broker socket. */
class NativeMqttFixture extends Z2mMqttClientAdapterService {
	readonly publish = jest.fn((_topic: string, _payload: string, _options: unknown, callback: (error?: Error) => void) =>
		callback(),
	);
	activate(): void {
		this.connected = true;
		Reflect.set(this, 'client', { publish: this.publish });
	}
	feed(topic: string, payload: unknown): void {
		this.handleMessage(`zigbee2mqtt/${topic}`, JSON.stringify(payload));
	}
}

it('native unit reaches the production MQTT publisher with exact nonretained QoS1 settings', async () => {
	const mqtt = new NativeMqttFixture();
	mqtt.activate();
	mqtt.feed('bridge/state', { state: 'online' });
	mqtt.feed('bridge/devices', registry());
	const service = new ZigbeeNativeClimateAdapterService(
		{ getActiveAdapter: () => mqtt } as unknown as Zigbee2mqttService,
		{
			prepareDispatch: () =>
				Promise.resolve({ bound: true, allowed: true, observedAfter: new Date(0), isCurrent: () => true }),
		} as unknown as ZigbeeSampleSourcesService,
		{
			findAll: () => Promise.resolve([{ id: 'heater', category: ChannelCategory.HEATER }]),
		} as unknown as ChannelsService,
		{ findAll: () => Promise.resolve([{ id: 'mode' }, { id: 'setpoint' }]) } as unknown as ChannelsPropertiesService,
	);
	const device = Object.assign(new Zigbee2mqttDeviceEntity(), { id: 'device', identifier: 'trv', enabled: true });
	const unit = await service.capture(device);
	const outcome = await unit.prepare({ mode: 'heat' }).dispatch(() => true);
	expect(outcome[0]).toMatchObject({ outcome: 'accepted', confirmed: false });
	expect(mqtt.publish).toHaveBeenCalledWith(
		'zigbee2mqtt/trv/set',
		'{"system_mode":"heat"}',
		{ qos: 1 },
		expect.any(Function),
	);
});
