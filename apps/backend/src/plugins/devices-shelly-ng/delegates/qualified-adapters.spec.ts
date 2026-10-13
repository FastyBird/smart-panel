import { RpcParams, ShellyPlus1, ShellyPlus1Pm, ShellyPlusDimmer, ShellyPlusHt } from 'shellies-ds9';
import WebSocket from 'ws';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { nativeTemperatureIdentity, nativeVoltmeterVoltageIdentity } from '../contracts/native-temperature.contract';
import { ShellyProtectiveQualification, protectiveReadiness } from '../contracts/protective-switch.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../entities/shelly-sample-source.entity';
import { PropertyMappingStorageService, TransformerRegistry } from '../mappings';
import { DeviceAddressService } from '../services/device-address.service';
import { DeviceManagerService } from '../services/device-manager.service';
import { GuardedShellyRpcHandler } from '../services/guarded-shelly-rpc';
import { ShellySampleSourcesService } from '../services/shelly-sample-sources.service';

import { DelegatesManagerService } from './delegates-manager.service';
import { ShellyDeviceDelegate } from './shelly-device.delegate';

/** Real pinned component classes. Only protocol transport and persistence are fixtures. */
class FixtureRpc extends GuardedShellyRpcHandler {
	private fixtureConnected = true;
	override get connected(): boolean {
		return this.fixtureConnected;
	}
	protected override createSocket(): WebSocket {
		return {} as WebSocket;
	}
	protected override disconnect(): Promise<void> {
		return Promise.resolve();
	}
	readonly requests: { method: string; params?: RpcParams }[] = [];
	response: (method: string) => Promise<unknown> = (method) =>
		Promise.resolve(
			method === 'Shelly.GetDeviceInfo'
				? { id: 'pilot', model: ShellyPlus1Pm.model, fw_id: 'fixture-firmware' }
				: { was_on: false },
		);
	constructor() {
		super('fixture.invalid', { clientId: 'fixture', requestTimeout: 1, pingInterval: 0, reconnectInterval: 0 });
	}
	request<T>(method: string, params?: RpcParams): Promise<T> {
		this.requests.push({ method, params });
		return this.response(method) as Promise<T>;
	}
	notify(values: Record<string, unknown>): void {
		this.emit('statusUpdate', { ts: Date.now() / 1000, ...values });
	}
	destroy(): Promise<void> {
		this.fixtureConnected = false;
		this.removeAllListeners();
		return Promise.resolve();
	}
}

const qualification = (id: string): ShellyProtectiveQualification => ({
	deviceId: id,
	model: 'SNSW-001P16EU',
	firmware: 'fixture-firmware',
	componentId: 0,
	evidenceId: 'bench-fixture-only',
	revision: 1,
	testedLeaseSeconds: { min: 1, max: 30 },
	releaseOrderingQualified: true,
	independentProtectionQualified: true,
});
const flush = async (): Promise<void> => {
	for (let i = 0; i < 12; i++) await Promise.resolve();
};

const helperConfig = {
	id: 100,
	type: 'analog',
	enable: true,
	invert: false,
	range_map: [0, 100],
	xpercent: { expr: 'x/2', unit: '°C' },
};
const probeConfig = { id: 100, name: 'Bathroom Temperature', report_thr_C: 0.1, offset_C: 0 };
const probePeripheral = { ds18b20: { 'temperature:100': { addr: '40:255:100:6:199:204:149:177' } } };
const helperPeripheral = { analog_in: { 'input:100': { io: 0 } } };
const voltmeterConfig = { id: 100, report_thr: 0.1, range: 0, xvoltage: { expr: 'x/2', unit: '°C' } };
const voltmeterPeripheral = { voltmeter: { 'voltmeter:100': {} } };

