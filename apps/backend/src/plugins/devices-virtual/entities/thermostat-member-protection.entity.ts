import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { VirtualThermostatActuatorClaimEntity } from './virtual-thermostat.entity';

/** Retained safety dependency, independent of ambient measurement provenance and claim lifetime. */
@Entity('devices_virtual_thermostat_member_protection')
@Index('IDX_thermostat_protection_source', ['sourcePropertyId'])
@Index('IDX_thermostat_protection_leaf', ['physicalPropertyIdentity'])
export class ThermostatMemberProtectionEntity {
	@PrimaryColumn({ type: 'varchar' })
	claimId: string;
	@ManyToOne(() => VirtualThermostatActuatorClaimEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'claimId' })
	claim: VirtualThermostatActuatorClaimEntity;
	@Column({ type: 'integer', default: 1 })
	schemaVersion: 1;
	@Column({ type: 'text', default: 'local_floor' })
	kind: 'local_floor';
	@Column({ type: 'integer' })
	revision: number;
	@Column({ type: 'varchar', nullable: true })
	sourcePropertyId: string | null;
	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;
	@Column({ type: 'varchar' })
	sourcePropertyIdentity: string;
	@Column({ type: 'varchar' })
	physicalPropertyIdentity: string;
	@Column({ type: 'varchar' })
	contractFingerprint: string;
	@Column({ type: 'integer' })
	maximumAgeSeconds: number;
}
