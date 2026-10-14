import { DataSource } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../../modules/devices/devices.constants';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualAggregateConfigEntity, VirtualLightGroupConfigEntity } from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';

/** A durable producer always owns an unavailable live overlay until a later runtime claims it. */
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';

@Injectable()
export class VirtualProducerStateService implements OnModuleInit, OnModuleDestroy {
	private readonly quarantineLeases = new Map<string, PropertyProducerLease>();
	private readonly configRevisions = new Map<string, number>();
	private stopObserving?: () => void;
	private appliedGraphRevision = -1;
	constructor(
		private readonly dataSource: DataSource,
		private readonly producers: PropertyProducerRegistryService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async onModuleInit(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.stopObserving?.();
		this.stopObserving = this.graph.observeValidation((revision, quarantined) =>
			this.synchronizeQuarantine(revision, quarantined),
		);
		// Module initialization finishes before HTTP/WebSocket serving. Persisted series are history,
		// never evidence of a fresh producer sample after restart.
		const properties = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
			relations: ['channel', 'channel.device'],
		});
		const transforms = await this.dataSource.manager.find(VirtualTransformConfigEntity);
		const aggregates = await this.dataSource.manager.find(VirtualAggregateConfigEntity);
		const groups = await this.dataSource.manager.find(VirtualLightGroupConfigEntity);
		for (const property of properties) {
			if (!property.isDerived) continue;
			const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
			const revision =
				transforms.find((config) => config.outputPropertyId === property.id)?.revision ??
				aggregates.find((config) => config.outputPropertyId === property.id)?.revision ??
				groups.find((config) => config.groupChannelId === channelId)?.revision ??
				0;
			this.installUnavailable(property, revision);
		}
	}

	installUnavailable(property: VirtualChannelPropertyEntity, revision: number): void {
		if (!property.isDerived) return;
		this.configRevisions.set(property.id, revision);
		const lease = this.producers.register(property, revision, {
			isCurrent: this.graph.capturePublishGuard(),
			reason: 'graph_validation_pending',
		});
		this.producers.invalidate(lease, ['runtime_unavailable']);
		property.value = this.producers.read(property.id);
	}

	onModuleDestroy(): void {
		this.stopObserving?.();
	}

	private async synchronizeQuarantine(revision: number, quarantined: ReadonlySet<string>): Promise<void> {
		if (revision < this.appliedGraphRevision) return;
		this.appliedGraphRevision = revision;
		const properties = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
			relations: ['channel', 'channel.device'],
		});
		if (revision !== this.appliedGraphRevision) return;
		for (const property of properties) {
			if (revision !== this.appliedGraphRevision) return;
			if (quarantined.has(property.id)) {
				const lease = this.producers.register(property, this.configRevisions.get(property.id) ?? revision, {
					isCurrent: this.graph.capturePublishGuard(),
					reason: 'graph_validation_pending',
				});
				this.producers.invalidate(lease, ['graph_quarantined']);
				this.quarantineLeases.set(property.id, lease);
			} else if (this.quarantineLeases.has(property.id)) {
				const lease = this.quarantineLeases.get(property.id);
				this.quarantineLeases.delete(property.id);
				if (!this.producers.isCurrent(lease)) continue;
				if (property.isDerived) this.installUnavailable(property, this.configRevisions.get(property.id) ?? 0);
				else {
					this.producers.remove(property.id);
					// Hydrate again after removing the alias-only mask; canonical physical authority stays intact.
					const restored = await this.dataSource.manager.findOne(VirtualChannelPropertyEntity, {
						where: { id: property.id },
						relations: ['channel', 'channel.device'],
					});
					if (revision !== this.appliedGraphRevision) return;
					if (restored) this.events.emit(EventType.CHANNEL_PROPERTY_UPDATED, restored);
				}
			}
		}
	}

	/** Mapping hooks call this synchronously before returning a newly created/converted output. */
	initializeOutput(property: VirtualChannelPropertyEntity): void {
		if (property.isDerived && !this.producers.owns(property.id)) this.installUnavailable(property, 0);
		if (property.isDerived) property.value = this.producers.read(property.id);
	}

	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	handlePropertyChanged(property: VirtualChannelPropertyEntity): void {
		if (property.type !== 'virtual') return;
		this.initializeOutput(property);
	}

	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	handlePropertyDeleted(property: VirtualChannelPropertyEntity): void {
		if (property.type === 'virtual') {
			this.producers.remove(property.id);
			this.quarantineLeases.delete(property.id);
			this.configRevisions.delete(property.id);
		}
	}
}
