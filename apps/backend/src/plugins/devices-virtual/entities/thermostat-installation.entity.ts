import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import {
	ThermostatGuardSetup,
	ThermostatMachineObservation,
	ThermostatOperatorAttestation,
} from '../services/thermostat-installation.types';

import { VirtualThermostatActuatorClaimEntity } from './virtual-thermostat.entity';

@Entity('devices_virtual_thermostat_installations')
@Check(
	'CHK_thermostat_installation_revision',
	'"revision" >= 1 AND "claimRevision" >= 1 AND "configurationRevision" >= 1',
)
export class ThermostatInstallationEntity {
	@PrimaryColumn({ type: 'varchar' }) claimId: string;
	@ManyToOne(() => VirtualThermostatActuatorClaimEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'claimId' })
	claim: VirtualThermostatActuatorClaimEntity;
	@Column({ type: 'integer' }) revision: number;
	@Column({ type: 'varchar' }) controllerId: string;
	@Column({ type: 'text' }) physicalIdentity: string;
	@Column({ type: 'integer' }) claimRevision: number;
	@Column({ type: 'integer' }) configurationRevision: number;
	@Column({ type: 'text' }) bindingFingerprint: string;
	@Column({ type: 'text' }) expectedScriptHash: string;
	@Column({ type: 'text' }) artifactSource: string;
	@Column({ type: 'simple-json' }) setup: ThermostatGuardSetup;
	@Column({ type: 'simple-json' }) attestations: ThermostatOperatorAttestation[];
	@Column({ type: 'varchar' }) updatedBy: string;
	@Column({ type: 'datetime' }) updatedAt: Date;
	@Column({ type: 'datetime', nullable: true }) revokedAt: Date | null;
	@Column({ type: 'simple-json', nullable: true }) lastMachineObservation: ThermostatMachineObservation | null;
}
@Entity('devices_virtual_thermostat_installation_audit')
export class ThermostatInstallationAuditEntity {
	@PrimaryGeneratedColumn('uuid') id: string;
	@Column({ type: 'varchar' }) claimId: string;
	@Column({ type: 'integer' }) revision: number;
	@Column({ type: 'text' }) action: 'staged' | 'revoked' | 'metadata_verified' | 'metadata_blocked';
	@Column({ type: 'varchar', nullable: true }) actorId: string | null;
	@Column({ type: 'datetime' }) occurredAt: Date;
	@Column({ type: 'simple-json' }) snapshot: {
		setup: ThermostatGuardSetup;
		attestations: ThermostatOperatorAttestation[];
		bindingFingerprint: string;
		expectedScriptHash?: string;
		observation?: ThermostatMachineObservation;
	};
}
