import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { ConfigureVirtualAggregateDto, ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
	VirtualLightGroupProfile,
} from '../entities/virtual-producer.entity';
import {
	VirtualAggregateConfigurationModel,
	VirtualLightGroupConfigurationModel,
	VirtualProducerBindingModel,
} from '../models/producer-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { isEligibleVirtualMeasurement } from './virtual-source-eligibility.utils';

/** Typed persistence and validation only. Runtime evaluation/dispatch belongs to later producer services. */
@Injectable()
export class VirtualProducerConfigService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async configureAggregate(
		outputPropertyId: string,
		dto: ConfigureVirtualAggregateDto,
	): Promise<VirtualAggregateConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			await this.graph.withStructuralWrite(async (manager) => {
				const { config, inputs } = await this.validateAggregate(manager, outputPropertyId, dto);
				await manager.save(config);
				await manager.delete(VirtualAggregateInputEntity, { outputPropertyId });
				await manager.save(inputs);
			}, dto.expectedGraphRevision);
			await this.announceOutputs([outputPropertyId]);
			return this.getAggregate(outputPropertyId);
		});
	}

	async previewAggregate(
		outputPropertyId: string,
		dto: ConfigureVirtualAggregateDto,
	): Promise<VirtualAggregateConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			const { config, inputs } = await this.validateAggregate(this.dataSource.manager, outputPropertyId, dto);
			return this.aggregateModel(config, inputs, await this.graph.revision());
		});
	}

	async getAggregate(outputPropertyId: string): Promise<VirtualAggregateConfigurationModel> {
		const config = await this.dataSource.manager.findOneBy(VirtualAggregateConfigEntity, { outputPropertyId });
		if (!config) throw new NotFoundException('Aggregate configuration does not exist.');
		const inputs = await this.dataSource.manager.find(VirtualAggregateInputEntity, {
			where: { outputPropertyId },
			order: { id: 'ASC' },
		});
		return this.aggregateModel(config, inputs, await this.graph.revision());
	}

	private async validateAggregate(
		manager: EntityManager,
		outputPropertyId: string,
		dto: ConfigureVirtualAggregateDto,
	): Promise<{ config: VirtualAggregateConfigEntity; inputs: VirtualAggregateInputEntity[] }> {
		this.assertPolicy(dto);
		const output = await this.property(manager, outputPropertyId);
		const channel = output.channel as ChannelEntity;
		const device = channel.device as VirtualDeviceEntity;
		if (!isEligibleVirtualMeasurement(output, channel, device))
			throw new DevicesValidationException(
				'Aggregate output must be a read-only derived sensor temperature with canonical Celsius semantics.',
			);
		const existing = await manager.findOneBy(VirtualAggregateConfigEntity, { outputPropertyId });
		this.assertRevision(existing?.revision ?? 0, dto.expectedRevision);
		const previous = await manager.find(VirtualAggregateInputEntity, { where: { outputPropertyId } });
		const inputs: VirtualAggregateInputEntity[] = [];
		const identities = new Set<string>();
		for (const proposed of dto.inputs) {
			const old = proposed.id
				? previous.find((input) => input.id === proposed.id)
				: previous.find((input) => input.sourcePropertyIdentity === proposed.sourcePropertyId);
			if (proposed.id && !old)
				throw new DevicesValidationException('Aggregate binding UUID is not owned by this output.');
			if (!proposed.sourcePropertyId) {
				if (!old || old.sourcePropertyId !== null)
					throw new DevicesValidationException('Only an existing missing input can retain a null source.');
				inputs.push(old);
			} else {
				const source = await this.property(manager, proposed.sourcePropertyId);
				const sourceChannel = source.channel as ChannelEntity;
				const sourceDevice = sourceChannel.device as VirtualDeviceEntity;
				// Aggregate nesting is intentionally excluded in the initial policy. Projection aliases
				// may consume this materialized output, while aggregate inputs remain physical.
				if (sourceDevice.type === 'virtual')
					throw new DevicesValidationException(
						'Aggregate inputs must be physical temperatures in this producer policy version.',
					);
				if (
					sourceChannel.category !== ChannelCategory.TEMPERATURE ||
					source.category !== PropertyCategory.TEMPERATURE ||
					source.dataType !== DataTypeType.FLOAT ||
					(!source.permissions.includes(PermissionType.READ_ONLY) &&
						!source.permissions.includes(PermissionType.READ_WRITE)) ||
					resolvePropertyUnit(source) !== resolvePropertyUnit(output)
				) {
					throw new DevicesValidationException('Aggregate input must be a readable canonical Celsius temperature.');
				}
				inputs.push(
					manager.create(VirtualAggregateInputEntity, {
						id: old?.id ?? uuid(),
						outputPropertyId,
						sourcePropertyId: source.id,
						sourcePropertyIdentity: source.id,
						quantity: source.category,
						unit: resolvePropertyUnit(source) ?? null,
					}),
				);
			}
			const identity = inputs[inputs.length - 1].sourcePropertyIdentity;
			if (identities.has(identity))
				throw new DevicesValidationException('Aggregate inputs must have distinct source identities.');
			identities.add(identity);
		}
		if (new Set(inputs.map((input) => input.id)).size !== inputs.length)
			throw new DevicesValidationException('Aggregate binding UUIDs must be distinct.');
		await this.graph.validateReplacement(
			manager,
			[outputPropertyId],
			inputs
				.filter((input) => input.sourcePropertyId)
				.map((input) => ({ outputPropertyId, sourcePropertyId: input.sourcePropertyId! })),
		);
		const config = manager.create(VirtualAggregateConfigEntity, {
			outputPropertyId,
			schemaVersion: 1,
			operator: dto.operator,
			minimumValidInputs: dto.minimumValidInputs,
			maximumAgeSeconds: dto.maximumAgeSeconds,
			revision: (existing?.revision ?? 0) + 1,
		});
		return { config, inputs };
	}

	async configureLightGroup(
		groupChannelId: string,
		dto: ConfigureVirtualLightGroupDto,
	): Promise<VirtualLightGroupConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			let outputs: string[] = [];
			await this.graph.withStructuralWrite(async (manager) => {
				const prepared = await this.validateLightGroup(manager, groupChannelId, dto);
				await manager.save(prepared.config);
				await manager.delete(VirtualLightGroupMemberEntity, { groupChannelId });
				await manager.save(prepared.members);
				await manager.save(prepared.bindings);
				outputs = [...new Set(prepared.bindings.map((binding) => binding.outputPropertyId))];
			}, dto.expectedGraphRevision);
			await this.announceOutputs(outputs);
			return this.getLightGroup(groupChannelId);
		});
	}

	async previewLightGroup(
		groupChannelId: string,
		dto: ConfigureVirtualLightGroupDto,
	): Promise<VirtualLightGroupConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			const prepared = await this.validateLightGroup(this.dataSource.manager, groupChannelId, dto);
			return this.groupModel(prepared.config, prepared.members, prepared.bindings, await this.graph.revision());
		});
	}

	async getLightGroup(groupChannelId: string): Promise<VirtualLightGroupConfigurationModel> {
		const config = await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, { groupChannelId });
		if (!config) throw new NotFoundException('Light group configuration does not exist.');
		const members = await this.dataSource.manager.find(VirtualLightGroupMemberEntity, {
			where: { groupChannelId },
			order: { id: 'ASC' },
		});
		const bindings = (await this.dataSource.manager.find(VirtualLightGroupBindingEntity)).filter((binding) =>
			members.some((member) => member.id === binding.memberId),
		);
		return this.groupModel(config, members, bindings, await this.graph.revision());
	}

	private async validateLightGroup(
		manager: EntityManager,
		groupChannelId: string,
		dto: ConfigureVirtualLightGroupDto,
	): Promise<{
		config: VirtualLightGroupConfigEntity;
		members: VirtualLightGroupMemberEntity[];
		bindings: VirtualLightGroupBindingEntity[];
	}> {
		if (
			dto.profile !== VirtualLightGroupProfile.LIGHT ||
			!Array.isArray(dto.members) ||
			dto.members.length < 2 ||
			dto.members.length > 256
		)
			throw new DevicesValidationException('A light group requires the light profile and 2–256 members.');
		const group = await manager.findOne(ChannelEntity, { where: { id: groupChannelId }, relations: ['device'] });
		const device = group?.device as VirtualDeviceEntity;
		if (
			!group ||
			device?.type !== 'virtual' ||
			device.mode !== VirtualDeviceMode.ACTUATOR_GROUP ||
			device.category !== DeviceCategory.LIGHTING ||
			group.category !== ChannelCategory.LIGHT
		)
			throw new DevicesValidationException(
				'Light group configuration requires an actuator-group lighting device and light channel.',
			);
		const existing = await manager.findOneBy(VirtualLightGroupConfigEntity, { groupChannelId });
		this.assertRevision(existing?.revision ?? 0, dto.expectedRevision);
		const previousMembers = await manager.find(VirtualLightGroupMemberEntity, { where: { groupChannelId } });
		const previousBindings = (await manager.find(VirtualLightGroupBindingEntity)).filter((binding) =>
			previousMembers.some((member) => member.id === binding.memberId),
		);
		const outputs = await manager.find(VirtualChannelPropertyEntity, {
			where: { channel: { id: groupChannelId } },
			relations: ['channel', 'channel.device'],
		});
		if (
			!outputs.some(
				(property) => property.category === PropertyCategory.ON && property.valueOrigin === VirtualValueOrigin.DERIVED,
			)
		)
			throw new DevicesValidationException('Light group requires a derived on output.');
		const exposed = outputs.filter((property) => property.valueOrigin === VirtualValueOrigin.DERIVED);
		if (
			exposed.some(
				(property) =>
					!property.permissions.includes(PermissionType.READ_ONLY) ||
					property.permissions.includes(PermissionType.READ_WRITE) ||
					property.permissions.includes(PermissionType.WRITE_ONLY) ||
					property.sourcePropertyId,
			)
		)
			throw new DevicesValidationException(
				'Initial light-group materialized outputs must be read-only and have no projection source.',
			);
		const members: VirtualLightGroupMemberEntity[] = [];
		const bindings: VirtualLightGroupBindingEntity[] = [];
		for (const proposed of dto.members) {
			const old = proposed.id
				? previousMembers.find((member) => member.id === proposed.id)
				: previousMembers.find((member) => member.sourceChannelIdentity === proposed.sourceChannelId);
			if (proposed.id && !old) throw new DevicesValidationException('Member UUID is not owned by this light group.');
			const sourceChannel = proposed.sourceChannelId
				? await manager.findOne(ChannelEntity, { where: { id: proposed.sourceChannelId }, relations: ['device'] })
				: null;
			if (
				proposed.sourceChannelId &&
				(!sourceChannel ||
					(sourceChannel.device as VirtualDeviceEntity)?.type === 'virtual' ||
					sourceChannel.category !== ChannelCategory.LIGHT)
			)
				throw new DevicesValidationException('Light group members must be physical light channels.');
			if (!proposed.sourceChannelId && (!old || old.sourceChannelId !== null))
				throw new DevicesValidationException('Only an existing missing member can retain a null channel.');
			const member = manager.create(VirtualLightGroupMemberEntity, {
				id: old?.id ?? uuid(),
				groupChannelId,
				sourceChannelId: sourceChannel?.id ?? null,
				sourceChannelIdentity: sourceChannel?.id ?? old!.sourceChannelIdentity,
			});
			members.push(member);
			if (
				!Array.isArray(proposed.bindings) ||
				proposed.bindings.length !== exposed.length ||
				new Set(proposed.bindings.map((binding) => binding.outputPropertyId)).size !== exposed.length
			)
				throw new DevicesValidationException('Every member must bind each exposed group property exactly once.');
			for (const proposedBinding of proposed.bindings) {
				const output = exposed.find((property) => property.id === proposedBinding.outputPropertyId);
				if (!output) throw new DevicesValidationException('Binding output does not belong to this group channel.');
				const oldBinding = proposedBinding.id
					? previousBindings.find(
							(binding) =>
								binding.id === proposedBinding.id &&
								binding.memberId === member.id &&
								binding.outputPropertyId === output.id,
						)
					: previousBindings.find(
							(binding) => binding.memberId === member.id && binding.outputPropertyId === output.id,
						);
				if (proposedBinding.id && !oldBinding)
					throw new DevicesValidationException('Binding UUID is not owned by this member/output.');
				if (!proposedBinding.sourcePropertyId) {
					if (!oldBinding || oldBinding.sourcePropertyId !== null)
						throw new DevicesValidationException('Only an existing missing binding can retain a null source.');
					bindings.push(oldBinding);
					continue;
				}
				const source = await this.property(manager, proposedBinding.sourcePropertyId);
				if (
					!sourceChannel ||
					(source.channel as ChannelEntity).id !== sourceChannel.id ||
					source.category !== output.category ||
					source.dataType !== output.dataType ||
					resolvePropertyUnit(source) !== resolvePropertyUnit(output) ||
					!source.permissions.includes(PermissionType.READ_WRITE)
				)
					throw new DevicesValidationException(
						'Member property must belong to its physical channel and match output quantity/type/unit with read-write support.',
					);
				bindings.push(
					manager.create(VirtualLightGroupBindingEntity, {
						id: oldBinding?.id ?? uuid(),
						memberId: member.id,
						outputPropertyId: output.id,
						sourcePropertyId: source.id,
						sourcePropertyIdentity: source.id,
						quantity: source.category,
						unit: resolvePropertyUnit(source) ?? null,
					}),
				);
			}
		}
		if (
			new Set(members.map((member) => member.sourceChannelIdentity)).size !== members.length ||
			new Set(members.map((member) => member.id)).size !== members.length ||
			new Set(bindings.map((binding) => binding.id)).size !== bindings.length
		)
			throw new DevicesValidationException('Member identities and binding UUIDs must be distinct.');
		await this.graph.validateReplacement(
			manager,
			exposed.map((property) => property.id),
			bindings
				.filter((binding) => binding.sourcePropertyId)
				.map((binding) => ({
					outputPropertyId: binding.outputPropertyId,
					sourcePropertyId: binding.sourcePropertyId!,
				})),
		);
		return {
			config: manager.create(VirtualLightGroupConfigEntity, {
				groupChannelId,
				schemaVersion: 1,
				profile: dto.profile,
				revision: (existing?.revision ?? 0) + 1,
			}),
			members,
			bindings,
		};
	}

	private async property(manager: EntityManager, id: string): Promise<ChannelPropertyEntity> {
		const property = await manager.findOne(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		if (!property || !property.channel || !(property.channel as ChannelEntity).device)
			throw new DevicesValidationException(
				`Source/output property id=${id} does not resolve to a complete device structure.`,
			);
		return property;
	}

	private assertPolicy(dto: ConfigureVirtualAggregateDto): void {
		if (
			!Object.values(VirtualAggregateOperator).includes(dto.operator) ||
			!Array.isArray(dto.inputs) ||
			dto.inputs.length < 2 ||
			dto.inputs.length > 256 ||
			!Number.isInteger(dto.minimumValidInputs) ||
			dto.minimumValidInputs < 1 ||
			dto.minimumValidInputs > dto.inputs.length ||
			!Number.isInteger(dto.maximumAgeSeconds) ||
			dto.maximumAgeSeconds < 1 ||
			dto.maximumAgeSeconds > 86400
		)
			throw new DevicesValidationException(
				'Aggregate requires 2–256 inputs, a supported operator, valid quorum and positive bounded maximum age.',
			);
	}

	private assertRevision(actual: number, expected: number): void {
		if (!Number.isInteger(expected) || actual !== expected)
			throw new DevicesValidationException('Producer configuration revision changed; reload and retry.');
	}

	private bindingModel(
		binding: VirtualAggregateInputEntity | VirtualLightGroupBindingEntity,
	): VirtualProducerBindingModel {
		return Object.assign(new VirtualProducerBindingModel(), {
			id: binding.id,
			output_property: binding.outputPropertyId,
			source_property: binding.sourcePropertyId,
			source_identity: binding.sourcePropertyIdentity,
			quantity: binding.quantity,
			unit: binding.unit,
		});
	}

	private aggregateModel(
		config: VirtualAggregateConfigEntity,
		inputs: VirtualAggregateInputEntity[],
		graphRevision: number,
	): VirtualAggregateConfigurationModel {
		return Object.assign(new VirtualAggregateConfigurationModel(), {
			output_property: config.outputPropertyId,
			schema_version: config.schemaVersion,
			operator: config.operator,
			minimum_valid_inputs: config.minimumValidInputs,
			maximum_age_seconds: config.maximumAgeSeconds,
			revision: config.revision,
			graph_revision: graphRevision,
			runtime_readiness: 'unavailable',
			inputs: inputs.map((input) => this.bindingModel(input)),
		});
	}

	private groupModel(
		config: VirtualLightGroupConfigEntity,
		members: VirtualLightGroupMemberEntity[],
		bindings: VirtualLightGroupBindingEntity[],
		graphRevision: number,
	): VirtualLightGroupConfigurationModel {
		return Object.assign(new VirtualLightGroupConfigurationModel(), {
			group_channel: config.groupChannelId,
			schema_version: config.schemaVersion,
			profile: config.profile,
			revision: config.revision,
			graph_revision: graphRevision,
			runtime_readiness: 'unavailable',
			members: members.map((member) => ({
				id: member.id,
				source_channel: member.sourceChannelId,
				source_identity: member.sourceChannelIdentity,
				bindings: bindings
					.filter((binding) => binding.memberId === member.id)
					.map((binding) => this.bindingModel(binding)),
			})),
		});
	}

	private async announceOutputs(ids: string[]): Promise<void> {
		for (const id of ids) {
			const property = await this.dataSource.manager.findOne(ChannelPropertyEntity, {
				where: { id },
				relations: ['channel', 'channel.device'],
			});
			if (property) this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_UPDATED, property);
		}
	}
}
