import { Exclude } from 'class-transformer';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { ClimateAutomationSlotFacts, ClimateAutomationSlotState, ClimateAutomationSourceFacts, ClimateAutomationSourceState } from '../contracts/climate-automation.contract';

export const CLIMATE_SOURCE_TABLE = 'devices_module_climate_automation_sources';
export const CLIMATE_SLOT_TABLE = 'devices_module_climate_automation_slots';
export const CLIMATE_SAFE_COUNTER = (column: string): string =>
	`typeof("${column}") = 'integer' AND "${column}" BETWEEN 1 AND 9007199254740991`;
export const CLIMATE_SOURCE_CHECK = `${CLIMATE_SAFE_COUNTER('generationIndex')} AND ${CLIMATE_SAFE_COUNTER('revision')} AND "isCurrent" IN (0,1) AND "state" IN ('PENDING','FINALIZED_LIVE','FINALIZED_INACTIVE','REVOKED','DELETED')`;
export const CLIMATE_SLOT_CHECK = `${CLIMATE_SAFE_COUNTER('slotRevision')} AND ${CLIMATE_SAFE_COUNTER('manualCounter')} AND "manualHold" IN (0,1) AND (
	("state" = 'EMPTY' AND "ownerId" IS NULL AND "baselineId" IS NULL AND "generationId" IS NULL AND "candidateId" IS NULL AND "bundleId" IS NULL AND "selection" IS NULL AND "installEvidence" IS NULL AND "legacyDigest" IS NULL) OR
	("state" = 'LEGACY' AND "ownerId" IS NULL AND "baselineId" IS NULL AND "generationId" IS NULL AND "candidateId" IS NULL AND "bundleId" IS NULL AND "selection" IS NULL AND "installEvidence" IS NULL AND "legacyDigest" IS NOT NULL) OR
	("state" IN ('PROVISIONAL','LIVE','RETIRED') AND "ownerId" IS NOT NULL AND "baselineId" IS NOT NULL AND "generationId" IS NOT NULL AND "candidateId" IS NOT NULL AND "bundleId" IS NOT NULL AND "selection" IS NOT NULL AND "installEvidence" IS NOT NULL AND "legacyDigest" IS NULL)
)`;

/** Not a response entity. Never add to Swagger, public relations or event payloads. */
@Exclude()
@Entity(CLIMATE_SOURCE_TABLE)
@Unique('UQ_climate_source_owner_index', ['ownerId', 'generationIndex'])
@Unique('UQ_climate_source_owner_generation', ['ownerId', 'generationId'])
@Index('UQ_climate_source_current', ['producerKey', 'subjectId'], { unique: true, where: '"isCurrent" = 1' })
@Check('CHK_climate_source', CLIMATE_SOURCE_CHECK)
export class ClimateAutomationSourceEntity implements ClimateAutomationSourceFacts {
	@PrimaryColumn({ type: 'varchar' }) generationId!: string;
	@Column({ type: 'varchar' }) ownerId!: string;
	@Column({ type: 'varchar' }) producerKey!: string;
	@Column({ type: 'varchar' }) subjectId!: string;
	@Column({ type: 'integer' }) generationIndex!: number;
	@Column({ type: 'integer' }) revision!: number;
	@Column({ type: 'boolean' }) isCurrent!: boolean;
	@Column({ type: 'varchar' }) state!: ClimateAutomationSourceState;
	@Column({ type: 'text' }) evidence!: string;
	@Column({ type: 'varchar' }) evidenceDigest!: string;
	toJSON(): Readonly<Record<string, never>> { return {}; }
}

@Exclude()
@Entity(CLIMATE_SLOT_TABLE)
@Check('CHK_climate_slot', CLIMATE_SLOT_CHECK)
export class ClimateAutomationSlotEntity implements ClimateAutomationSlotFacts {
	@PrimaryColumn({ type: 'varchar' }) controllerId!: string;
	@Column({ type: 'varchar' }) providerKey!: string;
	@Column({ type: 'varchar' }) controllerIncarnation!: string;
	@Column({ type: 'integer' }) slotRevision!: number;
	@Column({ type: 'varchar' }) manualGeneration!: string;
	@Column({ type: 'integer' }) manualCounter!: number;
	@Column({ type: 'boolean' }) manualHold!: boolean;
	@Column({ type: 'varchar' }) state!: ClimateAutomationSlotState;
	@Column({ type: 'varchar', nullable: true }) ownerId!: string | null;
	@Column({ type: 'varchar', nullable: true }) baselineId!: string | null;
	@Column({ type: 'varchar', nullable: true }) generationId!: string | null;
	@Column({ type: 'varchar', nullable: true }) candidateId!: string | null;
	@Column({ type: 'varchar', nullable: true }) bundleId!: string | null;
	@Column({ type: 'text', nullable: true }) selection!: string | null;
	@Column({ type: 'text', nullable: true }) installEvidence!: string | null;
	@Column({ type: 'varchar', nullable: true }) legacyDigest!: string | null;
	@ManyToOne(() => ClimateAutomationSourceEntity, { nullable: true, onDelete: 'RESTRICT' })
	@JoinColumn([{ name: 'ownerId', referencedColumnName: 'ownerId' }, { name: 'generationId', referencedColumnName: 'generationId' }])
	private source?: ClimateAutomationSourceEntity | null;
	toJSON(): Readonly<Record<string, never>> { return {}; }
}
