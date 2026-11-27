import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

@Entity('devices_shelly_v1_adopted_identities')
export class ShellyV1AdoptedIdentityEntity {
	@PrimaryColumn('varchar')
	deviceId: string;

	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'deviceId' })
	device: DeviceEntity;

	@Column('varchar')
	mac: string;

	@Column({ type: 'varchar', nullable: true })
	verifiedHost: string | null;
}
