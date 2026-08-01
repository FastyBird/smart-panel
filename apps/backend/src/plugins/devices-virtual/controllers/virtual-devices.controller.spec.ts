import { HttpException, HttpStatus, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualDevicesService } from '../services/virtual-devices.service';

import { VirtualDevicesController } from './virtual-devices.controller';

describe('VirtualDevicesController', () => {
	let controller: VirtualDevicesController;
	let devicesService: { findOne: jest.Mock };
	let virtualDevicesService: { findSourceDevices: jest.Mock };

	const virtualDevice = { id: 'virtual-device', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
	const deviceA = { id: 'device-a' } as DeviceEntity;
	const deviceB = { id: 'device-b' } as DeviceEntity;

	beforeEach(() => {
		devicesService = { findOne: jest.fn().mockResolvedValue(virtualDevice) };
		virtualDevicesService = { findSourceDevices: jest.fn().mockResolvedValue([deviceA, deviceB]) };

		controller = new VirtualDevicesController(
			devicesService as unknown as DevicesService,
			virtualDevicesService as unknown as VirtualDevicesService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns the source devices wrapped in the response model', async () => {
		const response = await controller.findSourceDevices('virtual-device');

		expect(response.data).toEqual([deviceA, deviceB]);
		expect(virtualDevicesService.findSourceDevices).toHaveBeenCalledWith('virtual-device');
	});

	it('throws NotFoundException when the device does not exist, without consulting the domain service', async () => {
		devicesService.findOne.mockResolvedValue(null);

		await expect(controller.findSourceDevices('missing')).rejects.toThrow(NotFoundException);
		expect(virtualDevicesService.findSourceDevices).not.toHaveBeenCalled();
	});

	// Regression test for an existence-only check on a route defined solely for virtual devices. A
	// Shelly or a simulator device has no source properties either, so it used to fall through to a
	// 200 with `data: []` — byte-for-byte what a genuine virtual device assembled purely from owned
	// properties answers, and therefore indistinguishable from it.
	it('rejects a device of another type rather than reporting it as having no sources', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'physical-device', type: 'shelly-ng' } as DeviceEntity);

		await expect(controller.findSourceDevices('physical-device')).rejects.toThrow(UnprocessableEntityException);
		expect(virtualDevicesService.findSourceDevices).not.toHaveBeenCalled();
	});

	// 422, not 404: the device exists and the caller can see it in the device list, so reporting it as
	// missing would trade one misleading answer for another. Matches how the rest of the codebase
	// separates "no such resource" from "that resource's type makes this operation invalid". The wire
	// status is asserted directly rather than inferred from the exception class, because it is the
	// status — not the class — that the endpoint's documented contract promises.
	it('rejects a wrong-type device with 422 rather than disguising it as a missing one', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'physical-device', type: 'shelly-ng' } as DeviceEntity);

		expect.assertions(2);

		try {
			await controller.findSourceDevices('physical-device');
		} catch (error) {
			expect(error).toBeInstanceOf(HttpException);
			expect((error as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
		}
	});

	// The owned-properties-only case the endpoint's own description promises, kept adjacent to the
	// rejection above: an empty list stays a legitimate answer for a real virtual device, and must not
	// have been collapsed into the wrong-type branch.
	it('still returns an empty list for a virtual device that draws from nothing', async () => {
		virtualDevicesService.findSourceDevices.mockResolvedValue([]);

		const response = await controller.findSourceDevices('virtual-device');

		expect(response.data).toEqual([]);
	});
});
