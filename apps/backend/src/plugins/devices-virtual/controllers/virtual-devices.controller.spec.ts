import { NotFoundException } from '@nestjs/common';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { VirtualDevicesService } from '../services/virtual-devices.service';

import { VirtualDevicesController } from './virtual-devices.controller';

describe('VirtualDevicesController', () => {
	let controller: VirtualDevicesController;
	let devicesService: { findOne: jest.Mock };
	let virtualDevicesService: { findSourceDevices: jest.Mock };

	const virtualDevice = { id: 'virtual-device' } as DeviceEntity;
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
});
