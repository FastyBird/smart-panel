import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
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
	/**
	 * Last look at the row a PATCH is about to write, before it is written.
	 *
	 * Receives the loaded entity with the update's fields already merged in — the state the database
	 * will actually hold — plus `previous`, a shallow snapshot of the row as it was loaded. The merged
	 * view is what makes an invariant spanning a sent field and an unsent one decidable at all; the
	 * snapshot is what tells a hook whether the field it cares about actually *changed*, so a device
	 * that was already in a state this hook would refuse can still be renamed. (`previous` is a spread
	 * of own enumerable properties: columns and loaded relations, not prototype getters such as
	 * `zoneIds`.)
	 *
	 * Throwing aborts the update before `repository.save`, leaving the row untouched and DEVICE_UPDATED
	 * unemitted. Throw `DevicesValidationException` (or another `DevicesException`) to have the HTTP
	 * layer report it as an unprocessable entity; anything else surfaces as a 500. Returns void because
	 * the service saves the very instance it passed in — mutate it in place to normalise rather than
	 * reject.
	 */
	beforeUpdate?: (device: TDevice, previous: Readonly<Partial<TDevice>>) => Promise<void>;
	afterCreate?: (device: TDevice, createDto?: TCreateDTO) => Promise<TDevice>;
	afterUpdate?: (device: TDevice) => Promise<TDevice>;
}

@Injectable()
export class DevicesTypeMapperService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesTypeMapperService');

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
		this.logger.debug(`Attempting to find mapping for device type: '${type}'`);

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
