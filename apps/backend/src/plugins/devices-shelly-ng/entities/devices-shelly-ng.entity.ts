import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column, OneToMany } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

import { ShellyNgDeviceAddressEntity } from './shelly-ng-device-address.entity';

@ApiSchema({ name: 'DevicesShellyNgPluginDataDevice' })
@ChildEntity()
export class ShellyNgDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_SHELLY_NG_TYPE,
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Device password for authentication',
		type: 'string',
		example: 'mypassword',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	password: string | null = null;

	@ApiPropertyOptional({
		description: 'Device hostname or IP address (preferred/active address)',
		type: 'string',
		example: '192.168.1.100',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	hostname: string | null = null;

	@ApiPropertyOptional({
		description: 'Canonical MAC address from Shelly device info, used for deduplication of multi-interface devices',
		name: 'canonical_mac',
		type: 'string',
		example: 'A8032ABE5084',
		nullable: true,
	})
	@Expose({ name: 'canonical_mac' })
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	canonicalMac: string | null = null;

	@OneToMany(() => ShellyNgDeviceAddressEntity, (addr) => addr.device, { cascade: true })
	addresses: ShellyNgDeviceAddressEntity[];

	toString(): string {
		return `Shelly Device [${this.identifier}] -> FB Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataChannel' })
@ChildEntity()
export class ShellyNgChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_SHELLY_NG_TYPE,
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	toString(): string {
		return `Shelly component [${this.identifier}] -> FB Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesShellyNgPluginDataChannelProperty' })
@ChildEntity()
export class ShellyNgChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_SHELLY_NG_TYPE,
		example: DEVICES_SHELLY_NG_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	toString(): string {
		return `Shelly component attribute [${this.identifier}] -> FB Channel property [${this.id}]`;
	}
}
