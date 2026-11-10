import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { AUTOMATION_NODE_KINDS, AutomationNodeKind, RegisteredAutomationNodeType } from '../graph/node-type';

@ApiSchema({ name: 'AutomationsModuleDataNodeTypePorts' })
export class AutomationNodeTypePortsModel {
	@ApiProperty({
		description: 'Input ports an edge can end at. A trigger has none.',
		type: 'array',
		items: { type: 'string' },
		example: ['in'],
	})
	@Expose()
	inputs: string[];

	@ApiProperty({
		description: 'Output ports an edge can start at',
		type: 'array',
		items: { type: 'string' },
		example: ['yes', 'no'],
	})
	@Expose()
	outputs: string[];
}

/**
 * One entry of the node type catalogue
 */
@ApiSchema({ name: 'AutomationsModuleDataNodeType' })
export class AutomationNodeTypeModel {
	@ApiProperty({
		description: 'Node type identifier, as stored in the `type` of a graph node',
		type: 'string',
		example: 'device.property.changed',
	})
	@Expose()
	type: string;

	@ApiProperty({
		description:
			'Node kind: `trigger` (When) starts a run, `condition` (And) continues on one of two outputs, `action` (Then) performs a side effect, `flow` shapes the run.',
		enum: AUTOMATION_NODE_KINDS,
		example: 'trigger',
	})
	@Expose()
	kind: AutomationNodeKind;

	@ApiProperty({ description: 'Human-facing name in English', type: 'string', example: 'Device value changes' })
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Human-facing description in English',
		type: 'string',
		example: 'Starts the automation when a value of a device changes.',
	})
	@Expose()
	description: string;

	@ApiProperty({ description: 'Ports edges can attach to', type: () => AutomationNodeTypePortsModel })
	@Expose()
	@Type(() => AutomationNodeTypePortsModel)
	ports: AutomationNodeTypePortsModel;

	@ApiProperty({
		name: 'config_schema',
		description:
			'JSON Schema of the node configuration, for building a generic form. A node type that does not describe its configuration gets a schema accepting any object; the server still checks the configuration on save.',
		type: 'object',
		additionalProperties: true,
		example: {
			type: 'object',
			properties: { property_id: { type: 'string', format: 'uuid' } },
			required: ['property_id'],
			additionalProperties: false,
		},
	})
	@Expose()
	config_schema: Record<string, unknown>;
}

export const createAutomationNodeTypeModel = (nodeType: RegisteredAutomationNodeType): AutomationNodeTypeModel => {
	const ports = new AutomationNodeTypePortsModel();
	ports.inputs = [...nodeType.ports.inputs];
	ports.outputs = [...nodeType.ports.outputs];

	const model = new AutomationNodeTypeModel();
	model.type = nodeType.type;
	model.kind = nodeType.kind;
	model.name = nodeType.name;
	model.description = nodeType.description;
	model.ports = ports;
	model.config_schema = nodeType.configSchema ?? { type: 'object', additionalProperties: true };

	return model;
};
