import { DataSource, EntityManager, IsNull, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

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

	constructor(private readonly dataSource: DataSource) {}

	async withStructuralWrite<T>(
		operation: (manager: EntityManager) => Promise<T>,
		expectedGraphRevision?: number,
	): Promise<T> {
		// The caller already owns DeviceStructureLockService. Never acquire another lock from this transaction.
		return this.dataSource.transaction(async (manager) => {
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
	}

	async revision(manager: EntityManager = this.dataSource.manager): Promise<number> {
		return (await manager.findOneBy(VirtualGraphRevisionEntity, { id: 1 }))?.revision ?? 0;
	}

	async edges(manager: EntityManager): Promise<VirtualDependencyEdge[]> {
		const projections = await manager.find(VirtualChannelPropertyEntity, {
			where: { sourcePropertyId: Not(IsNull()) },
		});
		const inputs = await manager.find(VirtualAggregateInputEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		const bindings = await manager.find(VirtualLightGroupBindingEntity, { where: { sourcePropertyId: Not(IsNull()) } });
		return [
			...projections
				.filter((property) => property.isProjecting)
				.map((property) => ({ outputPropertyId: property.id, sourcePropertyId: property.sourcePropertyId! })),
			...inputs.map((input) => ({
				outputPropertyId: input.outputPropertyId,
				sourcePropertyId: input.sourcePropertyId!,
			})),
			...bindings.map((binding) => ({
				outputPropertyId: binding.outputPropertyId,
				sourcePropertyId: binding.sourcePropertyId!,
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
			if (visiting.has(node))
				throw new DevicesValidationException('Virtual dependency graph contains a cycle or self-reference.');
			if (depths.has(node)) return depths.get(node)!;
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

	async onApplicationBootstrap(): Promise<void> {
		const edges = await this.edges(this.dataSource.manager);
		try {
			this.validate(edges);
			this.quarantined.clear();
		} catch (error) {
			if (!(error instanceof DevicesValidationException)) throw error;
			// Conservative quarantine prevents any malformed imported graph from propagating values.
			this.quarantined = new Set(edges.flatMap((edge) => [edge.outputPropertyId, edge.sourcePropertyId]));
		}
	}
}
