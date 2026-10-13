import { DataSource } from 'typeorm';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/devices/devices.constants';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualAggregateConfigEntity, VirtualLightGroupConfigEntity } from '../entities/virtual-producer.entity';

/** A durable producer always owns an unavailable live overlay until a later runtime claims it. */
@Injectable()
export class VirtualProducerStateService implements OnModuleInit {
	constructor(
		private readonly dataSource: DataSource,
		private readonly producers: PropertyProducerRegistryService,
	) {}

	async onModuleInit(): Promise<void> {
		// Module initialization finishes before HTTP/WebSocket serving. Persisted series are history,
		// never evidence of a fresh producer sample after restart.
		const properties = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
			relations: ['channel', 'channel.device'],
		});
		const aggregates = await this.dataSource.manager.find(VirtualAggregateConfigEntity);
		const groups = await this.dataSource.manager.find(VirtualLightGroupConfigEntity);
		for (const property of properties) {
			if (!property.isDerived) continue;
			const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
			const revision =
				aggregates.find((config) => config.outputPropertyId === property.id)?.revision ??
				groups.find((config) => config.groupChannelId === channelId)?.revision ??
				0;
			this.installUnavailable(property, revision);
		}
	}

	installUnavailable(property: VirtualChannelPropertyEntity, revision: number): void {
		if (!property.isDerived) return;
		const lease = this.producers.register(property, revision);
		this.producers.invalidate(lease, ['runtime_unavailable']);
		property.value = this.producers.read(property.id);
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
		if (property.type === 'virtual') this.producers.remove(property.id);
	}
}
