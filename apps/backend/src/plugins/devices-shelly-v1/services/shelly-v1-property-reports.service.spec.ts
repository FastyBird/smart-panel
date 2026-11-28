import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';
import { PropertyReadRequest } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { currentSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { RegisteredDevice, ShellyTemperatureReport } from '../interfaces/shellies.interface';
import { ShellyInfoResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import * as shelly from '../lib/shellies';

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';
import { ShellyV1PropertyReportsService } from './shelly-v1-property-reports.service';

function setup(temperature = false, id = 'AABBCCDDEEFF', catalogIdentifier = id) {
	const device = Object.assign(new ShellyV1DeviceEntity(), {
		id: 'panel-device',
		identifier: catalogIdentifier,
		enabled: true,
		hostname: '192.168.1.5',
	});
	const registration: RegisteredDevice = {
		id,
		type: temperature ? 'SHHT-1' : 'SHSW-1',
		host: '192.168.1.5',
		enabled: true,
	};
	if (catalogIdentifier !== id) registration.catalog = { deviceId: device.id, mac: 'AABBCCDDEEFF' };
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
		getRegisteredDevice: jest.fn((rawId: string, type?: string): RegisteredDevice | undefined =>
			rawId === id && (type === undefined || type === registration.type) ? registration : undefined,
		),
		getRegisteredDeviceForCatalog: jest.fn((row: ShellyV1DeviceEntity): RegisteredDevice | undefined => {
			const active = adapter.getRegisteredDevice(id, registration.type);
			return active && (active.catalog ? active.catalog.deviceId === row.id : active.id === row.identifier)
				? active
				: undefined;
		}),
		getDevice: jest.fn((type: string, rawId: string) =>
			rawId === id && type === registration.type ? peer : undefined,
		),
	};
	const reportSample = jest
		.fn<Promise<unknown>, [string, { value: unknown }, PropertySampleEvidence]>()
		.mockResolvedValue(null);
	const findChannel = jest.fn(() => Promise.resolve(channel));
	const findDevice = jest.fn((column: 'id' | 'identifier', value: string) =>
		Promise.resolve(device[column] === value ? device : null),
	);
	const expected = jest.fn(() => Promise.resolve<string | null>('AABBCCDDEEFF'));
	const pin = { mac: 'AABBCCDDEEFF', verifiedHost: registration.host, revision: 1 };
	const findPin = jest.fn(() => Promise.resolve<typeof pin | null>({ ...pin }));
	const confirmHost = jest.fn((_id: string, mac: string, host: string, previous: string | null, revision: number) => {
		if (mac !== pin.mac || previous !== pin.verifiedHost || revision !== pin.revision) return Promise.resolve(false);
		pin.verifiedHost = host;
		pin.revision++;
		return Promise.resolve(true);
	});
	const info: ShellyInfoResponse = { type: registration.type, mac: pin.mac, auth: false, fw: '1.14', longid: 0 };
	const getDeviceInfo = jest.fn((_host: string) => Promise.resolve(info));
	const move = (host: string) => {
		peer.host = host;
		adapter.getRegisteredDevice.mockReturnValue({ ...registration, host });
	};
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
		{ expected, findPin, confirmHost } as unknown as ShellyV1AdoptedIdentityService,
		{ getDeviceInfo } as unknown as ShellyV1HttpClientService,
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
		pin,
		findPin,
		confirmHost,
		info,
		getDeviceInfo,
		move,
		registration,
		peer,
		target,
		adapter,
		service,
		boundary: () => boundary,
	};
}

