import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column, Index } from 'typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	DEVICES_HOME_ASSISTANT_TYPE,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

@ChildEntity()
export class HomeAssistantDeviceEntity extends DeviceEntity {
	@Expose({ name: 'ha_device_id' })
	@IsString({ message: '[{"field":"ha_device_id","reason":"Home Assistant device ID must be provided."}]' })
	@Transform(({ obj }: { obj: { ha_device_id?: string; haDeviceId?: string } }) => obj.ha_device_id || obj.haDeviceId, {
		toClassOnly: true,
	})
	@Index({ unique: true })
	@Column()
	haDeviceId: string;

	@Expose()
	get type(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	toString(): string {
		return `HA Device [${this.haDeviceId}] -> FB Device [${this.id}]`;
	}
}

@ChildEntity()
export class HomeAssistantChannelEntity extends ChannelEntity {
	@Expose()
	get type(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}
}

@ChildEntity()
export class HomeAssistantChannelPropertyEntity extends ChannelPropertyEntity {
	@Expose({ name: 'ha_entity_id' })
	@IsOptional()
	@IsString({ message: '[{"field":"ha_entity_id","reason":"Home Assistant entity ID must be provided."}]' })
	@Transform(
		({ obj }: { obj: { ha_entity_id?: string | null; haEntityId?: string | null } }) =>
			obj.ha_entity_id || obj.haEntityId,
		{
			toClassOnly: true,
		},
	)
	@Column({ nullable: true })
	haEntityId: string | null;

	@Expose({ name: 'ha_attribute' })
	@IsOptional()
	@IsString({ message: '[{"field":"ha_attribute","reason":"Home Assistant entity attribute must be provided."}]' })
	@Transform(
		({ obj }: { obj: { ha_attribute?: string | null; haAttribute?: string | null } }) =>
			obj.ha_attribute || obj.haAttribute,
		{
			toClassOnly: true,
		},
	)
	@Column({ nullable: true })
	haAttribute: string | null;

	get haDomain(): HomeAssistantDomain {
		const domain = this.haEntityId.toLowerCase().split('.')[0] as HomeAssistantDomain;

		if (!Object.values(HomeAssistantDomain).includes(domain)) {
			throw new DevicesHomeAssistantValidationException(`Unknown or unsupported Home Assistant domain: ${domain}`);
		}

		return domain;
	}

	@Expose()
	get type(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	get isHaMainState(): boolean {
		return this.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE;
	}

	toString(): string {
		return `HA Entity-attribute [${this.haEntityId}][${this.haAttribute}] -> FB Channel property [${this.id}]`;
	}
}
