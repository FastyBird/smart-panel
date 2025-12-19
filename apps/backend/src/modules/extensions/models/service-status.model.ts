import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { ServiceState } from '../services/managed-plugin-service.interface';

@ApiSchema({ name: 'ExtensionsModuleDataServiceStatus' })
export class ServiceStatusModel {
	@ApiProperty({
		description: 'Plugin name this service belongs to',
		example: 'devices-shelly-v1',
	})
	@Expose({ name: 'plugin_name' })
	pluginName: string;

	@ApiProperty({
		description: 'Unique service identifier within the plugin',
		example: 'main',
	})
	@Expose({ name: 'service_id' })
	serviceId: string;

	@ApiProperty({
		description: 'Current service state',
		enum: ['stopped', 'starting', 'started', 'stopping', 'error'],
		example: 'started',
	})
	@Expose()
	state: ServiceState;

	@ApiProperty({
		description: 'Whether the plugin is enabled in configuration',
		example: true,
	})
	@Expose()
	enabled: boolean;

	@ApiPropertyOptional({
		description: 'Whether the service is healthy (only available if service implements health check)',
		example: true,
	})
	@Expose()
	healthy?: boolean;

	@ApiPropertyOptional({
		description: 'ISO 8601 timestamp of when the service was last started',
		example: '2025-01-15T10:30:00.000Z',
	})
	@Expose({ name: 'last_started_at' })
	lastStartedAt?: string;

	@ApiPropertyOptional({
		description: 'ISO 8601 timestamp of when the service was last stopped',
		example: '2025-01-15T09:00:00.000Z',
	})
	@Expose({ name: 'last_stopped_at' })
	lastStoppedAt?: string;

	@ApiPropertyOptional({
		description: 'Last error message if the service failed to start or stop',
		example: 'Connection refused',
	})
	@Expose({ name: 'last_error' })
	lastError?: string;

	@ApiProperty({
		description: 'Number of times the service has been started',
		example: 5,
	})
	@Expose({ name: 'start_count' })
	startCount: number;

	@ApiPropertyOptional({
		description: 'Current uptime in milliseconds (only available if service is started)',
		example: 3600000,
	})
	@Expose({ name: 'uptime_ms' })
	uptimeMs?: number;
}

@ApiSchema({ name: 'ExtensionsModuleResServicesStatus' })
export class ServicesStatusResponseModel extends BaseSuccessResponseModel<ServiceStatusModel[]> {
	@ApiProperty({
		description: 'The list of service statuses',
		type: 'array',
		items: {
			$ref: getSchemaPath(ServiceStatusModel),
		},
	})
	@Expose()
	@Type(() => ServiceStatusModel)
	declare data: ServiceStatusModel[];
}

@ApiSchema({ name: 'ExtensionsModuleResServiceStatus' })
export class ServiceStatusResponseModel extends BaseSuccessResponseModel<ServiceStatusModel> {
	@ApiProperty({
		description: 'The service status data',
		type: () => ServiceStatusModel,
	})
	@Expose()
	@Type(() => ServiceStatusModel)
	declare data: ServiceStatusModel;
}
