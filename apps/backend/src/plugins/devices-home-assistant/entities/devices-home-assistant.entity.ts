import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column, Index } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	DEVICES_HOME_ASSISTANT_TYPE,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataDevice' })
@ChildEntity()
export class HomeAssistantDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Home Assistant device ID',
		type: 'string',
		name: 'ha_device_id',
		example: 'abcd1234efgh5678',
	})
	@Expose({ name: 'ha_device_id' })
	@IsString({ message: '[{"field":"ha_device_id","reason":"Home Assistant device ID must be provided."}]' })
	@Transform(({ obj }: { obj: { ha_device_id?: string; haDeviceId?: string } }) => obj.ha_device_id || obj.haDeviceId, {
		toClassOnly: true,
	})
	@Index({ unique: true })
	@Column()
	haDeviceId: string;

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	toString(): string {
		return `HA Device [${this.haDeviceId}] -> FB Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataChannel' })
@ChildEntity()
export class HomeAssistantChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataChannelProperty' })
@ChildEntity()
export class HomeAssistantChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiPropertyOptional({
		description: 'Home Assistant entity ID',
		type: 'string',
		name: 'ha_entity_id',
		nullable: true,
		example: 'light.living_room',
	})
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

	@ApiPropertyOptional({
		description: 'Home Assistant entity attribute',
		type: 'string',
		name: 'ha_attribute',
		nullable: true,
		example: 'brightness',
	})
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

	@ApiPropertyOptional({
		description: 'Transformer name for value conversion between HA and Smart Panel formats',
		type: 'string',
		name: 'ha_transformer',
		nullable: true,
		example: 'brightness_to_percent',
	})
	@Expose({ name: 'ha_transformer' })
	@IsOptional()
	@IsString({ message: '[{"field":"ha_transformer","reason":"Transformer name must be a string."}]' })
	@Transform(
		({ obj }: { obj: { ha_transformer?: string | null; haTransformer?: string | null } }) =>
			obj.ha_transformer || obj.haTransformer || null,
		{
			toClassOnly: true,
		},
	)
	@Column({ nullable: true })
	haTransformer: string | null;

	get haDomain(): HomeAssistantDomain {
		const domain = this.haEntityId.toLowerCase().split('.')[0] as HomeAssistantDomain;

		if (!Object.values(HomeAssistantDomain).includes(domain)) {
			throw new DevicesHomeAssistantValidationException(`Unknown or unsupported Home Assistant domain: ${domain}`);
		}

		return domain;
	}

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_HOME_ASSISTANT_TYPE,
		example: DEVICES_HOME_ASSISTANT_TYPE,
	})
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
