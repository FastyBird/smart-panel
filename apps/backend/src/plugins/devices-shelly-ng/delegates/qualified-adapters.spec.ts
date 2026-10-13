import { RpcHandler, RpcParams, ShellyPlus1, ShellyPlus1Pm, ShellyPlusHt } from 'shellies-ds9';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { nativeTemperatureIdentity } from '../contracts/native-temperature.contract';
import { ShellyProtectiveQualification, protectiveReadiness } from '../contracts/protective-switch.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { PropertyMappingStorageService, TransformerRegistry } from '../mappings';
import { DeviceAddressService } from '../services/device-address.service';
import { DeviceManagerService } from '../services/device-manager.service';

import { DelegatesManagerService } from './delegates-manager.service';
import { ShellyDeviceDelegate } from './shelly-device.delegate';

/** Real pinned component classes. Only protocol transport and persistence are fixtures. */
class FixtureRpc extends RpcHandler {
	connected = true;
	readonly requests: { method: string; params?: RpcParams }[] = [];
	response: (method: string) => Promise<unknown> = (method) =>
		Promise.resolve(method === 'Shelly.GetDeviceInfo' ? { fw_id: 'fixture-firmware' } : { was_on: false });
	constructor() {
		super('qualified-adapter-fixture');
	}
	request<T>(method: string, params?: RpcParams): Promise<T> {
		this.requests.push({ method, params });
		return this.response(method) as Promise<T>;
	}
	notify(values: Record<string, unknown>): void {
		this.emit('statusUpdate', { ts: Date.now() / 1000, ...values });
	}
	destroy(): Promise<void> {
		this.connected = false;
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
const helperPeripheral = { analog_in: { 'input:100': { io: 0 } } };

const managerFixture = async (physical: ShellyPlus1Pm | ShellyPlusHt, helper = false) => {
	const device = Object.assign(new ShellyNgDeviceEntity(), { id: 'physical', identifier: physical.id, enabled: true });
	const channel = Object.assign(new ShellyNgChannelEntity(), {
		id: 'sensor',
		device,
		category: ChannelCategory.TEMPERATURE,
		identifier: helper
			? nativeTemperatureIdentity('input:100', helperConfig, helperPeripheral).channelIdentifier
			: physical instanceof ShellyPlusHt
				? 'temperature:0'
				: 'temperature:100',
	});
	const property = Object.assign(new ShellyNgChannelPropertyEntity(), {
		id: 'temperature',
		channel,
		category: PropertyCategory.TEMPERATURE,
		identifier: helper ? 'xpercent' : 'tC',
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
			findOneBy: (_field: string, value: string) => Promise.resolve(value === property.identifier ? property : null),
			reportSample,
			update,
		} as unknown as ChannelsPropertiesService,
		{ setConnectionState: () => Promise.resolve() } as unknown as DeviceConnectivityService,
		{} as DeviceManagerService,
		{ syncAddresses: () => Promise.resolve() } as unknown as DeviceAddressService,
		{ get: () => undefined } as unknown as PropertyMappingStorageService,
		{} as TransformerRegistry,
	);
	const delegate = await manager.insert(physical);
	update.mockClear();
	return { manager, delegate, reportSample, update, channel, property };
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
				(await delegate.protectiveSwitch(0, { on: true, leaseSeconds, qualification: qualification('pilot') }, 1000))
					.outcome,
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
			(await delegate.protectiveSwitch(0, { on: true, leaseSeconds: 10, qualification: qualification('other') }, 1000))
				.outcome,
		).toBe('refused');
		expect(rpc.requests.some((item) => item.method === 'Switch.Set')).toBe(false);
	});

	it('keeps timed-out ON unknown when a later OFF is accepted', async () => {
		const physical = new ShellyPlus1Pm({ id: 'pilot', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		delegate = new ShellyDeviceDelegate(physical);
		rpc.response = (method) =>
			method === 'Shelly.GetDeviceInfo' ? Promise.resolve({ fw_id: 'fixture-firmware' }) : new Promise(() => {});
		const pending = delegate.protectiveSwitch(
			0,
			{ on: true, leaseSeconds: 10, qualification: qualification('pilot') },
			1000,
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
			expect.objectContaining({ observedAt: expect.any(Date), sampledAt: expect.any(Date), provenance: 'live' }),
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
		expect(
			nativeTemperatureIdentity(
				'voltmeter:100',
				{ xvoltage: { expr: 'x/2', unit: '°C' } },
				{ voltmeter: { 'voltmeter:100': { io: 0 } } },
			).attribute,
		).toBe('xvoltage');
	});
});
