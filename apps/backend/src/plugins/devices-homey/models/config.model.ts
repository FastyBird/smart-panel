import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

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

@ApiSchema({ name: 'DevicesHomeyPluginDataConfig' })
export class HomeyConfigModel extends PluginConfigModel {
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
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
	url: string | null = null;

	@ApiPropertyOptional({
		description: 'Homey local API key. This value is accepted on write and never returned.',
		writeOnly: true,
		nullable: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
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
