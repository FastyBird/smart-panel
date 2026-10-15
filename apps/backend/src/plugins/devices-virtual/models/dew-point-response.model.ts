import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataDewPointInputDomain' })
export class VirtualDewPointInputDomainModel {
	@ApiProperty({ description: 'Finite lower canonical-unit bound' })
	@Expose()
	minimum: number;
	@ApiProperty({ description: 'The lower bound is excluded by the formula contract' })
	@Expose()
	minimumExclusive: boolean;
	@ApiProperty({ description: 'Inclusive upper canonical-unit bound' })
	@Expose()
	maximum: number;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataDewPointSource' })
export class VirtualDewPointSourceModel {
	@ApiProperty({ type: VirtualDewPointInputDomainModel, description: 'Retained versioned formula input domain' })
	@Expose()
	@Type(() => VirtualDewPointInputDomainModel)
	domain: VirtualDewPointInputDomainModel;
	@ApiProperty({ type: Number, nullable: true, description: 'Current qualified input value in its canonical unit' })
	@Expose()
	current_value: number | null;

	@ApiProperty({ enum: ['dry_bulb', 'relative_humidity'], description: 'Input role' })
	@Expose()
	role: string;
	@ApiProperty({ type: String, nullable: true, description: 'Current source UUID or retained missing binding' })
	@Expose()
	source_property: string | null;
	@ApiProperty({ description: 'Retained source UUID' })
	@Expose()
	source_identity: string;
	@ApiProperty({ description: 'Retained source contract fingerprint' })
	@Expose()
	contract_fingerprint: string;
	@ApiProperty({ description: 'Required source quantity' })
	@Expose()
	quantity: string;
	@ApiProperty({ description: 'Canonical source unit' })
	@Expose()
	unit: string;
	@ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Oldest accepted input time' })
	@Expose()
	sampled_at: string | null;
	@ApiProperty({ type: Number, nullable: true, description: 'Original input age' })
	@Expose()
	age_seconds: number | null;
	@ApiProperty({ type: [String], description: 'Current input blockers' })
	@Expose()
	errors: string[];
}

@ApiSchema({ name: 'DevicesVirtualPluginDataDewPoint' })
export class VirtualDewPointModel {
	@ApiProperty({ description: 'Stable output/history UUID' })
	@Expose()
	output_property: string;
	@ApiProperty({ enum: [1], description: 'Schema version' })
	@Expose()
	schema_version: number;
	@ApiProperty({ description: 'Exact formula version' })
	@Expose()
	formula_version: string;
	@ApiProperty({ description: 'Configuration revision' })
	@Expose()
	revision: number;
	@ApiProperty({ description: 'Graph revision' })
	@Expose()
	graph_revision: number;
	@ApiProperty({ description: 'Original maximum age' })
	@Expose()
	maximum_age_seconds: number;
	@ApiProperty({ description: 'Timestamp skew bound' })
	@Expose()
	maximum_skew_seconds: number;
	@ApiProperty({ enum: ['dew_point'], description: 'Dedicated quantity; never ambient or floor temperature' })
	@Expose()
	quantity: 'dew_point';
	@ApiProperty({ enum: ['°C'], description: 'Canonical output unit' })
	@Expose()
	unit: '°C';
	@ApiProperty({ type: Number, nullable: true, description: 'Current qualified dew point' })
	@Expose()
	current_value: number | null;
	@ApiProperty({ enum: ['good', 'unavailable'], description: 'Current evidence quality' })
	@Expose()
	quality: string;
	@ApiProperty({ type: [String], description: 'Exact current blockers; installed qualification remains separate' })
	@Expose()
	errors: string[];
	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description: 'Earliest inherited expiry; reading never renews it',
	})
	@Expose()
	expires_at: string | null;
	@ApiProperty({ type: [VirtualDewPointSourceModel], description: 'Both retained input identities and diagnostics' })
	@Expose()
	@Type(() => VirtualDewPointSourceModel)
	sources: VirtualDewPointSourceModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResDewPoint' })
export class VirtualDewPointResponseModel extends BaseSuccessResponseModel<VirtualDewPointModel> {
	@ApiProperty({ type: VirtualDewPointModel, description: 'Dew point configuration and live diagnostics' })
	@Expose()
	@Type(() => VirtualDewPointModel)
	declare data: VirtualDewPointModel;
}
