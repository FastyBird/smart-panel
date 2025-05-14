import { Injectable, Logger } from '@nestjs/common';

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
	afterCreate?: (device: TProperty) => Promise<TProperty>;
	afterUpdate?: (device: TProperty) => Promise<TProperty>;
}

@Injectable()
export class ChannelsPropertiesTypeMapperService {
	private readonly logger = new Logger(ChannelsPropertiesTypeMapperService.name);

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
		this.logger.debug(`[LOOKUP] Attempting to find mapping for channel property type: '${type}'`);

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
