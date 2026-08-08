import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';

/**
 * One candidate's compatibility verdict, echoing the triple it was evaluated for so a caller can
 * match a report back to its candidate without depending on array order.
 */
@ApiSchema({ name: 'DevicesVirtualPluginDataCompatibilityReport' })
export class CompatibilityReportModel {
	@ApiProperty({
		name: 'spec_channel',
		description: 'Channel category of the spec slot that was evaluated',
		enum: ChannelCategory,
		example: ChannelCategory.LIGHT,
	})
	@Expose({ name: 'spec_channel' })
	@IsEnum(ChannelCategory)
	spec_channel: ChannelCategory;

	@ApiProperty({
		name: 'spec_property',
		description: 'Property category of the spec slot that was evaluated',
		enum: PropertyCategory,
		example: PropertyCategory.ON,
	})
	@Expose({ name: 'spec_property' })
	@IsEnum(PropertyCategory)
	spec_property: PropertyCategory;

	@ApiProperty({
		name: 'source_property',
		description: 'ID of the candidate source property that was evaluated',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'source_property' })
	@IsUUID('4')
	source_property: string;

	@ApiProperty({
		description: 'Whether the source property can fill the spec slot',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	compatible: boolean;

	@ApiPropertyOptional({
		description: 'Why the source property cannot fill the spec slot. Unset when compatible is true.',
		type: 'string',
		nullable: true,
		example: 'Source property id=... permissions [ro] do not satisfy required permission(s) [rw]',
	})
	@Expose()
	@IsOptional()
	@IsString()
	reason?: string;
}

/**
 * Response wrapper for a compatibility preview: one report per candidate the request submitted, in
 * the same order.
 */
@ApiSchema({ name: 'DevicesVirtualPluginResCompatibility' })
export class CompatibilityResponseModel extends BaseSuccessResponseModel<CompatibilityReportModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(CompatibilityReportModel) },
	})
	@Expose()
	declare data: CompatibilityReportModel[];
}
