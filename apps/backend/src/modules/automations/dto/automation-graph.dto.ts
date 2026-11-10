import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	Equals,
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsString,
	Max,
	MaxLength,
	Min,
	Validate,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import {
	AUTOMATION_GRAPH_ID_MAX_LENGTH,
	AUTOMATION_GRAPH_MAX_EDGES,
	AUTOMATION_GRAPH_MAX_NODES,
	AUTOMATION_GRAPH_NODE_TYPE_MAX_LENGTH,
	AUTOMATION_GRAPH_PORT_MAX_LENGTH,
	AUTOMATION_GRAPH_POSITION_LIMIT,
	AUTOMATION_GRAPH_VERSION,
} from '../automations.constants';
import { GraphEdgesReferenceNodesConstraint } from '../validators/graph-edges-reference-nodes.validator';

@ApiSchema({ name: 'AutomationsModuleGraphNodePosition' })
export class AutomationGraphNodePositionDto {
	@ApiProperty({ description: 'Horizontal canvas position', type: 'number', example: 40 })
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"x","reason":"Position x must be a finite number."}]' },
	)
	@Min(-AUTOMATION_GRAPH_POSITION_LIMIT, { message: '[{"field":"x","reason":"Position x is out of range."}]' })
	@Max(AUTOMATION_GRAPH_POSITION_LIMIT, { message: '[{"field":"x","reason":"Position x is out of range."}]' })
	x: number;

	@ApiProperty({ description: 'Vertical canvas position', type: 'number', example: 80 })
	@Expose()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ message: '[{"field":"y","reason":"Position y must be a finite number."}]' },
	)
	@Min(-AUTOMATION_GRAPH_POSITION_LIMIT, { message: '[{"field":"y","reason":"Position y is out of range."}]' })
	@Max(AUTOMATION_GRAPH_POSITION_LIMIT, { message: '[{"field":"y","reason":"Position y is out of range."}]' })
	y: number;
}

@ApiSchema({ name: 'AutomationsModuleGraphNode' })
export class AutomationGraphNodeDto {
	@ApiProperty({
		description: 'Node identifier, unique within the graph',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_ID_MAX_LENGTH,
		example: 'n1',
	})
	@Expose()
	@IsString({ message: '[{"field":"id","reason":"Node ID must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"id","reason":"Node ID must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_ID_MAX_LENGTH, {
		message: `[{"field":"id","reason":"Node ID must be at most ${AUTOMATION_GRAPH_ID_MAX_LENGTH} characters long."}]`,
	})
	id: string;

	@ApiProperty({
		description: 'Node type',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_NODE_TYPE_MAX_LENGTH,
		example: 'device.property.changed',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Node type must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"type","reason":"Node type must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_NODE_TYPE_MAX_LENGTH, {
		message: `[{"field":"type","reason":"Node type must be at most ${AUTOMATION_GRAPH_NODE_TYPE_MAX_LENGTH} characters long."}]`,
	})
	type: string;

	@ApiProperty({ description: 'Position of the node on the canvas', type: () => AutomationGraphNodePositionDto })
	@Expose()
	@IsObject({ message: '[{"field":"position","reason":"Position must be an object with x and y."}]' })
	@ValidateNested()
	@Type(() => AutomationGraphNodePositionDto)
	position: AutomationGraphNodePositionDto;

	@ApiProperty({
		description: 'Node configuration (specific to the node type)',
		type: 'object',
		additionalProperties: true,
		example: { property_id: '550e8400-e29b-41d4-a716-446655440000', to: true },
	})
	@Expose()
	@IsObject({ message: '[{"field":"config","reason":"Config must be an object."}]' })
	config: Record<string, unknown>;
}

@ApiSchema({ name: 'AutomationsModuleGraphEdge' })
export class AutomationGraphEdgeDto {
	@ApiProperty({
		description: 'Edge identifier, unique within the graph',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_ID_MAX_LENGTH,
		example: 'e1',
	})
	@Expose()
	@IsString({ message: '[{"field":"id","reason":"Edge ID must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"id","reason":"Edge ID must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_ID_MAX_LENGTH, {
		message: `[{"field":"id","reason":"Edge ID must be at most ${AUTOMATION_GRAPH_ID_MAX_LENGTH} characters long."}]`,
	})
	id: string;

	@ApiProperty({
		description: 'Identifier of the node the edge starts at',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_ID_MAX_LENGTH,
		example: 'n1',
	})
	@Expose()
	@IsString({ message: '[{"field":"source","reason":"Source must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"source","reason":"Source must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_ID_MAX_LENGTH, {
		message: `[{"field":"source","reason":"Source must be at most ${AUTOMATION_GRAPH_ID_MAX_LENGTH} characters long."}]`,
	})
	source: string;

