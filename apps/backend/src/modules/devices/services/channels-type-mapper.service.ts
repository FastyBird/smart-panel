import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
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

	private registrationSequence = 0n;
	private readonly creationRegistrations = new Map<string, {
		readonly mapping: object;
		readonly revision: bigint;
		readonly close: () => void;
		readonly isCurrent: () => boolean;
	}>();

	registerMapping<
		TChannel extends ChannelEntity,
		TCreateDTO extends CreateChannelDto,
		TUpdateDTO extends UpdateChannelDto,
	>(mapping: ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO>): void {
		const type = mapping.type;
		let active = true;
		const fields = ['type', 'class', 'createDto', 'updateDto', 'beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate', 'withStructuralWrite'];
		const descriptors = (() => {
			try {
				return fields.map((field) => {
					const descriptor: Readonly<{ value?: unknown; get?: unknown; set?: unknown }> | undefined = Object.getOwnPropertyDescriptor(mapping, field);
					return { field, descriptor };
				});
			} catch {
				// Ordinary registration remains usable; opaque mappings cannot qualify an owned capture.
				return undefined;
			}
		})();
		const revision = ++this.registrationSequence;
		const registration: { readonly mapping: object; readonly revision: bigint; readonly close: () => void; readonly isCurrent: () => boolean } = {
			mapping,
			revision,
			close: (): void => { active = false; },
			isCurrent: (): boolean => active && descriptors !== undefined && this.creationRegistrations.get(type) === registration &&
				descriptors.every(({ field, descriptor }) => {
					const current: Readonly<{ value?: unknown; get?: unknown; set?: unknown }> | undefined = Object.getOwnPropertyDescriptor(mapping, field);
					return descriptor === undefined ? current === undefined :
						descriptor.get === undefined && descriptor.set === undefined && current?.get === undefined &&
						current?.set === undefined && current?.value === descriptor.value;
				}),
		};
		this.creationRegistrations.get(type)?.close();
		this.creationRegistrations.set(type, registration);
		this.mappings.set(type, mapping);

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

	/** Read-only continuity of the ORIGINAL registration; ordinary lookup never mints an epoch. */
	captureMapping<TChannel extends ChannelEntity, TCreateDTO extends CreateChannelDto, TUpdateDTO extends UpdateChannelDto>(type: string): Readonly<{ mapping: ChannelTypeMapping<TChannel, TCreateDTO, TUpdateDTO>; isCurrent: () => boolean }> | null {
		const registration = this.creationRegistrations.get(type);
		if (!registration?.isCurrent()) return null;
		const mapping = this.getMapping<TChannel, TCreateDTO, TUpdateDTO>(type);
		if (mapping !== registration.mapping || !registration.isCurrent()) return null;
		return Object.freeze({ mapping, isCurrent: registration.isCurrent });
	}
}
