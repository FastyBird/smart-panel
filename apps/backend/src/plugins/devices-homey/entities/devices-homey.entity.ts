import { Expose } from 'class-transformer';
import { ChildEntity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginDataDevice' })
@ChildEntity()
export class HomeyDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOMEY_TYPE;
	}

	toString(): string {
		return `Homey Device [${this.identifier}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesHomeyPluginDataChannel' })
@ChildEntity()
export class HomeyChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOMEY_TYPE;
	}

	toString(): string {
		return `Homey Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesHomeyPluginDataChannelProperty' })
@ChildEntity()
export class HomeyChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_HOMEY_TYPE,
		example: DEVICES_HOMEY_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_HOMEY_TYPE;
	}

	toString(): string {
		return `Homey Capability [${this.identifier}] -> Property [${this.id}]`;
	}
}
