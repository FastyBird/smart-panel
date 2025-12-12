import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_WLED_TYPE } from '../devices-wled.constants';

@ApiSchema({ name: 'DevicesWledPluginDataDevice' })
@ChildEntity()
export class WledDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_WLED_TYPE,
		example: DEVICES_WLED_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_WLED_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Device hostname or IP address',
		type: 'string',
		example: '192.168.1.100',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	hostname: string | null = null;

	toString(): string {
		return `WLED Device [${this.identifier}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesWledPluginDataChannel' })
@ChildEntity()
export class WledChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_WLED_TYPE,
		example: DEVICES_WLED_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_WLED_TYPE;
	}

	toString(): string {
		return `WLED Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesWledPluginDataChannelProperty' })
@ChildEntity()
export class WledChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_WLED_TYPE,
		example: DEVICES_WLED_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_WLED_TYPE;
	}

	toString(): string {
		return `WLED Channel Property [${this.identifier}] -> Property [${this.id}]`;
	}
}
