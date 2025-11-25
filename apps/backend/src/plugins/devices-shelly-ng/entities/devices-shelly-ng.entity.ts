import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { ChildEntity, Column } from 'typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgDevice' })
@ChildEntity()
export class ShellyNgDeviceEntity extends DeviceEntity {
	@ApiProperty({ description: 'Device type', type: 'string', example: 'devices-shelly-ng' })
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	@ApiPropertyOptional({ description: 'Device password for authentication', type: 'string', example: 'mypassword', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	password: string = null;

	@ApiPropertyOptional({ description: 'Device hostname or IP address', type: 'string', example: '192.168.1.100', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	hostname: string = null;

	toString(): string {
		return `Shelly Device [${this.identifier}] -> FB Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgChannel' })
@ChildEntity()
export class ShellyNgChannelEntity extends ChannelEntity {
	@ApiProperty({ description: 'Channel type', type: 'string', example: 'devices-shelly-ng' })
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	toString(): string {
		return `Shelly component [${this.identifier}] -> FB Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesShellyNgPluginShellyNgChannelProperty' })
@ChildEntity()
export class ShellyNgChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({ description: 'Channel property type', type: 'string', example: 'devices-shelly-ng' })
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	toString(): string {
		return `Shelly component attribute [${this.identifier}] -> FB Channel property [${this.id}]`;
	}
}
