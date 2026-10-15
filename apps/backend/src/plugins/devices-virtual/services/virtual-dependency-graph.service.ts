import { DataSource, EntityManager, IsNull, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualGraphRevisionEntity,
	VirtualLightGroupBindingEntity,
} from '../entities/virtual-producer.entity';
import { VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { isEligibleVirtualMeasurement } from './virtual-source-eligibility.utils';

export interface VirtualDependencyEdge {
	outputPropertyId: string;
	sourcePropertyId: string;
}

/** Database writer reservation precedes all graph validation, including across independent processes. */
@Injectable()
export class VirtualDependencyGraphService implements OnApplicationBootstrap {
	private quarantined = new Set<string>();
	private liveValueProperties = new Set<string>();
	private knownProperties = new Set<string>();
	private valueSources = new Map<string, { valueOrigin: VirtualValueOrigin; sourcePropertyId: string | null }>();
	private readonly validationListeners = new Map<
		(revision: number, quarantined: ReadonlySet<string>) => Promise<void>,
		{ requiresActivation?: boolean }
	>();
	private quarantineRevision = -1;
	// Module initialization may install leases before bootstrap validates the durable graph.
	private validationPending = true;
	private validationGeneration = 0;
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDependencyGraphService');

	constructor(
		private readonly dataSource: DataSource,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	/** Synchronous structural-event fence; a settled owner must refresh after commit or rollback. */
	invalidateValidation(): void {
		this.validationGeneration++;
		this.validationPending = true;
	}

	/** Applies committed validation before returning; runtime evaluation waits for the caller's activation events. */
	async withStructuralWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision?: number,
	): Promise<T> {
		// The caller already owns DeviceStructureLockService. Never acquire another lock from this transaction.
		const result = await this.dataSource.transaction(async (manager) => {
			// Even an ignored INSERT reserves SQLite's writer slot before a validation read. This also
			// initializes synchronized databases, which do not run the migration's singleton seed.
			await manager.query('INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)');
			const current = await manager.findOneByOrFail(VirtualGraphRevisionEntity, { id: 1 });
			if (expectedGraphRevision !== undefined && current.revision !== expectedGraphRevision) {
				throw new DevicesValidationException('Virtual dependency graph revision changed; reload and retry.');
			}
			await manager.increment(VirtualGraphRevisionEntity, { id: 1 }, 'revision', 1);
			return operation(manager);
		});
		try {
			await this.refreshValidation(false);
		} catch (error) {
			// The owning COMMIT succeeded. Returning its result allows the caller to activate the
			// persisted catalog while validation guards keep live authority unavailable until retry.
			this.logger.error(
				'Virtual structural write committed, but graph validation failed; live authority remains unavailable until validation succeeds.',
				error instanceof Error ? error : new Error('Post-commit graph validation rejected', { cause: error }),
			);
		}
		return result;
	}

	/** The applied validated graph revision, safe for an internal provider publish guard. */
	isRevisionCurrent(revision: number): boolean {
		return !this.validationPending && this.quarantineRevision === revision;
	}

	/** Whether a complete graph snapshot and every validation listener have succeeded. */
	isValidated(): boolean {
		return !this.validationPending && this.quarantineRevision >= 0;
	}

	/** Policy from the same validated metadata snapshot as the dependency graph; null while suspended. */
	propertyRequiresLiveValue(propertyId: string): boolean | null {
		return this.isValidated() && this.knownProperties.has(propertyId) ? this.liveValueProperties.has(propertyId) : null;
	}

	/** A stale bound entity cannot read an old canonical source after a committed relink. */
	matchesValueSource(property: Pick<VirtualChannelPropertyEntity, 'id' | 'valueOrigin' | 'sourcePropertyId'>): boolean {
		const source = this.valueSources.get(property.id);
		return (
			this.isValidated() &&
			!!source &&
			source.valueOrigin === (property.valueOrigin ?? VirtualValueOrigin.SOURCE) &&
			source.sourcePropertyId === (property.sourcePropertyId ?? null)
		);
	}

	/** Captures one validation lifecycle so pending publications cannot survive a failed refresh/retry. */
	capturePublishGuard(): () => boolean {
		const generation = this.validationGeneration;
		return () => this.isValidated() && generation === this.validationGeneration;
	}

	async revision(manager: EntityManager = this.dataSource.manager): Promise<number> {
		return (await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 }))?.revision ?? 0;
	}

	async edges(manager: EntityManager): Promise<VirtualDependencyEdge[]> {
		const projections = await manager
			.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
			.select(['property.id', 'property.sourcePropertyId', 'property.valueOrigin'])
			.where('property.sourcePropertyId IS NOT NULL')
			.callListeners(false)
			.getMany();
		const transforms = await manager.find(VirtualTransformSourceEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const inputs = await manager.find(VirtualAggregateInputEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const bindings = await manager.find(VirtualLightGroupBindingEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		return [
			...transforms.map((input) => ({
				outputPropertyId: input.outputPropertyId,
				sourcePropertyId: input.sourcePropertyId,
			})),
			...projections
				.filter((property) => property.isProjecting)
				.map((property) => ({ outputPropertyId: property.id, sourcePropertyId: property.sourcePropertyId })),
			...inputs.map((input) => ({
				outputPropertyId: input.outputPropertyId,
				sourcePropertyId: input.sourcePropertyId,
			})),
			...bindings.map((binding) => ({
				outputPropertyId: binding.outputPropertyId,
				sourcePropertyId: binding.sourcePropertyId,
			})),
		];
	}

	async validateReplacement(
		manager: EntityManager,
		outputIds: string[],
		replacements: VirtualDependencyEdge[],
	): Promise<void> {
		const replacing = new Set(outputIds);
		this.validate([
			...(await this.edges(manager)).filter((edge) => !replacing.has(edge.outputPropertyId)),
			...replacements,
		]);
	}

	async validateProperty(manager: EntityManager, property: VirtualChannelPropertyEntity): Promise<void> {
		// Updating an owned producer cannot silently erase its durable input edges.
		if (property.valueOrigin === VirtualValueOrigin.DERIVED) {
			this.validate(await this.edges(manager));
			return;
		}
		const producerInputs = await manager.count(VirtualAggregateInputEntity, {
			where: { outputPropertyId: property.id },
		});
		const groupBindings = await manager.count(VirtualLightGroupBindingEntity, {
			where: { outputPropertyId: property.id },
		});
		const transformInputs = await manager.count(VirtualTransformSourceEntity, {
			where: { outputPropertyId: property.id },
		});
		if (producerInputs || groupBindings || transformInputs)
			throw new DevicesValidationException(
				'A configured producer output must retain derived origin; edit or remove its producer configuration first.',
			);
		await this.validateReplacement(
			manager,
			[property.id],
			property.isLinked && property.sourcePropertyId
				? [{ outputPropertyId: property.id, sourcePropertyId: property.sourcePropertyId }]
				: [],
		);
	}

	validate(edges: VirtualDependencyEdge[]): void {
		if (edges.length > 8192) throw new DevicesValidationException('Virtual dependency graph exceeds the edge limit.');
		const graph = new Map<string, Set<string>>();
		const fanOut = new Map<string, Set<string>>();
		const nodes = new Set<string>();
		for (const edge of edges) {
			nodes.add(edge.outputPropertyId);
			nodes.add(edge.sourcePropertyId);
			const inputs = graph.get(edge.outputPropertyId) ?? new Set<string>();
			inputs.add(edge.sourcePropertyId);
			graph.set(edge.outputPropertyId, inputs);
			const outputs = fanOut.get(edge.sourcePropertyId) ?? new Set<string>();
			outputs.add(edge.outputPropertyId);
			fanOut.set(edge.sourcePropertyId, outputs);
			if (outputs.size > 256)
				throw new DevicesValidationException('Virtual dependency graph exceeds the fan-out limit.');
		}
		if (nodes.size > 4096) throw new DevicesValidationException('Virtual dependency graph exceeds the node limit.');
		const depths = new Map<string, number>();
		const visiting = new Set<string>();
		const depth = (node: string): number => {
			if (visiting.size > 16) throw new DevicesValidationException('Virtual dependency graph exceeds the depth limit.');
			if (visiting.has(node))
				throw new DevicesValidationException('Virtual dependency graph contains a cycle or self-reference.');
			if (depths.has(node)) return depths.get(node);
			visiting.add(node);
			let result = 0;
			for (const input of graph.get(node) ?? []) {
				result = Math.max(result, depth(input) + 1);
				if (result > 16) throw new DevicesValidationException('Virtual dependency graph exceeds the depth limit.');
			}
			visiting.delete(node);
			depths.set(node, result);
			return result;
		};
		for (const node of nodes) depth(node);
	}

	isQuarantined(propertyId: string): boolean {
		return this.quarantined.has(propertyId);
	}

	/**
	 * Quarantine masks run before structural writers return. Evaluators that require activation must
	 * instead observe the caller's subsequent catalog events, after fresh-input barriers are installed.
	 */
	observeValidation(
		listener: (revision: number, quarantined: ReadonlySet<string>) => Promise<void>,
		options: { requiresActivation?: boolean } = {},
	): () => void {
		this.validationListeners.set(listener, options);
		return () => this.validationListeners.delete(listener);
	}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		await this.refreshQuarantine();
	}

	/** Explicit/startup validation also refreshes activated runtime outputs. */
	async refreshQuarantine(): Promise<void> {
		await this.refreshValidation(true);
	}

	/** Reads only existing identities referenced by SOURCE projections, without hydrating value history. */
	private async readProjectionSources(manager: EntityManager): Promise<ChannelPropertyEntity[]> {
		const sources = manager
			.createQueryBuilder(VirtualChannelPropertyEntity, 'projection')
			.select('projection.sourcePropertyId')
			.where('projection.valueOrigin = :projectionOrigin', { projectionOrigin: VirtualValueOrigin.SOURCE })
			.andWhere('projection.sourcePropertyId IS NOT NULL');
		// Materialize the STI query before copying its generated discriminator parameters.
		const sourceQuery = sources.getQuery();
		return manager
			.createQueryBuilder(ChannelPropertyEntity, 'property')
			.select(['property.id'])
			.where(`property.id IN (${sourceQuery})`)
			.setParameters(sources.getParameters())
			.callListeners(false)
			.getMany();
	}

	/** Validates one committed snapshot without evaluating outputs before their writer activates them. */
	private async refreshValidation(activated: boolean): Promise<void> {
		const generation = ++this.validationGeneration;
		this.validationPending = true;
		try {
			const snapshot = await this.dataSource.transaction(async (manager) => ({
				edges: await this.edges(manager),
				aggregates: await manager.find(VirtualAggregateConfigEntity),
				knownProperties: await this.readProjectionSources(manager),
				properties: await manager
					.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
					.leftJoinAndSelect('property.channel', 'channel')
					.leftJoinAndSelect('channel.device', 'device')
					.callListeners(false)
					.getMany(),
				revision: await this.revision(manager),
			}));
			if (generation !== this.validationGeneration) return;
			if (snapshot.revision < this.quarantineRevision)
				throw new Error('Graph validation snapshot is older than the applied revision');
			const quarantined = new Set<string>();
			const neighbors = new Map<string, Set<string>>();
			for (const edge of snapshot.edges) {
				for (const [node, neighbor] of [
					[edge.outputPropertyId, edge.sourcePropertyId],
					[edge.sourcePropertyId, edge.outputPropertyId],
				]) {
					const adjacent = neighbors.get(node) ?? new Set<string>();
					adjacent.add(neighbor);
					neighbors.set(node, adjacent);
				}
			}
			const visited = new Set<string>();
			for (const root of neighbors.keys()) {
				if (visited.has(root)) continue;
				const component = new Set<string>();
				const queue = [root];
				for (let index = 0; index < queue.length; index++) {
					const node = queue[index];
					if (component.has(node)) continue;
					component.add(node);
					visited.add(node);
					queue.push(...(neighbors.get(node) ?? []));
				}
				try {
					this.validate(snapshot.edges.filter((edge) => component.has(edge.outputPropertyId)));
				} catch (error) {
					if (!(error instanceof DevicesValidationException)) throw error;
					for (const node of component) quarantined.add(node);
				}
			}
			if (snapshot.edges.length > 8192 || neighbors.size > 4096)
				for (const node of neighbors.keys()) quarantined.add(node);
			for (const config of snapshot.aggregates) {
				const property = snapshot.properties.find((candidate) => candidate.id === config.outputPropertyId);
				const channel = property?.channel as ChannelEntity;
				if (
					!property ||
					!channel?.device ||
					!isEligibleVirtualMeasurement(property, channel, channel.device as DeviceEntity)
				)
					quarantined.add(config.outputPropertyId);
			}
			this.quarantined = quarantined;
			this.knownProperties = new Set(snapshot.knownProperties.map((property) => property.id));
			this.valueSources = new Map(
				snapshot.properties.map((property) => [
					property.id,
					{ valueOrigin: property.valueOrigin, sourcePropertyId: property.sourcePropertyId ?? null },
				]),
			);
			this.liveValueProperties = new Set(
				snapshot.properties.filter((property) => property.requiresLiveValue).map((property) => property.id),
			);
			for (const [listener, options] of this.validationListeners) {
				if (generation !== this.validationGeneration) return;
				if (!options.requiresActivation) await listener(snapshot.revision, quarantined);
			}
			if (generation !== this.validationGeneration) return;
			this.quarantineRevision = snapshot.revision;
			this.validationPending = false;
			if (activated)
				for (const [listener, options] of this.validationListeners) {
					if (generation !== this.validationGeneration) return;
					if (options.requiresActivation) await listener(snapshot.revision, quarantined);
				}
		} catch (error) {
			if (generation === this.validationGeneration) this.validationPending = true;
			throw error;
		}
	}
}
