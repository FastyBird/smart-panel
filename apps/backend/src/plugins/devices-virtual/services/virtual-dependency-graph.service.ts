import { DataSource, EntityManager, IsNull, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { getEnvValue } from '../../../common/utils/config.utils';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import {
	VirtualAggregateInputEntity,
	VirtualGraphRevisionEntity,
	VirtualLightGroupBindingEntity,
} from '../entities/virtual-producer.entity';

export interface VirtualDependencyEdge {
	outputPropertyId: string;
	sourcePropertyId: string;
}

/** Database writer reservation precedes all graph validation, including across independent processes. */
@Injectable()
export class VirtualDependencyGraphService implements OnApplicationBootstrap {
	private quarantined = new Set<string>();
	private readonly validationListeners = new Set<
		(revision: number, quarantined: ReadonlySet<string>) => Promise<void>
	>();
	private quarantineRevision = -1;

	constructor(
		private readonly dataSource: DataSource,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

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
		if (this.quarantined.size) await this.refreshQuarantine();
		return result;
	}

	/** The applied validated graph revision, safe for an internal provider publish guard. */
	isRevisionCurrent(revision: number): boolean {
		return this.quarantineRevision === revision;
	}

	async revision(manager: EntityManager = this.dataSource.manager): Promise<number> {
		return (await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 }))?.revision ?? 0;
	}

	async edges(manager: EntityManager): Promise<VirtualDependencyEdge[]> {
		const projections = await manager
			.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
			.where('property.sourcePropertyId IS NOT NULL')
			.callListeners(false)
			.getMany();
		const inputs = await manager.find(VirtualAggregateInputEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const bindings = await manager.find(VirtualLightGroupBindingEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		return [
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
		if (producerInputs || groupBindings)
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

	observeValidation(listener: (revision: number, quarantined: ReadonlySet<string>) => Promise<void>): () => void {
		this.validationListeners.add(listener);
		return () => this.validationListeners.delete(listener);
	}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		await this.refreshQuarantine();
	}

	async refreshQuarantine(): Promise<void> {
		const snapshot = await this.dataSource.transaction(async (manager) => ({
			edges: await this.edges(manager),
			revision: await this.revision(manager),
		}));
		if (snapshot.revision < this.quarantineRevision) return;
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
		this.quarantineRevision = snapshot.revision;
		this.quarantined = quarantined;
		for (const listener of this.validationListeners) await listener(snapshot.revision, quarantined);
	}
}
