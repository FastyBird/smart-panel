import { Expose, Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';

@ApiSchema({ name: 'DevicesHomeyPluginUpdateConfig' })
export class HomeyUpdatePluginConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: DEVICES_HOMEY_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof DEVICES_HOMEY_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Homey local API base URL',
		example: 'http://homey.local:4859',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsUrl(
		{ protocols: ['http', 'https'], require_protocol: true, require_tld: false },
		{ message: '[{"field":"url","reason":"URL must use HTTP or HTTPS and include a protocol."}]' },
	)
	url?: string | null;

	@ApiPropertyOptional({
		description: 'Replacement Homey local API key. Omit to preserve the stored key or send null to clear it.',
		writeOnly: true,
		nullable: true,
		name: 'api_key',
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	apiKey?: string | null;

	@ApiPropertyOptional({
		description: 'Connection timeout in milliseconds',
		example: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
		minimum: MIN_HOMEY_CONNECTION_TIMEOUT_MS,
		maximum: MAX_HOMEY_CONNECTION_TIMEOUT_MS,
		name: 'connection_timeout',
	})
	@Expose({ name: 'connection_timeout' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"connection_timeout","reason":"Connection timeout must be a whole number."}]' })
	@Min(MIN_HOMEY_CONNECTION_TIMEOUT_MS, {
		message: `[{"field":"connection_timeout","reason":"Connection timeout must be at least ${MIN_HOMEY_CONNECTION_TIMEOUT_MS}ms."}]`,
	})
	@Max(MAX_HOMEY_CONNECTION_TIMEOUT_MS, {
		message: `[{"field":"connection_timeout","reason":"Connection timeout must be at most ${MAX_HOMEY_CONNECTION_TIMEOUT_MS}ms."}]`,
	})
	connectionTimeout?: number;

	@ApiPropertyOptional({
		description: 'Authoritative inventory reconciliation interval in milliseconds',
		example: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		minimum: MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
		maximum: MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
		name: 'reconciliation_interval',
	})
	@Expose({ name: 'reconciliation_interval' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({
		message: '[{"field":"reconciliation_interval","reason":"Reconciliation interval must be a whole number."}]',
	})
	@Min(MIN_HOMEY_RECONCILIATION_INTERVAL_MS, {
		message: `[{"field":"reconciliation_interval","reason":"Reconciliation interval must be at least ${MIN_HOMEY_RECONCILIATION_INTERVAL_MS}ms."}]`,
	})
	@Max(MAX_HOMEY_RECONCILIATION_INTERVAL_MS, {
		message: `[{"field":"reconciliation_interval","reason":"Reconciliation interval must be at most ${MAX_HOMEY_RECONCILIATION_INTERVAL_MS}ms."}]`,
	})
	reconciliationInterval?: number;
}
