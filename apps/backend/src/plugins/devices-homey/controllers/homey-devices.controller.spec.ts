import { instanceToPlain } from 'class-transformer';

import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { HomeyInventoryDeviceNotFoundError, HomeyInventoryUnavailableError } from '../errors/homey-inventory.error';
import { HomeyDeviceSupportState, HomeyInventoryDeviceModel } from '../models/inventory.model';
import { HomeyDeviceInventoryService } from '../services/homey-device-inventory.service';

import { HomeyDevicesController } from './homey-devices.controller';

function createInventoryDevice(): HomeyInventoryDeviceModel {
	return Object.assign(new HomeyInventoryDeviceModel(), {
		id: 'homey-light',
		name: 'Light',
		class: 'light',
		zoneId: 'zone-living',
		zoneName: 'Living room',
		zonePath: ['Living room'],
		available: true,
		driverId: null,
		manufacturer: null,
		model: null,
		capabilities: [],
		supportState: HomeyDeviceSupportState.SUPPORTED,
		supportReasons: [],
		suggestedCategory: null,
		adopted: false,
		adoptedDeviceId: null,
	});
}

describe('HomeyDevicesController', () => {
	let inventoryService: jest.Mocked<Pick<HomeyDeviceInventoryService, 'findAll' | 'findOne'>>;
	let controller: HomeyDevicesController;

	beforeEach(() => {
		inventoryService = {
			findAll: jest.fn().mockResolvedValue([createInventoryDevice()]),
			findOne: jest.fn().mockResolvedValue(createInventoryDevice()),
		};
		controller = new HomeyDevicesController(inventoryService as unknown as HomeyDeviceInventoryService);
	});

	it('wraps list and single results in standard response envelopes', async () => {
		const query = { search: 'light' };
		const listResponse = await controller.findAll(query);
		const singleResponse = await controller.findOne('homey-light');

		expect(inventoryService.findAll).toHaveBeenCalledWith(query);
		expect(inventoryService.findOne).toHaveBeenCalledWith('homey-light');
		expect(instanceToPlain(listResponse)).toMatchObject({ data: [{ id: 'homey-light', zone_id: 'zone-living' }] });
		expect(instanceToPlain(singleResponse)).toMatchObject({ data: { id: 'homey-light', zone_id: 'zone-living' } });
	});

	it('maps unavailable inventory and unknown devices to fixed HTTP errors', async () => {
		inventoryService.findAll.mockRejectedValueOnce(new HomeyInventoryUnavailableError());
		inventoryService.findOne.mockRejectedValueOnce(new HomeyInventoryDeviceNotFoundError());

		await expect(controller.findAll({})).rejects.toBeInstanceOf(UnprocessableEntityException);
		await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);

		inventoryService.findOne.mockRejectedValueOnce(new HomeyInventoryUnavailableError());
		await expect(controller.findOne('homey-light')).rejects.toBeInstanceOf(UnprocessableEntityException);
	});

	it('allows authenticated owners, administrators, and users to read inventory', () => {
		// Metadata inspection intentionally references unbound controller methods.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const listHandler = HomeyDevicesController.prototype.findAll;
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const singleHandler = HomeyDevicesController.prototype.findOne;

		expect(Reflect.getMetadata(ROLES_KEY, listHandler)).toEqual([UserRole.OWNER, UserRole.ADMIN, UserRole.USER]);
		expect(Reflect.getMetadata(ROLES_KEY, singleHandler)).toEqual([UserRole.OWNER, UserRole.ADMIN, UserRole.USER]);
	});
});
