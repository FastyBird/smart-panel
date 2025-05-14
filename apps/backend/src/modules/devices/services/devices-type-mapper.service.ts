import { Injectable, Logger } from '@nestjs/common';

import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

export interface DeviceTypeMapping<
	TDevice extends DeviceEntity,
	TCreateDTO extends CreateDeviceDto,
	TUpdateDTO extends UpdateDeviceDto,
> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TDevice; // Constructor for the device class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
	afterCreate?: (device: TDevice) => Promise<TDevice>;
	afterUpdate?: (device: TDevice) => Promise<TDevice>;
}

@Injectable()
export class DevicesTypeMapperService {
	private readonly logger = new Logger(DevicesTypeMapperService.name);

	private readonly mappings = new Map<string, DeviceTypeMapping<any, any, any>>();

	registerMapping<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto, TUpdateDTO extends UpdateDeviceDto>(
		mapping: DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Device type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto, TUpdateDTO extends UpdateDeviceDto>(
		type: string,
	): DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`[LOOKUP] Attempting to find mapping for device type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Device mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DevicesException(`Unsupported device type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for device type: '${type}'`);

		return mapping as DeviceTypeMapping<TDevice, TCreateDTO, TUpdateDTO>;
	}
}
