import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { CreateChannelPropertyDto } from '../../../modules/devices/dto/create-channel-property.dto';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { ValidateSourceNotVirtual } from '../validators/source-not-virtual-constraint.validator';

@ApiSchema({ name: 'DevicesVirtualPluginCreateChannelProperty' })
export class CreateVirtualChannelPropertyDto extends CreateChannelPropertyDto {
	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid channel property type string."}]' })
	readonly type: typeof DEVICES_VIRTUAL_TYPE;

	@ApiPropertyOptional({
		name: 'value_origin',
		description:
			'Whether the value comes from a source property or is stored by this property itself. Defaults to source.',
		enum: VirtualValueOrigin,
		default: VirtualValueOrigin.SOURCE,
		example: VirtualValueOrigin.SOURCE,
	})
	@Expose({ name: 'value_origin' })
	@IsOptional()
	@IsEnum(VirtualValueOrigin, {
		message: '[{"field":"value_origin","reason":"Value origin must be a valid value origin."}]',
	})
	value_origin?: VirtualValueOrigin;

	@ApiPropertyOptional({
		name: 'source_property',
		description: 'Property whose value this one should project',
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
	@ValidateIf((_, value) => value !== null)
	@ValidateSourceNotVirtual()
	source_property?: string | null;
}
