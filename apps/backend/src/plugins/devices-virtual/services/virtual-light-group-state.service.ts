import { DataSource } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	DataTypeType,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import {
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';
import { VirtualLightGroupReportedStateModel } from '../models/producer-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { LIGHT_GROUP_MAXIMUM_AGE_MS, LightGroupReportedState, reportLightGroup } from './virtual-light-group.utils';

export const LIGHT_GROUP_REPORTED_STATE_CHANGED = 'DevicesVirtual.LightGroup.ReportedStateChanged';

@Injectable()
export class VirtualLightGroupStateService implements OnModuleInit, OnModuleDestroy {
	private timer?: NodeJS.Timeout;
	private running: Promise<void> | null = null;
	private disposed = false;
	private readonly leases = new Map<string, PropertyProducerLease>();
	private readonly states = new Map<string, LightGroupReportedState>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly values: PropertyValueService,
		private readonly producers: PropertyProducerRegistryService,
		private readonly devices: DeviceCommandGraphService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly events: EventEmitter2,
		private readonly structure: DeviceStructureLockService,
	) {}

	async onModuleInit(): Promise<void> {
		this.disposed = false;
		await this.refresh();
		this.timer = setInterval(() => {
			void this.refresh().catch(() => this.invalidateAll());
		}, 1_000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		this.disposed = true;
		if (this.timer) clearInterval(this.timer);
		this.invalidateAll();
	}
	getReportedState(channelId: string): LightGroupReportedState | null {
		return this.states.get(channelId) ?? null;
	}

	getReportedModel(channelId: string): VirtualLightGroupReportedStateModel | null {
		const state = this.states.get(channelId);
		if (!state) return null;
		return Object.assign(new VirtualLightGroupReportedStateModel(), {
			on: state.on,
			all_on: state.allOn,
			mixed: state.mixed,
			total: state.total,
			on_count: state.onCount,
			off_count: state.offCount,
			unknown_count: state.unknownCount,
			members: state.members.map((member) => ({
				source_identity: member.identity,
				on: member.on,
				reasons: [...member.reasons],
			})),
			properties: [...state.properties].map(([category, reported]) => ({
				category,
				value: reported.value,
				representative_value: reported.representativeValue,
				rounded: reported.rounded,
				mixed: reported.mixed,
				contributors: [...reported.contributors],
			})),
		});
	}

	@OnEvent(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)
	@OnEvent(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	@OnEvent(EventType.DEVICE_UPDATED)
	changed(): void {
		void this.refresh().catch(() => this.invalidateAll());
	}

	refresh(): Promise<void> {
		if (this.disposed) return Promise.resolve();
		if (this.running !== null) return this.running;
		this.running = this.structure
			.runShared(() => this.evaluate())
			.finally(() => {
				this.running = null;
			});
		return this.running;
	}

	private async evaluate(): Promise<void> {
		const configs = await this.dataSource.manager.find(VirtualLightGroupConfigEntity);
		const active = new Set<string>();
		const deviceCache = new Map<string, DeviceEntity | null>();
		for (const config of configs) {
			if (this.disposed) return;
			const members = await this.dataSource.manager.find(VirtualLightGroupMemberEntity, {
				where: { groupChannelId: config.groupChannelId },
			});
			const outputs = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
				where: { channel: { id: config.groupChannelId } },
				relations: ['channel', 'channel.device'],
			});
			const bindings = (
				await this.dataSource.manager.find(VirtualLightGroupBindingEntity, {
					relations: ['sourceProperty', 'sourceProperty.channel', 'sourceProperty.channel.device'],
				})
			).filter((binding) => members.some((member) => member.id === binding.memberId));
			const now = new Date();
			const snapshots = [];
			for (const member of members) {
				const samples = new Map<PropertyCategory, QualifiedPropertySample>();
				const reasons = new Set<string>();
				if (!member.sourceChannelId) reasons.add('missing_channel');
				for (const binding of bindings.filter((binding) => binding.memberId === member.id)) {
					const property = binding.sourceProperty;
					if (!member.sourceChannelId || !property) {
						reasons.add('missing_property');
						continue;
					}
					if (this.graph.isQuarantined(property.id)) {
						reasons.add('graph_quarantined');
						continue;
					}
					const channel = property.channel as ChannelEntity;
					const output = outputs.find((candidate) => candidate.id === binding.outputPropertyId);
					if (
						channel.id !== member.sourceChannelId ||
						channel.category !== ChannelCategory.LIGHT ||
						!output ||
						property.category !== output.category ||
						property.dataType !== output.dataType ||
						resolvePropertyUnit(property) !== resolvePropertyUnit(output) ||
						!property.permissions.includes(PermissionType.READ_WRITE)
					) {
						reasons.add('metadata_incompatible');
						continue;
					}
					const deviceId = (channel.device as DeviceEntity).id;
					if (!deviceCache.has(deviceId)) deviceCache.set(deviceId, await this.devices.findOne(deviceId));
					const device = deviceCache.get(deviceId);
					if (!device?.enabled) {
						reasons.add(device ? 'disabled' : 'missing_device');
						continue;
					}
					if (!device.status.online) {
						reasons.add('offline');
						continue;
					}
					const sample = this.values.readQualifiedSample(property, LIGHT_GROUP_MAXIMUM_AGE_MS, now);
					if (sample && validatePropertyCommandValue(property, sample.value).valid)
						samples.set(property.category, sample);
					else reasons.add('no_fresh_provider_feedback');
				}
				snapshots.push({ identity: member.sourceChannelIdentity, samples, reasons: [...reasons] });
			}
			const state = reportLightGroup(snapshots);
			this.states.set(config.groupChannelId, state);
			const current = await this.dataSource.manager.findOneBy(VirtualLightGroupConfigEntity, {
				groupChannelId: config.groupChannelId,
			});
			if (this.disposed || current?.revision !== config.revision) continue;
			for (const output of outputs.filter((property) => property.isDerived)) {
				active.add(output.id);
				let lease = this.leases.get(output.id);
				if (!lease || lease.revision !== config.revision || !this.producers.isCurrent(lease)) {
					lease = this.producers.register(output, config.revision);
					this.leases.set(output.id, lease);
				}
				const reported = state.properties.get(output.category);
				if (
					this.graph.isQuarantined(output.id) ||
					!(output.channel as ChannelEntity).device ||
					!((output.channel as ChannelEntity).device as DeviceEntity).enabled ||
					!reported ||
					reported.value === null ||
					!reported.samples.length
				) {
					this.producers.invalidate(lease, [
						this.graph.isQuarantined(output.id) ? 'graph_quarantined' : 'member_evidence_unavailable',
					]);
					continue;
				}
				const sampledAt = new Date(Math.min(...reported.samples.map((sample) => sample.sampledAt.getTime())));
				let representative = reported.value;
				if (typeof representative === 'number') {
					const step = output.step ?? (output.dataType === DataTypeType.FLOAT ? null : 1);
					if (step) {
						const lower = typeof output.format?.[0] === 'number' ? output.format[0] : 0;
						representative = lower + Math.round((representative - lower) / step) * step;
					}
				}
				reported.representativeValue = representative;
				reported.rounded = representative !== reported.value;
				await this.values.publishDerived(output, lease, representative, {
					quality: state.unknownCount || reported.mixed ? 'degraded' : 'good',
					reasons: [...(state.unknownCount ? ['members_unavailable'] : []), ...(reported.mixed ? ['mixed'] : [])],
					sampledAt,
					evaluatedAt: now,
					expiresAt: new Date(sampledAt.getTime() + LIGHT_GROUP_MAXIMUM_AGE_MS),
				});
			}
			this.events.emit(LIGHT_GROUP_REPORTED_STATE_CHANGED, {
				groupChannelId: config.groupChannelId,
				revision: config.revision,
				state: this.getReportedModel(config.groupChannelId),
			});
		}
		for (const [id, lease] of this.leases)
			if (!active.has(id)) {
				this.producers.unregister(lease);
				this.leases.delete(id);
			}
	}
	private invalidateAll(): void {
		for (const lease of this.leases.values()) this.producers.invalidate(lease, ['runtime_unavailable']);
	}
}
