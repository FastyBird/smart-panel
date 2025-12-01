import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

@ApiSchema({ name: 'DevicesThirdPartyPluginDataDevice' })
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

	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_THIRD_PARTY_TYPE,
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}

@ApiSchema({ name: 'DevicesThirdPartyPluginDataChannel' })
@ChildEntity()
export class ThirdPartyChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_THIRD_PARTY_TYPE,
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}

@ApiSchema({ name: 'DevicesThirdPartyPluginDataChannelProperty' })
@ChildEntity()
export class ThirdPartyChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_THIRD_PARTY_TYPE,
		example: DEVICES_THIRD_PARTY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}
}
