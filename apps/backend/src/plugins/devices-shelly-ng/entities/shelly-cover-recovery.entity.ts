import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Immutable operator uncertainty acceptance. It never records command confirmation or a drain barrier. */
@Entity('devices_shelly_ng_cover_recoveries')
export class ShellyCoverRecoveryEntity {
	@PrimaryColumn({ type: 'text' }) id: string;
	@Column({ type: 'text' }) actorId: string;
	@Column({ type: 'datetime' }) createdAt: Date;
	@Column({ type: 'text' }) physicalIdentity: string;
	@Column({ type: 'text' }) deviceId: string;
	@Column({ type: 'text' }) channelId: string;
	@Column({ type: 'text' }) propertyId: string;
	@Column({ type: 'text' }) oldToken: string;
	@Column({ type: 'datetime' }) oldStartedAt: Date;
	@Column({ type: 'text' }) contextRevision: string;
	@Column({ type: 'text' }) reason: string;
	@Column({ type: 'text' }) observedState: string;
	@Column({ type: 'real' }) observedPosition: number;
	@Column({ type: 'datetime' }) observedAt: Date;
	@Column({ type: 'text' }) advisory: string;
}
