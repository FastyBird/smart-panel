import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

@ChildEntity()
export class ShellyNgDeviceEntity extends DeviceEntity {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
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
		return `Shelly Device [${this.identifier}] -> FB Device [${this.id}]`;
	}
}

@ChildEntity()
export class ShellyNgChannelEntity extends ChannelEntity {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	toString(): string {
		return `Shelly component [${this.identifier}] -> FB Channel [${this.id}]`;
	}
}

@ChildEntity()
export class ShellyNgChannelPropertyEntity extends ChannelPropertyEntity {
	@Expose()
	get type(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	toString(): string {
		return `Shelly component attribute [${this.identifier}] -> FB Channel property [${this.id}]`;
	}
}
