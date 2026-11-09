import { FastifyReply, FastifyRequest } from 'fastify';

import { NotFoundException } from '@nestjs/common';

import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { CreateModbusDeviceStructureDto } from '../dto/create-device-structure.dto';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusBindingsService } from '../services/modbus-bindings.service';
import { ModbusDeviceStructureService } from '../services/modbus-device-structure.service';

import { ModbusDevicesController } from './modbus-devices.controller';

describe('ModbusDevicesController', () => {
	let structure: { create: jest.Mock };
	let bindings: { findByDevice: jest.Mock };
	let devices: { findOne: jest.Mock };
	let controller: ModbusDevicesController;

	beforeEach(() => {
		structure = { create: jest.fn() };
		bindings = { findByDevice: jest.fn().mockResolvedValue([new ModbusBindingEntity()]) };
		devices = { findOne: jest.fn() };
		controller = new ModbusDevicesController(
			structure as unknown as ModbusDeviceStructureService,
			bindings as unknown as ModbusBindingsService,
			devices as unknown as DevicesService,
		);
	});

	it('creates the structure and points Location at the core device resource', async () => {
		const device = Object.assign(new ModbusDeviceEntity(), { id: 'c5bb0e6a-0a52-4c4a-9d0e-0f4cbb5c1a01' });
		const header = jest.fn();

		structure.create.mockResolvedValue(device);

		const data = new CreateModbusDeviceStructureDto();
		const response = await controller.create(
			{ data },
			{ header } as unknown as FastifyReply,
			{
				url: '/api/v1/plugins/devices-modbus/devices',
				protocol: 'http',
				hostname: 'localhost',
				headers: {},
			} as unknown as FastifyRequest,
		);

		expect(structure.create).toHaveBeenCalledWith(data);
		expect(response.data).toBe(device);
		expect(header).toHaveBeenCalledWith('Location', expect.stringContaining(`/devices/devices/${device.id}`));
	});

	it('returns the bindings of a Modbus device', async () => {
		devices.findOne.mockResolvedValue(Object.assign(new ModbusDeviceEntity(), { id: 'd1' }));

		const response = await controller.bindings('d1');

		expect(bindings.findByDevice).toHaveBeenCalledWith('d1');
		expect(response.data).toHaveLength(1);
	});

	it('answers not found for missing and non-Modbus devices', async () => {
		devices.findOne.mockResolvedValueOnce(null);

		await expect(controller.bindings('missing')).rejects.toBeInstanceOf(NotFoundException);

		devices.findOne.mockResolvedValueOnce({ id: 'other', type: 'devices-shelly-ng' });

		await expect(controller.bindings('other')).rejects.toBeInstanceOf(NotFoundException);
		expect(bindings.findByDevice).not.toHaveBeenCalled();
	});

	it('restricts every route to owners and admins', () => {
		const proto = ModbusDevicesController.prototype;

		for (const name of ['create', 'bindings'] as const) {
			expect(Reflect.getMetadata(ROLES_KEY, proto[name])).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
	});
});
