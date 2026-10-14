import { DataSource } from 'typeorm';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import {
	DeviceContributionRegistryService,
	MeasurementContributionCoverage,
	MeasurementContributionProvider,
} from '../../../modules/devices/services/device-contribution.registry.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualAggregateConfigEntity, VirtualAggregateInputEntity } from '../entities/virtual-producer.entity';
import { VirtualThermostatConfigEntity, VirtualThermostatSourceEntity } from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { isThermostatTemperature } from './virtual-thermostat-contract.utils';

/** Supplies provenance only. Room roles/strategy and representative selection belong to the room domain. */
@Injectable()
export class VirtualMeasurementContributionService
	implements MeasurementContributionProvider, OnModuleInit, OnModuleDestroy
{
	private unregister?: () => void;

	constructor(
		private readonly registry: DeviceContributionRegistryService,
		private readonly dataSource: DataSource,
		private readonly graph: VirtualDependencyGraphService,
		private readonly metadata: PropertyMetadataService,
		private readonly producers: PropertyProducerRegistryService,
		private readonly values: PropertyValueService,
	) {}

	onModuleInit(): void {
		this.unregister = this.registry.registerMeasurement(this);
	}

	onModuleDestroy(): void {
		this.unregister?.();
	}

	async getMeasurementCoverage(property: ChannelPropertyEntity): Promise<MeasurementContributionCoverage | null> {
		if (property.type !== 'virtual') return null;
		// Load durable wiring rather than the eventually rebuilt projection index or cached room entity.
		const generation = this.metadata.getGeneration();
		const lifecycle = this.graph.capturePublishGuard();
		const revision = await this.graph.revision();
		const output = await this.dataSource.manager.findOne(VirtualChannelPropertyEntity, {
			where: { id: property.id },
			relations: ['channel', 'channel.device'],
		});
		const outputChannel = output?.channel;
		const outputDevice = outputChannel && typeof outputChannel !== 'string' ? outputChannel.device : null;
		const outputReadable =
			!!output &&
			outputChannel &&
			typeof outputChannel !== 'string' &&
			outputDevice &&
			typeof outputDevice !== 'string' &&
			outputDevice.enabled !== false &&
			isThermostatTemperature(output, outputChannel);

		const represented = new Set<string>();
		const leaves: string[] = [];
		let valid = !!output;
		let outputRevision: number | undefined;
		const visit = async (id: string, path: ReadonlySet<string>): Promise<void> => {
			if (path.has(id)) {
				valid = false;
				return;
			}
			const next = new Set([...path, id]);
			const aggregate = await this.dataSource.manager.findOneBy(VirtualAggregateConfigEntity, { outputPropertyId: id });
			const transform = await this.dataSource.manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId: id });
			if (aggregate || transform) {
				if (id === property.id) outputRevision = (aggregate ?? transform).revision;
				const inputs = aggregate
					? await this.dataSource.manager.find(VirtualAggregateInputEntity, { where: { outputPropertyId: id } })
					: await this.dataSource.manager.find(VirtualTransformSourceEntity, { where: { outputPropertyId: id } });
				if (!inputs.length) valid = false;
				for (const input of inputs) {
					if (!input.sourcePropertyId) valid = false;
					represented.add(input.sourcePropertyIdentity);
					await visit(input.sourcePropertyId ?? input.sourcePropertyIdentity, next);
				}
				return;
			}
			const source = await this.dataSource.manager.findOne(VirtualChannelPropertyEntity, {
				where: { id },
				relations: ['channel', 'channel.device'],
			});
			const channel = source?.channel;
			const device = channel && typeof channel !== 'string' ? channel.device : null;
			const thermostat =
				device &&
				typeof device !== 'string' &&
				typeof channel !== 'string' &&
				channel.category === ChannelCategory.TEMPERATURE &&
				source.category === PropertyCategory.TEMPERATURE
					? await this.dataSource.manager.findOneBy(VirtualThermostatConfigEntity, { ownerDeviceId: device.id })
					: null;
			if (thermostat) {
				if (id === property.id) outputRevision = thermostat.revision;
				const ambient = await this.dataSource.manager.find(VirtualThermostatSourceEntity, {
					where: { controllerId: thermostat.controllerId, role: 'ambient' },
				});
				if (ambient.length !== 1) valid = false;
				for (const input of ambient) {
					if (!input.sourcePropertyId) valid = false;
					represented.add(input.sourcePropertyIdentity);
					await visit(input.sourcePropertyId ?? input.sourcePropertyIdentity, next);
				}
				return;
			}
			if (source?.isProjecting && source.sourcePropertyId) {
				represented.add(source.sourcePropertyId);
				await visit(source.sourcePropertyId, next);
			} else if (source) {
				// Orphaned or unconfigured virtual values must never fall back to persisted history.
				valid = false;
				leaves.push(id);
			} else leaves.push(id);
		};
		await visit(property.id, new Set());
		const unique = new Set(leaves);
		const duplicateLeaves = [...unique].filter((leaf) => leaves.filter((entry) => entry === leaf).length > 1);
		const isCurrent = () =>
			valid && lifecycle() && this.graph.isRevisionCurrent(revision) && this.metadata.getGeneration() === generation;
		return {
			leaves: [...unique],
			representedProperties: [...represented],
			duplicateLeaves,
			isCurrent,
			readValue: () => {
				if (!isCurrent() || !outputReadable) return null;
				if (outputRevision === undefined) {
					// A room adds no source-age policy. Qualification still requires an accepted live sample,
					// current source generation and any upstream producer's own freshness/expiry contract.
					const sample = this.values.readQualifiedSample(output, Number.MAX_SAFE_INTEGER);
					return isCurrent() && typeof sample?.value === 'number' && Number.isFinite(sample.value)
						? sample.value
						: null;
				}
				const state = this.producers.read(property.id);
				if (outputRevision !== undefined && state?.producer?.revision !== outputRevision) return null;
				if (!isCurrent() || state?.producer?.quality === 'unavailable') return null;
				return typeof state?.value === 'number' && Number.isFinite(state.value) ? state.value : null;
			},
		};
	}
}