	@ApiProperty({
		description: 'Output port of the source node',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_PORT_MAX_LENGTH,
		example: 'out',
	})
	@Expose()
	@IsString({ message: '[{"field":"source_port","reason":"Source port must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"source_port","reason":"Source port must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_PORT_MAX_LENGTH, {
		message: `[{"field":"source_port","reason":"Source port must be at most ${AUTOMATION_GRAPH_PORT_MAX_LENGTH} characters long."}]`,
	})
	source_port: string;

	@ApiProperty({
		description: 'Identifier of the node the edge ends at',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_ID_MAX_LENGTH,
		example: 'n2',
	})
	@Expose()
	@IsString({ message: '[{"field":"target","reason":"Target must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"target","reason":"Target must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_ID_MAX_LENGTH, {
		message: `[{"field":"target","reason":"Target must be at most ${AUTOMATION_GRAPH_ID_MAX_LENGTH} characters long."}]`,
	})
	target: string;

	@ApiProperty({
		description: 'Input port of the target node',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_PORT_MAX_LENGTH,
		example: 'in',
	})
	@Expose()
	@IsString({ message: '[{"field":"target_port","reason":"Target port must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"target_port","reason":"Target port must be a non-empty string."}]' })
	@MaxLength(AUTOMATION_GRAPH_PORT_MAX_LENGTH, {
		message: `[{"field":"target_port","reason":"Target port must be at most ${AUTOMATION_GRAPH_PORT_MAX_LENGTH} characters long."}]`,
	})
	target_port: string;
}

/**
 * The automation graph as a client submits it. Only its shape is validated here; node types, ports and
 * the configuration of each node are not.
 */
@ApiSchema({ name: 'AutomationsModuleGraph' })
export class AutomationGraphDto {
	@ApiProperty({
		description: `Graph document version. The only supported version is ${AUTOMATION_GRAPH_VERSION}.`,
		type: 'integer',
		minimum: AUTOMATION_GRAPH_VERSION,
		maximum: AUTOMATION_GRAPH_VERSION,
		example: AUTOMATION_GRAPH_VERSION,
	})
	@Expose()
	@Equals(AUTOMATION_GRAPH_VERSION, {
		message: `[{"field":"version","reason":"Graph version must be ${AUTOMATION_GRAPH_VERSION}."}]`,
	})
	version: number;

	@ApiProperty({
		description: 'Graph nodes. Node identifiers must be unique.',
		type: 'array',
		maxItems: AUTOMATION_GRAPH_MAX_NODES,
		items: { $ref: getSchemaPath(AutomationGraphNodeDto) },
	})
	@Expose()
	@IsArray({ message: '[{"field":"nodes","reason":"Nodes must be an array."}]' })
	@ArrayMaxSize(AUTOMATION_GRAPH_MAX_NODES, {
		message: `[{"field":"nodes","reason":"A graph may have at most ${AUTOMATION_GRAPH_MAX_NODES} nodes."}]`,
	})
	@ArrayUnique((node: AutomationGraphNodeDto | null) => node?.id, {
		message: '[{"field":"nodes","reason":"Node IDs must be unique."}]',
	})
	@ValidateNested({ each: true })
	@Type(() => AutomationGraphNodeDto)
	nodes: AutomationGraphNodeDto[];

	@ApiProperty({
		description: 'Graph edges. Edge identifiers must be unique and every edge must connect two existing nodes.',
		type: 'array',
		maxItems: AUTOMATION_GRAPH_MAX_EDGES,
		items: { $ref: getSchemaPath(AutomationGraphEdgeDto) },
	})
	@Expose()
	@IsArray({ message: '[{"field":"edges","reason":"Edges must be an array."}]' })
	@ArrayMaxSize(AUTOMATION_GRAPH_MAX_EDGES, {
		message: `[{"field":"edges","reason":"A graph may have at most ${AUTOMATION_GRAPH_MAX_EDGES} edges."}]`,
	})
	@ArrayUnique((edge: AutomationGraphEdgeDto | null) => edge?.id, {
		message: '[{"field":"edges","reason":"Edge IDs must be unique."}]',
	})
	@Validate(GraphEdgesReferenceNodesConstraint)
	@ValidateNested({ each: true })
	@Type(() => AutomationGraphEdgeDto)
	edges: AutomationGraphEdgeDto[];
}
