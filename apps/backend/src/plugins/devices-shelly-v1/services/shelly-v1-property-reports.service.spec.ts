import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';
import { PropertyReadRequest } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { currentSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import * as shelly from '../lib/shellies';

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from './shelly-v1-adopted-identity.service';
import { ShellyV1PropertyReportsService } from './shelly-v1-property-reports.service';

function setup(temperature = false, id = 'AABBCCDDEEFF') {
	const device = Object.assign(new ShellyV1DeviceEntity(), { id: 'panel-device', identifier: id, enabled: true });
	const registration = { id, type: temperature ? 'SHHT-1' : 'SHSW-1', host: '192.168.1.5', enabled: true };
	const peer = { ...registration, online: true, relay0: true, getStatus: jest.fn<Promise<ShellyStatusResponse>, []>() };
	const channel = { id: 'channel', identifier: temperature ? 'temperature_0' : 'relay_0' };
	const property = {
		id: 'property',
		identifier: temperature ? 'temperature' : 'state',
		category: temperature ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
		dataType: temperature ? DataTypeType.FLOAT : DataTypeType.BOOL,
	};
	const adapter = {
		isRunning: () => true,
		getRegisteredDevice: jest.fn().mockReturnValue(registration),
		getDevice: () => peer,
	};
	const reportSample = jest
		.fn<Promise<unknown>, [string, { value: unknown }, PropertySampleEvidence]>()
		.mockResolvedValue(null);
	const findChannel = jest.fn(() => Promise.resolve(channel));
	const findDevice = jest.fn(() => Promise.resolve(device));
	const expected = jest.fn(() => Promise.resolve<string | null>('AABBCCDDEEFF'));
	jest.spyOn(shelly, 'readShellyRelayStatus').mockImplementation(async (source, dispatching) => {
		dispatching();
		try {
			return { sent: true, status: await source.getStatus() };
		} catch {
			return { sent: true };
		}
	});
	const service = new ShellyV1PropertyReportsService(
		adapter as unknown as ShelliesAdapterService,
		{ findOneBy: findDevice } as unknown as DevicesService,
		{ findOneBy: findChannel } as unknown as ChannelsService,
		{
			findOneBy: () => Promise.resolve(property),
			reportSample,
		} as unknown as ChannelsPropertiesService,
		{ expected } as unknown as ShellyV1AdoptedIdentityService,
	);
	let boundary = -1;
	const target = {
		device,
		channel,
		property,
		dispatching: jest.fn(() => {
			boundary = currentSampleIngress();
		}),
	} as unknown as PropertyReadRequest;
	return {
		id,
		device,
		reportSample,
		findChannel,
		findDevice,
		expected,
		registration,
		peer,
		target,
		adapter,
		service,
		boundary: () => boundary,
	};
}

describe('Shelly Gen1 physical property reports', () => {
	afterEach(() => jest.restoreAllMocks());
	it('reads an unchanged OFF from the addressed relay after dispatch, independently of its cached or commanded value', async () => {
		const f = setup();
		f.peer.getStatus.mockResolvedValue({ mac: f.id, relays: [{ ison: false }] } as ShellyStatusResponse);
		expect(await f.service.read(f.device, f.target)).toBe(true);
		const [id, update, evidence] = f.reportSample.mock.calls[0];
		expect(id).toBe('property');
		expect(update.value).toBe(false);
		expect(evidence.provenance).toBe('live');
		expect(evidence.ingressSequence).toBeGreaterThan(f.boundary());
		expect(evidence.sampledAt.getTime()).toBeLessThanOrEqual(evidence.receivedAt.getTime());
		expect(evidence.sourceIsCurrent()).toBe(true);
		f.adapter.getRegisteredDevice.mockReturnValue({ ...f.registration });
		expect(evidence.sourceIsCurrent()).toBe(false);
	});

	it.each([
		{ mac: 'BB99CCDDEEFF', relays: [{ ison: false }] },
		{ mac: 'AABBCCDDEEFF', relays: [{ ison: 0 }] },
		{ mac: 'AABBCCDDEEFF', lights: [{ ison: false }] },
	])('withholds foreign, malformed and unrelated status values', async (status) => {
		const f = setup();
		f.peer.getStatus.mockResolvedValue(status as unknown as ShellyStatusResponse);
		await f.service.read(f.device, f.target);
		expect(f.reportSample).not.toHaveBeenCalled();
	});

	it('verifies the pinned MAC before accepting a legacy short CoIoT address', async () => {
		const f = setup(false, 'DDEEFF');
		f.peer.getStatus
			.mockResolvedValueOnce({ mac: '112233DDEEFF', relays: [{ ison: false }] } as ShellyStatusResponse)
			.mockResolvedValueOnce({ mac: 'AABBCCDDEEFF', relays: [{ ison: false }] } as ShellyStatusResponse);
		await f.service.read(f.device, f.target);
		expect(f.reportSample).not.toHaveBeenCalled();
		await f.service.read(f.device, f.target);
		expect(f.reportSample).toHaveBeenCalledTimes(1);
		f.expected.mockResolvedValue(null);
		f.peer.getStatus.mockResolvedValue({ mac: 'AABBCCDDEEFF', relays: [{ ison: false }] } as ShellyStatusResponse);
		await f.service.read(f.device, f.target);
		expect(f.reportSample).toHaveBeenCalledTimes(1);
	});

	it('keeps unrelated reports current and retires only the edited or deleted device binding', async () => {
		const f = setup();
		const status = { mac: f.id, relays: [{ ison: false }] } as ShellyStatusResponse;
		f.peer.getStatus.mockResolvedValue(status);
		await f.service.read(f.device);
		const original = f.reportSample.mock.calls[0][2];
		const inFlight = f.service.capture(f.device);
		f.service.propertyChanged({
			id: 'another-property',
			channel: { id: 'other-channel', device: { id: 'other-device' } },
		});
		f.service.channelChanged({ id: 'other-channel', device: 'other-device' });
		f.service.invalidate({ id: 'other-device' });
		expect(original.sourceIsCurrent()).toBe(true);
		await f.service.publish(inFlight, status, new Date());
		expect(f.reportSample).toHaveBeenCalledTimes(2);
		f.service.propertyChanged({ channel: 'channel' });
		expect(original.sourceIsCurrent()).toBe(false);
		await f.service.publish(inFlight, status, new Date());
		expect(f.reportSample).toHaveBeenCalledTimes(2);
		await f.service.read(f.device);
		const replacement = f.reportSample.mock.calls[2][2];
		f.service.propertyChanged({ id: 'property' });
		expect(replacement.sourceIsCurrent()).toBe(false);
	});

	it.each([false, true])(
		'coalesces change notifications into a later GET even if the first read fails=%s',
		async (fails) => {
			const f = setup();
			let finish: (status: ShellyStatusResponse) => void, reject: (error: Error) => void;
			const waiting = new Promise<ShellyStatusResponse>((ok, no) => {
				finish = ok;
				reject = no;
			});
			const status = { mac: f.id, relays: [{ ison: false }] } as ShellyStatusResponse;
			f.peer.getStatus.mockReturnValueOnce(waiting).mockResolvedValue(status);
			const first = f.service.refresh(f.device);
			await Promise.resolve();
			const changes = [f.service.refresh(f.device), f.service.refresh(f.device)];
			expect(f.peer.getStatus).toHaveBeenCalledTimes(1);
			await f.service.read(f.device, f.target);
			expect(f.peer.getStatus).toHaveBeenCalledTimes(2);
			if (fails) reject(new Error('lost response'));
			else finish({ ...status, relays: [{ ison: true }] });
			await Promise.all([first, ...changes]);
			expect(f.peer.getStatus).toHaveBeenCalledTimes(3);
			expect(f.reportSample.mock.calls.map(([, update]) => update.value)).toEqual(
				fails ? [false, false] : [false, true, false],
			);
		},
	);

	it('withdraws an in-flight and an already accepted sample after a binding changes', async () => {
		const f = setup();
		const old = f.service.capture(f.device);
		f.service.invalidate({ type: DEVICES_SHELLY_V1_TYPE });
		const status = { mac: f.id, relays: [{ ison: false }] } as ShellyStatusResponse;
		await f.service.publish(old, status, new Date());
		expect(f.reportSample).not.toHaveBeenCalled();
		f.peer.getStatus.mockResolvedValue(status);
		await f.service.read(f.device);
		const evidence = f.reportSample.mock.calls[0][2];
		f.service.invalidate({ type: DEVICES_SHELLY_V1_TYPE });
		expect(evidence.sourceIsCurrent()).toBe(false);
	});

	it('takes temperature from an original sleeping probe notification at its receipt time without a network read', async () => {
		const f = setup(true);
		const receivedAt = new Date(Date.now() - 5_000);
		let current = true;
		const report = {
			deviceId: f.id,
			value: 21.75,
			receivedAt,
			ingressSequence: 28,
			isCurrent: () => current,
			isLatest: () => true,
		};
		await f.service.temperature(report);
		expect(f.peer.getStatus).not.toHaveBeenCalled();
		expect(f.reportSample).toHaveBeenCalledWith(
			'property',
			{ type: DEVICES_SHELLY_V1_TYPE, value: 21.75 },
			expect.objectContaining({ sampledAt: receivedAt, receivedAt, ingressSequence: 28 }),
		);
		const evidence = f.reportSample.mock.calls[0][2];
		expect(evidence.sourceIsCurrent()).toBe(true);
		current = false;
		expect(evidence.sourceIsCurrent()).toBe(false);
		await f.service.temperature(report);
		expect(f.reportSample).toHaveBeenCalledTimes(1);
	});
	it('drops a pre-reboot report while its channel lookup is pending', async () => {
		const f = setup(true);
		let current = true;
		let release: () => void;
		const wait = new Promise<void>((resolve) => {
			release = resolve;
		});
		f.findChannel.mockImplementationOnce(async () => {
			await wait;
			return { id: 'channel', identifier: 'temperature_0' };
		});
		const admission = f.service.temperature({
			deviceId: f.id,
			value: 21,
			receivedAt: new Date(),
			ingressSequence: 22,
			isCurrent: () => current,
			isLatest: () => true,
		});
		await Promise.resolve();
		expect(f.findChannel).toHaveBeenCalled();
		current = false;
		release();
		await admission;
		expect(f.reportSample).not.toHaveBeenCalled();
	});

	it.each([21.75, null])(
		'waits for actual publication of its own observation, including a fault (%s)',
		async (value) => {
			const f = setup(true);
			let latest = true;
			const report = {
				deviceId: f.id,
				value,
				receivedAt: new Date(),
				ingressSequence: 9,
				isCurrent: () => true,
				isLatest: () => latest,
			};
			f.findDevice.mockResolvedValueOnce(null);
			await expect(f.service.temperature(report)).resolves.toBe(false);
			f.findChannel.mockResolvedValueOnce(null);
			await expect(f.service.temperature(report)).resolves.toBe(false);
			expect(f.reportSample).not.toHaveBeenCalled();
			f.reportSample.mockImplementationOnce((id, _update, evidence) => {
				f.service.temperaturePublished({ propertyId: 'unrelated', evidence });
				f.service.temperaturePublished({ propertyId: id, evidence: { ...evidence, ingressSequence: 8 } });
				return Promise.resolve();
			});
			await expect(f.service.temperature(report)).resolves.toBe(false);
			f.reportSample.mockImplementationOnce((propertyId, _update, evidence) => {
				f.service.temperaturePublished(value === null ? { propertyId, evidence } : { propertyId, sample: evidence });
				return Promise.reject(new Error('a later listener failed after publication'));
			});
			await expect(f.service.temperature(report)).resolves.toBe(true);
			const evidence = f.reportSample.mock.lastCall[2];
			latest = false;
			expect(evidence.isCurrent()).toBe(false);
			expect(evidence.sourceIsCurrent()).toBe(true);
		},
	);

	it('keeps a suppressed report bound to its original mapped property on retry', async () => {
		const f = setup(true);
		const report = {
			deviceId: f.id,
			value: 18,
			receivedAt: new Date(),
			ingressSequence: 42,
			isCurrent: () => true,
			isLatest: () => true,
		};
		await expect(f.service.temperature(report)).resolves.toBe(false);
		f.service.propertyChanged({ type: DEVICES_SHELLY_V1_TYPE, id: 'property' });
		await expect(f.service.temperature(report)).resolves.toBe(false);
		expect(f.reportSample).toHaveBeenCalledTimes(1);
	});
});
