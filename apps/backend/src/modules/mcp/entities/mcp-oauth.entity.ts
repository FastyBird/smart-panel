import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/users.entity';
import { McpOAuthScope } from '../mcp.constants';

@Entity('mcp_module_oauth_clients')
export class McpOAuthClientEntity extends BaseEntity {
	@Index({ unique: true })
	@Column({ type: 'varchar' })
	clientIdentifier: string;

	@Column({ type: 'varchar' })
	name: string;

	@Column({ type: 'simple-json' })
	redirectUris: string[];

	@Column({ type: 'simple-json' })
	maximumScopes: McpOAuthScope[];

	@Index()
	@Column({ type: 'boolean', default: true })
	enabled: boolean;

	@Column({ type: 'integer', default: 0 })
	generation: number;

	@Column({ type: 'varchar', nullable: true })
	createdById: string | null;

	@ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'createdById' })
	createdBy?: UserEntity | null;
}

@Entity('mcp_module_oauth_grants')
export class McpOAuthGrantEntity extends BaseEntity {
	@Index({ unique: true })
	@Column({ type: 'varchar', nullable: true })
	providerGrantIdHash: string | null;

	@Index()
	@Column({ type: 'varchar' })
	clientId: string;

	@ManyToOne(() => McpOAuthClientEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'clientId' })
	client?: McpOAuthClientEntity;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	approvedById: string | null;

	@ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'approvedById' })
	approvedBy?: UserEntity | null;

	@Column({ type: 'varchar' })
	installationId: string;

	@Column({ type: 'varchar' })
	issuer: string;

	@Column({ type: 'varchar' })
	resource: string;

	@Column({ type: 'simple-json' })
	approvedScopes: McpOAuthScope[];

	@Index()
	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Index()
	@Column({ type: 'datetime', nullable: true })
	revokedAt: Date | null;

	@Column({ type: 'integer', default: 0 })
	generation: number;

	@Column({ type: 'integer', default: 0 })
	approverAuthorityGeneration: number;
}

@Entity('mcp_module_oauth_interactions')
export class McpOAuthInteractionEntity extends BaseEntity {
	@Index({ unique: true })
	@Column({ type: 'varchar' })
	uidHash: string;

	@Index()
	@Column({ type: 'varchar' })
	clientId: string;

	@ManyToOne(() => McpOAuthClientEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'clientId' })
	client?: McpOAuthClientEntity;

	@Column({ type: 'varchar', nullable: true })
	authenticatedUserId: string | null;

	@ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'authenticatedUserId' })
	authenticatedUser?: UserEntity | null;

	@Column({ type: 'varchar' })
	redirectUri: string;

	@Column({ type: 'simple-json' })
	requestedScopes: McpOAuthScope[];

	@Index()
	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Column({ type: 'datetime', nullable: true })
	consumedAt: Date | null;
}

@Entity('mcp_module_oauth_authorization_codes')
export class McpOAuthAuthorizationCodeEntity extends BaseEntity {
	@Index({ unique: true })
	@Column({ type: 'varchar' })
	codeHash: string;

	@Index()
	@Column({ type: 'varchar' })
	clientId: string;

	@ManyToOne(() => McpOAuthClientEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'clientId' })
	client?: McpOAuthClientEntity;

	@Index()
	@Column({ type: 'varchar' })
	grantId: string;

	@ManyToOne(() => McpOAuthGrantEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'grantId' })
	grant?: McpOAuthGrantEntity;

	@Column({ type: 'varchar' })
	interactionId: string;

	@OneToOne(() => McpOAuthInteractionEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'interactionId' })
	interaction?: McpOAuthInteractionEntity;

	@Column({ type: 'varchar' })
	installationId: string;

	@Column({ type: 'varchar' })
	issuer: string;

	@Column({ type: 'varchar' })
	resource: string;

	@Column({ type: 'varchar' })
	redirectUri: string;

	@Column({ type: 'simple-json' })
	scopes: McpOAuthScope[];

	@Column({ type: 'varchar' })
	codeChallenge: string;

	@Index()
	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Column({ type: 'datetime', nullable: true })
	consumedAt: Date | null;
}

@Entity('mcp_module_oauth_refresh_families')
export class McpOAuthRefreshTokenFamilyEntity extends BaseEntity {
	@Index()
	@Column({ type: 'varchar' })
	clientId: string;

	@ManyToOne(() => McpOAuthClientEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'clientId' })
	client?: McpOAuthClientEntity;

	@Index()
	@Column({ type: 'varchar' })
	grantId: string;

	@ManyToOne(() => McpOAuthGrantEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'grantId' })
	grant?: McpOAuthGrantEntity;

	@Column({ type: 'varchar' })
	installationId: string;

	@Index()
	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Index()
	@Column({ type: 'datetime', nullable: true })
	revokedAt: Date | null;

	@Column({ type: 'varchar', nullable: true })
	revocationReason: string | null;

	@Column({ type: 'integer', default: 0 })
	generation: number;

	@OneToMany(() => McpOAuthRefreshTokenEntity, (token) => token.family)
	tokens?: McpOAuthRefreshTokenEntity[];
}

