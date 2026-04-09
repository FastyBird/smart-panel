import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
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

	/**
	 * Canonical MAC address from Shelly device system config, used for deduplication
	 * of multi-interface devices (e.g., Shelly Pro with WiFi + Ethernet).
	 *
	 * NOTE: This column lives on the shared STI parent table `devices_module_devices`
	 * because TypeORM places all @ChildEntity columns there. It will be NULL for all
	 * non-Shelly-NG device types. The unique index allows multiple NULLs in SQLite;
	 * verify NULL uniqueness semantics if migrating to PostgreSQL or MySQL.
	 */
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
	@Column({ nullable: true, default: null, unique: true })
	canonicalMac: string | null = null;

	@ApiProperty({
		description: 'Whether the device has an Ethernet interface (Pro devices)',
		name: 'has_ethernet',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_ethernet' })
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	hasEthernet: boolean = false;

	/**
	 * Transient fields for passing address updates through the DTO → entity → subscriber
	 * pipeline. Not persisted as columns — the subscriber reads them and delegates
	 * to DeviceAddressService for actual storage in the addresses table.
	 */
	@ApiPropertyOptional({
		name: 'wifi_address',
		description: 'Transient WiFi address for address updates through the DTO pipeline',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'wifi_address' })
	@IsOptional()
	@IsString()
	wifiAddress?: string | null;

	@ApiPropertyOptional({
		name: 'ethernet_address',
		description: 'Transient Ethernet address for address updates through the DTO pipeline',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'ethernet_address' })
	@IsOptional()
	@IsString()
	ethernetAddress?: string | null;

	@Expose()
	@OneToMany(() => ShellyNgDeviceAddressEntity, (addr) => addr.device, { eager: true })
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
