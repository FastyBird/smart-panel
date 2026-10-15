import { DataSource, EntityManager } from 'typeorm';

import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { ConfigureVirtualDewPointDto } from '../dto/dew-point-config.dto';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import { VirtualAggregateConfigEntity } from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';
import { VirtualDewPointModel } from '../models/dew-point-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	dewPointOutputContract,
	dewPointSourceContract,
	dewPointSourceFingerprint,
} from './virtual-dew-point-contract.utils';
import { DewPointDiagnostic, VirtualDewPointRuntimeService } from './virtual-dew-point-runtime.service';
import { DEW_POINT_FORMULA, DEW_POINT_ROLES, dewPointInputDomain } from './virtual-dew-point.utils';
import { hydrateMeasurementContract } from './virtual-measurement-metadata.utils';

@Injectable()
export class VirtualDewPointConfigService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly runtime: VirtualDewPointRuntimeService,
		private readonly events: EventEmitter2,
	) {}

	async get(outputPropertyId: string): Promise<VirtualDewPointModel> {
		const config = await this.dataSource.manager.findOneBy(VirtualDewPointConfigEntity, { outputPropertyId });
		if (!config) throw new NotFoundException('Dew point configuration does not exist.');
		const sources = await this.dataSource.manager.findBy(VirtualDewPointSourceEntity, { outputPropertyId });
		return this.describe(config, sources, await this.graph.revision());
	}

	async configure(id: string, dto: ConfigureVirtualDewPointDto, preview = false): Promise<VirtualDewPointModel> {
		return this.lock.runExclusive(async () => {
			if (preview) {
				const result = await this.prepare(this.dataSource.manager, id, dto);
				return this.describe(
					result.config,
					result.sources,
					await this.graph.revision(),
					false,
					await this.runtime.inspect(result.config, result.output, result.sources),
				);
			}
			const result = await this.graph.withStructuralWrite(async (manager) => {
				const prepared = await this.prepare(manager, id, dto, undefined, true);
				await manager.save(prepared.config);
				await manager.save(prepared.sources);
				return prepared;
			}, dto.expectedGraphRevision);
			this.runtime.activate(result.output, result.config.revision);
			result.output.unit = '°C';
			result.output.measurementQuantity = 'dew_point';
			this.events.emit(EventType.CHANNEL_PROPERTY_UPDATED, result.output);
			return this.get(id);
		});
	}

	/** Internal atomic authoring seam; the caller owns the structural lock and transaction. */
	async prepare(
		manager: EntityManager,
		id: string,
		dto: ConfigureVirtualDewPointDto,
		draftOutput?: VirtualChannelPropertyEntity,
		writing = false,
	) {
		if (
			dto.schemaVersion !== 1 ||
			dto.formulaVersion !== DEW_POINT_FORMULA ||
			!Number.isInteger(dto.maximumAgeSeconds) ||
			dto.maximumAgeSeconds < 1 ||
			dto.maximumAgeSeconds > 86400 ||
			!Number.isInteger(dto.maximumSkewSeconds) ||
			dto.maximumSkewSeconds < 0 ||
			dto.maximumSkewSeconds > 3600 ||
			((writing || dto.expectedGraphRevision !== undefined) &&
				(!Number.isSafeInteger(dto.expectedGraphRevision) ||
					dto.expectedGraphRevision + (writing ? 1 : 0) !== (await this.graph.revision(manager)))) ||
			dto.sources?.length !== 2 ||
			DEW_POINT_ROLES.some((role) => dto.sources.filter((s) => s.role === role).length !== 1)
		)
			throw new DevicesValidationException('Invalid dedicated dew point policy, roles or graph revision.');
		const output =
			draftOutput ??
			(await manager.findOne(VirtualChannelPropertyEntity, {
				where: { id },
				relations: ['channel', 'channel.device'],
			}));
		if (
			!dewPointOutputContract(output) ||
			(await manager.existsBy(VirtualTransformConfigEntity, { outputPropertyId: id })) ||
			(await manager.existsBy(VirtualAggregateConfigEntity, { outputPropertyId: id }))
		)
			throw new DevicesValidationException('Dew point requires an unclaimed read-only generic derived output.');
		const previous = await manager.findOneBy(VirtualDewPointConfigEntity, { outputPropertyId: id });
		if (!Number.isInteger(dto.expectedRevision) || dto.expectedRevision !== (previous?.revision ?? 0))
			throw new DevicesValidationException('Producer revision changed; reload and retry.');
		const config = manager.create(VirtualDewPointConfigEntity, {
			outputPropertyId: id,
			schemaVersion: 1,
			formulaVersion: DEW_POINT_FORMULA,
			maximumAgeSeconds: dto.maximumAgeSeconds,
			maximumSkewSeconds: dto.maximumSkewSeconds,
			revision: (previous?.revision ?? 0) + 1,
			configuredAt: new Date(),
		});
		const sources: VirtualDewPointSourceEntity[] = [];
		for (const role of DEW_POINT_ROLES) {
			const sourceId = dto.sources.find((s) => s.role === role).sourcePropertyId;
			if (sourceId === undefined) throw new DevicesValidationException('Both explicit source identities are required.');
			const old = await manager.findOneBy(VirtualDewPointSourceEntity, { outputPropertyId: id, role });
			if (sourceId === null) {
				if (!old || old.sourcePropertyId !== null)
					throw new DevicesValidationException('Only an existing missing binding may retain null.');
				sources.push(old);
				continue;
			}
			const source = await manager.findOne(ChannelPropertyEntity, {
				where: { id: sourceId },
				relations: ['channel', 'channel.device'],
			});
			if (source) await hydrateMeasurementContract(manager, source);
			if (!sourceId || !dewPointSourceContract(source, role))
				throw new DevicesValidationException(`Incompatible ${role} source.`);
			sources.push(
				manager.create(VirtualDewPointSourceEntity, {
					outputPropertyId: id,
					role,
					sourcePropertyId: source.id,
					sourcePropertyIdentity: source.id,
					quantity: role === 'dry_bulb' ? 'temperature' : 'humidity',
					unit: role === 'dry_bulb' ? '°C' : '%',
					domain: dewPointInputDomain(role),
					contractFingerprint: dewPointSourceFingerprint(source),
				}),
			);
		}
		if (sources[0].sourcePropertyIdentity === sources[1].sourcePropertyIdentity)
			throw new DevicesValidationException('Dew point sources must be distinct.');
		await this.graph.validateReplacement(
			manager,
			[id],
			sources
				.filter((s) => !!s.sourcePropertyId)
				.map((s) => ({ outputPropertyId: id, sourcePropertyId: s.sourcePropertyId })),
		);
		return { config, sources, output };
	}

	async persist(
		manager: EntityManager,
		prepared: Awaited<ReturnType<VirtualDewPointConfigService['prepare']>>,
	): Promise<void> {
		await manager.save(prepared.config);
		await manager.save(prepared.sources);
	}
	activate(prepared: Awaited<ReturnType<VirtualDewPointConfigService['prepare']>>): void {
		prepared.output.unit = '°C';
		prepared.output.measurementQuantity = 'dew_point';
		this.runtime.activate(prepared.output, prepared.config.revision);
	}

	inspect(prepared: Awaited<ReturnType<VirtualDewPointConfigService['prepare']>>): Promise<DewPointDiagnostic> {
		return this.runtime.inspect(prepared.config, prepared.output, prepared.sources);
	}

	describe(
		config: VirtualDewPointConfigEntity,
		sources: VirtualDewPointSourceEntity[],
		revision: number,
		live = true,
		inspected?: DewPointDiagnostic,
	): VirtualDewPointModel {
		const diagnostic = live ? this.runtime.readDiagnostics(config.outputPropertyId) : inspected;
		return Object.assign(new VirtualDewPointModel(), {
			output_property: config.outputPropertyId,
			schema_version: 1,
			formula_version: config.formulaVersion,
			revision: config.revision,
			graph_revision: revision,
			maximum_age_seconds: config.maximumAgeSeconds,
			maximum_skew_seconds: config.maximumSkewSeconds,
			quantity: 'dew_point',
			unit: '°C',
			current_value: live ? (diagnostic?.value ?? null) : null,
			quality: live ? (diagnostic?.quality ?? 'unavailable') : 'unavailable',
			errors: diagnostic?.errors.length
				? diagnostic.errors
				: [live ? 'awaiting_fresh_inputs' : 'awaiting_fresh_inputs_after_save'],
			expires_at: diagnostic?.expiresAt?.toISOString() ?? null,
			sources: sources.map((s) => ({
				role: s.role,
				source_property: s.sourcePropertyId,
				source_identity: s.sourcePropertyIdentity,
				contract_fingerprint: s.contractFingerprint,
				domain: s.domain,
				quantity: s.quantity,
				unit: s.unit,
				current_value: diagnostic?.sources[s.role]?.value ?? null,
				sampled_at: diagnostic?.sources[s.role]?.sampledAt ?? null,
				age_seconds: diagnostic?.sources[s.role]?.ageSeconds ?? null,
				errors: diagnostic?.sources[s.role]?.errors ?? [s.sourcePropertyId ? 'awaiting_fresh_input' : 'missing'],
			})),
		});
	}
}
