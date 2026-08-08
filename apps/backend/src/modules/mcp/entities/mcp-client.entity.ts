import { Exclude, Expose, Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { UserEntity } from '../../users/entities/users.entity';
import { McpCapability } from '../mcp.constants';

@ApiSchema({ name: 'McpModuleDataClient' })
@Entity('mcp_module_clients')
export class McpClientEntity extends BaseEntity {
	@ApiProperty({ description: 'Human-readable client name', type: 'string', example: 'Home assistant agent' })
	@Expose()
	@IsString()
	@Column({ type: 'varchar' })
	name: string;

	@ApiPropertyOptional({ description: 'Optional client description', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	description: string | null;

	@ApiProperty({ description: 'Whether this client may authenticate', type: 'boolean', default: true })
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ type: 'boolean', default: true })
	enabled: boolean;

	@ApiProperty({
		description: 'Capabilities granted to the client',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpCapability) },
	})
	@Expose()
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpCapability, { each: true })
	@Column({ type: 'simple-json' })
	capabilities: McpCapability[];

	@ApiPropertyOptional({
		name: 'created_by_id',
		description: 'User who created the client',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'created_by_id' })
	@IsOptional()
	@IsUUID()
	@Transform(
		({ obj }: { obj: { created_by_id?: string; createdById?: string } }) => obj.created_by_id ?? obj.createdById,
		{
			toClassOnly: true,
		},
	)
	@Column({ type: 'varchar', nullable: true })
	createdById: string | null;

	@ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'createdById' })
	@Exclude()
	createdBy?: UserEntity | null;

	@ApiPropertyOptional({
		name: 'token_id',
		description: 'Current credential record identifier',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'token_id' })
	@IsOptional()
	@IsUUID()
	@Transform(({ obj }: { obj: { token_id?: string; tokenId?: string } }) => obj.token_id ?? obj.tokenId, {
		toClassOnly: true,
	})
	@Index({ unique: true })
	@Column({ type: 'varchar', nullable: true })
	tokenId: string | null;

	@OneToOne(() => LongLiveTokenEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'tokenId' })
	@Exclude()
	token?: LongLiveTokenEntity | null;

	@ApiPropertyOptional({
		name: 'credential_expires_at',
		description: 'Expiration timestamp of the current credential',
		type: 'string',
		format: 'date-time',
		nullable: true,
	})
	@Expose({ name: 'credential_expires_at' })
	get credentialExpiresAt(): Date | null {
		return this.token?.expiresAt ?? null;
	}

	@ApiProperty({
		name: 'credential_revoked',
		description: 'Whether the current credential has been revoked or is unavailable',
		type: 'boolean',
	})
	@Expose({ name: 'credential_revoked' })
	get credentialRevoked(): boolean {
		return this.token?.revoked ?? true;
	}

	@ApiPropertyOptional({
		name: 'last_used_at',
		description: 'Timestamp when the current credential was last used',
		type: 'string',
		format: 'date-time',
		nullable: true,
	})
	@Expose({ name: 'last_used_at' })
	get lastUsedAt(): Date | null {
		return this.token?.lastUsedAt ?? null;
	}
}
