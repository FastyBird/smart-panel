import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';

export interface ChannelPropertyTypeMapping<
	TProperty extends ChannelPropertyEntity,
	TCreateDTO extends CreateChannelPropertyDto,
	TUpdateDTO extends UpdateChannelPropertyDto,
> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TProperty; // Constructor for the property class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
	/**
	 * Last look at the row a PATCH is about to write, before it is written.
	 *
	 * Receives the loaded entity with the update's fields already merged in, so it sees the state the
	 * database will actually hold — which is the one thing a DTO constraint cannot: a PATCH carrying
	 * one half of a two-field invariant validates perfectly on its own and only becomes illegal once
	 * merged with the stored row. Throwing aborts the update before `repository.save`, leaving the row
	 * untouched.
	 *
	 * Throw `DevicesValidationException` (or another `DevicesException`) to have the HTTP layer report
	 * it as an unprocessable entity; anything else surfaces as a 500. Returns void rather than the
	 * entity because the service goes on to save the very instance it passed in — mutate it in place if
	 * a hook ever needs to normalise rather than reject.
	 */
	beforeUpdate?: (property: TProperty) => Promise<void>;
	afterCreate?: (device: TProperty) => Promise<TProperty>;
	afterUpdate?: (device: TProperty) => Promise<TProperty>;
}

@Injectable()
export class ChannelsPropertiesTypeMapperService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsPropertiesTypeMapperService');

	private readonly mappings = new Map<string, ChannelPropertyTypeMapping<any, any, any>>();

	registerMapping<
		TProperty extends ChannelPropertyEntity,
		TCreateDTO extends CreateChannelPropertyDto,
		TUpdateDTO extends UpdateChannelPropertyDto,
	>(mapping: ChannelPropertyTypeMapping<TProperty, TCreateDTO, TUpdateDTO>): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Property type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<
		TProperty extends ChannelPropertyEntity,
		TCreateDTO extends CreateChannelPropertyDto,
		TUpdateDTO extends UpdateChannelPropertyDto,
	>(type: string): ChannelPropertyTypeMapping<TProperty, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`Attempting to find mapping for channel property type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Property mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DevicesException(`Unsupported channel property type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for channel property type: '${type}'`);

		return mapping as ChannelPropertyTypeMapping<TProperty, TCreateDTO, TUpdateDTO>;
	}
}
