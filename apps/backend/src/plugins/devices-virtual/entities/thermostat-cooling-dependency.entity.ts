import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { VirtualThermostatActuatorClaimEntity } from './virtual-thermostat.entity';

/** Separate from local_floor: retain both missing identities and installed surface semantics per cooling leaf. */
@Entity('devices_virtual_thermostat_cooling_dependencies')
export class ThermostatCoolingDependencyEntity {
	@PrimaryColumn({ type: 'varchar' })
	claimId: string;
	@ManyToOne(() => VirtualThermostatActuatorClaimEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'claimId' })
	claim: VirtualThermostatActuatorClaimEntity;
	@Column({ type: 'integer', default: 1 })
	schemaVersion: 1;
	@Column({ type: 'integer' })
	revision: number;
	@Index('IDX_thermostat_cooling_dew_point')
	@Column({ type: 'varchar', nullable: true })
	dewPointPropertyId: string | null;
	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'dewPointPropertyId' })
	dewPointProperty: ChannelPropertyEntity | null;
	@Column({ type: 'varchar' })
	dewPointIdentity: string;
	@Column({ type: 'varchar' })
	dewPointFingerprint: string;
	@Index('IDX_thermostat_cooling_surface')
	@Column({ type: 'varchar', nullable: true })
	surfacePropertyId: string | null;
	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'surfacePropertyId' })
	surfaceProperty: ChannelPropertyEntity | null;
	@Column({ type: 'varchar' })
	surfaceIdentity: string;
	@Column({ type: 'varchar' })
	physicalSurfaceIdentity: string;
	@Column({ type: 'varchar' })
	surfaceFingerprint: string;
	@Column({ type: 'text', default: 'cooled_surface' })
	purpose: 'cooled_surface';
	@Column({ type: 'integer' })
	maximumAgeSeconds: number;
}
