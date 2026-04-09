import { Expose } from 'class-transformer';
import { IsEnum, IsString } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AddressType } from '../devices-shelly-ng.constants';

import { ShellyNgDeviceEntity } from './devices-shelly-ng.entity';

@ApiSchema({ name: 'DevicesShellyNgPluginDataDeviceAddress' })
@Entity('devices_shelly_ng_addresses')
@Unique('UQ_shelly_ng_device_interface', ['deviceId', 'interfaceType'])
export class ShellyNgDeviceAddressEntity extends BaseEntity {
	@ApiProperty({
		name: 'device_id',
		description: 'Device ID this address belongs to',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'device_id' })
	@IsString()
	@Column({ type: 'varchar' })
	deviceId: string;

	@ManyToOne(() => ShellyNgDeviceEntity, (device) => device.addresses, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId' })
	device: ShellyNgDeviceEntity;

	@ApiProperty({
		name: 'interface_type',
		description: 'Network interface type',
		enum: AddressType,
		example: AddressType.ETHERNET,
	})
	@Expose({ name: 'interface_type' })
	@IsEnum(AddressType)
	@Column({ type: 'varchar' })
	interfaceType: AddressType;

	@ApiProperty({
		description: 'IP address of the device on this interface',
		type: 'string',
		example: '192.168.1.100',
	})
	@Expose()
	@IsString()
	@Column({ type: 'varchar' })
	address: string;

	toString(): string {
		return `Shelly Address [${this.interfaceType}:${this.address}] -> Device [${this.deviceId}]`;
	}
}
