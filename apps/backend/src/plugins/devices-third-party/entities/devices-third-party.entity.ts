import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginThirdPartyDevice' })
@ChildEntity()
export class ThirdPartyDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Third party service address',
		name: 'service_address',
		type: 'string',
		example: 'http://192.168.1.100:8080',
	})
	@Expose({ name: 'service_address' })
	@IsString()
	@Column()
	@Transform(
		({ obj }: { obj: { service_address?: string; serviceAddress?: string } }) =>
			obj.service_address || obj.serviceAddress,
		{ toClassOnly: true },
	)
	serviceAddress: string;

	@ApiProperty({ description: 'Device type', type: 'string', example: DEVICES_THIRD_PARTY_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}

@ApiSchema({ name: 'DevicesThirdPartyPluginThirdPartyChannel' })
@ChildEntity()
export class ThirdPartyChannelEntity extends ChannelEntity {
	@ApiProperty({ description: 'Channel type', type: 'string', example: DEVICES_THIRD_PARTY_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}

@ApiSchema({ name: 'DevicesThirdPartyPluginThirdPartyChannelProperty' })
@ChildEntity()
export class ThirdPartyChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({ description: 'Property type', type: 'string', example: DEVICES_THIRD_PARTY_TYPE })
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}
