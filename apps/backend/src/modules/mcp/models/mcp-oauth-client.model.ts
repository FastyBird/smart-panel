import { Expose, Transform } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { McpOAuthClientEntity } from '../entities/mcp-oauth.entity';
import { McpOAuthScope } from '../mcp.constants';

@ApiSchema({ name: 'McpModuleDataOAuthClient' })
export class McpOAuthClientModel {
	@ApiProperty({ description: 'Internal OAuth client record identifier', type: 'string', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ name: 'client_id', description: 'Public OAuth client identifier' })
	@Expose({ name: 'client_id' })
	clientIdentifier: string;

	@ApiProperty({ description: 'Human-readable OAuth client name' })
	@Expose()
	name: string;

	@ApiProperty({ name: 'redirect_uris', type: 'array', items: { type: 'string', format: 'uri' } })
	@Expose({ name: 'redirect_uris' })
	redirectUris: string[];

	@ApiProperty({
		name: 'maximum_scopes',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpOAuthScope) },
	})
	@Expose({ name: 'maximum_scopes' })
	maximumScopes: McpOAuthScope[];

	@ApiProperty({ description: 'Whether the client may authorize', type: 'boolean' })
	@Expose()
	enabled: boolean;

	@ApiProperty({ name: 'created_at', type: 'string', format: 'date-time' })
	@Expose({ name: 'created_at' })
	@Transform(({ value }: { value: Date | string }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	createdAt: Date | string;

	@ApiProperty({ name: 'updated_at', type: 'string', format: 'date-time', nullable: true })
	@Expose({ name: 'updated_at' })
	@Transform(({ value }: { value: Date | string | null }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	updatedAt: Date | string | null;

	static fromEntity(entity: McpOAuthClientEntity): McpOAuthClientModel {
		return Object.assign(new McpOAuthClientModel(), {
			id: entity.id,
			clientIdentifier: entity.clientIdentifier,
			name: entity.name,
			redirectUris: [...entity.redirectUris],
			maximumScopes: [...entity.maximumScopes],
			enabled: entity.enabled,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt ?? null,
		});
	}
}
