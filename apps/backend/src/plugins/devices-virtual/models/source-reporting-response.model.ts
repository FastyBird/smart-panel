import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataSourceReporting' })
export class VirtualSourceReportingModel {
	@ApiProperty({ description: 'Source property UUID', format: 'uuid' })
	@Expose()
	property: string;

	@ApiProperty({
		name: 'source_kind',
		description: 'A physical device property, or a derived (virtual) measurement with its own freshness policy',
		enum: ['physical', 'derived'],
	})
	@Expose({ name: 'source_kind' })
	source_kind: 'physical' | 'derived';

	@ApiProperty({
		description: 'Live device reports seen since Smart Panel started (equal-value heartbeats included)',
		example: 12,
	})
	@Expose()
	reports: number;

	@ApiPropertyOptional({
		name: 'typical_interval_seconds',
		description: 'Median time between reports; null until at least three reports were seen',
		nullable: true,
		type: Number,
		example: 3300,
	})
	@Expose({ name: 'typical_interval_seconds' })
	typical_interval_seconds: number | null;

	@ApiPropertyOptional({
		name: 'longest_interval_seconds',
		description: 'Longest time between reports; null until at least three reports were seen',
		nullable: true,
		type: Number,
		example: 3600,
	})
	@Expose({ name: 'longest_interval_seconds' })
	longest_interval_seconds: number | null;

	@ApiPropertyOptional({
		name: 'last_report_at',
		description: 'Sample time of the latest live report',
		nullable: true,
		type: String,
		format: 'date-time',
	})
	@Expose({ name: 'last_report_at' })
	last_report_at: string | null;

	@ApiPropertyOptional({
		name: 'recommended_maximum_age_seconds',
		description:
			'A maximum sample age that leaves room for one late report (longest interval plus half, at least 60 s); ' +
			'null when it cannot be derived yet',
		nullable: true,
		type: Number,
		example: 5460,
	})
	@Expose({ name: 'recommended_maximum_age_seconds' })
	recommended_maximum_age_seconds: number | null;
}

@ApiSchema({ name: 'DevicesVirtualPluginResSourceReporting' })
export class VirtualSourceReportingResponseModel extends BaseSuccessResponseModel<VirtualSourceReportingModel> {
	@ApiProperty({ type: VirtualSourceReportingModel })
	@Expose()
	@Type(() => VirtualSourceReportingModel)
	declare data: VirtualSourceReportingModel;
}
