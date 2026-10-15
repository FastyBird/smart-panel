import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
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
	VirtualAggregateProfile,
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
	VirtualLightGroupProfile,
} from '../entities/virtual-producer.entity';
import {
	VirtualAggregateConfigurationModel,
	VirtualAggregatePreviewModel,
	VirtualAggregateProfileModel,
	VirtualAggregateSourceModel,
	VirtualLightGroupCapabilityModel,
	VirtualLightGroupConfigurationModel,
	VirtualProducerBindingModel,
} from '../models/producer-response.model';

import { evaluateAggregate } from './virtual-aggregate-evaluator';
import { isValidAggregateFilter, isValidAggregateWeight } from './virtual-aggregate-policy.utils';
import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { coverContractReasons, loadCoverMemberContract } from './virtual-cover-contract.utils';
import { coverOperationReadiness } from './virtual-cover-readiness.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { groupCapabilityChange } from './virtual-group-contract.utils';
import {
	GROUP_PROFILES,
	commonGroupCapabilities,
	groupBooleanContractIsSupported,
	groupField,
	groupSourceSupports,
	requiredGroupFields,
} from './virtual-group-profile';
import { VirtualLightGroupStateService } from './virtual-light-group-state.service';
import { LightGroupCapability } from './virtual-light-group.utils';
import { hydrateMeasurementContract } from './virtual-measurement-metadata.utils';
import {
	aggregateOperatorAllowed,
	aggregateProfile,
	aggregateProfiles,
	isEligibleAggregateOutput,
	isEligibleAggregateSource,
} from './virtual-numeric-profile.utils';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { typedGroupSourceMatchesOutput } from './virtual-typed-group.utils';