function temperatureReport(
	deviceId: string,
	ingressSequence: number,
	value: number | null = 20,
): ShellyTemperatureReport {
	return {
		deviceId,
		deviceType: 'SHHT-1',
		value,
		receivedAt: new Date(),
		ingressSequence,
		isCurrent: () => true,
		isLatest: () => true,
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
		['shelly1-DDEEFF', 'shelly1-AABBCCDDEEFF'],
		['shelly1-AABBCCDDEEFF', 'shelly1-DDEEFF'],
	])('reads a verified peer %s for the renamed catalog identifier %s', async (rawId, identifier) => {
		const f = setup(false, rawId, identifier);
		f.peer.getStatus.mockResolvedValue({ mac: f.pin.mac, relays: [{ ison: false }] } as ShellyStatusResponse);
		await expect(f.service.read(f.device, f.target)).resolves.toBe(true);
		expect(f.target.dispatching).toHaveBeenCalledTimes(1);
		const [, update, evidence] = f.reportSample.mock.calls[0];
		expect(update.value).toBe(false);
		expect(evidence.ingressSequence).toBeGreaterThan(f.boundary());
		expect(evidence.sourceIsCurrent()).toBe(true);
		f.adapter.getDevice.mockReturnValue({ ...f.peer });
		expect(evidence.sourceIsCurrent()).toBe(false);
	});

	it.each(['foreign pin', 'moved pin', 'missing pin', 'failed pin lookup', 'replaced registration'])(
		'withholds the alias status request after a %s',
		async (change) => {
			const f = setup(false, 'shelly1-DDEEFF', 'shelly1-AABBCCDDEEFF');
			f.findPin.mockImplementationOnce(() => {
				if (change === 'replaced registration') f.adapter.getRegisteredDevice.mockReturnValue({ ...f.registration });
				if (change === 'failed pin lookup') return Promise.reject(new Error('catalog unavailable'));
				if (change === 'missing pin') return Promise.resolve(null);
				return Promise.resolve({
					...f.pin,
					mac: change === 'foreign pin' ? '112233DDEEFF' : f.pin.mac,
					verifiedHost: change === 'moved pin' ? '192.168.1.6' : f.pin.verifiedHost,
				});
			});
			await expect(f.service.read(f.device, f.target)).resolves.toBe(false);
			expect(f.peer.getStatus).not.toHaveBeenCalled();
			expect(f.target.dispatching).not.toHaveBeenCalled();
			expect(f.reportSample).not.toHaveBeenCalled();
		},
	);

	it('rejects a mismatched same-suffix status or a binding replaced during the alias read', async () => {
		const f = setup(false, 'shelly1-DDEEFF', 'shelly1-AABBCCDDEEFF');
		f.peer.getStatus.mockResolvedValueOnce({ mac: '112233DDEEFF', relays: [{ ison: true }] } as ShellyStatusResponse);
		await f.service.read(f.device, f.target);
		f.peer.getStatus.mockImplementationOnce(() => {
			f.adapter.getRegisteredDevice.mockReturnValue({ ...f.registration });
			return Promise.resolve({ mac: f.pin.mac, relays: [{ ison: true }] } as ShellyStatusResponse);
		});
		await f.service.read(f.device, f.target);
		expect(f.peer.getStatus).toHaveBeenCalledTimes(2);
		expect(f.reportSample).not.toHaveBeenCalled();
	});

	it('drops a queued change refresh when its originating registration is replaced', async () => {
		const f = setup(false, 'shelly1-DDEEFF', 'shelly1-AABBCCDDEEFF');
		const queued = f.service.refresh(f.device, () => f.adapter.getRegisteredDevice(f.id) === f.registration);
		f.adapter.getRegisteredDevice.mockReturnValue({ ...f.registration });
		await expect(queued).resolves.toBe(false);
		expect(f.peer.getStatus).not.toHaveBeenCalled();
		expect(f.reportSample).not.toHaveBeenCalled();
	});

	it.each([
		{ mac: 'BB99CCDDEEFF', relays: [{ ison: false }] },
		{ mac: 'AABBCCDDEEFF', relays: [{ ison: 0 }] },
		{ mac: 'AABBCCDDEEFF', relays: { 0: { ison: true } } },
		{ mac: 'AABBCCDDEEFF', relays: true },
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
			deviceType: f.peer.type,
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

	it('reports sleeping sensor values and faults against the verified catalog UUID while the raw peer stays current', async () => {
		const f = setup(true, 'shellyht-DDEEFF', 'shellyht-AABBCCDDEEFF');
		// A relay with the same short ID makes an untyped SDK lookup ambiguous.
		f.adapter.getRegisteredDevice.mockImplementation((id, type) =>
			id === f.id && type === f.registration.type ? f.registration : undefined,
		);
		const value = temperatureReport(f.id, 17, 21);
		const fault = temperatureReport(f.id, 18, null);
		await f.service.temperature(value);
		await f.service.temperature(fault);
		expect(f.findDevice.mock.calls).toEqual([
			['id', f.device.id, DEVICES_SHELLY_V1_TYPE],
			['id', f.device.id, DEVICES_SHELLY_V1_TYPE],
		]);
		expect(f.reportSample.mock.calls.map(([, update, evidence]) => [update.value, evidence.sampledAt])).toEqual([
			[21, value.receivedAt],
			[null, fault.receivedAt],
		]);
		const evidence = f.reportSample.mock.lastCall[2];
		expect(evidence.sourceIsCurrent()).toBe(true);
		f.findPin.mockResolvedValueOnce({ ...f.pin, mac: '112233DDEEFF' });
		await f.service.temperature(temperatureReport(f.id, 19));
		f.findPin.mockResolvedValueOnce({ ...f.pin, verifiedHost: '192.168.1.8' });
		await f.service.temperature(temperatureReport(f.id, 20));
		f.adapter.getRegisteredDevice.mockReturnValue({ ...f.registration });
		expect(evidence.sourceIsCurrent()).toBe(false);
		await f.service.temperature(fault);
		expect(f.reportSample).toHaveBeenCalledTimes(2);
		expect(f.getDeviceInfo).not.toHaveBeenCalled();
		expect(f.peer.getStatus).not.toHaveBeenCalled();
	});
	it('drops a pre-reboot report while its channel lookup is pending', async () => {
		const f = setup(true);
		let current = true;
		let started: () => void;
		const lookup = new Promise<void>((resolve) => {
			started = resolve;
		});
		let release: () => void;
		const wait = new Promise<void>((resolve) => {
			release = resolve;
		});
		f.findChannel.mockImplementationOnce(async () => {
			started();
			await wait;
			return { id: 'channel', identifier: 'temperature_0' };
		});
		const admission = f.service.temperature({
			deviceId: f.id,
			deviceType: f.peer.type,
			value: 21,
			receivedAt: new Date(),
			ingressSequence: 22,
			isCurrent: () => current,
			isLatest: () => true,
		});
		await lookup;
		current = false;
		release();
		await admission;
		expect(f.reportSample).not.toHaveBeenCalled();
	});

	it('reads a sleeping short-ID sensor passively at its confirmed address, including after a failed move', async () => {
		const f = setup(true, 'DDEEFF');
		await f.service.temperature(temperatureReport(f.id, 1));
		await f.service.temperature(temperatureReport(f.id, 2));
		expect(f.getDeviceInfo).not.toHaveBeenCalled();
		expect(f.reportSample).toHaveBeenCalledTimes(2);
		const evidence = f.reportSample.mock.calls[1][2];
		f.move('192.168.1.6');
		f.device.hostname = f.peer.host;
		expect(evidence.sourceIsCurrent()).toBe(false);
		f.getDeviceInfo
			.mockResolvedValueOnce({ ...f.info, mac: '112233DDEEFF' })
			.mockResolvedValueOnce({ ...f.info, type: 'SHSW-1' })
			.mockRejectedValueOnce(new Error('sleeping'));
		await f.service.temperature(temperatureReport(f.id, 3));
		await f.service.temperature(temperatureReport(f.id, 4, null));
		await f.service.temperature(temperatureReport(f.id, 5));
		expect(f.getDeviceInfo.mock.calls).toEqual(Array(3).fill(['192.168.1.6']));
		expect(f.confirmHost).not.toHaveBeenCalled();
		expect(f.reportSample).toHaveBeenCalledTimes(2);
		f.move(f.registration.host);
		await f.service.temperature(temperatureReport(f.id, 6));
		expect(f.reportSample).toHaveBeenCalledTimes(3);
		expect(f.getDeviceInfo).toHaveBeenCalledTimes(3);
	});

	it.each([null, '192.168.1.5'])(
		'verifies the hardware once when the last verified host was %s and preserves sample time',
		async (previousHost) => {
			const f = setup(true, 'DDEEFF');
			f.pin.verifiedHost = previousHost;
			f.move('192.168.1.6');
			f.device.hostname = f.peer.host;
			const report = temperatureReport(f.id, 9);
			f.getDeviceInfo.mockRejectedValueOnce(new Error('sleeping'));
			await expect(f.service.temperature(report)).resolves.toBe(false);
			expect(f.reportSample).not.toHaveBeenCalled();
			await f.service.temperature(report);
			expect(f.confirmHost).toHaveBeenCalledWith(f.device.id, f.pin.mac, f.peer.host, previousHost, 1);
			expect(f.reportSample).toHaveBeenCalledWith(
				'property',
				expect.objectContaining({ value: 20 }),
				expect.objectContaining({ receivedAt: report.receivedAt, sampledAt: report.receivedAt, ingressSequence: 9 }),
			);
			await f.service.temperature(temperatureReport(f.id, 10));
			expect(f.reportSample).toHaveBeenCalledTimes(2);
			expect(f.getDeviceInfo).toHaveBeenCalledTimes(2);
		},
	);

	it('withholds full-address temperature reports when the catalog row pins another sensor', async () => {
		const f = setup(true, '112233DDEEFF');
		await f.service.temperature(temperatureReport(f.id, 1));
		expect(f.reportSample).not.toHaveBeenCalled();
		f.findPin.mockResolvedValue(null);
		await f.service.temperature(temperatureReport(f.id, 2));
		expect(f.reportSample).toHaveBeenCalledTimes(1);
		expect(f.getDeviceInfo).not.toHaveBeenCalled();
	});

	it('shares a pending identity read and discards it if registration changes before it completes', async () => {
		const f = setup(true, 'DDEEFF');
		f.move('192.168.1.6');
		let finish: (info: ShellyInfoResponse) => void;
		let started: () => void;
		const probing = new Promise<void>((resolve) => {
			started = resolve;
		});
		f.getDeviceInfo.mockImplementationOnce(() => {
			started();
			return new Promise((resolve) => {
				finish = resolve;
			});
		});
		const first = f.service.temperature(temperatureReport(f.id, 41));
		const second = f.service.temperature(temperatureReport(f.id, 42));
		await probing;
		f.move('192.168.1.7');
		finish(f.info);
		expect(await Promise.all([first, second])).toEqual([false, false]);
		expect(f.getDeviceInfo).toHaveBeenCalledTimes(1);
		expect(f.confirmHost).not.toHaveBeenCalled();
		expect(f.reportSample).not.toHaveBeenCalled();
	});

	it('keeps unpinned legacy sensors on their configured host and withholds input when verification loses its race', async () => {
		const f = setup(true, 'DDEEFF');
		f.findPin.mockResolvedValue(null);
		await f.service.temperature(temperatureReport(f.id, 1));
		f.move('192.168.1.6');
		await f.service.temperature(temperatureReport(f.id, 2));
		f.device.hostname = null;
		await f.service.temperature(temperatureReport(f.id, 3));
		expect(f.reportSample).toHaveBeenCalledTimes(1);
		expect(f.getDeviceInfo).not.toHaveBeenCalled();
		f.findPin.mockResolvedValue(f.pin);
		f.confirmHost.mockResolvedValueOnce(false);
		await f.service.temperature(temperatureReport(f.id, 4));
		expect(f.reportSample).toHaveBeenCalledTimes(1);
		expect(f.getDeviceInfo).toHaveBeenCalledWith('192.168.1.6');
	});

	it.each([21.75, null])(
		'waits for actual publication of its own observation, including a fault (%s)',
		async (value) => {
			const f = setup(true);
			let latest = true;
			const report = {
				deviceId: f.id,
				deviceType: f.peer.type,
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
			deviceType: f.peer.type,
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
