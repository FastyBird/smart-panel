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

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1PropertyReportsService } from './shelly-v1-property-reports.service';

function setup(temperature = false) {
	const id = 'AABBCCDDEEFF';
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
	const service = new ShellyV1PropertyReportsService(
		adapter as unknown as ShelliesAdapterService,
		{ findOneBy: () => Promise.resolve(device) } as unknown as DevicesService,
		{ findOneBy: () => Promise.resolve(channel) } as unknown as ChannelsService,
		{ findOneBy: () => Promise.resolve(property), reportSample } as unknown as ChannelsPropertiesService,
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
	return { id, device, reportSample, registration, peer, target, adapter, service, boundary: () => boundary };
}

describe('Shelly Gen1 physical property reports', () => {
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
		const report = { deviceId: f.id, value: 21.75, receivedAt, ingressSequence: 28, isCurrent: () => true };
		await f.service.temperature(report);
		expect(f.peer.getStatus).not.toHaveBeenCalled();
		expect(f.reportSample).toHaveBeenCalledWith(
			'property',
			{ type: DEVICES_SHELLY_V1_TYPE, value: 21.75 },
			expect.objectContaining({ sampledAt: receivedAt, receivedAt, ingressSequence: 28 }),
		);
		await f.service.temperature({ ...report, isCurrent: () => false });
		expect(f.reportSample).toHaveBeenCalledTimes(1);
	});
});
