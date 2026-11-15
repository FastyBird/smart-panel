import { instanceToPlain } from 'class-transformer';

import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ProtectConsoleUnavailableError, ProtectDeviceNotFoundError } from '../errors/protect-adoption.error';
import { ProtectInventoryDeviceModel } from '../models/protect-inventory.model';
import { ProtectInventoryService } from '../services/protect-inventory.service';

import { ProtectDevicesController } from './protect-devices.controller';

const device = (): ProtectInventoryDeviceModel =>
	Object.assign(new ProtectInventoryDeviceModel(), {
		id: '600cefafd5f365d6f83c4ef3',
		modelKey: 'camera',
		name: 'Front door',
		model: 'UVC G5 Dome',
		mac: null,
		state: 'CONNECTED',
		connected: true,
		supported: true,
		mappingName: 'camera',
		suggestedCategory: 'camera',
		identifier: '0cea14003a69:600cefafd5f365d6f83c4ef3',
		adopted: false,
		adoptedDeviceId: null,
	});

describe('ProtectDevicesController', () => {
	let inventory: { findAll: jest.Mock; findOne: jest.Mock };
	let controller: ProtectDevicesController;

	beforeEach(() => {
		inventory = {
			findAll: jest.fn().mockResolvedValue([device()]),
			findOne: jest.fn().mockResolvedValue(device()),
		};
		controller = new ProtectDevicesController(inventory as unknown as ProtectInventoryService);
	});

	it('wraps the inventory in the response envelope', async () => {
		const list = instanceToPlain(await controller.findAll()) as { data: Record<string, unknown>[] };
		const one = instanceToPlain(await controller.findOne('600cefafd5f365d6f83c4ef3')) as {
			data: Record<string, unknown>;
		};

		expect(list.data).toHaveLength(1);
		expect(list.data[0]).toMatchObject({
			id: '600cefafd5f365d6f83c4ef3',
			model_key: 'camera',
			mapping_name: 'camera',
			suggested_category: 'camera',
			adopted_device_id: null,
		});
		expect(one.data).toMatchObject({ name: 'Front door', connected: true });
		expect(inventory.findOne).toHaveBeenCalledWith('600cefafd5f365d6f83c4ef3');
	});

	it.each([
		[new ProtectConsoleUnavailableError(null), ServiceUnavailableException, 503],
		[new ProtectDeviceNotFoundError(), NotFoundException, 404],
	])('maps %s to %i', async (error, expected) => {
		inventory.findAll.mockRejectedValue(error);
		inventory.findOne.mockRejectedValue(error);

		if (expected === NotFoundException) {
			await expect(controller.findOne('abc')).rejects.toBeInstanceOf(NotFoundException);
		} else {
			await expect(controller.findAll()).rejects.toBeInstanceOf(ServiceUnavailableException);
			await expect(controller.findOne('abc')).rejects.toBeInstanceOf(ServiceUnavailableException);
		}
	});

	it('rejects a malformed device id with 400 before reading the console', async () => {
		await expect(controller.findOne('../nvrs')).rejects.toBeInstanceOf(BadRequestException);
		await expect(controller.findOne('a'.repeat(65))).rejects.toBeInstanceOf(BadRequestException);
		expect(inventory.findOne).not.toHaveBeenCalled();
	});

	it('restricts both routes to owners and administrators', () => {
		// Metadata inspection intentionally references unbound controller methods.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const { findAll, findOne } = ProtectDevicesController.prototype;

		expect(Reflect.getMetadata(ROLES_KEY, findAll)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		expect(Reflect.getMetadata(ROLES_KEY, findOne)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
	});
});
