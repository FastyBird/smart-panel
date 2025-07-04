import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

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
		return DEVICES_THIRD_PARTY_TYPE;
	}
}

@ChildEntity()
export class ThirdPartyChannelEntity extends ChannelEntity {
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}

@ChildEntity()
export class ThirdPartyChannelPropertyEntity extends ChannelPropertyEntity {
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}
