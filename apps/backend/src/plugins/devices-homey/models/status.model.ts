import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ServiceState } from '../../../modules/extensions/services/managed-plugin-service.interface';
import { HomeyConnectionState } from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginDataStatus' })
export class HomeyStatusModel {
	@ApiProperty({
		description: 'Managed plugin service lifecycle state',
		enum: ['stopped', 'starting', 'started', 'stopping', 'error'],
		name: 'service_state',
	})
	@Expose({ name: 'service_state' })
	@IsString()
	serviceState: ServiceState;

	@ApiProperty({
		description: 'Homey transport connection state',
		enum: HomeyConnectionState,
		name: 'connection_state',
	})
	@Expose({ name: 'connection_state' })
	@IsEnum(HomeyConnectionState)
	connectionState: HomeyConnectionState;

	@ApiProperty({ description: 'Whether the plugin is enabled' })
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({ description: 'Whether the saved local URL and API key are both configured' })
	@Expose()
	@IsBoolean()
	configured: boolean;

	@ApiProperty({ description: 'Whether an active Homey connector is healthy' })
	@Expose()
	@IsBoolean()
	healthy: boolean;

	@ApiPropertyOptional({
		description: 'Sanitized service error summary',
		nullable: true,
		name: 'last_error',
	})
	@Expose({ name: 'last_error' })
	@IsOptional()
	@IsString()
	lastError: string | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginResStatus' })
export class HomeyStatusResponseModel extends BaseSuccessResponseModel<HomeyStatusModel> {
	@ApiProperty({ type: HomeyStatusModel })
	@Expose()
	declare data: HomeyStatusModel;
}
