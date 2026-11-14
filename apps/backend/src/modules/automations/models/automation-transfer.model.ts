import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { AutomationMode } from '../automations.constants';
import { AUTOMATION_NODE_REFERENCE_KINDS, AutomationNodeReferenceKind } from '../graph/node-type';
import { AutomationGraphSaveIssue } from '../graph/save-policy';
import { AutomationMissingReference } from '../transfer/import-references';

import { AutomationGraphModel } from './automation-graph.model';
import { AutomationGraphIssueModel, createAutomationGraphIssueModel } from './graph-validation.model';

/**
 * An automation as a YAML document, to be saved as a file
 */
@ApiSchema({ name: 'AutomationsModuleDataExport' })
export class AutomationExportModel {
	@ApiProperty({
		name: 'file_name',
		description: 'The name to save the file under: the name of the automation in lowercase words joined by dashes',
		type: 'string',
		example: 'hallway-motion-light.yaml',
	})
	@Expose()
	file_name: string;

	@ApiProperty({
		name: 'content_type',
		description: 'The media type of the file',
		type: 'string',
		example: 'application/yaml',
	})
	@Expose()
	content_type: string;

	@ApiProperty({
		description: 'The YAML document',
		type: 'string',
		example:
			'version: 1\nkind: automation\nname: Hallway motion light\nmode: restart\ngraph:\n  nodes: []\n  edges: []\n',
	})
	@Expose()
	content: string;
}

/**
 * One place an imported automation uses a reference
 */
@ApiSchema({ name: 'AutomationsModuleDataImportReferenceUsage' })
export class AutomationImportReferenceUsageModel {
	@ApiProperty({
		name: 'node_id',
		description: 'The node holding the reference; null for the space the automation belongs to',
		type: 'string',
		nullable: true,
		example: 'n1',
	})
	@Expose()
	node_id: string | null;

	@ApiProperty({
		description:
			'Where the reference is held: the dot-separated path of the field in the node configuration, or `space_id` for the space of the automation',
		type: 'string',
		example: 'writes.0.property_id',
	})
	@Expose()
	field: string;
}

/**
 * An entity an imported automation refers to that does not exist in this installation
 */
@ApiSchema({ name: 'AutomationsModuleDataImportMissingReference' })
export class AutomationImportMissingReferenceModel {
	@ApiProperty({
		description:
			'The kind of the entity. A device property target - a property with its channel and device - is one reference of kind `property`.',
		enum: AUTOMATION_NODE_REFERENCE_KINDS,
		example: 'property',
	})
	@Expose()
	kind: AutomationNodeReferenceKind;

	@ApiProperty({
		description: 'The id the file refers to',
		type: 'string',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Every place the reference is used',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationImportReferenceUsageModel) },
	})
	@Expose()
	@Type(() => AutomationImportReferenceUsageModel)
	usages: AutomationImportReferenceUsageModel[];
}

/**
 * The automation an import file describes, ready to be created the ordinary way
 */
@ApiSchema({ name: 'AutomationsModuleDataImportDraft' })
export class AutomationImportDraftModel {
	@ApiProperty({ description: 'Automation name', type: 'string', example: 'Hallway motion light' })
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Automation description',
		type: 'string',
		nullable: true,
		example: 'Turns the hallway light on when somebody walks in',
	})
	@Expose()
	description: string | null;

	@ApiProperty({ description: 'Icon identifier', type: 'string', nullable: true, example: 'mdi:motion-sensor' })
	@Expose()
	icon: string | null;

	@ApiProperty({ description: 'The run mode', enum: AutomationMode, example: AutomationMode.RESTART })
	@Expose()
	mode: AutomationMode;

	@ApiProperty({
		name: 'space_id',
		description:
			'The space the automation belongs to; null when the file names none, or names one that does not exist and was not mapped',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: null,
	})
	@Expose()
	space_id: string | null;

	@ApiProperty({ description: 'The graph, with every mapping applied', type: () => AutomationGraphModel })
	@Expose()
	@Type(() => AutomationGraphModel)
	graph: AutomationGraphModel;
}

/**
 * What an import file would create
 */
@ApiSchema({ name: 'AutomationsModuleDataImportPreparation' })
export class AutomationImportPreparationModel {
	@ApiProperty({
		description: 'The automation to create, disabled, through the ordinary create request',
		type: () => AutomationImportDraftModel,
	})
	@Expose()
	@Type(() => AutomationImportDraftModel)
	draft: AutomationImportDraftModel;

	@ApiProperty({
		name: 'missing_references',
		description:
			'The entities the automation refers to that do not exist here and were not mapped. The automation can be created with them, disabled; the nodes using them have to be pointed elsewhere before it can be enabled.',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationImportMissingReferenceModel) },
	})
	@Expose()
	@Type(() => AutomationImportMissingReferenceModel)
	missing_references: AutomationImportMissingReferenceModel[];

	@ApiProperty({
		description:
			'What saving the graph as a disabled automation reports; none of them is blocking, or the preparation would have been refused',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationGraphIssueModel) },
	})
	@Expose()
	@Type(() => AutomationGraphIssueModel)
	issues: AutomationGraphIssueModel[];
}

export interface AutomationImportPreparation {
	draft: {
		name: string;
		description: string | null;
		icon: string | null;
		mode: AutomationMode;
		spaceId: string | null;
		graph: AutomationGraphModel;
	};
	missingReferences: AutomationMissingReference[];
	issues: AutomationGraphSaveIssue[];
}

export const createAutomationImportPreparationModel = (
	preparation: AutomationImportPreparation,
): AutomationImportPreparationModel => {
	const draft = new AutomationImportDraftModel();

	draft.name = preparation.draft.name;
	draft.description = preparation.draft.description;
	draft.icon = preparation.draft.icon;
	draft.mode = preparation.draft.mode;
	draft.space_id = preparation.draft.spaceId;
	draft.graph = preparation.draft.graph;

	const model = new AutomationImportPreparationModel();

	model.draft = draft;
	model.missing_references = preparation.missingReferences.map((reference) => {
		const missing = new AutomationImportMissingReferenceModel();

		missing.kind = reference.kind;
		missing.id = reference.id;
		missing.usages = reference.usages.map((usage) =>
			Object.assign(new AutomationImportReferenceUsageModel(), { node_id: usage.nodeId, field: usage.field }),
		);

		return missing;
	});
	model.issues = preparation.issues.map(createAutomationGraphIssueModel);

	return model;
};

export const createAutomationExportModel = (fileName: string, content: string): AutomationExportModel =>
	Object.assign(new AutomationExportModel(), { file_name: fileName, content_type: 'application/yaml', content });
