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
	 * The type owner's last look at a row a POST is about to insert, before it is inserted.
	 *
	 * The counterpart to `beforeUpdate` below, and it exists for the same reason: an invariant that
	 * spans the property and something outside the request payload is not decidable by a DTO
	 * constraint. `channelId` in particular is a *route* parameter on both property controllers and an
	 * argument on the two nested-creation paths, so it never reaches the create DTO at all — which is
	 * why it is passed explicitly here rather than read back off `property.channel` (assigned as a bare
	 * id string at this point, not a loaded relation).
	 *
	 * Throwing aborts the create before `repository.save`, so nothing is persisted, no
	 * CHANNEL_PROPERTY_CREATED is emitted, and `afterCreate` does not run. Same failure vocabulary as
	 * `beforeUpdate`: `DevicesValidationException` (or another `DevicesException`) is reported by the
	 * HTTP layer as an unprocessable entity, anything else as a 500.
	 */
	beforeCreate?: (property: TProperty, channelId: string) => Promise<void>;
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
