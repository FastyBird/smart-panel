import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('devices_homey_adoption_locks')
export class HomeyAdoptionLockEntity {
	@PrimaryColumn({ type: 'varchar' })
	deviceIdentifier!: string;

	@Column({ type: 'varchar' })
	ownerToken!: string;

	@Column({ type: 'integer' })
	expiresAt!: number;
}
