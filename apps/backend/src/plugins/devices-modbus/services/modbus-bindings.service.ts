import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ModbusBindingRole } from '../devices-modbus.constants';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';

@Injectable()
export class ModbusBindingsService {
	constructor(
		@InjectRepository(ModbusBindingEntity)
		private readonly repository: Repository<ModbusBindingEntity>,
	) {}

	async findByDevice(deviceId: string): Promise<ModbusBindingEntity[]> {
		return this.repository.find({
			where: { deviceId },
			order: { propertyId: 'ASC', role: 'ASC' },
		});
	}

	async findByProperty(
		propertyId: string,
	): Promise<{ read: ModbusBindingEntity | null; write: ModbusBindingEntity | null }> {
		const rows = await this.repository.find({ where: { propertyId } });

		return {
			read: rows.find((row) => row.role === ModbusBindingRole.READ) ?? null,
			write: rows.find((row) => row.role === ModbusBindingRole.WRITE) ?? null,
		};
	}
}
