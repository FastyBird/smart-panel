import { Expose } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ServiceState } from '../../../modules/extensions/services/managed-plugin-service.interface';
import { HomeyConnectionState } from '../devices-homey.constants';
import { HomeyConnectorErrorCategory } from '../errors/homey-connector.error';

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

	@ApiProperty({ description: 'Whether event delivery is unavailable while polling remains operational' })
	@Expose()
	@IsBoolean()
	degraded: boolean;

	@ApiPropertyOptional({ description: 'Connected Homey identifier', nullable: true, name: 'homey_id' })
	@Expose({ name: 'homey_id' })
	@IsOptional()
	@IsString()
	homeyId: string | null;

	@ApiPropertyOptional({ description: 'Connected Homey display name', nullable: true, name: 'homey_name' })
	@Expose({ name: 'homey_name' })
	@IsOptional()
	@IsString()
	homeyName: string | null;

	@ApiPropertyOptional({ description: 'Connected Homey software version', nullable: true, name: 'homey_version' })
	@Expose({ name: 'homey_version' })
	@IsOptional()
	@IsString()
	homeyVersion: string | null;

	@ApiPropertyOptional({
		description: 'Timestamp of the last successful transport connection',
		nullable: true,
		name: 'last_connected_at',
	})
	@Expose({ name: 'last_connected_at' })
	@IsOptional()
	@IsDateString()
	lastConnectedAt: string | null;

	@ApiPropertyOptional({
		description: 'Timestamp of the last successful authoritative inventory synchronization',
		nullable: true,
		name: 'last_inventory_sync_at',
	})
	@Expose({ name: 'last_inventory_sync_at' })
	@IsOptional()
	@IsDateString()
	lastInventorySyncAt: string | null;

	@ApiPropertyOptional({
		description: 'Timestamp of the last successfully processed Homey event',
		nullable: true,
		name: 'last_event_at',
	})
	@Expose({ name: 'last_event_at' })
	@IsOptional()
	@IsDateString()
	lastEventAt: string | null;

	@ApiProperty({ description: 'Reconnect attempts executed since the last explicit start', name: 'reconnect_count' })
	@Expose({ name: 'reconnect_count' })
	@IsInt()
	@Min(0)
	reconnectCount: number;

	@ApiProperty({
		description: 'Authoritative inventory reconciliation attempts since the last explicit start',
		name: 'reconciliation_count',
	})
	@Expose({ name: 'reconciliation_count' })
	@IsInt()
	@Min(0)
	reconciliationCount: number;

	@ApiProperty({
		description: 'Authoritative inventory reconciliation attempts that failed since the last explicit start',
		name: 'reconciliation_failure_count',
	})
	@Expose({ name: 'reconciliation_failure_count' })
	@IsInt()
	@Min(0)
	reconciliationFailureCount: number;

	@ApiPropertyOptional({
		description: 'Duration of the latest authoritative inventory reconciliation in milliseconds',
		nullable: true,
		name: 'last_reconciliation_duration_ms',
	})
	@Expose({ name: 'last_reconciliation_duration_ms' })
	@IsOptional()
	@IsInt()
	@Min(0)
	lastReconciliationDurationMs: number | null;

	@ApiPropertyOptional({
		description: 'Normalized category for the current sanitized connector error',
		enum: HomeyConnectorErrorCategory,
		nullable: true,
		name: 'last_error_category',
	})
	@Expose({ name: 'last_error_category' })
	@IsOptional()
	@IsEnum(HomeyConnectorErrorCategory)
	lastErrorCategory: HomeyConnectorErrorCategory | null;

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
