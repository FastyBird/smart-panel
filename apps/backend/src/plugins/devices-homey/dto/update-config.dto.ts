import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionMode,
	MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH,
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';
import { IsSafeHomeyCloudRedirectUrl } from '../validators/homey-cloud-redirect-url.validator';
import { IsSafeHomeyUrl, MAX_HOMEY_URL_LENGTH } from '../validators/homey-url.validator';

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
		description: 'Saved Homey connector mode',
		enum: HomeyConnectionMode,
		example: HomeyConnectionMode.LOCAL,
	})
	@Expose()
	@IsOptional()
	@IsEnum(HomeyConnectionMode, { message: '[{"field":"mode","reason":"Connection mode must be local or cloud."}]' })
	mode?: HomeyConnectionMode;

	@ApiPropertyOptional({
		description: 'Homey local API base URL',
		example: 'http://homey.local:4859',
		maxLength: MAX_HOMEY_URL_LENGTH,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsSafeHomeyUrl({
		message: `[{"field":"url","reason":"URL must be at most ${MAX_HOMEY_URL_LENGTH} characters and use HTTP or HTTPS without embedded credentials."}]`,
	})
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
	@Matches(/\S/, { message: '[{"field":"api_key","reason":"API key must contain a non-whitespace character."}]' })
	apiKey?: string | null;

	@ApiPropertyOptional({
		description: 'Homey Cloud OAuth client ID',
		maxLength: MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH,
		name: 'cloud_client_id',
		nullable: true,
	})
	@Expose({ name: 'cloud_client_id' })
	@IsOptional()
	@IsString({ message: '[{"field":"cloud_client_id","reason":"Cloud client ID must be a valid string."}]' })
	@Matches(/\S/, {
		message: '[{"field":"cloud_client_id","reason":"Cloud client ID must contain a non-whitespace character."}]',
	})
	@MaxLength(MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH, {
		message: `[{"field":"cloud_client_id","reason":"Cloud client ID must be at most ${MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH} characters."}]`,
	})
	cloudClientId?: string | null;

	@ApiPropertyOptional({
		description:
			'Replacement Homey Cloud OAuth client secret. Omit to preserve the stored secret or send null to clear it.',
		maxLength: MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH,
		name: 'cloud_client_secret',
		nullable: true,
		writeOnly: true,
	})
	@Expose({ name: 'cloud_client_secret' })
	@IsOptional()
	@IsString({ message: '[{"field":"cloud_client_secret","reason":"Cloud client secret must be a valid string."}]' })
	@Matches(/\S/, {
		message:
			'[{"field":"cloud_client_secret","reason":"Cloud client secret must contain a non-whitespace character."}]',
	})
	@MaxLength(MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH, {
		message: `[{"field":"cloud_client_secret","reason":"Cloud client secret must be at most ${MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH} characters."}]`,
	})
	cloudClientSecret?: string | null;

	@ApiPropertyOptional({
		description: 'Exact Homey Cloud OAuth callback URL registered for this Smart Panel installation',
		maxLength: MAX_HOMEY_URL_LENGTH,
		name: 'cloud_redirect_url',
		nullable: true,
	})
	@Expose({ name: 'cloud_redirect_url' })
	@IsOptional()
	@IsSafeHomeyCloudRedirectUrl({
		message:
			'[{"field":"cloud_redirect_url","reason":"Cloud redirect URL must be the exact HTTPS callback URL, or use HTTP on a loopback host."}]',
	})
	cloudRedirectUrl?: string | null;

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
