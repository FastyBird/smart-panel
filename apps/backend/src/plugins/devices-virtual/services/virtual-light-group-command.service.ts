import { DataSource } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	CompositeCommandChild,
	CompositeCommandPlan,
	CompositePropertyCommandPlanner,
	CompositePropertyCommandRegistryService,
} from '../../../modules/devices/services/composite-property-command.registry.service';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { PropertyCommandEntrySnapshot } from '../../../modules/devices/services/property-command-entry-snapshot';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
} from '../entities/devices-virtual.entity';
import {
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
	VirtualLightGroupProfile,
} from '../entities/virtual-producer.entity';

import { loadCoverMemberContract } from './virtual-cover-contract.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	GROUP_PROFILES,
	groupBooleanContractIsSupported,
	groupField,
	groupProfileForChannel,
	groupSourceSupports,
} from './virtual-group-profile';
import { LIGHT_GROUP_MAXIMUM_AGE_MS } from './virtual-light-group.utils';
import { typedGroupSourceMatchesOutput } from './virtual-typed-group.utils';

@Injectable()
export class VirtualLightGroupCommandService implements CompositePropertyCommandPlanner, OnModuleInit, OnModuleDestroy {
	private unregister?: () => void;
	private readonly planningLeases = new Set<() => void>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly registry: CompositePropertyCommandRegistryService,
		private readonly devices: DeviceCommandGraphService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly metadata: PropertyMetadataService,
		private readonly values: PropertyValueService,
		private readonly windows: PropertyCommandWindowService,
	) {}
	onModuleInit(): void {
		this.unregister = this.registry.register(this);
	}
	onModuleDestroy(): void {
		this.unregister?.();
		for (const dispose of this.planningLeases) dispose();
		this.planningLeases.clear();
	}
	canHandle(property: ChannelPropertyEntity): boolean {
		const channel = property.channel;
		return (
			property instanceof VirtualChannelPropertyEntity &&
			property.isDerived &&
			!!channel &&
			typeof channel !== 'string' &&
			typeof channel.device !== 'string' &&
			groupProfileForChannel(channel.category) !== undefined &&
			channel.device.type === 'virtual' &&
			channel.device.category === GROUP_PROFILES[groupProfileForChannel(channel.category)].deviceCategory &&
			groupField(groupProfileForChannel(channel.category), property.category)?.access !== undefined &&
			groupField(groupProfileForChannel(channel.category), property.category)?.access !== 'ro' &&
			(channel.device as VirtualDeviceEntity).mode === VirtualDeviceMode.ACTUATOR_GROUP &&
			property.permissions.includes(PermissionType.READ_ONLY)
		);
	}
	async plan(
		updates: readonly IDevicePropertyData[],
		entry?: PropertyCommandEntrySnapshot,
	): Promise<CompositeCommandPlan> {
		if (!updates.some((update) => update.property.category === PropertyCategory.BRIGHTNESS))
			return this.planCurrent(updates, undefined, entry);
		if (this.planningLeases.size >= 128) throw new Error('Too many active brightness planning snapshots');
		const changed = new Set<string>();
		const admitted = new Set<string>();
		let overflow = false;
		let stopped = false;
		const unsubscribe = this.windows.observeGeneration((propertyId) => {
			if (overflow || admitted.has(propertyId)) return;
			if (!changed.has(propertyId) && changed.size >= 2048) {
				overflow = true;
				return;
			}
			changed.add(propertyId);
		});
		const dispose = () => {
			stopped = true;
			unsubscribe();
			clearTimeout(timer);
			this.planningLeases.delete(dispose);
		};
		const timer = setTimeout(dispose, 30_000);
		timer.unref();
		this.planningLeases.add(dispose);
		try {
			const plan = await this.planCurrent(updates, { changed, admitted, isStopped: () => stopped || overflow }, entry);
			return { ...plan, dispose };
		} catch (error) {
			dispose();
			throw error;
		}
	}

	private async planCurrent(
		updates: readonly IDevicePropertyData[],
		power?: { changed: Set<string>; admitted: Set<string>; isStopped: () => boolean },
		entry?: PropertyCommandEntrySnapshot,
	): Promise<CompositeCommandPlan> {
		const graphRevision = await this.graph.revision();
		const metadataGeneration = this.metadata.getGeneration();
		const revisions = new Map<string, number>();
		const children: CompositeCommandChild[] = [];
		const deviceCache = new Map<string, DeviceEntity | null>();
		for (const update of updates) {
			const channelId = update.channel.id;
			const config = await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, {
				groupChannelId: channelId,
			});
			if (!config) throw new Error('Light group is not configured');
			const policy = GROUP_PROFILES[config.profile];
			if (
				!policy ||
				policy.channelCategory !== update.channel.category ||
				policy.deviceCategory !== update.device.category
			)
				throw new Error('Group profile does not match its current device/channel');
			const field = groupField(config.profile, update.property.category);
			if (!field || field.access === 'ro') throw new Error('Group capability is not commandable');
			if (!groupBooleanContractIsSupported(config.profile, update.property))
				throw new Error('Group output requires an unrestricted two-state boolean contract');

			revisions.set(channelId, config.revision);
			const members = await this.dataSource.manager.find(VirtualLightGroupMemberEntity, {
				where: { groupChannelId: channelId },
			});
			if (members.length < 2 || members.length > 256) throw new Error('Invalid light group member count');

			const coverOutputs =
				config.profile === VirtualLightGroupProfile.COVER
					? await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
							where: { channel: { id: channelId } },
							relations: ['channel'],
						})
					: [];
			for (const member of members) {
				const binding = await this.dataSource.manager.findOne(VirtualLightGroupBindingEntity, {
					where: { memberId: member.id, outputPropertyId: update.property.id },
					relations: ['sourceProperty', 'sourceProperty.channel', 'sourceProperty.channel.device'],
				});
				const property = binding?.sourceProperty;
				const channel = property?.channel as ChannelEntity;
				const deviceId = channel ? (channel.device as DeviceEntity).id : null;
				if (deviceId && !deviceCache.has(deviceId)) deviceCache.set(deviceId, await this.devices.findOne(deviceId));
				const device = deviceId ? deviceCache.get(deviceId) : null;
				const coverContract =
					config.profile === VirtualLightGroupProfile.COVER
						? await loadCoverMemberContract(this.dataSource.manager, member.id, member.sourceChannelId, coverOutputs)
						: null;
				const coverTypeCompatible = !coverContract?.reasons.length;

				const available =
					coverTypeCompatible &&
					member.sourceChannelId &&
					property &&
					channel.id === member.sourceChannelId &&
					channel.category === GROUP_PROFILES[config.profile].channelCategory &&
					(config.profile === VirtualLightGroupProfile.LIGHT ||
						device?.category === GROUP_PROFILES[config.profile].deviceCategory) &&
					device?.enabled &&
					device.type !== 'virtual' &&
					device.status.online &&
					!this.graph.isQuarantined(property.id) &&
					!this.graph.isQuarantined(update.property.id) &&
					property.category === update.property.category &&
					property.dataType === update.property.dataType &&
					resolvePropertyUnit(property) === resolvePropertyUnit(update.property) &&
					groupSourceSupports(property, field) &&
					groupBooleanContractIsSupported(config.profile, property) &&
					typedGroupSourceMatchesOutput(config.profile, field, property, update.property);
				if (children.length >= 2048) throw new Error('Composite size exceeds bounds');
				let preserved: CompositeCommandChild | null = null;
				let powerAvailable = true;
				if (
					available &&
					update.property.category === PropertyCategory.BRIGHTNESS &&
					!updates.some(
						(candidate) => candidate.channel.id === channelId && candidate.property.category === PropertyCategory.ON,
					)
				) {
					const onBinding = await this.dataSource.manager.findOne(VirtualLightGroupBindingEntity, {
						where: { memberId: member.id, quantity: PropertyCategory.ON },
						relations: ['sourceProperty', 'sourceProperty.channel'],
					});
					const on = onBinding?.sourceProperty;
					const sample = on ? this.values.readQualifiedSample(on, LIGHT_GROUP_MAXIMUM_AGE_MS) : null;
					powerAvailable =
						!!on &&
						on.category === PropertyCategory.ON &&
						on.dataType === DataTypeType.BOOL &&
						on.permissions.includes(PermissionType.READ_WRITE) &&
						(on.channel as ChannelEntity).id === channel.id &&
						typeof sample?.value === 'boolean' &&
						this.windows.get(on.id)?.state !== 'pending' &&
						(entry?.canPreservePower(on.id) ?? true) &&
						!power.isStopped() &&
						!power.changed.has(on.id);
					if (powerAvailable) {
						const generation = this.windows.peekGeneration(on.id);
						const baseline = sample.value;
						preserved = {
							memberId: member.id,
							memberIdentity: member.sourceChannelIdentity,
							propertyIdentity: onBinding.sourcePropertyIdentity,
							update: { property: on, channel, device, value: baseline },
							admissionCheck: () => {
								const current = this.values.readQualifiedSample(on, LIGHT_GROUP_MAXIMUM_AGE_MS);
								if (
									power.isStopped() ||
									!(entry?.canPreservePower(on.id) ?? true) ||
									power.changed.has(on.id) ||
									(this.windows.peekGeneration(on.id) != null && this.windows.peekGeneration(on.id) !== generation) ||
									current?.value !== baseline
								)
									return false;
								power.admitted.add(on.id);
								return true;
							},
						};
					}
				}
				children.push({
					memberId: member.id,
					memberIdentity: member.sourceChannelIdentity,
					propertyIdentity: binding?.sourcePropertyIdentity ?? null,
					update: available && powerAvailable ? { property, channel, device, value: update.value } : null,
					reason: coverContract?.reasons.length
						? coverContract.reasons.join(', ')
						: !powerAvailable
							? 'Qualified member power is unknown or changed during brightness planning'
							: available
								? undefined
								: 'Member is missing, disabled, offline, incompatible or quarantined',
				});
				if (preserved) children.push(preserved);
			}
		}
		return {
			revision: Math.max(...revisions.values()),
			children,
			isDispatchCurrent: () =>
				this.metadata.getGeneration() === metadataGeneration && this.graph.isRevisionCurrent(graphRevision),
			isCurrent: async () => {
				if (!this.graph.isRevisionCurrent(graphRevision)) return false;
				if (this.metadata.getGeneration() !== metadataGeneration) return false;
				if ((await this.graph.revision()) !== graphRevision) return false;
				for (const [groupChannelId, revision] of revisions)
					if (
						(await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, { groupChannelId }))?.revision !==
						revision
					)
						return false;
				return true;
			},
		};
	}
}
