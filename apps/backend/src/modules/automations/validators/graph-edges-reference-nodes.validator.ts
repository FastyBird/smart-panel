import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

interface GraphLike {
	nodes?: unknown;
}

/**
 * Checks that every edge of a graph starts and ends at a node of the same graph.
 * It is a shape check only: node types and ports are not looked at here.
 */
@ValidatorConstraint({ name: 'automationGraphEdgesReferenceNodes', async: false })
export class GraphEdgesReferenceNodesConstraint implements ValidatorConstraintInterface {
	validate(edges: unknown, args: ValidationArguments): boolean {
		return this.findDanglingEdges(edges, args).length === 0;
	}

	defaultMessage(args: ValidationArguments): string {
		const dangling = this.findDanglingEdges(args.value, args).slice(0, 5).join(', ');

		return JSON.stringify([
			{
				field: 'edges',
				reason: `Every edge must connect two existing nodes. Edges with an unknown source or target: ${dangling}.`,
			},
		]);
	}

	private findDanglingEdges(edges: unknown, args: ValidationArguments): string[] {
		const nodes = (args.object as GraphLike).nodes;

		// Malformed nodes or edges are reported by the validators of those properties
		if (!Array.isArray(edges) || !Array.isArray(nodes)) {
			return [];
		}

		const nodeIds = new Set<unknown>(
			nodes.filter((node): node is { id: unknown } => typeof node === 'object' && node !== null).map((node) => node.id),
		);

		const dangling: string[] = [];

		for (const edge of edges as unknown[]) {
			if (typeof edge !== 'object' || edge === null) {
				continue;
			}

			const { id, source, target } = edge as { id?: unknown; source?: unknown; target?: unknown };

			if (!nodeIds.has(source) || !nodeIds.has(target)) {
				dangling.push(typeof id === 'string' ? id : '(no id)');
			}
		}

		return dangling;
	}
}
