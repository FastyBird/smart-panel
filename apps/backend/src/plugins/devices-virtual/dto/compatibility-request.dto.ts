import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { VIRTUAL_MAX_COMPATIBILITY_CANDIDATES } from '../devices-virtual.constants';

/**
 * One candidate pairing to check: a spec slot (a channel category + property category the target
 * device category's specification either requires or allows) and the id of the source property being
 * considered to fill it.
 *
 * `source_property` is an id, not a hydrated property — the controller resolves it, and refuses the
 * whole request with 422 if it does not resolve to an existing property. See
 * VirtualDevicesController.checkCompatibility.
 */
@ApiSchema({ name: 'DevicesVirtualPluginCompatibilityCandidate' })
export class CompatibilityCandidateDto {
	@ApiProperty({
		name: 'spec_channel',
		description: 'Channel category of the spec slot being filled',
		enum: ChannelCategory,
		example: ChannelCategory.LIGHT,
	})
	@Expose({ name: 'spec_channel' })
	@IsEnum(ChannelCategory, {
		message: '[{"field":"spec_channel","reason":"Spec channel must be a valid channel category."}]',
	})
	spec_channel: ChannelCategory;

	@ApiProperty({
		name: 'spec_property',
		description: 'Property category of the spec slot being filled',
		enum: PropertyCategory,
		example: PropertyCategory.ON,
	})
	@Expose({ name: 'spec_property' })
	@IsEnum(PropertyCategory, {
		message: '[{"field":"spec_property","reason":"Spec property must be a valid property category."}]',
	})
	spec_property: PropertyCategory;

	@ApiProperty({
		name: 'source_property',
		description: 'ID of the candidate source property being considered to fill the spec slot',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'source_property' })
	@IsUUID('4', {
		message: '[{"field":"source_property","reason":"Source property must be a valid UUID (version 4)."}]',
	})
	source_property: string;
}

/**
 * A compatibility preview request: the device category being built, plus every candidate spec-slot /
 * source-property pairing the caller wants checked. Each candidate is evaluated independently — one
 * incompatible candidate does not stop the others from being reported; see
 * VirtualDevicesService.reportCompatibility.
 */
@ApiSchema({ name: 'DevicesVirtualPluginCompatibility' })
export class CompatibilityDto {
	@ApiProperty({
		description: 'Target device category the candidates are being evaluated for',
		enum: DeviceCategory,
		example: DeviceCategory.LIGHTING,
	})
	@Expose()
	@IsEnum(DeviceCategory, { message: '[{"field":"category","reason":"Category must be a valid device category."}]' })
	category: DeviceCategory;

	@ApiProperty({
		description: 'Candidate spec-slot / source-property pairings to check',
		type: 'array',
		items: { $ref: getSchemaPath(CompatibilityCandidateDto) },
	})
	@Expose()
	@IsArray({ message: '[{"field":"candidates","reason":"Candidates must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"candidates","reason":"Candidates array cannot be empty."}]' })
	@ArrayMaxSize(VIRTUAL_MAX_COMPATIBILITY_CANDIDATES, {
		message: `[{"field":"candidates","reason":"Candidates array can contain at most ${VIRTUAL_MAX_COMPATIBILITY_CANDIDATES} items."}]`,
	})
	@ValidateNested({ each: true })
	@Type(() => CompatibilityCandidateDto)
	candidates: CompatibilityCandidateDto[];
}

/**
 * Request wrapper for a compatibility preview — the same `{ data: ... }` envelope every other POST
 * body in this backend uses (e.g. ReqBulkAssignDto, ReqTriggerSceneDto).
 */
@ApiSchema({ name: 'DevicesVirtualPluginReqCompatibility' })
export class ReqCompatibilityDto {
	@ApiProperty({ description: 'Compatibility check data', type: () => CompatibilityDto })
	@Expose()
	@ValidateNested()
	@Type(() => CompatibilityDto)
	data: CompatibilityDto;
}