const managerFixture = async (
	physical: ShellyPlus1Pm | ShellyPlusHt | ShellyPlusDimmer,
	helper: boolean | 'probe' | 'voltmeter' | 'raw-voltmeter' | 'switch' | 'light' = false,
) => {
	const device = Object.assign(new ShellyNgDeviceEntity(), {
		id: 'physical',
		identifier: physical.id,
		canonicalMac: '000000000001',
		enabled: true,
	});
	const channel = Object.assign(new ShellyNgChannelEntity(), {
		id: 'sensor',
		device,
		category:
			helper === 'light'
				? ChannelCategory.LIGHT
				: helper === 'switch'
					? ChannelCategory.SWITCHER
					: helper === 'raw-voltmeter'
						? ChannelCategory.ANALOG_INPUT
						: ChannelCategory.TEMPERATURE,
		identifier:
			helper === 'light'
				? 'light:0'
				: helper === 'switch'
					? 'switch:0'
					: helper === 'raw-voltmeter'
						? nativeVoltmeterVoltageIdentity('voltmeter:100', voltmeterConfig, voltmeterPeripheral, '000000000001')
								.channelIdentifier
						: helper === 'voltmeter'
							? nativeTemperatureIdentity('voltmeter:100', voltmeterConfig, voltmeterPeripheral).channelIdentifier
							: helper === 'probe'
								? nativeTemperatureIdentity('temperature:100', probeConfig, probePeripheral).channelIdentifier
								: helper
									? nativeTemperatureIdentity('input:100', helperConfig, helperPeripheral).channelIdentifier
									: physical instanceof ShellyPlusHt
										? 'temperature:0'
										: 'temperature:100',
	});
	const property = Object.assign(new ShellyNgChannelPropertyEntity(), {
		id: 'temperature',
		channel,
		category:
			helper === 'switch' || helper === 'light'
				? PropertyCategory.ON
				: helper === 'raw-voltmeter'
					? PropertyCategory.VALUE
					: PropertyCategory.TEMPERATURE,
		identifier:
			helper === 'switch' || helper === 'light'
				? 'output'
				: helper === 'raw-voltmeter'
					? 'voltage'
					: helper === 'voltmeter'
						? 'xvoltage'
						: helper === true
							? 'xpercent'
							: 'tC',
	});
	const brightness = Object.assign(new ShellyNgChannelPropertyEntity(), {
		id: 'brightness',
		channel,
		category: PropertyCategory.BRIGHTNESS,
		identifier: 'brightness',
	});
	const reportSample = jest.fn().mockResolvedValue(property);
	const update = jest.fn().mockResolvedValue(property);
	physical.wifi.update({ sta_ip: 'fixture.invalid' });
	const manager = new DelegatesManagerService(
		{ findOneBy: () => Promise.resolve(device), findOne: () => Promise.resolve(device) } as unknown as DevicesService,
		{
			findOneBy: (_field: string, value: string) =>
				Promise.resolve(
					value === String(ChannelCategory.DEVICE_INFORMATION)
						? { id: 'info' }
						: value === channel.identifier
							? channel
							: null,
				),
			findAll: () => Promise.resolve([channel]),
		} as unknown as ChannelsService,
		{
			findOneBy: (_field: string, value: string) =>
				Promise.resolve(
					value === property.identifier ? property : helper === 'light' && value === 'brightness' ? brightness : null,
				),
			reportSample,
			update,
		} as unknown as ChannelsPropertiesService,
		{ setConnectionState: () => Promise.resolve() } as unknown as DeviceConnectivityService,
		{} as DeviceManagerService,
		{ syncAddresses: () => Promise.resolve() } as unknown as DeviceAddressService,
		{ get: () => undefined } as unknown as PropertyMappingStorageService,
		{} as TransformerRegistry,
		undefined,
		undefined,
		undefined,
		{
			get: () =>
				Promise.resolve({
					metadata: Object.assign(new ShellySampleSourceEntity(), {
						propertyId: property.id,
						fingerprint: channel.identifier.split(':').at(-1),
						componentKey:
							helper === 'probe'
								? 'temperature:100'
								: helper === 'voltmeter' || helper === 'raw-voltmeter'
									? 'voltmeter:100'
									: 'input:100',
						deviceId: device.id,
					}),
					activatedAt: new Date(Date.now() - 1),
				}),
			isCurrent: () => true,
			revoke: () => {},
		} as unknown as ShellySampleSourcesService,
	);
	const delegate = await manager.insert(physical);
	update.mockClear();
	return { manager, delegate, reportSample, update, channel, property, device };
};

