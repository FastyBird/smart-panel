import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity } from '../../../modules/devices/entities/devices.entity';
import {
	DeviceContributionCoverage,
	DeviceContributionProvider,
	DeviceContributionRegistryService,
} from '../../../modules/devices/services/device-contribution.registry.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualLightGroupStateService } from './virtual-light-group-state.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';

@Injectable()
export class VirtualLightGroupContributionService implements DeviceContributionProvider, OnModuleInit, OnModuleDestroy {
	private unregister?: () => void;

	constructor(
		private readonly registry: DeviceContributionRegistryService,
		private readonly configs: VirtualProducerConfigService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly metadata: PropertyMetadataService,
		private readonly states: VirtualLightGroupStateService,
	) {}

	onModuleInit(): void {
		this.unregister = this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.unregister?.();
	}

	async getCoverage(channel: ChannelEntity): Promise<DeviceContributionCoverage | null> {
		// Avoid interpreting an ordinary light channel as a producer merely because its value is derived.
		if (channel.type !== 'virtual') return null;
		const metadataGeneration = this.metadata.getGeneration();
		let config: Awaited<ReturnType<VirtualProducerConfigService['getLightGroup']>>;
		try {
			config = await this.configs.getLightGroup(channel.id);
		} catch (error) {
			if (error instanceof NotFoundException) return null;
			throw error;
		}
		const state = config.reported_state;
		const brightness = this.states
			.getReportedState(channel.id, config.revision)
			?.properties.get(PropertyCategory.BRIGHTNESS);
		return {
			revision: config.revision,
			isCurrent: () =>
				this.metadata.getGeneration() === metadataGeneration && this.graph.isRevisionCurrent(config.graph_revision),
			leaves: config.members.map((member) => member.source_identity),
			reported: {
				onBrightness: {
					sum: brightness?.samples.reduce((sum, sample) => sum + Number(sample.value), 0) ?? 0,
					count: brightness?.samples.length ?? 0,
				},
				total: config.members.length,
				on: state?.on_count ?? 0,
				unknown: state?.unknown_count ?? config.members.length,
				mixed: state?.mixed ?? false,
				properties:
					state?.properties.map((property) => ({
						category: property.category,
						value: property.value,
						contributors: property.contributors.length,
					})) ?? [],
				mixedProperties:
					state?.properties.filter((property) => property.mixed).map((property) => property.category) ?? [],
			},
		};
	}
}