@Entity('mcp_module_oauth_refresh_tokens')
export class McpOAuthRefreshTokenEntity extends BaseEntity {
	@Index({ unique: true })
	@Column({ type: 'varchar' })
	tokenHash: string;

	@Index()
	@Column({ type: 'varchar' })
	familyId: string;

	@ManyToOne(() => McpOAuthRefreshTokenFamilyEntity, (family) => family.tokens, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'familyId' })
	family?: McpOAuthRefreshTokenFamilyEntity;

	@Index({ unique: true })
	@Column({ type: 'varchar', nullable: true })
	predecessorId: string | null;

	@OneToOne(() => McpOAuthRefreshTokenEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'predecessorId' })
	predecessor?: McpOAuthRefreshTokenEntity | null;

	@Index()
	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Index()
	@Column({ type: 'datetime', nullable: true })
	consumedAt: Date | null;

	@Column({ type: 'datetime', nullable: true })
	revokedAt: Date | null;
}

@Entity('mcp_module_oauth_access_tokens')
export class McpOAuthAccessTokenEntity extends BaseEntity {
	@Index({ unique: true })
	@Column({ type: 'varchar' })
	tokenHash: string;

	@Index()
	@Column({ type: 'varchar' })
	clientId: string;

	@ManyToOne(() => McpOAuthClientEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'clientId' })
	client?: McpOAuthClientEntity;

	@Index()
	@Column({ type: 'varchar' })
	grantId: string;

	@ManyToOne(() => McpOAuthGrantEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'grantId' })
	grant?: McpOAuthGrantEntity;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	refreshFamilyId: string | null;

	@ManyToOne(() => McpOAuthRefreshTokenFamilyEntity, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'refreshFamilyId' })
	refreshFamily?: McpOAuthRefreshTokenFamilyEntity | null;

	@Column({ type: 'varchar' })
	installationId: string;

	@Column({ type: 'varchar' })
	issuer: string;

	@Column({ type: 'varchar' })
	resource: string;

	@Column({ type: 'simple-json' })
	scopes: McpOAuthScope[];

	@Index()
	@Column({ type: 'datetime' })
	expiresAt: Date;

	@Index()
	@Column({ type: 'datetime', nullable: true })
	revokedAt: Date | null;
}

@Entity('mcp_module_oauth_server_state')
export class McpOAuthServerStateEntity {
	@PrimaryColumn({ type: 'varchar' })
	key: string;

	@Column({ type: 'integer', default: 1 })
	serverSecretVersion: number;

	@Column({ type: 'integer', default: 1 })
	keyVersion: number;

	@Column({ type: 'integer', default: 0 })
	publicIdentityGeneration: number;

	@Column({ type: 'integer', default: 0 })
	oauthEnabledGeneration: number;

	@Column({ type: 'integer', default: 0 })
	modulePolicyGeneration: number;

	@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
	createdAt: Date | string;

	@Column({ type: 'datetime', onUpdate: 'CURRENT_TIMESTAMP', nullable: true })
	updatedAt: Date | string | null;
}

@Entity('mcp_module_oauth_approver_authorities')
export class McpOAuthApproverAuthorityEntity {
	@PrimaryColumn({ type: 'varchar' })
	approverId: string;

	@Column({ type: 'integer', default: 0 })
	generation: number;
}

@Entity('mcp_module_oauth_provider_artifacts')
@Index(['model', 'idHash'], { unique: true })
export class McpOAuthProviderArtifactEntity {
	@PrimaryColumn({ type: 'varchar' })
	model: string;

	@PrimaryColumn({ type: 'varchar' })
	idHash: string;

	@Index({ unique: true })
	@Column({ type: 'varchar' })
	managementId: string;

	@Column({ type: 'text' })
	payload: string;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	grantIdHash: string | null;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	refreshFamilyId: string | null;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	userCodeHash: string | null;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	uidHash: string | null;

	@Column({ type: 'integer', nullable: true })
	consumedAt: number | null;

	@Index()
	@Column({ type: 'integer', nullable: true })
	expiresAt: number | null;
}

@Entity('mcp_module_oauth_provider_revoked_grants')
export class McpOAuthProviderRevokedGrantEntity {
	@PrimaryColumn({ type: 'varchar' })
	grantIdHash: string;

	@Column({ type: 'integer' })
	revokedAt: number;
}

@Entity('mcp_module_oauth_provider_revoked_refresh_families')
export class McpOAuthProviderRevokedRefreshFamilyEntity {
	@PrimaryColumn({ type: 'varchar' })
	refreshFamilyId: string;

	@Column({ type: 'integer' })
	revokedAt: number;
}

@Entity('mcp_module_oauth_provider_refresh_family_lineage')
export class McpOAuthProviderRefreshFamilyLineageEntity {
	@PrimaryColumn({ type: 'varchar' })
	grantIdHash: string;

	@Index({ unique: true })
	@Column({ type: 'varchar' })
	refreshFamilyId: string;
}