describe('qualified Shelly adapter boundaries', () => {
	let rpc: FixtureRpc;
	let delegate: ShellyDeviceDelegate;
	let manager: DelegatesManagerService | undefined;
	beforeEach(() => {
		jest.useFakeTimers();
		rpc = new FixtureRpc();
		jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Live network forbidden'));
	});
	afterEach(async () => {
		await manager?.detach();
		manager = undefined;
		delegate?.destroy();
		await rpc.destroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('sends qualified timed ON and absolute timer-free OFF; was_on never confirms output/drain', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		delegate = new ShellyDeviceDelegate(physical);
		const accepted = await delegate.protectiveSwitch(
			0,
			{ on: true, leaseSeconds: 30, qualification: qualification('pilot') },
			1000,
			() => true,
		);
		expect(accepted).toEqual({ outcome: 'accepted', wasOn: false, outputConfirmed: false, pendingOnDrained: false });
		expect(physical.switch0.output).toBe(false);
		await delegate.protectiveSwitch(0, { on: false }, 1000);
		const requests = rpc.requests
			.filter((item) => item.method === 'Switch.Set')
			.map((item) => JSON.parse(JSON.stringify(item.params)) as unknown);
		expect(requests).toEqual([
			{ id: 0, on: true, toggle_after: 30 },
			{ id: 0, on: false },
		]);
	});

	it.each([0, -1, NaN, Infinity, 31])(
		'refuses invalid/unqualified lease %s without energizing',
		async (leaseSeconds) => {
			const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
			delegate = new ShellyDeviceDelegate(physical);
			expect(
				(
					await delegate.protectiveSwitch(
						0,
						{ on: true, leaseSeconds, qualification: qualification('pilot') },
						1000,
						() => true,
					)
				).outcome,
			).toBe('refused');
			expect(rpc.requests.some((item) => item.method === 'Switch.Set')).toBe(false);
		},
	);

	it('requires exact hardware/model/firmware evidence, and refuses another NG model', async () => {
		expect(
			protectiveReadiness({ deviceId: 'pilot', model: ShellyPlus1Pm.model, firmware: 'fixture-firmware' }, 0),
		).toContain('hardware_evidence_missing');
		const physical = new ShellyPlus1({ id: 'other', mac: '000000000001', model: ShellyPlus1.model }, rpc);
		delegate = new ShellyDeviceDelegate(physical);
		expect(
			(
				await delegate.protectiveSwitch(
					0,
					{ on: true, leaseSeconds: 10, qualification: qualification('other') },
					1000,
					() => true,
				)
			).outcome,
		).toBe('refused');
		expect(rpc.requests.some((item) => item.method === 'Switch.Set')).toBe(false);
	});

	it('keeps timed-out ON unknown when a later OFF is accepted', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		delegate = new ShellyDeviceDelegate(physical);
		rpc.response = (method) =>
			method === 'Shelly.GetDeviceInfo'
				? Promise.resolve({ id: 'pilot', model: ShellyPlus1Pm.model, fw_id: 'fixture-firmware' })
				: new Promise(() => {});
		const pending = delegate.protectiveSwitch(
			0,
			{ on: true, leaseSeconds: 10, qualification: qualification('pilot') },
			1000,
			() => true,
		);
		await flush();
		await jest.advanceTimersByTimeAsync(1000);
		expect(await pending).toEqual({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
		rpc.response = () => Promise.resolve({ was_on: true });
		expect(await delegate.protectiveSwitch(0, { on: false }, 1000)).toEqual({
			outcome: 'accepted',
			wasOn: true,
			outputConfirmed: false,
			pendingOnDrained: false,
		});
	});

	it('forwards equal dynamic measurements from notify and polls with captured timestamps', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical);
		manager = fixture.manager;
		delegate = fixture.delegate;
		for (const tC of [25, 25, 31, null]) rpc.notify({ 'temperature:100': { tC } });
		await flush();
		expect(fixture.reportSample.mock.calls.map((call: unknown[]) => (call[1] as { value: unknown }).value)).toEqual([
			25,
			25,
			31,
			null,
		]);
		expect(fixture.update).not.toHaveBeenCalled();
		rpc.response = () => Promise.resolve({ 'temperature:100': { tC: 31 } });
		await delegate.pollStatus();
		await delegate.pollStatus();
		await flush();
		expect(
			fixture.reportSample.mock.calls.slice(-2).map((call: unknown[]) => (call[1] as { value: unknown }).value),
		).toEqual([31, 31]);
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: 31 }),
			expect.objectContaining({ provenance: 'cached' }),
		);
	});

	it('inspects raw null/error before the pinned component launders null into its old number', async () => {
		const physical = new ShellyPlusHt({ id: 'ht', mac: '000000000002', model: ShellyPlusHt.model }, rpc);
		const fixture = await managerFixture(physical);
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'temperature:0': { tC: 25 } });
		rpc.notify({ 'temperature:0': { tC: null, errors: ['read'] } });
		await flush();
		expect(fixture.reportSample.mock.calls.map((call: unknown[]) => (call[1] as { value: unknown }).value)).toEqual([
			25,
			null,
		]);
		rpc.notify({ 'temperature:0': { id: 0 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenCalledTimes(2);
	});

	it('fences an older dynamic poll after an equal notification', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		delegate = new ShellyDeviceDelegate(physical);
		const samples = jest.fn();
		delegate.on('sample', samples);
		let resolve: (value: unknown) => void;
		rpc.response = () =>
			new Promise((done) => {
				resolve = done;
			});
		const poll = delegate.pollStatus();
		rpc.notify({ 'temperature:100': { tC: 25 } });
		resolve({ 'temperature:100': { tC: 99 } });
		await poll;
		expect(samples).toHaveBeenCalledTimes(1);
	});

	it('accepts native Celsius without conversion; null has no raw percent fallback', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		rpc.response = (method) => Promise.resolve(method === 'Input.GetConfig' ? helperConfig : helperPeripheral);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'input:100': { percent: 50, xpercent: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: 25 }),
			expect.anything(),
		);
		rpc.notify({ 'input:100': { percent: 50, xpercent: null } });
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
	});

	it('qualifies a configured voltmeter with omitted default io and fences a changed input range', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		rpc.response = (method) =>
			Promise.resolve(method === 'Voltmeter.GetConfig' ? voltmeterConfig : voltmeterPeripheral);
		const fixture = await managerFixture(physical, 'voltmeter');
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'voltmeter:100': { voltage: 50, xvoltage: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: 25 }),
			expect.objectContaining({ provenance: 'live' }),
		);
		rpc.response = (method) =>
			Promise.resolve(method === 'Voltmeter.GetConfig' ? { ...voltmeterConfig, range: 1 } : voltmeterPeripheral);
		rpc.notify({ 'voltmeter:100': { voltage: 50, xvoltage: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
	});

	it('accepts only fresh configured raw volts and nulls a changed range or sensor fault', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const rawConfig = { ...voltmeterConfig, xvoltage: { expr: null, unit: null } };
		rpc.response = (method) => Promise.resolve(method === 'Voltmeter.GetConfig' ? rawConfig : voltmeterPeripheral);
		const fixture = await managerFixture(physical, 'raw-voltmeter');
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'voltmeter:100': { voltage: 2.47 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: 2.47 }),
			expect.objectContaining({ provenance: 'live' }),
		);
		rpc.response = (method) =>
			Promise.resolve(method === 'Voltmeter.GetConfig' ? { ...rawConfig, range: 1 } : voltmeterPeripheral);
		rpc.notify({ 'voltmeter:100': { voltage: 2.5 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
		rpc.response = (method) => Promise.resolve(method === 'Voltmeter.GetConfig' ? rawConfig : voltmeterPeripheral);
		rpc.notify({ 'voltmeter:100': { voltage: 2.52, errors: ['sensor_fault'] } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
	});

	it('revokes a changed helper config and fences a pending valid response after immediate null', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.response = (method) =>
			Promise.resolve(
				method === 'Input.GetConfig' ? { ...helperConfig, xpercent: { expr: 'x/3', unit: '°C' } } : helperPeripheral,
			);
		rpc.notify({ 'input:100': { xpercent: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
		fixture.reportSample.mockClear();
		let resolve: (value: unknown) => void;
		rpc.response = (method) =>
			method === 'Input.GetConfig'
				? new Promise((done) => {
						resolve = done;
					})
				: Promise.resolve(helperPeripheral);
		rpc.notify({ 'input:100': { xpercent: 25 } });
		await flush();
		rpc.notify({ 'input:100': { xpercent: null } });
		expect(fixture.reportSample).toHaveBeenCalledTimes(1);
		resolve(helperConfig);
		await flush();
		expect(fixture.reportSample).toHaveBeenCalledTimes(1);
	});

	it('invalidates source loss and fences helper callbacks across connection generations', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		let resolve: (value: unknown) => void;
		rpc.response = (method) =>
			method === 'Input.GetConfig'
				? new Promise((done) => {
						resolve = done;
					})
				: Promise.resolve(helperPeripheral);
		rpc.notify({ 'input:100': { xpercent: 25 } });
		await flush();
		rpc.emit('disconnect', 1000, '', null);
		resolve(helperConfig);
		await flush();
		expect(fixture.reportSample.mock.calls.map((call: unknown[]) => (call[1] as { value: unknown }).value)).toEqual([
			null,
		]);
	});

	it('preserves unit/expression/peripheral identity and rejects non-Celsius/native virtual assumptions', () => {
		const identity = nativeTemperatureIdentity('input:100', helperConfig, helperPeripheral);
		expect(identity).toMatchObject({ unit: '°C', attribute: 'xpercent' });
		expect(
			nativeTemperatureIdentity('input:100', { ...helperConfig, invert: true }, helperPeripheral).channelIdentifier,
		).not.toBe(identity.channelIdentifier);
		expect(
			nativeTemperatureIdentity('input:100', helperConfig, { analog_in: { 'input:100': { io: 1 } } }).channelIdentifier,
		).not.toBe(identity.channelIdentifier);
		expect(
			nativeTemperatureIdentity(
				'input:100',
				{ ...helperConfig, xpercent: { expr: 'x/2', unit: '%' } },
				helperPeripheral,
			),
		).toBeNull();
		expect(nativeTemperatureIdentity('number:100', helperConfig, helperPeripheral)).toBeNull();
		const omittedIo = nativeTemperatureIdentity('voltmeter:100', voltmeterConfig, voltmeterPeripheral);
		expect(omittedIo).toMatchObject({ peripheral: { kind: 'voltmeter', io: 0 }, configuration: { inputRange: 0 } });
		expect(
			nativeTemperatureIdentity('voltmeter:100', voltmeterConfig, { voltmeter: { 'voltmeter:100': { io: 0 } } })
				.channelIdentifier,
		).toBe(omittedIo.channelIdentifier);
		expect(
			nativeTemperatureIdentity('voltmeter:100', voltmeterConfig, { voltmeter: { 'voltmeter:100': { io: -1 } } }),
		).toBeNull();
		expect(nativeTemperatureIdentity('voltmeter:100', voltmeterConfig, {})).toBeNull();
		expect(
			nativeTemperatureIdentity(
				'voltmeter:100',
				{ ...voltmeterConfig, xvoltage: { expr: null, unit: null } },
				voltmeterPeripheral,
			),
		).toBeNull();
		expect(
			nativeTemperatureIdentity('temperature:100', { ...probeConfig, offset_C: 0.5 }, probePeripheral)
				.channelIdentifier,
		).not.toBe(nativeTemperatureIdentity('temperature:100', probeConfig, probePeripheral).channelIdentifier);
		expect(
			nativeTemperatureIdentity('temperature:100', { ...probeConfig, report_thr_C: 0.2 }, probePeripheral)
				.channelIdentifier,
		).not.toBe(nativeTemperatureIdentity('temperature:100', probeConfig, probePeripheral).channelIdentifier);
		expect(
			nativeTemperatureIdentity(
				'voltmeter:100',
				{ id: 100, xvoltage: { expr: 'x/2', unit: '°C' } },
				{ voltmeter: { 'voltmeter:100': { io: 0 } } },
			).attribute,
		).toBe('xvoltage');
		const raw = nativeVoltmeterVoltageIdentity('voltmeter:100', voltmeterConfig, voltmeterPeripheral, '000000000001');
		expect(raw).toMatchObject({ attribute: 'voltage', unit: 'V', expression: null });
		expect(
			nativeVoltmeterVoltageIdentity(
				'voltmeter:100',
				{ ...voltmeterConfig, xvoltage: { expr: null, unit: null } },
				voltmeterPeripheral,
				'000000000001',
			).fingerprint,
		).toBe(raw.fingerprint);
		for (const changed of [
			nativeVoltmeterVoltageIdentity(
				'voltmeter:100',
				{ ...voltmeterConfig, range: 1 },
				voltmeterPeripheral,
				'000000000001',
			),
			nativeVoltmeterVoltageIdentity(
				'voltmeter:100',
				voltmeterConfig,
				{ voltmeter: { 'voltmeter:100': { io: 1 } } },
				'000000000001',
			),
			nativeVoltmeterVoltageIdentity('voltmeter:100', voltmeterConfig, voltmeterPeripheral, '000000000002'),
		])
			expect(changed.fingerprint).not.toBe(raw.fingerprint);
		expect(
			nativeVoltmeterVoltageIdentity('voltmeter:100', { id: 100 }, voltmeterPeripheral, '000000000001'),
		).toBeNull();
		expect(nativeVoltmeterVoltageIdentity('voltmeter:100', voltmeterConfig, {}, '000000000001')).toBeNull();
		expect(nativeVoltmeterVoltageIdentity('voltmeter:100', voltmeterConfig, voltmeterPeripheral, null)).toBeNull();
	});
	it('accepts address-bound add-on probes and revokes peripheral replacement', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		rpc.response = (method) => Promise.resolve(method === 'Temperature.GetConfig' ? probeConfig : probePeripheral);
		const fixture = await managerFixture(physical, 'probe');
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'temperature:100': { tC: 25 } });
		await flush();
		rpc.notify({ 'temperature:100': { tC: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenCalledTimes(2);
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: 25 }),
			expect.objectContaining({ provenance: 'live' }),
		);
		rpc.response = (method) =>
			Promise.resolve(
				method === 'Temperature.GetConfig' ? probeConfig : { ds18b20: { 'temperature:100': { addr: 'replacement' } } },
			);
		rpc.notify({ 'temperature:100': { tC: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
	});

	it('revokes a probe packet when its Celsius calibration changes', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		rpc.response = (method) => Promise.resolve(method === 'Temperature.GetConfig' ? probeConfig : probePeripheral);
		const fixture = await managerFixture(physical, 'probe');
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'temperature:100': { tC: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: 25 }),
			expect.anything(),
		);
		rpc.response = (method) =>
			Promise.resolve(method === 'Temperature.GetConfig' ? { ...probeConfig, offset_C: 0.5 } : probePeripheral);
		rpc.notify({ 'temperature:100': { tC: 25 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
	});

	it('full polling source loss invalidates immediately; an absent field in a partial notify does not', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'input:100': { id: 100 } });
		expect(fixture.reportSample).not.toHaveBeenCalled();
		rpc.response = () => Promise.resolve({ 'switch:0': { output: false } });
		await delegate.pollStatus();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.objectContaining({ provenance: 'live' }),
		);
	});

	it('rejects a full poll response from a previous connection generation', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		delegate = new ShellyDeviceDelegate(physical);
		const samples = jest.fn();
		delegate.on('sample', samples);
		let resolve: (value: unknown) => void;
		rpc.response = () =>
			new Promise((done) => {
				resolve = done;
			});
		const pending = delegate.pollStatus();
		rpc.emit('disconnect', 1000, '', null);
		rpc.emit('connect');
		resolve({ 'temperature:100': { tC: 25 } });
		expect(await pending).toBe(false);
		expect(samples).not.toHaveBeenCalled();
	});

	it('detach revokes eligibility and fences pending configuration callbacks before finishing', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		let resolve: (value: unknown) => void;
		rpc.response = (method) =>
			method === 'Input.GetConfig'
				? new Promise((done) => {
						resolve = done;
					})
				: Promise.resolve(helperPeripheral);
		rpc.notify({ 'input:100': { xpercent: 25 } });
		await flush();
		const detached = manager.detach();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
		resolve(helperConfig);
		await detached;
		expect(fixture.reportSample).toHaveBeenCalledTimes(1);
		rpc.notify({ 'input:100': { xpercent: 25 } });
		expect(fixture.reportSample).toHaveBeenCalledTimes(1);
	});
	it('keeps an already-submitted sample guard false after disconnect while core admission is pending', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		rpc.response = (method) => Promise.resolve(method === 'Input.GetConfig' ? helperConfig : helperPeripheral);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		let evidence: { isCurrent(): boolean };
		let finish: () => void;
		fixture.reportSample.mockImplementation(
			(_id: string, dto: { value: unknown }, captured: { isCurrent(): boolean }) => {
				if (dto.value === null) return Promise.resolve(fixture.property);
				evidence = captured;
				return new Promise((resolve) => {
					finish = () => resolve(fixture.property);
				});
			},
		);
		rpc.notify({ 'input:100': { xpercent: 25 } });
		await flush();
		expect(evidence.isCurrent()).toBe(true);
		rpc.emit('disconnect', 1000, '', null);
		expect(evidence.isCurrent()).toBe(false);
		finish();
		await flush();
	});

	it('admits equal native Light output/brightness and immediate null through the physical sample boundary', async () => {
		const physical = new ShellyPlusDimmer({ id: 'dimmer', mac: '000000000002', model: ShellyPlusDimmer.model }, rpc);
		const fixture = await managerFixture(physical, 'light');
		manager = fixture.manager;
		delegate = fixture.delegate;
		fixture.reportSample.mockClear();
		rpc.notify({ 'light:0': { output: false, brightness: 42 } });
		await flush();
		rpc.notify({ 'light:0': { output: false, brightness: 42 } });
		await flush();
		expect(fixture.reportSample).toHaveBeenCalledTimes(4);
		expect(
			fixture.reportSample.mock.calls
				.filter(([id]) => id === 'brightness')
				.map(([, dto]) => (dto as { value: unknown }).value),
		).toEqual([42, 42]);
		rpc.notify({ 'light:0': { brightness: null } });
		await flush();
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'brightness',
			expect.objectContaining({ value: null }),
			expect.objectContaining({ provenance: 'live' }),
		);
		// Missing output in the brightness fault cannot renew the output measurement.
		expect(fixture.reportSample.mock.calls.filter(([id]) => id === 'temperature')).toHaveLength(2);
	});

	it('refuses protective ON on a disabled source while absolute protective OFF remains available', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical);
		manager = fixture.manager;
		delegate = fixture.delegate;
		fixture.device.enabled = false;
		expect(
			await manager.protectiveSwitch(
				'pilot',
				0,
				{ on: true, leaseSeconds: 10, qualification: qualification('pilot') },
				1000,
			),
		).toEqual({ outcome: 'refused', reasons: ['source_disabled_or_missing'] });
		expect(rpc.requests).toHaveLength(0);
		expect((await manager.protectiveSwitch('pilot', 0, { on: false }, 1000)).outcome).toBe('accepted');
	});
	it('retains stable source authority while a newer valid helper proof is blocked, and a fault revokes admission immediately', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		rpc.response = (method) => Promise.resolve(method === 'Input.GetConfig' ? helperConfig : helperPeripheral);
		const fixture = await managerFixture(physical, true);
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'input:100': { xpercent: 25 } });
		await flush();
		const first = (
			fixture.reportSample.mock.calls[0] as unknown as [
				string,
				unknown,
				{ isCurrent(): boolean; sourceIsCurrent(): boolean },
			]
		)[2];
		expect(first.sourceIsCurrent()).toBe(true);
		let finish: (value: unknown) => void;
		rpc.response = (method) =>
			method === 'Input.GetConfig'
				? new Promise((resolve) => {
						finish = resolve;
					})
				: Promise.resolve(helperPeripheral);
		rpc.notify({ 'input:100': { xpercent: 26 } });
		await flush();
		expect(first.isCurrent()).toBe(false);
		expect(first.sourceIsCurrent()).toBe(true);
		expect(fixture.reportSample).toHaveBeenCalledTimes(1);
		rpc.notify({ 'input:100': { xpercent: null, errors: ['read'] } });
		expect(fixture.reportSample).toHaveBeenLastCalledWith(
			'temperature',
			expect.objectContaining({ value: null }),
			expect.anything(),
		);
		finish(helperConfig);
		await flush();
		expect(fixture.reportSample).toHaveBeenCalledTimes(2);
	});
	it('routes switch output exclusively through raw sample admission, including equal reports and null', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const fixture = await managerFixture(physical, 'switch');
		manager = fixture.manager;
		delegate = fixture.delegate;
		rpc.notify({ 'switch:0': { output: true } });
		await flush();
		rpc.notify({ 'switch:0': { output: true } });
		await flush();
		rpc.notify({ 'switch:0': { output: null } });
		await flush();
		expect(fixture.reportSample.mock.calls.map((call: unknown[]) => (call[1] as { value: unknown }).value)).toEqual([
			true,
			true,
			null,
		]);
		expect(fixture.update).not.toHaveBeenCalled();
	});
});
