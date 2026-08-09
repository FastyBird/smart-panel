import { Exclude, Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { McpOAuthScope } from '../mcp.constants';

export enum McpOAuthInteractionAction {
	CONSENT = 'consent',
	REDIRECT = 'redirect',
}

@ApiSchema({ name: 'McpModuleDataOAuthInteraction' })
export class McpOAuthInteractionModel {
	@ApiProperty({ enum: McpOAuthInteractionAction })
	@Expose()
	action: McpOAuthInteractionAction;

	@ApiPropertyOptional({ name: 'redirect_to', description: 'Authorization resume URL after automatic login' })
	@Expose({ name: 'redirect_to' })
	redirectTo?: string;

	@ApiPropertyOptional({ name: 'installation_name', description: 'Configured Smart Panel installation name' })
	@Expose({ name: 'installation_name' })
	installationName?: string;

	@ApiPropertyOptional({ name: 'installation_id', type: 'string', format: 'uuid' })
	@Expose({ name: 'installation_id' })
	installationId?: string;

	@ApiPropertyOptional({ name: 'client_id', description: 'Public OAuth client identifier' })
	@Expose({ name: 'client_id' })
	clientIdentifier?: string;

	@ApiPropertyOptional({ name: 'client_name', description: 'Human-readable OAuth client name' })
	@Expose({ name: 'client_name' })
	clientName?: string;

	@ApiPropertyOptional({ name: 'redirect_uri', type: 'string', format: 'uri' })
	@Expose({ name: 'redirect_uri' })
	redirectUri?: string;

	@ApiPropertyOptional({
		name: 'requested_scopes',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpOAuthScope) },
	})
	@Expose({ name: 'requested_scopes' })
	requestedScopes?: McpOAuthScope[];

	@ApiPropertyOptional({ name: 'access_expires_in_seconds', type: 'integer' })
	@Expose({ name: 'access_expires_in_seconds' })
	accessExpiresInSeconds?: number;

	@ApiPropertyOptional({ name: 'maximum_grant_expires_in_days', type: 'integer' })
	@Expose({ name: 'maximum_grant_expires_in_days' })
	maximumGrantExpiresInDays?: number;

	@ApiPropertyOptional({ name: 'physical_device_warning', type: 'boolean' })
	@Expose({ name: 'physical_device_warning' })
	physicalDeviceWarning?: boolean;

	@Exclude()
	setCookies: string[] = [];
}

@ApiSchema({ name: 'McpModuleDataOAuthInteractionCompletion' })
export class McpOAuthInteractionCompletionModel {
	@ApiProperty({ name: 'redirect_to', description: 'Validated OAuth client callback URL' })
	@Expose({ name: 'redirect_to' })
	redirectTo: string;

	@Exclude()
	setCookies: string[] = [];
}
