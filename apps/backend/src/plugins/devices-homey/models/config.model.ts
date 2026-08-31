import { Exclude, Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';
import { IsSafeHomeyUrl, MAX_HOMEY_URL_LENGTH } from '../validators/homey-url.validator';

@ApiSchema({ name: 'DevicesHomeyPluginDataConfig' })
export class HomeyConfigModel extends PluginConfigModel {
	@Exclude({ toPlainOnly: true })
	@Expose({ name: 'mode', toClassOnly: true })
	legacyConnectionMode?: unknown;

	@Exclude({ toPlainOnly: true })
	@Expose({ name: 'cloud_client_id', toClassOnly: true })
	legacyRemoteClientId?: unknown;

	@Exclude({ toPlainOnly: true })
	@Expose({ name: 'cloud_client_secret', toClassOnly: true })
	legacyRemoteClientSecret?: unknown;

	@Exclude({ toPlainOnly: true })
	@Expose({ name: 'cloud_redirect_url', toClassOnly: true })
	legacyRemoteRedirectUrl?: unknown;

	@Exclude({ toPlainOnly: true })
	@Expose({ name: 'cloud_legacy_environment_migrated', toClassOnly: true })
	legacyEnvironmentMigrationMarker?: unknown;

	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_HOMEY_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = DEVICES_HOMEY_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Homey local API base URL',
		example: 'http://homey.local:4859',
		maxLength: MAX_HOMEY_URL_LENGTH,
		nullable: true,
	})
	@Expose()
	@ValidateIf((config: HomeyConfigModel) => config.url !== null)
	@IsNotEmpty()
	@IsSafeHomeyUrl()
	url: string | null = null;

	@ApiPropertyOptional({
		description: 'Homey local API key. This value is accepted on write and never returned.',
		writeOnly: true,
		nullable: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@ValidateIf((config: HomeyConfigModel) => config.apiKey !== null)
	@IsNotEmpty()
	@IsString()
	@Matches(/\S/)
	apiKey: string | null = null;

	@ApiProperty({
		description: 'Whether a Homey local API key is configured',
		name: 'api_key_configured',
	})
	@Expose({ name: 'api_key_configured' })
	@IsOptional()
	@IsBoolean()
	apiKeyConfigured?: boolean;

	@ApiProperty({
		description: 'Connection timeout in milliseconds',
		example: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
		minimum: MIN_HOMEY_CONNECTION_TIMEOUT_MS,
		maximum: MAX_HOMEY_CONNECTION_TIMEOUT_MS,
		name: 'connection_timeout',
	})
	@Expose({ name: 'connection_timeout' })
	@IsInt()
	@Min(MIN_HOMEY_CONNECTION_TIMEOUT_MS)
	@Max(MAX_HOMEY_CONNECTION_TIMEOUT_MS)
	connectionTimeout: number = DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS;

	@ApiProperty({
		description: 'Authoritative inventory reconciliation interval in milliseconds',
		example: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		minimum: MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
		maximum: MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
		name: 'reconciliation_interval',
	})
	@Expose({ name: 'reconciliation_interval' })
	@IsInt()
	@Min(MIN_HOMEY_RECONCILIATION_INTERVAL_MS)
	@Max(MAX_HOMEY_RECONCILIATION_INTERVAL_MS)
	reconciliationInterval: number = DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS;
}
