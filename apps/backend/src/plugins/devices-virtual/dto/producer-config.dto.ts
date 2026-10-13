import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { VirtualAggregateOperator, VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

@ApiSchema({ name: 'DevicesVirtualPluginAggregateInput' })
export class VirtualAggregateInputDto {
	@ApiPropertyOptional({ description: 'Stable binding UUID; retain it to repair a missing input', format: 'uuid' })
	@Expose()
	@IsOptional()
	@IsUUID('4')
	id?: string;

	@ApiProperty({
		name: 'source_property',
		description: 'Source property UUID; null only for an existing missing binding',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4')
	sourcePropertyId: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginConfigureAggregate' })
export class ConfigureVirtualAggregateDto {
	@ApiProperty({
		name: 'expected_revision',
		description: 'Expected config revision; zero for first configuration',
		minimum: 0,
	})
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(0)
	expectedRevision: number;

	@ApiPropertyOptional({
		name: 'expected_graph_revision',
		description: 'Optional dependency graph revision fence',
		minimum: 0,
	})
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;

	@ApiProperty({ description: 'Versioned aggregate operator', enum: VirtualAggregateOperator })
	@Expose()
	@IsEnum(VirtualAggregateOperator)
	operator: VirtualAggregateOperator;

	@ApiProperty({
		name: 'minimum_valid_inputs',
		description: 'Required fresh input count; missing rows remain members',
		minimum: 1,
		maximum: 256,
	})
	@Expose({ name: 'minimum_valid_inputs' })
	@IsInt()
	@Min(1)
	@Max(256)
	minimumValidInputs: number;

	@ApiProperty({ name: 'maximum_age_seconds', description: 'Maximum source sample age', minimum: 1, maximum: 86400 })
	@Expose({ name: 'maximum_age_seconds' })
	@IsInt()
	@Min(1)
	@Max(86400)
	maximumAgeSeconds: number;

	@ApiProperty({
		description: 'Distinct compatible temperature inputs',
		type: [VirtualAggregateInputDto],
		minItems: 2,
		maxItems: 256,
	})
	@Expose()
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(256)
	@ValidateNested({ each: true })
	@Type(() => VirtualAggregateInputDto)
	inputs: VirtualAggregateInputDto[];
}

@ApiSchema({ name: 'DevicesVirtualPluginLightGroupPropertyBinding' })
export class VirtualLightGroupPropertyBindingDto {
	@ApiPropertyOptional({ description: 'Stable binding UUID', format: 'uuid' })
	@Expose()
	@IsOptional()
	@IsUUID('4')
	id?: string;

	@ApiProperty({ name: 'output_property', description: 'Materialized group output property UUID', format: 'uuid' })
	@Expose({ name: 'output_property' })
	@IsUUID('4')
	outputPropertyId: string;

	@ApiProperty({
		name: 'source_property',
		description: 'Physical member property UUID; null only for an existing missing binding',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4')
	sourcePropertyId: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginLightGroupMember' })
export class VirtualLightGroupMemberDto {
	@ApiPropertyOptional({ description: 'Stable member UUID; retain it when repairing a missing member', format: 'uuid' })
	@Expose()
	@IsOptional()
	@IsUUID('4')
	id?: string;

	@ApiProperty({
		name: 'source_channel',
		description: 'Physical light channel UUID; null only for an existing missing member',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'source_channel' })
	@IsOptional()
	@IsUUID('4')
	sourceChannelId: string | null;

	@ApiProperty({
		description: 'Physical member bindings for exposed group properties',
		type: [VirtualLightGroupPropertyBindingDto],
		minItems: 1,
		maxItems: 32,
	})
	@Expose()
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(32)
	@ValidateNested({ each: true })
	@Type(() => VirtualLightGroupPropertyBindingDto)
	bindings: VirtualLightGroupPropertyBindingDto[];
}

@ApiSchema({ name: 'DevicesVirtualPluginConfigureLightGroup' })
export class ConfigureVirtualLightGroupDto {
	@ApiProperty({
		name: 'expected_revision',
		description: 'Expected config revision; zero for first configuration',
		minimum: 0,
	})
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(0)
	expectedRevision: number;

	@ApiPropertyOptional({
		name: 'expected_graph_revision',
		description: 'Optional dependency graph revision fence',
		minimum: 0,
	})
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;

	@ApiProperty({ description: 'Versioned group profile', enum: VirtualLightGroupProfile })
	@Expose()
	@IsEnum(VirtualLightGroupProfile)
	profile: VirtualLightGroupProfile;

	@ApiProperty({
		description: 'Distinct physical light members',
		type: [VirtualLightGroupMemberDto],
		minItems: 2,
		maxItems: 256,
	})
	@Expose()
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(256)
	@ValidateNested({ each: true })
	@Type(() => VirtualLightGroupMemberDto)
	members: VirtualLightGroupMemberDto[];
}
