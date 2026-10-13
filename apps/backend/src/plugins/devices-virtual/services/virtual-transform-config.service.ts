import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { ConfigureVirtualTransformDto } from '../dto/transform-config.dto';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { VirtualProducerBindingModel } from '../models/producer-response.model';
import { VirtualTransformConfigurationModel } from '../models/transform-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericTransformConfig } from './virtual-numeric-transform.utils';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { transformContractErrors } from './virtual-transform-contract.utils';
import { VirtualTransformRuntimeService } from './virtual-transform-runtime.service';

@Injectable()
export class VirtualTransformConfigService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly events: EventEmitter2,
		private readonly state: VirtualProducerStateService,
		@Optional() private readonly runtime?: VirtualTransformRuntimeService,
	) {}

	async configure(
		outputPropertyId: string,
		dto: ConfigureVirtualTransformDto,
	): Promise<VirtualTransformConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			let prepared: Awaited<ReturnType<VirtualTransformConfigService['validate']>>;
			await this.graph.withStructuralWrite(async (manager) => {
				prepared = await this.validate(manager, outputPropertyId, dto);
				await manager.save(prepared.config);
				await manager.save(prepared.source);
			}, dto.expectedGraphRevision);
			this.state.installUnavailable(prepared.output, prepared.config.revision);
			prepared.output.unit = prepared.config.unit;
			prepared.output.measurementQuantity = prepared.config.quantity;
			this.runtime?.requireFreshSample(outputPropertyId, prepared.source.sourcePropertyId);
			this.events.emit(EventType.CHANNEL_PROPERTY_UPDATED, prepared.output);
			return this.get(outputPropertyId);
		});
	}

	async preview(
		outputPropertyId: string,
		dto: ConfigureVirtualTransformDto,
	): Promise<VirtualTransformConfigurationModel> {
		return this.structureLock.runExclusive(async () => {
			const revision = await this.graph.revision();
			if (dto.expectedGraphRevision !== undefined && dto.expectedGraphRevision !== revision)
				throw new DevicesValidationException('Virtual dependency graph revision changed; reload and retry.');
			const prepared = await this.validate(this.dataSource.manager, outputPropertyId, dto);
			return this.model(prepared.config, prepared.source, revision, false);
		});
	}

	async get(outputPropertyId: string): Promise<VirtualTransformConfigurationModel> {
		const config = await this.dataSource.manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId });
		const source = await this.dataSource.manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId });
		if (!config || !source) throw new NotFoundException('Numeric transform configuration does not exist.');
		return this.model(config, source, await this.graph.revision(), true);
	}

	private async property(manager: EntityManager, id: string): Promise<ChannelPropertyEntity> {
		const property = await manager.findOne(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		if (!property) throw new DevicesValidationException('Source/output property does not exist.');
		return property;
	}

	private async validate(manager: EntityManager, outputPropertyId: string, dto: ConfigureVirtualTransformDto) {
		const output = await this.property(manager, outputPropertyId);
		const existing = await manager.findOneBy(VirtualTransformConfigEntity, { outputPropertyId });
		if (!Number.isInteger(dto.expectedRevision) || dto.expectedRevision !== (existing?.revision ?? 0))
			throw new DevicesValidationException('Producer configuration revision changed; reload and retry.');
		const old = await manager.findOneBy(VirtualTransformSourceEntity, { outputPropertyId });
		if (!dto.source || (dto.source.id && dto.source.id !== old?.id))
			throw new DevicesValidationException('Source binding UUID is not owned by this output.');
		if (!dto.source.sourcePropertyId && (!old || old.sourcePropertyId !== null))
			throw new DevicesValidationException('Only a missing existing source may retain a null source.');
		const physical = dto.source.sourcePropertyId ? await this.property(manager, dto.source.sourcePropertyId) : null;
		const config = manager.create(VirtualTransformConfigEntity, {
			outputPropertyId,
			schemaVersion: dto.schemaVersion,
			policy: dto.policy as VirtualNumericTransformConfig,
			maximumAgeSeconds: dto.maximumAgeSeconds,
			quantity: dto.quantity,
			unit: dto.unit,
			revision: (existing?.revision ?? 0) + 1,
			configuredAt: new Date(),
		});
		const errors = transformContractErrors(config, output, physical);
		if (errors.length)
			throw new DevicesValidationException(`Invalid numeric transform contract: ${errors.join(', ')}.`);
		const source = manager.create(VirtualTransformSourceEntity, {
			id: old?.id ?? uuid(),
			outputPropertyId,
			sourcePropertyId: physical?.id ?? null,
			sourcePropertyIdentity: physical?.id ?? old.sourcePropertyIdentity,
			quantity: physical?.category ?? old.quantity,
			unit: physical ? resolvePropertyUnit(physical) : old.unit,
		});
		await this.graph.validateReplacement(
			manager,
			[outputPropertyId],
			physical ? [{ outputPropertyId, sourcePropertyId: physical.id }] : [],
		);
		return { config, source, output: output as VirtualChannelPropertyEntity };
	}

	private model(
		config: VirtualTransformConfigEntity,
		source: VirtualTransformSourceEntity,
		graphRevision: number,
		diagnostics: boolean,
	): VirtualTransformConfigurationModel {
		const result = diagnostics ? this.runtime?.readDiagnostics(config.outputPropertyId) : null;
		return Object.assign(new VirtualTransformConfigurationModel(), {
			output_property: config.outputPropertyId,
			schema_version: config.schemaVersion,
			revision: config.revision,
			graph_revision: graphRevision,
			maximum_age_seconds: config.maximumAgeSeconds,
			quantity: config.quantity,
			unit: config.unit,
			policy: config.policy,
			runtime_readiness: this.runtime?.isActive() ? 'ready' : 'unavailable',
			current_value: result?.value ?? null,
			quality: result?.quality ?? 'unavailable',
			errors: result?.reasons ?? ['runtime_unavailable'],
			source: Object.assign(new VirtualProducerBindingModel(), {
				id: source.id,
				output_property: source.outputPropertyId,
				source_property: source.sourcePropertyId,
				source_identity: source.sourcePropertyIdentity,
				quantity: source.quantity,
				unit: source.unit,
				current_value: result?.inputValue ?? null,
				sampled_at: result?.sampledAt?.toISOString() ?? null,
				age_seconds: result?.ageSeconds ?? null,
				exclusion: result?.reasons[0] ?? null,
			}),
		});
	}
}
