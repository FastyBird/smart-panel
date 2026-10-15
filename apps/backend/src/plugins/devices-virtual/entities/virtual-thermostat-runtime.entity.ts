import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { VirtualThermostatActuatorClaimEntity, VirtualThermostatConfigEntity } from './virtual-thermostat.entity';

@Entity('devices_virtual_thermostat_runtime')
export class VirtualThermostatRuntimeEntity {
	@PrimaryColumn({ type: 'varchar' })
	controllerId: string;
	@ManyToOne(() => VirtualThermostatConfigEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'controllerId' })
	config: VirtualThermostatConfigEntity;
	@Column({ type: 'integer', default: 0 })
	decisionRevision: number;
	@Column({ type: 'integer' })
	configurationRevision: number;
	@Column({ type: 'boolean', default: false })
	floorLatched: boolean;
	/** No sample frames or historical input/contact qualification survives restart. */
	@Column({ type: 'simple-json', nullable: true })
	heuristicHold: { pausedAt: number; pausedUntil: number; cooldownUntil: number | null } | null;
	@Column({ type: 'text', default: 'off' })
	previousDemand: 'off' | 'heat' | 'cool';
	@Column({ type: 'simple-json' })
	reasons: string[];
	@Column({ type: 'datetime' })
	evaluatedAt: Date;
}

@Entity('devices_virtual_thermostat_branch_runtime')
export class VirtualThermostatBranchRuntimeEntity {
	@PrimaryColumn({ type: 'varchar' })
	claimId: string;
	@ManyToOne(() => VirtualThermostatActuatorClaimEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'claimId' })
	claim: VirtualThermostatActuatorClaimEntity;
	@Column({ type: 'text', default: 'unknown' })
	activity: 'on' | 'off' | 'unknown';
	@Column({ type: 'datetime', nullable: true })
	lastVerifiedOffAt: Date | null;
	@Column({ type: 'text', nullable: true })
	releaseProofId: string | null;
	@Column({ type: 'integer', default: 0 })
	releaseAttempts: number;
	@Column({ type: 'datetime', nullable: true })
	nextReleaseAt: Date | null;
	@Column({ type: 'text', nullable: true })
	fault: string | null;
	/** Diagnostic only: a persisted clear latch never grants post-restart authority. */
	@Column({ type: 'boolean', nullable: true })
	floorLatched: boolean | null;
}

export type ThermostatJournalStatus = 'prepared' | 'dispatching' | 'accepted' | 'unknown' | 'cancelled' | 'confirmed';

/** Append-only command identity; timeout or deletion never erases an unresolved energizing command. */
@Index('IDX_virtual_thermostat_commands_unresolved', ['controllerId', 'status'], {
	where: `"status" NOT IN ('confirmed', 'cancelled')`,
})
@Index(
	'IDX_virtual_thermostat_commands_latest_on',
	['controllerId', 'claimId', 'preparedAt', 'decisionRevision', 'id'],
	{
		where: `"action" = 'on' AND "status" <> 'cancelled'`,
	},
)
@Index('IDX_virtual_thermostat_commands_pending_branch', ['controllerId', 'claimId', 'action', 'status'], {
	where: `"status" NOT IN ('confirmed', 'cancelled')`,
})
@Index('IDX_virtual_thermostat_commands_pending_dispatch', ['controllerId', 'claimId', 'dispatchedAt', 'id'], {
	where: `"status" NOT IN ('confirmed', 'cancelled') AND "action" = 'on' AND "dispatchedAt" IS NOT NULL`,
})
@Index('IDX_virtual_thermostat_commands_pending_fault', ['controllerId', 'claimId'], {
	where: `"status" NOT IN ('confirmed', 'cancelled') AND "fault" IS NOT NULL AND "fault" <> ''`,
})
@Entity('devices_virtual_thermostat_command_journal')
export class VirtualThermostatCommandEntity {
	@PrimaryColumn({ type: 'varchar' })
	id: string;
	@Column({ type: 'varchar' })
	controllerId: string;
	@ManyToOne(() => VirtualThermostatConfigEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'controllerId' })
	config: VirtualThermostatConfigEntity;
	@Column({ type: 'varchar' })
	claimId: string;
	@ManyToOne(() => VirtualThermostatActuatorClaimEntity, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'claimId' })
	claim: VirtualThermostatActuatorClaimEntity;
	@Column({ type: 'integer' })
	claimRevision: number;
	@Column({ type: 'integer' })
	configurationRevision: number;
	@Column({ type: 'integer' })
	decisionRevision: number;
	@Column({ type: 'text' })
	action: 'on' | 'off';
	@Column({ type: 'text' })
	status: ThermostatJournalStatus;
	@Column({ type: 'datetime' })
	preparedAt: Date;
	@Column({ type: 'datetime', nullable: true })
	dispatchedAt: Date | null;
	@Column({ type: 'datetime', nullable: true })
	settledAt: Date | null;
	@Column({ type: 'text', nullable: true })
	proofId: string | null;
	@Column({ type: 'text', nullable: true })
	fault: string | null;
}
