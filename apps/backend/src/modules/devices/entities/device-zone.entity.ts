import { Expose, Transform } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceEntity } from '../../spaces/entities/space.entity';

import { DeviceEntity } from './devices.entity';

@ApiSchema({ name: 'DevicesModuleDataDeviceZone' })
@Entity('devices_module_devices_zones')
export class DeviceZoneEntity {
	@ApiProperty({
		name: 'device_id',
		description: 'ID of the device',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'device_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	@PrimaryColumn({ type: 'uuid' })
	deviceId: string;

	@ApiProperty({
		name: 'zone_id',
		description: 'ID of the zone',
		type: 'string',
		format: 'uuid',
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'zone_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { zone_id?: string; zoneId?: string } }) => obj.zone_id ?? obj.zoneId, {
		toClassOnly: true,
	})
	@PrimaryColumn({ type: 'uuid' })
	zoneId: string;

	@ManyToOne(() => DeviceEntity, (device) => device.deviceZones, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId' })
	device: DeviceEntity;

	@ManyToOne(() => SpaceEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'zoneId' })
	zone: SpaceEntity;

	@ApiProperty({
		name: 'created_at',
		description: 'Timestamp when the device was added to the zone',
		type: 'string',
		format: 'date-time',
		example: '2025-01-25T12:00:00Z',
	})
	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | Date; createdAt?: string | Date } }) => {
			const value: string | Date | undefined = obj.created_at ?? obj.createdAt;
			if (!value) return new Date();
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@CreateDateColumn({ type: 'datetime' })
	createdAt: Date;
}
