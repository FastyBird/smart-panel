import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

@ChildEntity()
export class ThirdPartyDeviceEntity extends DeviceEntity {
	@Expose({ name: 'service_address' })
	@IsString()
	@Column()
	@Transform(
		({ obj }: { obj: { service_address?: string; serviceAddress?: string } }) =>
			obj.service_address || obj.serviceAddress,
		{ toClassOnly: true },
	)
	serviceAddress: string;

	@Expose()
	get type(): string {
		return 'third-party';
	}
}
