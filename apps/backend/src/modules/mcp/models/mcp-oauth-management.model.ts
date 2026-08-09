import { Expose, Transform } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UserRole } from '../../users/users.constants';
import { McpOAuthGrantEntity } from '../entities/mcp-oauth.entity';
import { McpOAuthScope } from '../mcp.constants';

const toIsoString = ({ value }: { value: Date | string | null }): string | null =>
	value instanceof Date ? value.toISOString() : value;

@ApiSchema({ name: 'McpModuleDataOAuthGrant' })
export class McpOAuthGrantModel {
	@ApiProperty({ description: 'OAuth grant management identifier', type: 'string', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ name: 'client_id', description: 'Internal OAuth client record identifier', format: 'uuid' })
	@Expose({ name: 'client_id' })
	clientId: string;

	@ApiProperty({ name: 'client_name', description: 'Human-readable OAuth client name' })
	@Expose({ name: 'client_name' })
	clientName: string;

	@ApiPropertyOptional({ name: 'approved_by_id', type: 'string', format: 'uuid', nullable: true })
	@Expose({ name: 'approved_by_id' })
	approvedById: string | null;

	@ApiProperty({
		name: 'approved_scopes',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpOAuthScope) },
	})
	@Expose({ name: 'approved_scopes' })
	approvedScopes: McpOAuthScope[];

	@ApiProperty({ name: 'expires_at', type: 'string', format: 'date-time' })
	@Expose({ name: 'expires_at' })
	@Transform(toIsoString, { toPlainOnly: true })
	expiresAt: Date | string;

	@ApiPropertyOptional({ name: 'revoked_at', type: 'string', format: 'date-time', nullable: true })
	@Expose({ name: 'revoked_at' })
	@Transform(toIsoString, { toPlainOnly: true })
	revokedAt: Date | string | null;

	@ApiProperty({ description: 'Whether the grant is currently usable', type: 'boolean' })
	@Expose()
	active: boolean;

	@ApiProperty({ name: 'created_at', type: 'string', format: 'date-time' })
	@Expose({ name: 'created_at' })
	@Transform(toIsoString, { toPlainOnly: true })
	createdAt: Date | string;

	static fromEntity(entity: McpOAuthGrantEntity): McpOAuthGrantModel {
		return Object.assign(new McpOAuthGrantModel(), {
			id: entity.id,
			clientId: entity.clientId,
			clientName: entity.client?.name ?? 'Unknown client',
			approvedById: entity.approvedById,
			approvedScopes: [...entity.approvedScopes],
			expiresAt: entity.expiresAt,
			revokedAt: entity.revokedAt,
			active:
				entity.revokedAt === null &&
				entity.expiresAt > new Date() &&
				entity.client?.enabled === true &&
				entity.approvedBy !== undefined &&
				entity.approvedBy !== null &&
				[UserRole.OWNER, UserRole.ADMIN].includes(entity.approvedBy.role),
			createdAt: entity.createdAt,
		});
	}
}

@ApiSchema({ name: 'McpModuleDataOAuthAccessToken' })
export class McpOAuthAccessTokenModel {
	@ApiProperty({ description: 'Non-secret access-token management identifier', type: 'string', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ name: 'client_id', description: 'Internal OAuth client record identifier', format: 'uuid' })
	@Expose({ name: 'client_id' })
	clientId: string;

	@ApiProperty({ name: 'client_name', description: 'Human-readable OAuth client name' })
	@Expose({ name: 'client_name' })
	clientName: string;

	@ApiProperty({ name: 'grant_id', description: 'OAuth grant management identifier', format: 'uuid' })
	@Expose({ name: 'grant_id' })
	grantId: string;

	@ApiPropertyOptional({ name: 'refresh_family_id', type: 'string', format: 'uuid', nullable: true })
	@Expose({ name: 'refresh_family_id' })
	refreshFamilyId: string | null;

	@ApiProperty({ type: 'array', items: { type: 'string', enum: Object.values(McpOAuthScope) } })
	@Expose()
	scopes: McpOAuthScope[];

	@ApiProperty({ name: 'expires_at', type: 'string', format: 'date-time' })
	@Expose({ name: 'expires_at' })
	expiresAt: string;
}

@ApiSchema({ name: 'McpModuleDataOAuthRefreshFamily' })
export class McpOAuthRefreshFamilyModel {
	@ApiProperty({ description: 'Non-secret refresh-family management identifier', type: 'string', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ name: 'client_id', description: 'Internal OAuth client record identifier', format: 'uuid' })
	@Expose({ name: 'client_id' })
	clientId: string;

	@ApiProperty({ name: 'client_name', description: 'Human-readable OAuth client name' })
	@Expose({ name: 'client_name' })
	clientName: string;

	@ApiProperty({ name: 'grant_id', description: 'OAuth grant management identifier', format: 'uuid' })
	@Expose({ name: 'grant_id' })
	grantId: string;

	@ApiProperty({ name: 'expires_at', type: 'string', format: 'date-time' })
	@Expose({ name: 'expires_at' })
	expiresAt: string;

	@ApiProperty({ name: 'active_token_count', type: 'integer', minimum: 0 })
	@Expose({ name: 'active_token_count' })
	activeTokenCount: number;
}
