import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DEW_POINT_FORMULA, DewPointRole } from '../services/virtual-dew-point.utils';

@Entity('devices_virtual_dew_point_configs')
@Check(
	'CHK_virtual_dew_point_policy',
	'"schemaVersion" = 1 AND "revision" >= 1 AND "maximumAgeSeconds" BETWEEN 1 AND 86400 AND "maximumSkewSeconds" BETWEEN 0 AND 3600',
)
export class VirtualDewPointConfigEntity {
	@PrimaryColumn({ type: 'varchar' })
	outputPropertyId: string;
	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	outputProperty: ChannelPropertyEntity;
	@Column({ type: 'integer', default: 1 })
	schemaVersion: 1;
	@Column({ type: 'text' })
	formulaVersion: typeof DEW_POINT_FORMULA;
	@Column({ type: 'integer' })
	maximumAgeSeconds: number;
	@Column({ type: 'integer' })
	maximumSkewSeconds: number;
	@Column({ type: 'integer' })
	revision: number;
	@Column({ type: 'datetime' })
	configuredAt: Date;
}

/** Both roles survive source deletion; repair changes the edge, never the output/history UUID. */
@Entity('devices_virtual_dew_point_sources')
@Index('IDX_virtual_dew_point_source', ['sourcePropertyId'])
export class VirtualDewPointSourceEntity {
	@PrimaryColumn({ type: 'varchar' })
	outputPropertyId: string;
	@PrimaryColumn({ type: 'text' })
	role: DewPointRole;
	@ManyToOne(() => VirtualDewPointConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	config: VirtualDewPointConfigEntity;
	@Column({ type: 'varchar', nullable: true })
	sourcePropertyId: string | null;
	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;
	@Column({ type: 'varchar' })
	sourcePropertyIdentity: string;
	@Column({ type: 'text' })
	quantity: string;
	@Column({ type: 'text' })
	unit: string;
	@Column({ type: 'simple-json' })
	domain: { minimum: number; minimumExclusive: boolean; maximum: number };
	@Column({ type: 'text' })
	contractFingerprint: string;
}
