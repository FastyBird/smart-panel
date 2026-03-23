import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { ChildEntity, Column } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_RETERMINAL_TYPE, ReTerminalVariant } from '../devices-reterminal.constants';

@ApiSchema({ name: 'DevicesReTerminalPluginDataDevice' })
@ChildEntity()
export class ReTerminalDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_RETERMINAL_TYPE,
		example: DEVICES_RETERMINAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_RETERMINAL_TYPE;
	}

	@ApiPropertyOptional({
		description: 'Hardware variant (reterminal or reterminal_dm)',
		enum: ReTerminalVariant,
		example: ReTerminalVariant.RETERMINAL,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsEnum(ReTerminalVariant)
	@Column({ nullable: true, default: null })
	variant: ReTerminalVariant | null = null;

	toString(): string {
		return `reTerminal Device [${this.identifier}] -> Device [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesReTerminalPluginDataChannel' })
@ChildEntity()
export class ReTerminalChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_RETERMINAL_TYPE,
		example: DEVICES_RETERMINAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_RETERMINAL_TYPE;
	}

	toString(): string {
		return `reTerminal Channel [${this.identifier}] -> Channel [${this.id}]`;
	}
}

@ApiSchema({ name: 'DevicesReTerminalPluginDataChannelProperty' })
@ChildEntity()
export class ReTerminalChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_RETERMINAL_TYPE,
		example: DEVICES_RETERMINAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_RETERMINAL_TYPE;
	}

	toString(): string {
		return `reTerminal Channel Property [${this.identifier}] -> Property [${this.id}]`;
	}
}
