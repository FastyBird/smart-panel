import { Injectable, Logger } from '@nestjs/common';

import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';

export interface ChannelTypeMapping<
	TChannel extends ChannelEntity,
	TCreateDTO extends CreateChannelDto,
	TUpdateDTO extends UpdateChannelDto,
> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TChannel; // Constructor for the channel class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
	afterCreate?: (device: TChannel) => Promise<TChannel>;
	afterUpdate?: (device: TChannel) => Promise<TChannel>;
}

@Injectable()
export class ChannelsTypeMapperService {
	private readonly logger = new Logger(ChannelsTypeMapperService.name);

	private readonly mappings = new Map<string, ChannelTypeMapping<any, any, any>>();

	registerMapping<
		TChannel extends ChannelEntity,
		TCreateDTO extends CreateChannelDto,
		TUpdateDTO extends UpdateChannelDto,
	>(mapping: ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO>): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Channel type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TChannel extends ChannelEntity, TCreateDTO extends CreateChannelDto, TUpdateDTO extends UpdateChannelDto>(
		type: string,
	): ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`[LOOKUP] Attempting to find mapping for channel type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Channel mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DevicesException(`Unsupported channel type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for channel type: '${type}'`);

		return mapping as ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO>;
	}
}
