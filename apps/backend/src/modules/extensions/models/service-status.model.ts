import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import {
	ManagedServiceActivationPolicy,
	ManagedServiceOwnerKind,
	ServiceState,
} from '../services/managed-extension-service.interface';

@ApiSchema({ name: 'ExtensionsModuleDataServiceStatus' })
export class ServiceStatusModel {
	@ApiProperty({
		name: 'extension_kind',
		description: 'Kind of extension that owns this service',
		enum: ['module', 'plugin'],
		example: 'plugin',
	})
	@Expose({ name: 'extension_kind' })
	extensionKind: ManagedServiceOwnerKind;

	@ApiProperty({
		name: 'extension_type',
		description: 'Type identifier of the extension that owns this service',
		example: 'devices-shelly-v1',
	})
	@Expose({ name: 'extension_type' })
	extensionType: string;

	@ApiProperty({
		name: 'service_id',
		description: 'Unique service identifier within the extension',
		example: 'main',
	})
	@Expose({ name: 'service_id' })
	serviceId: string;

	@ApiProperty({
		name: 'activation_policy',
		description: 'How the desired service state is determined',
		enum: ['owner-enabled', 'always'],
		example: 'owner-enabled',
	})
	@Expose({ name: 'activation_policy' })
	activationPolicy: ManagedServiceActivationPolicy;

	@ApiProperty({
		description: 'Current service state',
		enum: ['stopped', 'starting', 'started', 'stopping', 'error'],
		example: 'started',
	})
	@Expose()
	state: ServiceState;

	@ApiProperty({
		name: 'desired_state',
		description: 'Service state derived from its activation policy and owner configuration',
		enum: ['started', 'stopped'],
		example: 'started',
	})
	@Expose({ name: 'desired_state' })
	desiredState: 'started' | 'stopped';

	@ApiProperty({
		description: 'Whether the owning extension is enabled in configuration',
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
		name: 'last_started_at',
		description: 'ISO 8601 timestamp of when the service was last started',
		example: '2025-01-15T10:30:00.000Z',
	})
	@Expose({ name: 'last_started_at' })
	lastStartedAt?: string;

	@ApiPropertyOptional({
		name: 'last_stopped_at',
		description: 'ISO 8601 timestamp of when the service was last stopped',
		example: '2025-01-15T09:00:00.000Z',
	})
	@Expose({ name: 'last_stopped_at' })
	lastStoppedAt?: string;

	@ApiPropertyOptional({
		name: 'last_error',
		description: 'Last error message if the service failed to start or stop',
		example: 'Connection refused',
	})
	@Expose({ name: 'last_error' })
	lastError?: string;

	@ApiProperty({
		name: 'start_count',
		description: 'Number of times the service has been started',
		example: 5,
	})
	@Expose({ name: 'start_count' })
	startCount: number;

	@ApiPropertyOptional({
		name: 'uptime_ms',
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
