import { DataSource } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { EventType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import {
	VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity,
	VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { LIGHT_GROUP_MAXIMUM_AGE_MS, LightGroupReportedState, reportLightGroup } from './virtual-light-group.utils';

export const LIGHT_GROUP_REPORTED_STATE_CHANGED = 'DevicesVirtual.Internal.LightGroup.ReportedStateChanged';

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
		if (this.running) return this.running;
		this.running = this.evaluate().finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async evaluate(): Promise<void> {
		const configs = await this.dataSource.manager.find(VirtualLightGroupConfigEntity);
		const active = new Set<string>();
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
				for (const binding of bindings.filter((binding) => binding.memberId === member.id)) {
					const property = binding.sourceProperty;
					if (!member.sourceChannelId || !property || this.graph.isQuarantined(property.id)) continue;
					const channel = property.channel as ChannelEntity;
					if (channel.id !== member.sourceChannelId) continue;
					const device = await this.devices.findOne((channel.device as DeviceEntity).id);
					if (!device?.enabled || !device.status.online) continue;
					const sample = this.values.readQualifiedSample(property, LIGHT_GROUP_MAXIMUM_AGE_MS, now);
					if (sample) samples.set(property.category, sample);
				}
				snapshots.push({ identity: member.sourceChannelIdentity, samples });
			}
			const state = reportLightGroup(snapshots);
			this.states.set(config.groupChannelId, state);
			this.events.emit(LIGHT_GROUP_REPORTED_STATE_CHANGED, {
				groupChannelId: config.groupChannelId,
				revision: config.revision,
				state,
			});
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
				await this.values.publishDerived(output, lease, reported.value, {
					quality: state.unknownCount || reported.mixed ? 'degraded' : 'good',
					reasons: [...(state.unknownCount ? ['members_unavailable'] : []), ...(reported.mixed ? ['mixed'] : [])],
					sampledAt,
					evaluatedAt: now,
					expiresAt: new Date(sampledAt.getTime() + LIGHT_GROUP_MAXIMUM_AGE_MS),
				});
			}
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
