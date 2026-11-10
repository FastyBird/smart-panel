import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import {
	AUTOMATION_GRAPH_MAX_EDGES,
	AUTOMATION_GRAPH_MAX_NODES,
	AUTOMATION_GRAPH_VERSION,
} from '../automations.constants';

@ApiSchema({ name: 'AutomationsModuleDataGraphNodePosition' })
export class AutomationGraphNodePositionModel {
	@ApiProperty({ description: 'Horizontal canvas position', type: 'number', example: 40 })
	@Expose()
	x: number;

	@ApiProperty({ description: 'Vertical canvas position', type: 'number', example: 80 })
	@Expose()
	y: number;
}

@ApiSchema({ name: 'AutomationsModuleDataGraphNode' })
export class AutomationGraphNodeModel {
	@ApiProperty({ description: 'Node identifier, unique within the graph', type: 'string', example: 'n1' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Node type', type: 'string', example: 'device.property.changed' })
	@Expose()
	type: string;

	@ApiProperty({ description: 'Position of the node on the canvas', type: () => AutomationGraphNodePositionModel })
	@Expose()
	@Type(() => AutomationGraphNodePositionModel)
	position: AutomationGraphNodePositionModel;

	@ApiProperty({
		description: 'Node configuration (specific to the node type)',
		type: 'object',
		additionalProperties: true,
		example: { property_id: '550e8400-e29b-41d4-a716-446655440000', to: true },
	})
	@Expose()
	config: Record<string, unknown>;
}

@ApiSchema({ name: 'AutomationsModuleDataGraphEdge' })
export class AutomationGraphEdgeModel {
	@ApiProperty({ description: 'Edge identifier, unique within the graph', type: 'string', example: 'e1' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Identifier of the node the edge starts at', type: 'string', example: 'n1' })
	@Expose()
	source: string;

	@ApiProperty({
		name: 'source_port',
		description: 'Output port of the source node',
		type: 'string',
		example: 'out',
	})
	@Expose()
	source_port: string;

	@ApiProperty({ description: 'Identifier of the node the edge ends at', type: 'string', example: 'n2' })
	@Expose()
	target: string;

	@ApiProperty({
		name: 'target_port',
		description: 'Input port of the target node',
		type: 'string',
		example: 'in',
	})
	@Expose()
	target_port: string;
}

/**
 * The stored automation graph. It is one JSON document: the wire format and the stored format are the same,
 * so keys are snake_case in both.
 */
@ApiSchema({ name: 'AutomationsModuleDataGraph' })
export class AutomationGraphModel {
	@ApiProperty({
		description: `Graph document version. The only supported version is ${AUTOMATION_GRAPH_VERSION}.`,
		type: 'integer',
		minimum: AUTOMATION_GRAPH_VERSION,
		maximum: AUTOMATION_GRAPH_VERSION,
		example: AUTOMATION_GRAPH_VERSION,
	})
	@Expose()
	version: number;

	@ApiProperty({
		description: 'Graph nodes',
		type: 'array',
		maxItems: AUTOMATION_GRAPH_MAX_NODES,
		items: { $ref: getSchemaPath(AutomationGraphNodeModel) },
	})
	@Expose()
	@Type(() => AutomationGraphNodeModel)
	nodes: AutomationGraphNodeModel[];

	@ApiProperty({
		description: 'Graph edges',
		type: 'array',
		maxItems: AUTOMATION_GRAPH_MAX_EDGES,
		items: { $ref: getSchemaPath(AutomationGraphEdgeModel) },
	})
	@Expose()
	@Type(() => AutomationGraphEdgeModel)
	edges: AutomationGraphEdgeModel[];
}

export const createEmptyAutomationGraph = (): AutomationGraphModel => ({
	version: AUTOMATION_GRAPH_VERSION,
	nodes: [],
	edges: [],
});