/** Typed persistence and validation only. Runtime evaluation/dispatch belongs to later producer services. */
@Injectable()
export class VirtualProducerConfigService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly eventEmitter: EventEmitter2,
		private readonly producerState: VirtualProducerStateService,
		@Optional() private readonly lightGroups?: VirtualLightGroupStateService,
		@Optional() private readonly aggregateRuntime?: VirtualAggregateRuntimeService,
		@Optional() private readonly platforms?: PlatformRegistryService,
	) {}

	listAggregateProfiles(): VirtualAggregateProfileModel[] {
		return aggregateProfiles.map((profile) =>
			Object.assign(new VirtualAggregateProfileModel(), {
				profile: profile.id,
				channel: profile.channel,
				quantity: profile.quantity,
				unit: profile.unit,
				data_types: [...profile.dataTypes],
				operators: Object.values(VirtualAggregateOperator).filter((operator) =>
					aggregateOperatorAllowed(profile, operator),
				),
				numeric_policy: !profile.binary,
				output_step: profile.outputStep,
			}),
		);
	}

	async listAggregateSources(profileId: VirtualAggregateProfile): Promise<VirtualAggregateSourceModel[]> {
		const profile = aggregateProfiles.find((candidate) => candidate.id === profileId);
		if (!profile) return [];
		const properties = await this.dataSource.manager
			.createQueryBuilder(ChannelPropertyEntity, 'property')
			.leftJoinAndSelect('property.channel', 'channel')
			.leftJoinAndSelect('channel.device', 'device')
			.where('channel.category = :channelCategory', { channelCategory: profile.channel })
			.andWhere('property.category = :quantity', { quantity: profile.quantity })
			.callListeners(false)
			.getMany();
		for (const property of properties) await hydrateMeasurementContract(this.dataSource.manager, property);
		return properties
			.filter((property) => {
				const channel = property.channel as ChannelEntity;
				return (
					!this.graph.isQuarantined(property.id) &&
					aggregateProfile(property, channel)?.id === profileId &&
					isEligibleAggregateSource(property, channel, channel.device as DeviceEntity)
				);
			})
			.map((property) =>
				Object.assign(new VirtualAggregateSourceModel(), {
					property: property.id,
					channel: (property.channel as ChannelEntity).id,
					device: ((property.channel as ChannelEntity).device as DeviceEntity).id,
				}),
			);
	}

	async configureAggregate(
		outputPropertyId: string,
		dto: ConfigureVirtualAggregateDto,
	): Promise<VirtualAggregateConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			let committedOutput: VirtualChannelPropertyEntity;
			let committedRevision: number;
			await this.graph.withStructuralWrite(async (manager) => {
				const { config, inputs, output } = await this.prepareAggregate(manager, outputPropertyId, dto);
				await this.persistAggregate(manager, { config, inputs });
				committedOutput = output;
				committedRevision = config.revision;
			}, dto.expectedGraphRevision);
			this.producerState.installUnavailable(committedOutput, committedRevision);
			await this.announceOutputs([outputPropertyId]);
			return this.getAggregate(outputPropertyId);
		});
	}

	/** Used only by admitted atomic authoring; does not publish state or open another transaction. */
	async persistAggregate(
		manager: EntityManager,
		prepared: { config: VirtualAggregateConfigEntity; inputs: VirtualAggregateInputEntity[] },
	): Promise<void> {
		await manager.save(prepared.config);
		await manager.delete(VirtualAggregateInputEntity, { outputPropertyId: prepared.config.outputPropertyId });
		await manager.save(prepared.inputs);
	}

	describeAggregate(
		prepared: {
			config: VirtualAggregateConfigEntity;
			inputs: VirtualAggregateInputEntity[];
			output?: VirtualChannelPropertyEntity;
		},
		graphRevision: number,
	): VirtualAggregateConfigurationModel {
		return this.aggregateModel(prepared.config, prepared.inputs, graphRevision, prepared.output?.step, false);
	}

	/** Evaluate prepared draft policy without mutating catalog, live state, source evidence or runtime barriers. */
	async previewPreparedAggregate(
		prepared: Awaited<ReturnType<VirtualProducerConfigService['prepareAggregate']>>,
		graphRevision: number,
		graphCurrent: () => boolean,
	): Promise<VirtualAggregateConfigurationModel> {
		const { config, inputs, output } = prepared;
		const readEvidence = await this.aggregateRuntime?.snapshotEvidence(config, inputs, output);
		const saved = await this.dataSource.manager.findOneBy(VirtualAggregateConfigEntity, {
			outputPropertyId: output.id,
		});
		const revision = await this.graph.revision();
		// All asynchronous metadata and fence reads precede this single evaluation clock.
		const now = new Date();
		const profile = aggregateProfile(output, output.channel as ChannelEntity);
		const step = output.step ?? profile.outputStep;
		const evidence =
			readEvidence?.(now) ??
			inputs.map((input) => ({
				id: input.id,
				sourceIdentity: input.sourcePropertyIdentity,
				sample: null,
				weight: input.weight,
			}));
		let result = evaluateAggregate(
			config.operator,
			config.minimumValidInputs,
			config.maximumAgeSeconds,
			evidence,
			now,
			step,
			config.outlierFilter,
		);
		const revoked = !graphCurrent() || revision !== graphRevision || (saved?.revision ?? 0) !== config.revision - 1;
		const reason = revoked
			? 'preview_revoked'
			: !readEvidence
				? 'runtime_unavailable'
				: (output.channel as ChannelEntity).device &&
					  ((output.channel as ChannelEntity).device as DeviceEntity).enabled === false
					? 'output_disabled'
					: null;
		if (reason)
			result = {
				...result,
				value: null,
				quality: 'unavailable',
				reasons: [reason],
				sampledAt: null,
				expiresAt: null,
				inputs: result.inputs.map((input) => ({
					...input,
					value: null,
					sampledAt: null,
					ageSeconds: null,
					exclusion: 'invalid',
				})),
			};
		const model = this.describeAggregate(prepared, graphRevision);
		model.preview_result = Object.assign(new VirtualAggregatePreviewModel(), {
			evaluated_at: now.toISOString(),
			sampled_at: result.sampledAt?.toISOString() ?? null,
			expires_at: result.expiresAt?.toISOString() ?? null,
			profile: config.profile,
			unit: profile.unit,
			output_step: step ?? null,
			value: result.value,
			quality: result.quality,
			reasons: [...result.reasons],
			inputs: inputs.map((input) => {
				const diagnostic = result.inputs.find((candidate) => candidate.id === input.id);
				return Object.assign(this.bindingModel(input), {
					...(!profile.binary ? { weight: input.weight ?? 1 } : {}),
					current_value: diagnostic.value,
					sampled_at: diagnostic.sampledAt,
					age_seconds: diagnostic.ageSeconds,
					exclusion: diagnostic.exclusion,
				});
			}),
		});
		return model;
	}

	async previewAggregate(
		outputPropertyId: string,
		dto: ConfigureVirtualAggregateDto,
	): Promise<VirtualAggregateConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			const graphCurrent = this.graph.capturePublishGuard();
			const revision = await this.graph.revision();
			if (dto.expectedGraphRevision !== undefined && dto.expectedGraphRevision !== revision)
				throw new DevicesValidationException('Virtual dependency graph revision changed; reload and retry.');
			const prepared = await this.prepareAggregate(this.dataSource.manager, outputPropertyId, dto, undefined, true);
			return this.previewPreparedAggregate(prepared, revision, graphCurrent);
		});
	}

	async getAggregate(outputPropertyId: string): Promise<VirtualAggregateConfigurationModel> {
		const config = await this.dataSource.manager.findOneBy(VirtualAggregateConfigEntity, { outputPropertyId });
		if (!config) throw new NotFoundException('Aggregate configuration does not exist.');
		const inputs = await this.dataSource.manager.find(VirtualAggregateInputEntity, {
			where: { outputPropertyId },
			order: { id: 'ASC' },
		});
		const output = await this.property(this.dataSource.manager, outputPropertyId, true);
		return this.aggregateModel(config, inputs, await this.graph.revision(), output.step);
	}

	async prepareAggregate(
		manager: EntityManager,
		outputPropertyId: string,
		dto: ConfigureVirtualAggregateDto,
		draftOutput?: VirtualChannelPropertyEntity,
		previewOnly = false,
	): Promise<{
		config: VirtualAggregateConfigEntity;
		inputs: VirtualAggregateInputEntity[];
		output: VirtualChannelPropertyEntity;
	}> {
		this.assertPolicy(dto);
		const output = draftOutput ?? (await this.property(manager, outputPropertyId, previewOnly));
		const channel = output.channel as ChannelEntity;
		const device = channel.device as VirtualDeviceEntity;
		if (!isEligibleAggregateOutput(output, channel, device))
			throw new DevicesValidationException(
				'Aggregate output must be a read-only derived sensor with a supported canonical aggregate profile.',
			);
		const profile = aggregateProfile(output, channel);
		if (
			!aggregateOperatorAllowed(profile, dto.operator) ||
			(profile.binary && (dto.outlierFilter != null || dto.inputs.some((input) => input.weight !== undefined)))
		)
			throw new DevicesValidationException(
				'Aggregate profile does not support this operator, binary weights or filtering.',
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
				if (
					!old ||
					old.sourcePropertyId !== null ||
					old.quantity !== String(profile.quantity) ||
					old.unit !== profile.unit ||
					existing?.profile !== profile.id
				)
					throw new DevicesValidationException('Only an existing missing input can retain a null source.');
				inputs.push(manager.create(VirtualAggregateInputEntity, { ...old, weight: proposed.weight ?? 1 }));
			} else {
				const source = await this.property(manager, proposed.sourcePropertyId, previewOnly);
				const sourceChannel = source.channel as ChannelEntity;
				const sourceDevice = sourceChannel.device as VirtualDeviceEntity;
				if (
					!isEligibleAggregateSource(source, sourceChannel, sourceDevice) ||
					aggregateProfile(source, sourceChannel)?.id !== profile.id
				)
					throw new DevicesValidationException(
						sourceDevice.type === 'virtual'
							? 'Aggregate inputs require matching physical profiles or read-only canonical transformed temperatures (temperature composition only).'
							: 'Aggregate input must match the output canonical quantity, channel, unit and type.',
					);

				inputs.push(
					manager.create(VirtualAggregateInputEntity, {
						id: old?.id ?? uuid(),
						weight: proposed.weight ?? 1,
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
				.map((input) => ({ outputPropertyId, sourcePropertyId: input.sourcePropertyId })),
		);
		const config = manager.create(VirtualAggregateConfigEntity, {
			outputPropertyId,
			schemaVersion: 1,
			profile: profile.id,
			operator: dto.operator,
			outlierFilter: dto.outlierFilter ?? null,
			minimumValidInputs: dto.minimumValidInputs,
			maximumAgeSeconds: dto.maximumAgeSeconds,
			revision: (existing?.revision ?? 0) + 1,
		});
		return { config, inputs, output: output as VirtualChannelPropertyEntity };
	}

	async configureLightGroup(
		groupChannelId: string,
		dto: ConfigureVirtualLightGroupDto,
	): Promise<VirtualLightGroupConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			let outputs: string[] = [];
			let committedProperties: VirtualChannelPropertyEntity[] = [];
			let committedRevision = 0;
			await this.graph.withStructuralWrite(async (manager) => {
				const prepared = await this.prepareLightGroup(manager, groupChannelId, dto);
				await this.persistLightGroup(manager, prepared);
				outputs = [...new Set(prepared.bindings.map((binding) => binding.outputPropertyId))];
				committedProperties = prepared.outputs;
				committedRevision = prepared.config.revision;
			}, dto.expectedGraphRevision);
			for (const property of committedProperties) this.producerState.installUnavailable(property, committedRevision);
			await this.announceOutputs(outputs);
			return this.getLightGroup(groupChannelId);
		});
	}

	/** Caller owns the structural writer; publish state only after commit. */
	async persistLightGroup(
		manager: EntityManager,
		prepared: Awaited<ReturnType<VirtualProducerConfigService['prepareLightGroup']>>,
	): Promise<void> {
		await manager.save(prepared.config);
		await manager.delete(VirtualLightGroupMemberEntity, { groupChannelId: prepared.config.groupChannelId });
		await manager.save(prepared.members);
		await manager.save(prepared.bindings);
	}

	installLightGroup(prepared: Awaited<ReturnType<VirtualProducerConfigService['prepareLightGroup']>>): void {
		for (const property of prepared.outputs) this.producerState.installUnavailable(property, prepared.config.revision);
	}

	async previewLightGroup(
		groupChannelId: string,
		dto: ConfigureVirtualLightGroupDto,
	): Promise<VirtualLightGroupConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			const prepared = await this.prepareLightGroup(this.dataSource.manager, groupChannelId, dto);
			return this.groupModel(
				prepared.config,
				prepared.members,
				prepared.bindings,
				await this.graph.revision(),
				prepared.capabilities,
			);
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
		const outputs = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
			where: { channel: { id: groupChannelId } },
			relations: ['channel'],
		});
		const capabilities = await this.commonContract(this.dataSource.manager, members, bindings, outputs, config.profile);
		const model = this.groupModel(config, members, bindings, await this.graph.revision(), capabilities);
		if (config.profile === VirtualLightGroupProfile.COVER) {
			const readinessMembers = await Promise.all(
				members.map(async (member) => {
					const channel = member.sourceChannelId
						? await this.dataSource.manager.findOne(ChannelEntity, {
								where: { id: member.sourceChannelId },
								relations: ['device', 'properties'],
							})
						: null;
					const contract = await loadCoverMemberContract(
						this.dataSource.manager,
						member.id,
						member.sourceChannelId,
						outputs,
					);
					return { identity: member.sourceChannelIdentity, channel, reasons: contract.reasons };
				}),
			);
			model.operations = await coverOperationReadiness(this.platforms, readinessMembers);
		}
		return model;
	}

	async prepareLightGroup(
		manager: EntityManager,
		groupChannelId: string,
		dto: ConfigureVirtualLightGroupDto,
	): Promise<{
		config: VirtualLightGroupConfigEntity;
		members: VirtualLightGroupMemberEntity[];
		bindings: VirtualLightGroupBindingEntity[];
		outputs: VirtualChannelPropertyEntity[];
		capabilities: LightGroupCapability[];
	}> {
		if (
			!Object.hasOwn(GROUP_PROFILES, dto.profile) ||
			!Array.isArray(dto.members) ||
			dto.members.length < 2 ||
			dto.members.length > 256
		)
			throw new DevicesValidationException('A group requires a supported profile and 2–256 members.');
		const group = await manager
			.createQueryBuilder(ChannelEntity, 'channel')
			.leftJoinAndSelect('channel.device', 'device')
			.where('channel.id = :id', { id: groupChannelId })
			.callListeners(false)
			.getOne();
		const device = group?.device as VirtualDeviceEntity;
		if (
			!group ||
			device?.type !== 'virtual' ||
			device.mode !== VirtualDeviceMode.ACTUATOR_GROUP ||
			device.category !== GROUP_PROFILES[dto.profile].deviceCategory ||
			group.category !== GROUP_PROFILES[dto.profile].channelCategory
		)
			throw new DevicesValidationException(
				'Group configuration requires an actuator-group device/channel matching its profile.',
			);
		const existing = await manager.findOneBy(VirtualLightGroupConfigEntity, { groupChannelId });
		this.assertRevision(existing?.revision ?? 0, dto.expectedRevision);
		if (existing && existing.profile !== dto.profile)
			throw new ConflictException('An existing group profile cannot be changed');
		const previousMembers = await manager.find(VirtualLightGroupMemberEntity, { where: { groupChannelId } });
		const previousBindings = (await manager.find(VirtualLightGroupBindingEntity)).filter((binding) =>
			previousMembers.some((member) => member.id === binding.memberId),
		);
		const outputs = await manager
			.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
			.leftJoinAndSelect('property.channel', 'channel')
			.leftJoinAndSelect('channel.device', 'device')
			.where('channel.id = :id', { id: groupChannelId })
			.callListeners(false)
			.getMany();
		if (
			!requiredGroupFields(dto.profile).every((category) =>
				outputs.some(
					(property) => property.category === category && property.valueOrigin === VirtualValueOrigin.DERIVED,
				),
			)
		)
			throw new DevicesValidationException('Group requires all derived profile outputs.');
		const exposed = outputs.filter((property) => property.valueOrigin === VirtualValueOrigin.DERIVED);
		if (exposed.some((property) => !groupBooleanContractIsSupported(dto.profile, property)))
			throw new DevicesValidationException('Switch/outlet outputs require an unrestricted two-state boolean contract.');

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
				? await manager
						.createQueryBuilder(ChannelEntity, 'channel')
						.leftJoinAndSelect('channel.device', 'device')
						.where('channel.id = :id', { id: proposed.sourceChannelId })
						.callListeners(false)
						.getOne()
				: null;
			if (
				proposed.sourceChannelId &&
				(!sourceChannel ||
					(sourceChannel.device as VirtualDeviceEntity)?.type === 'virtual' ||
					sourceChannel.category !== GROUP_PROFILES[dto.profile].channelCategory ||
					(dto.profile !== VirtualLightGroupProfile.LIGHT &&
						(sourceChannel.device as VirtualDeviceEntity)?.category !== GROUP_PROFILES[dto.profile].deviceCategory))
			)
				throw new DevicesValidationException(
					'Group members must be homogeneous physical channels matching the profile.',
				);
			if (!proposed.sourceChannelId && (!old || old.sourceChannelId !== null))
				throw new DevicesValidationException('Only an existing missing member can retain a null channel.');
			const member = manager.create(VirtualLightGroupMemberEntity, {
				id: old?.id ?? uuid(),
				groupChannelId,
				sourceChannelId: sourceChannel?.id ?? null,
				sourceChannelIdentity: sourceChannel?.id ?? old.sourceChannelIdentity,
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
				const source = await this.property(manager, proposedBinding.sourcePropertyId, true);
				if (
					!sourceChannel ||
					(source.channel as ChannelEntity).id !== sourceChannel.id ||
					source.category !== output.category ||
					source.dataType !== output.dataType ||
					resolvePropertyUnit(source) !== resolvePropertyUnit(output) ||
					!groupSourceSupports(source, groupField(dto.profile, output.category)) ||
					!groupBooleanContractIsSupported(dto.profile, source) ||
					!typedGroupSourceMatchesOutput(dto.profile, groupField(dto.profile, output.category), source, output)
				) {
					if (existing && output.category !== PropertyCategory.ON)
						throw new ConflictException(
							`Membership edit would remove capability ${output.category}; repair its scene/tile references and exposed contract explicitly.`,
						);
					throw new DevicesValidationException(
						'Member property must belong to its physical channel and match output quantity/type/unit with the profile-required access.',
					);
				}
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
		if (dto.profile === VirtualLightGroupProfile.COVER) {
			for (const member of members) {
				const memberBindings = bindings.filter((binding) => binding.memberId === member.id);
				if (memberBindings.some((binding) => !binding.sourcePropertyId)) continue; // retained missing identities, never runtime authority
				const properties = await Promise.all(
					memberBindings.map((binding) => this.property(manager, binding.sourcePropertyId, true)),
				);
				const reasons = coverContractReasons(properties, exposed);
				if (reasons.length) throw new DevicesValidationException(reasons.join(', '));
			}
		}
		const capabilities = await this.commonContract(manager, members, bindings, exposed, dto.profile);
		// Missing identities retain their last durable contract; live metadata is checked again at runtime.
		for (const output of exposed) {
			const liveSources = bindings.filter(
				(binding) => binding.outputPropertyId === output.id && binding.sourcePropertyId,
			);
			if (liveSources.length !== members.length) continue;
			const common = capabilities.find((capability) => capability.category === output.category);
			const change = groupCapabilityChange(dto.profile, common, output);
			if (change === 'changed')
				throw new ConflictException(
					`Membership edit would change capability ${output.category}; preserve the exact exposed contract.`,
				);
			if (change === 'removed') {
				if (existing)
					throw new ConflictException(
						`Membership edit would remove capability ${output.category}; repair its scene/tile references and exposed contract explicitly.`,
					);
				throw new DevicesValidationException(`Exposed capability ${output.category} is not common to all members.`);
			}
		}
		await this.graph.validateReplacement(
			manager,
			exposed.map((property) => property.id),
			bindings
				.filter((binding) => binding.sourcePropertyId)
				.map((binding) => ({
					outputPropertyId: binding.outputPropertyId,
					sourcePropertyId: binding.sourcePropertyId,
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
			outputs: exposed,
			capabilities,
		};
	}

	private async commonContract(
		manager: EntityManager,
		members: VirtualLightGroupMemberEntity[],
		bindings: VirtualLightGroupBindingEntity[],
		outputs: VirtualChannelPropertyEntity[],
		profile: VirtualLightGroupProfile,
	): Promise<LightGroupCapability[]> {
		return commonGroupCapabilities(
			profile,
			await Promise.all(
				members.map(async (member) => {
					const physical = member.sourceChannelId
						? await manager
								.createQueryBuilder(ChannelPropertyEntity, 'property')
								.leftJoinAndSelect('property.channel', 'channel')
								.where('channel.id = :id', { id: member.sourceChannelId })
								.callListeners(false)
								.getMany()
						: [];
					// Unavailable members never shrink the last validated intended contract. These placeholders
					// are metadata only; runtimes still require the actual live FK and fresh physical feedback.
					const missing = bindings.filter((binding) => binding.memberId === member.id && !binding.sourcePropertyId);
					for (const binding of missing) {
						const output = outputs.find((output) => output.id === binding.outputPropertyId);
						if (output)
							physical.push(
								Object.assign(new ChannelPropertyEntity(), output, { permissions: [PermissionType.READ_WRITE] }),
							);
					}
					return physical;
				}),
			),
		);
	}

	private async property(manager: EntityManager, id: string, previewOnly = false): Promise<ChannelPropertyEntity> {
		const property = previewOnly
			? await manager
					.createQueryBuilder(ChannelPropertyEntity, 'property')
					.leftJoinAndSelect('property.channel', 'channel')
					.leftJoinAndSelect('channel.device', 'device')
					.where('property.id = :id', { id })
					.callListeners(false)
					.getOne()
			: await manager.findOne(ChannelPropertyEntity, {
					where: { id },
					relations: ['channel', 'channel.device'],
				});
		if (!property || !property.channel || !(property.channel as ChannelEntity).device)
			throw new DevicesValidationException(
				`Source/output property id=${id} does not resolve to a complete device structure.`,
			);
		if (previewOnly) await hydrateMeasurementContract(manager, property);
		return property;
	}

	private assertPolicy(dto: ConfigureVirtualAggregateDto): void {
		if (!isValidAggregateFilter(dto.outlierFilter))
			throw new DevicesValidationException(
				'Aggregate outlier filter requires a supported kind and a positive finite canonical-unit threshold.',
			);
		if (
			Array.isArray(dto.inputs) &&
			dto.inputs.some((input) => !isValidAggregateWeight(input.weight === undefined ? 1 : input.weight))
		)
			throw new DevicesValidationException(
				'Aggregate input weight must be finite and between 0.000001 and 1000000 (inclusive).',
			);
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
		outputStep?: number | null,
		includeRuntimeDiagnostics = true,
	): VirtualAggregateConfigurationModel {
		return Object.assign(new VirtualAggregateConfigurationModel(), {
			output_property: config.outputPropertyId,
			schema_version: config.schemaVersion,
			profile: config.profile,
			output_step: outputStep ?? aggregateProfiles.find((profile) => profile.id === config.profile)?.outputStep ?? null,
			rounding: 'nearest_ties_positive',
			operator: config.operator,
			outlier_filter: config.outlierFilter ?? null,
			minimum_valid_inputs: config.minimumValidInputs,
			maximum_age_seconds: config.maximumAgeSeconds,
			revision: config.revision,
			graph_revision: graphRevision,
			runtime_readiness: this.aggregateRuntime?.isActive() ? 'ready' : 'unavailable',
			inputs: inputs.map((input) => {
				const model = this.bindingModel(input);
				if (!aggregateProfiles.find((profile) => profile.id === config.profile)?.binary)
					model.weight = input.weight ?? 1;
				const diagnostic =
					includeRuntimeDiagnostics && input.sourcePropertyId !== null
						? this.aggregateRuntime
								?.readDiagnostics(config.outputPropertyId)
								?.inputs.find(
									(candidate) => candidate.id === input.id && candidate.sourceIdentity === input.sourcePropertyIdentity,
								)
						: undefined;
				if (diagnostic)
					Object.assign(model, {
						current_value: diagnostic.value,
						sampled_at: diagnostic.sampledAt,
						age_seconds: diagnostic.ageSeconds,
						exclusion: diagnostic.exclusion,
					});
				return model;
			}),
		});
	}

	private groupModel(
		config: VirtualLightGroupConfigEntity,
		members: VirtualLightGroupMemberEntity[],
		bindings: VirtualLightGroupBindingEntity[],
		graphRevision: number,
		capabilities: LightGroupCapability[],
	): VirtualLightGroupConfigurationModel {
		return Object.assign(new VirtualLightGroupConfigurationModel(), {
			group_channel: config.groupChannelId,
			schema_version: config.schemaVersion,
			profile: config.profile,
			revision: config.revision,
			graph_revision: graphRevision,
			runtime_readiness: 'ready',
			common_capabilities: capabilities.map((capability) =>
				Object.assign(new VirtualLightGroupCapabilityModel(), {
					category: capability.category,
					...(config.profile === VirtualLightGroupProfile.LIGHT
						? {}
						: { access: groupField(config.profile, capability.category).access }),
					data_type: capability.dataType,
					unit: capability.unit,
					format: capability.format,
					step: capability.step,
				}),
			),
			reported_state: this.lightGroups?.getReportedModel(config.groupChannelId, config.revision) ?? null,
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
