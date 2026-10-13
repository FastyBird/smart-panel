import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualNumericTransformConfig } from '../services/virtual-numeric-transform.utils';

@Entity('devices_virtual_transform_configs')
@Check('CHK_virtual_transform_policy', '"schemaVersion" = 1 AND "maximumAgeSeconds" > 0 AND "revision" >= 1')
export class VirtualTransformConfigEntity {
	@PrimaryColumn({ type: 'varchar' })
	outputPropertyId: string;

	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	outputProperty: ChannelPropertyEntity;

	@Column({ type: 'integer', default: 1 })
	schemaVersion: number;

	@Column({ type: 'simple-json' })
	policy: VirtualNumericTransformConfig;

	@Column({ type: 'integer' })
	maximumAgeSeconds: number;

	@Column({ type: 'integer', default: 1 })
	revision: number;

	@Column({ type: 'datetime' })
	configuredAt: Date;

	@Column({ type: 'text' })
	quantity: string;

	@Column({ type: 'text' })
	unit: string;
}

@Entity('devices_virtual_transform_sources')
@Index('UQ_virtual_transform_source_output', ['outputPropertyId'], { unique: true })
export class VirtualTransformSourceEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar' })
	outputPropertyId: string;

	@ManyToOne(() => VirtualTransformConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	config: VirtualTransformConfigEntity;

	@Index('IDX_virtual_transform_source')
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
}
