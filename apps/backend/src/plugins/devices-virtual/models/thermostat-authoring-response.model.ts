import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';

import { VirtualThermostatConfigurationModel } from './thermostat-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataCreatedThermostat' })
export class VirtualCreatedThermostatModel {
	@ApiProperty({ description: 'Atomically created thermostat device', type: VirtualDeviceEntity })
	@Expose()
	@Type(() => VirtualDeviceEntity)
	device: VirtualDeviceEntity;

	@ApiProperty({
		description: 'Committed or proposed thermostat configuration',
		type: VirtualThermostatConfigurationModel,
	})
	@Expose()
	@Type(() => VirtualThermostatConfigurationModel)
	configuration: VirtualThermostatConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResCreatedThermostat' })
export class VirtualCreatedThermostatResponseModel extends BaseSuccessResponseModel<VirtualCreatedThermostatModel> {
	@ApiProperty({
		description: 'Created thermostat and configuration',
		allOf: [{ $ref: getSchemaPath(VirtualCreatedThermostatModel) }],
	})
	@Expose()
	@Type(() => VirtualCreatedThermostatModel)
	declare data: VirtualCreatedThermostatModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatPropertyBinding' })
export class VirtualThermostatPropertyBindingModel {
	@ApiProperty({ description: 'Bound property UUID', format: 'uuid' })
	@Expose()
	property: string;

	@ApiProperty({ description: 'Owning channel UUID', format: 'uuid' })
	@Expose()
	channel: string;

	@ApiProperty({ description: 'Owning device UUID', format: 'uuid' })
	@Expose()
	device: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatPropertyBinding' })
export class VirtualThermostatPropertyBindingResponseModel extends BaseSuccessResponseModel<VirtualThermostatPropertyBindingModel> {
	@ApiProperty({ type: VirtualThermostatPropertyBindingModel })
	@Expose()
	@Type(() => VirtualThermostatPropertyBindingModel)
	declare data: VirtualThermostatPropertyBindingModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataThermostatSourceReporting' })
export class VirtualThermostatSourceReportingModel {
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

@ApiSchema({ name: 'DevicesVirtualPluginResThermostatSourceReporting' })
export class VirtualThermostatSourceReportingResponseModel extends BaseSuccessResponseModel<VirtualThermostatSourceReportingModel> {
	@ApiProperty({ type: VirtualThermostatSourceReportingModel })
	@Expose()
	@Type(() => VirtualThermostatSourceReportingModel)
	declare data: VirtualThermostatSourceReportingModel;
}
