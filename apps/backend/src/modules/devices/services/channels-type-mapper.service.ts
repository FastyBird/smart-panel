import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';

import { CreationCapture, captureCreation } from './creation-capture';

export interface ChannelTypeMapping<
	TChannel extends ChannelEntity,
	TCreateDTO extends CreateChannelDto,
	TUpdateDTO extends UpdateChannelDto,
> {
	type: string; // e.g., 'third-party', 'shelly'
	class: new (...args: any[]) => TChannel; // Constructor for the channel class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
	/**
	 * The type owner's last look at the merged row, before it is written — the only point at which an
	 * invariant spanning a field the PATCH sent and one it did not is decidable. Throwing here persists
	 * nothing. Mirrors the device and channel-property mappings, which have carried one for the same
	 * reason.
	 */
	beforeUpdate?: (channel: TChannel, previous: Readonly<Partial<TChannel>>) => Promise<void>;
	afterCreate?: (device: TChannel) => Promise<TChannel>;
	afterUpdate?: (device: TChannel) => Promise<TChannel>;
}

@Injectable()
export class ChannelsTypeMapperService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelsTypeMapperService');

	private readonly mappings = new Map<string, ChannelTypeMapping<any, any, any>>();

	private readonly creationRegistrations = new Map<string, object>();

	/** Each register call retires prior captures, including same-object re-registration. */
	captureMapping(type: string) {
		const api = captureCreation(this, [
			'captureMapping',
			'getMapping',
			'mappings',
			'creationRegistrations',
		] as (keyof this)[]);
		const mapping = api.values.getMapping.call(this, type);
		const fields = ['type', 'class', 'createDto', 'afterCreate', 'beforeCreate', 'withStructuralWrite'] as const;
		const captured = captureCreation(mapping, fields as readonly (keyof typeof mapping)[]);
		const registration = this.creationRegistrations.get(type);
		return Object.freeze({
			...captured,
			current: () => api.current() && this.creationRegistrations.get(type) === registration && captured.current(),
		}) as CreationCapture<typeof mapping>;
	}

	registerMapping<
		TChannel extends ChannelEntity,
		TCreateDTO extends CreateChannelDto,
		TUpdateDTO extends UpdateChannelDto,
	>(mapping: ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO>): void {
		const type = mapping.type;
		this.mappings.set(type, mapping);
		this.creationRegistrations.set(type, {});

		this.logger.log(`[REGISTERED] Channel type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TChannel extends ChannelEntity, TCreateDTO extends CreateChannelDto, TUpdateDTO extends UpdateChannelDto>(
		type: string,
	): ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`Attempting to find mapping for channel type: '${type}'`);

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
