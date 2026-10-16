import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsUUID,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, OmitType } from '@nestjs/swagger';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { CreateVirtualDeviceDto } from './create-device.dto';

@ApiSchema({ name: 'DevicesVirtualPluginLightGroupDraftDevice' })
export class LightGroupDraftDeviceDto extends OmitType(CreateVirtualDeviceDto, [
	'type',
	'category',
	'mode',
	'channels',
] as const) {}

@ApiSchema({ name: 'DevicesVirtualPluginLightGroupDraftMember' })
export class LightGroupDraftMemberDto {
	@ApiProperty({
		name: 'source_channel',
		description: 'Distinct physical channel matching the selected group profile',
		format: 'uuid',
	})
	@Expose({ name: 'source_channel' })
	@IsUUID('4')
	sourceChannelId: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginLightGroupDraft' })
export class LightGroupDraftDto {
	@ApiPropertyOptional({ enum: VirtualLightGroupProfile, default: VirtualLightGroupProfile.LIGHT })
	@Expose()
	@IsOptional()
	@IsEnum(VirtualLightGroupProfile)
	profile?: VirtualLightGroupProfile;

	@ApiProperty({ type: [LightGroupDraftMemberDto], minItems: 2, maxItems: 256 })
	@Expose()
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(256)
	@ValidateNested({ each: true })
	@Type(() => LightGroupDraftMemberDto)
	members: LightGroupDraftMemberDto[];

	@ApiPropertyOptional({
		enum: PropertyCategory,
		isArray: true,
		description:
			'Explicit exposed controls; defaults to the whole validated intersection. Required fields depend on the selected profile.',
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(8)
	@IsEnum(PropertyCategory, { each: true })
	capabilities?: PropertyCategory[];

	@ApiPropertyOptional({
		name: 'expected_graph_revision',
		description: 'Preview graph revision; creation revalidates under writer admission',
		minimum: 0,
	})
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginCreateLightGroupDraft' })
export class CreateLightGroupDraftDto extends LightGroupDraftDto {
	@ApiProperty({ type: LightGroupDraftDeviceDto })
	@Expose()
	@ValidateNested()
	@Type(() => LightGroupDraftDeviceDto)
	device: LightGroupDraftDeviceDto;
}
