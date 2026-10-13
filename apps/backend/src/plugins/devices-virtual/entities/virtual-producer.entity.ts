import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from './virtual-transform.entity';

export enum VirtualAggregateOperator {
	MEAN = 'mean',
	MEDIAN = 'median',
	MIN = 'min',
	MAX = 'max',
}

export enum VirtualLightGroupProfile {
	LIGHT = 'light',
}

@Entity('devices_virtual_graph_revision')
export class VirtualGraphRevisionEntity {
	@PrimaryColumn({ type: 'integer' })
	id: number;

	@Column({ type: 'integer', default: 0 })
	revision: number;
}

@Entity('devices_virtual_aggregate_configs')
@Check('CHK_virtual_aggregate_policy', '"schemaVersion" = 1 AND "minimumValidInputs" >= 1 AND "maximumAgeSeconds" > 0')
export class VirtualAggregateConfigEntity {
	@PrimaryColumn({ type: 'varchar' })
	outputPropertyId: string;

	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	outputProperty: ChannelPropertyEntity;

	@Column({ type: 'integer', default: 1 })
	schemaVersion: number;

	@Column({ type: 'text', enum: VirtualAggregateOperator })
	operator: VirtualAggregateOperator;

	@Column({ type: 'integer' })
	minimumValidInputs: number;

	@Column({ type: 'integer' })
	maximumAgeSeconds: number;

	@Column({ type: 'integer', default: 1 })
	revision: number;
}

@Entity('devices_virtual_aggregate_inputs')
@Index('UQ_virtual_aggregate_input_source', ['outputPropertyId', 'sourcePropertyIdentity'], { unique: true })
export class VirtualAggregateInputEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Index('IDX_virtual_aggregate_input_output')
	@Column({ type: 'varchar' })
	outputPropertyId: string;

	@ManyToOne(() => VirtualAggregateConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	config: VirtualAggregateConfigEntity;

	@Index('IDX_virtual_aggregate_input_source')
	@Column({ type: 'varchar', nullable: true })
	sourcePropertyId: string | null;

	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;

	/** Preserved when the live FK is cleared; membership/quorum never shrink on source deletion. */
	@Column({ type: 'varchar' })
	sourcePropertyIdentity: string;

	@Column({ type: 'text' })
	quantity: string;

	@Column({ type: 'text', nullable: true })
	unit: string | null;
}

@Entity('devices_virtual_light_group_configs')
@Check('CHK_virtual_light_group_version', '"schemaVersion" = 1')
export class VirtualLightGroupConfigEntity {
	@PrimaryColumn({ type: 'varchar' })
	groupChannelId: string;

	@ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'groupChannelId' })
	groupChannel: ChannelEntity;

	@Column({ type: 'integer', default: 1 })
	schemaVersion: number;

	@Column({ type: 'text', enum: VirtualLightGroupProfile, default: VirtualLightGroupProfile.LIGHT })
	profile: VirtualLightGroupProfile;

	@Column({ type: 'integer', default: 1 })
	revision: number;
}

@Entity('devices_virtual_light_group_members')
@Index('UQ_virtual_light_group_member_source', ['groupChannelId', 'sourceChannelIdentity'], { unique: true })
export class VirtualLightGroupMemberEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Index('IDX_virtual_light_group_member_owner')
	@Column({ type: 'varchar' })
	groupChannelId: string;

	@ManyToOne(() => VirtualLightGroupConfigEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'groupChannelId' })
	config: VirtualLightGroupConfigEntity;

	@Index('IDX_virtual_light_group_member_source')
	@Column({ type: 'varchar', nullable: true })
	sourceChannelId: string | null;

	@ManyToOne(() => ChannelEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourceChannelId' })
	sourceChannel: ChannelEntity | null;

	@Column({ type: 'varchar' })
	sourceChannelIdentity: string;
}

@Entity('devices_virtual_light_group_bindings')
@Index('UQ_virtual_light_group_binding_output', ['memberId', 'outputPropertyId'], { unique: true })
export class VirtualLightGroupBindingEntity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Index('IDX_virtual_light_group_binding_member')
	@Column({ type: 'varchar' })
	memberId: string;

	@ManyToOne(() => VirtualLightGroupMemberEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'memberId' })
	member: VirtualLightGroupMemberEntity;

	@Column({ type: 'varchar' })
	outputPropertyId: string;

	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'outputPropertyId' })
	outputProperty: ChannelPropertyEntity;

	@Index('IDX_virtual_light_group_binding_source')
	@Column({ type: 'varchar', nullable: true })
	sourcePropertyId: string | null;

	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;

	@Column({ type: 'varchar' })
	sourcePropertyIdentity: string;

	@Column({ type: 'text' })
	quantity: string;

	@Column({ type: 'text', nullable: true })
	unit: string | null;
}

export const VIRTUAL_PRODUCER_ENTITIES = [
	VirtualTransformConfigEntity,
	VirtualTransformSourceEntity,
	VirtualGraphRevisionEntity,
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
	VirtualLightGroupBindingEntity,
];
