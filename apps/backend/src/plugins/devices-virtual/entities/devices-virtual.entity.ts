import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

export enum VirtualValueOrigin {
	/** Value is read from and written to `sourcePropertyId`. */
	SOURCE = 'source',
	/** Value is stored under this property's own id, e.g. synthesized device information. */
	LOCAL = 'local',
}

@ApiSchema({ name: 'DevicesVirtualPluginDataDevice' })
@ChildEntity()
export class VirtualDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginDataChannel' })
@ChildEntity()
export class VirtualChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginDataChannelProperty' })
@ChildEntity()
export class VirtualChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		name: 'value_origin',
		description: 'Whether the value comes from a source property or is stored by this property itself',
		enum: VirtualValueOrigin,
		example: VirtualValueOrigin.SOURCE,
	})
	@Expose({ name: 'value_origin' })
	@IsEnum(VirtualValueOrigin)
	@Transform(
		({ obj }: { obj: { value_origin?: VirtualValueOrigin; valueOrigin?: VirtualValueOrigin } }) =>
			obj.value_origin ?? obj.valueOrigin,
		{ toClassOnly: true },
	)
	@Column({ type: 'text', enum: VirtualValueOrigin, default: VirtualValueOrigin.SOURCE })
	valueOrigin: VirtualValueOrigin = VirtualValueOrigin.SOURCE;

	@ApiPropertyOptional({
		name: 'source_property',
		description: 'Property whose value this one projects. Null once the source has been deleted.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"source_property","reason":"Source property must be a valid UUID (version 4)."}]',
	})
	@Transform(
		({ obj }: { obj: { source_property?: string | null; sourcePropertyId?: string | null } }) =>
			obj.source_property !== undefined ? obj.source_property : obj.sourcePropertyId,
		{ toClassOnly: true },
	)
	@Index()
	@Column({ nullable: true, default: null })
	sourcePropertyId: string | null;

	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	/** True when this property was meant to project a source that has since been deleted. */
	get isOrphaned(): boolean {
		return this.valueOrigin === VirtualValueOrigin.SOURCE && this.sourcePropertyId === null;
	}
}
