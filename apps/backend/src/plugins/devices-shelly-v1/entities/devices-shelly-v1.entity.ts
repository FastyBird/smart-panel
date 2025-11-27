import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

@ApiSchema({ name: 'DevicesShellyV1PluginDataDevice' })
@ChildEntity()
export class ShellyV1DeviceEntity extends DeviceEntity {
	@ApiProperty({ description: 'Device type', type: 'string', example: DEVICES_SHELLY_V1_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Device password for authentication',
		type: 'string',
		example: 'mySecurePassword123',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	password: string = null;

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
	hostname: string = null;

	toString(): string {
		return `Shelly V1 Device [${this.identifier}] -> FB Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataChannel' })
@ChildEntity()
export class ShellyV1ChannelEntity extends ChannelEntity {
	@ApiProperty({ description: 'Channel type', type: 'string', example: DEVICES_SHELLY_V1_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	toString(): string {
		return `Shelly V1 component [${this.identifier}] -> FB Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesShellyV1PluginDataChannelProperty' })
@ChildEntity()
export class ShellyV1ChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({ description: 'Property type', type: 'string', example: DEVICES_SHELLY_V1_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	toString(): string {
		return `Shelly V1 component attribute [${this.identifier}] -> FB Channel property [${this.id}]`;
	}
}
