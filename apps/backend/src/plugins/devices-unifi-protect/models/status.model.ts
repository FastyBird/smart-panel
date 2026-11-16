import { Expose } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ServiceState } from '../../../modules/extensions/services/managed-extension-service.interface';
import {
	PROTECT_REALTIME_STATES,
	PROTECT_TLS_MODES,
	ProtectConnectionState,
	ProtectRealtimeState,
	ProtectTlsMode,
} from '../devices-unifi-protect.constants';
import { ProtectErrorCategory } from '../errors/protect-api.error';

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataStatus' })
export class ProtectStatusModel {
	@ApiProperty({
		description: 'Managed plugin service lifecycle state',
		enum: ['stopped', 'starting', 'started', 'stopping', 'error'],
		name: 'service_state',
	})
	@Expose({ name: 'service_state' })
	@IsString()
	serviceState: ServiceState;

	@ApiProperty({
		description: 'Console connection state',
		enum: ProtectConnectionState,
		name: 'connection_state',
	})
	@Expose({ name: 'connection_state' })
	@IsEnum(ProtectConnectionState)
	connectionState: ProtectConnectionState;

	@ApiProperty({ description: 'Whether the plugin is enabled' })
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({ description: 'Whether the saved console host and API key are both configured' })
	@Expose()
	@IsBoolean()
	configured: boolean;

	@ApiProperty({ description: 'Whether the connector is started and connected to a supported console' })
	@Expose()
	@IsBoolean()
	healthy: boolean;

	@ApiProperty({
		description: 'Configured certificate trust mode',
		enum: PROTECT_TLS_MODES,
		name: 'tls_mode',
	})
	@Expose({ name: 'tls_mode' })
	@IsString()
	tlsMode: ProtectTlsMode;

	@ApiPropertyOptional({
		description: 'UniFi Protect application version reported by the console',
		nullable: true,
		name: 'application_version',
	})
	@Expose({ name: 'application_version' })
	@IsOptional()
	@IsString()
	applicationVersion: string | null;

	@ApiProperty({
		description: 'Oldest UniFi Protect application version the plugin supports',
		name: 'minimum_version',
	})
	@Expose({ name: 'minimum_version' })
	@IsString()
	minimumVersion: string;

	@ApiPropertyOptional({ description: 'Identifier of the console NVR', nullable: true, name: 'nvr_id' })
	@Expose({ name: 'nvr_id' })
	@IsOptional()
	@IsString()
	nvrId: string | null;

	@ApiPropertyOptional({ description: 'Display name of the console NVR', nullable: true, name: 'nvr_name' })
	@Expose({ name: 'nvr_name' })
	@IsOptional()
	@IsString()
	nvrName: string | null;

	@ApiPropertyOptional({
		description: 'Timestamp of the last successful connection',
		nullable: true,
		name: 'last_connected_at',
	})
	@Expose({ name: 'last_connected_at' })
	@IsOptional()
	@IsDateString()
	lastConnectedAt: string | null;

	@ApiPropertyOptional({
		description: 'Normalized category of the current error',
		enum: ProtectErrorCategory,
		nullable: true,
		name: 'last_error_category',
	})
	@Expose({ name: 'last_error_category' })
	@IsOptional()
	@IsEnum(ProtectErrorCategory)
	lastErrorCategory: ProtectErrorCategory | null;

	@ApiPropertyOptional({
		description: 'Fixed, credential-free text describing the current error',
		nullable: true,
		name: 'last_error',
	})
	@Expose({ name: 'last_error' })
	@IsOptional()
	@IsString()
	lastError: string | null;

	@ApiProperty({
		description: 'Consecutive failed connection attempts since the last connection',
		name: 'reconnect_attempt',
	})
	@Expose({ name: 'reconnect_attempt' })
	@IsInt()
	@Min(0)
	reconnectAttempt: number;

	@ApiPropertyOptional({
		description: 'Timestamp of the next scheduled connection attempt',
		nullable: true,
		name: 'next_retry_at',
	})
	@Expose({ name: 'next_retry_at' })
	@IsOptional()
	@IsDateString()
	nextRetryAt: string | null;

	@ApiProperty({
		description: 'Real-time synchronisation state',
		enum: PROTECT_REALTIME_STATES,
		name: 'realtime_state',
	})
	@Expose({ name: 'realtime_state' })
	@IsIn(PROTECT_REALTIME_STATES)
	realtimeState: ProtectRealtimeState = 'stopped';

	@ApiProperty({
		description: 'Protect events of unknown types ignored since the service started',
		minimum: 0,
		name: 'ignored_event_count',
	})
	@Expose({ name: 'ignored_event_count' })
	@IsInt()
	@Min(0)
	ignoredEventCount: number = 0;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginResStatus' })
export class ProtectStatusResponseModel extends BaseSuccessResponseModel<ProtectStatusModel> {
	@ApiProperty({ type: ProtectStatusModel })
	@Expose()
	declare data: ProtectStatusModel;
}
