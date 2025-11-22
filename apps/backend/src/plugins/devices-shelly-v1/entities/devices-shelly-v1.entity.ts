import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';

@ChildEntity()
export class ShellyV1DeviceEntity extends DeviceEntity {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	password: string = null;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	hostname: string = null;

	toString(): string {
		return `Shelly V1 Device [${this.identifier}] -> FB Device [${this.id}]`;
	}
}

@ChildEntity()
export class ShellyV1ChannelEntity extends ChannelEntity {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	toString(): string {
		return `Shelly V1 component [${this.identifier}] -> FB Channel [${this.id}]`;
	}
}

@ChildEntity()
export class ShellyV1ChannelPropertyEntity extends ChannelPropertyEntity {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_V1_TYPE;
	}

	toString(): string {
		return `Shelly V1 component attribute [${this.identifier}] -> FB Channel property [${this.id}]`;
	}
}
