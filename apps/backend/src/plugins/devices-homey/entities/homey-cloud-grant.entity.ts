import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('devices_homey_cloud_authorization_state')
export class HomeyCloudAuthorizationStateEntity {
	@PrimaryColumn({ type: 'varchar' })
	key!: string;

	@Column({ type: 'integer', default: 0 })
	activeGrantGeneration!: number;

	@Column({ type: 'integer', default: 0 })
	configurationGeneration!: number;

	@Column({ type: 'varchar', nullable: true })
	configurationFingerprint!: string | null;
}

@Entity('devices_homey_cloud_user_authorities')
export class HomeyCloudUserAuthorityEntity {
	@PrimaryColumn({ type: 'varchar' })
	userId!: string;

	@Column({ type: 'integer', default: 0 })
	generation!: number;
}

@Entity('devices_homey_cloud_pending_grants')
export class HomeyCloudPendingGrantEntity {
	@PrimaryColumn({ type: 'varchar' })
	transactionId!: string;

	@Index()
	@Column({ type: 'varchar' })
	initiatingUserId!: string;

	@Column({ type: 'integer' })
	authorityGeneration!: number;

	@Column({ type: 'integer' })
	activeGrantGeneration!: number;

	@Column({ type: 'integer' })
	configurationGeneration!: number;

	@Column({ type: 'text' })
	redirectUrl!: string;

	@Column({ type: 'varchar', select: false })
	tokenType!: string;

	@Column({ type: 'text', select: false })
	accessToken!: string;

	@Column({ type: 'text', nullable: true, select: false })
	refreshToken!: string | null;

	@Column({ type: 'integer', nullable: true, select: false })
	expiresIn!: number | null;

	@Column({ type: 'varchar', nullable: true, select: false })
	grantType!: string | null;

	@Column({ type: 'integer', select: false })
	tokenIssuedAt!: number;

	@Index()
	@Column({ type: 'integer' })
	expiresAt!: number;

	@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
	createdAt!: Date | string;
}

@Entity('devices_homey_cloud_cancelled_authorizations')
export class HomeyCloudCancelledAuthorizationEntity {
	@PrimaryColumn({ type: 'varchar' })
	transactionId!: string;

	@Index()
	@Column({ type: 'varchar' })
	initiatingUserId!: string;

	@Index()
	@Column({ type: 'integer' })
	expiresAt!: number;
}

@Entity('devices_homey_cloud_active_grants')
export class HomeyCloudActiveGrantEntity {
	@PrimaryColumn({ type: 'varchar' })
	key!: string;

	@Index({ unique: true })
	@Column({ type: 'varchar' })
	grantIdentifier!: string;

	@Index()
	@Column({ type: 'varchar' })
	activatedById!: string;

	@Column({ type: 'integer' })
	authorityGeneration!: number;

	@Column({ type: 'integer' })
	generation!: number;

	@Column({ type: 'integer' })
	configurationGeneration!: number;

	@Index()
	@Column({ type: 'varchar', nullable: true })
	sourceTransactionId!: string | null;

	@Column({ type: 'varchar' })
	selectedHomeyId!: string;

	@Column({ type: 'varchar', select: false })
	tokenType!: string;

	@Column({ type: 'text', select: false })
	accessToken!: string;

	@Column({ type: 'text', nullable: true, select: false })
	refreshToken!: string | null;

	@Column({ type: 'integer', nullable: true, select: false })
	expiresIn!: number | null;

	@Column({ type: 'varchar', nullable: true, select: false })
	grantType!: string | null;

	@Column({ type: 'integer', select: false })
	tokenIssuedAt!: number;

	@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
	activatedAt!: Date | string;

	@Column({ type: 'datetime', nullable: true })
	updatedAt!: Date | string | null;
}
