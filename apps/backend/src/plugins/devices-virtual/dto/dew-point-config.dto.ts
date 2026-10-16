import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDefined,
	IsIn,
	IsInt,
	IsOptional,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { DEW_POINT_FORMULA, DEW_POINT_ROLES, DewPointRole } from '../services/virtual-dew-point.utils';

@ApiSchema({ name: 'DevicesVirtualPluginDewPointSource' })
export class VirtualDewPointSourceDto {
	@ApiProperty({ enum: DEW_POINT_ROLES, description: 'Exact input role; each role occurs once' })
	@Expose()
	@IsIn(DEW_POINT_ROLES)
	role: DewPointRole;
	@ApiProperty({
		name: 'source_property',
		format: 'uuid',
		nullable: true,
		description: 'Physical or supported derived T/RH source; null retains a missing binding',
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4')
	sourcePropertyId: string | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginConfigureDewPoint' })
export class ConfigureVirtualDewPointDto {
	@ApiProperty({ name: 'schema_version', enum: [1], description: 'Dedicated two-input schema' })
	@Expose({ name: 'schema_version' })
	@IsIn([1])
	schemaVersion: 1;
	@ApiProperty({
		name: 'formula_version',
		enum: [DEW_POINT_FORMULA],
		description: 'Magnus over water; bounded domain without clipping',
	})
	@Expose({ name: 'formula_version' })
	@IsIn([DEW_POINT_FORMULA])
	formulaVersion: typeof DEW_POINT_FORMULA;
	@ApiProperty({ name: 'expected_revision', minimum: 0, description: 'Current revision; zero on create' })
	@Expose({ name: 'expected_revision' })
	@IsInt()
	@Min(0)
	expectedRevision: number;
	@ApiPropertyOptional({
		name: 'expected_graph_revision',
		minimum: 0,
		description: 'May be omitted for preview; writes require the current dependency graph revision',
	})
	@Expose({ name: 'expected_graph_revision' })
	@IsOptional()
	@IsInt()
	@Min(0)
	expectedGraphRevision?: number;
	@ApiProperty({ name: 'maximum_age_seconds', minimum: 1, maximum: 86400, description: 'Original evidence lifetime' })
	@Expose({ name: 'maximum_age_seconds' })
	@IsInt()
	@Min(1)
	@Max(86400)
	maximumAgeSeconds: number;
	@ApiProperty({
		name: 'maximum_skew_seconds',
		minimum: 0,
		maximum: 3600,
		description: 'Maximum input timestamp skew; equality allowed',
	})
	@Expose({ name: 'maximum_skew_seconds' })
	@IsInt()
	@Min(0)
	@Max(3600)
	maximumSkewSeconds: number;
	@ApiProperty({
		type: [VirtualDewPointSourceDto],
		minItems: 2,
		maxItems: 2,
		description: 'Exactly dry bulb Celsius and relative humidity percent',
	})
	@Expose()
	@IsDefined()
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(2)
	@ValidateNested({ each: true })
	@Type(() => VirtualDewPointSourceDto)
	sources: VirtualDewPointSourceDto[];
}
