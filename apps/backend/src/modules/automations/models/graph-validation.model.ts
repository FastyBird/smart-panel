import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { AutomationGraphIssueCode, AutomationGraphIssueSeverity } from '../graph/graph-validator';
import { AutomationGraphSaveCheck, AutomationGraphSaveIssue } from '../graph/save-policy';

/**
 * One issue found in a graph, addressed to the node or edge it is about
 */
@ApiSchema({ name: 'AutomationsModuleDataGraphIssue' })
export class AutomationGraphIssueModel {
	@ApiProperty({
		description: 'An `error` makes the graph not runnable; a `warning` is advice and never stops a save.',
		enum: ['error', 'warning'],
		example: 'error',
	})
	@Expose()
	severity: AutomationGraphIssueSeverity;

	@ApiProperty({
		description:
			'What is wrong. `unknown_node_type`, `unknown_port`, `edge_into_trigger`, `cycle` and `duplicate_edge` always stop a save, and so does `safety_reducing_action` as an error: an action that would unlock, disarm or open (as a warning it says a scene would, which is refused when the automation runs); `invalid_config` and `no_trigger` stop it only when the automation would be enabled; `unreachable_node` is a warning.',
		enum: Object.values(AutomationGraphIssueCode),
		example: AutomationGraphIssueCode.INVALID_CONFIG,
	})
	@Expose()
	code: AutomationGraphIssueCode;

	@ApiProperty({ description: 'Explanation in English', type: 'string', example: 'Property ID must be a valid UUID.' })
	@Expose()
	message: string;

	@ApiProperty({
		description: 'Whether this issue stops the save it was checked for',
		type: 'boolean',
		example: true,
	})
	@Expose()
	blocking: boolean;

	@ApiPropertyOptional({
		name: 'node_id',
		description: 'Identifier of the node the issue is about',
		type: 'string',
		example: 'n1',
	})
	@Expose()
	node_id?: string;

	@ApiPropertyOptional({
		name: 'edge_id',
		description: 'Identifier of the edge the issue is about',
		type: 'string',
		example: 'e1',
	})
	@Expose()
	edge_id?: string;

	@ApiPropertyOptional({
		name: 'node_ids',
		description: 'Identifiers of all nodes taking part, for an issue about several nodes (`cycle`)',
		type: 'array',
		items: { type: 'string' },
		example: ['n2', 'n3'],
	})
	@Expose()
	node_ids?: string[];

	@ApiPropertyOptional({
		description: 'Configuration field the issue is about, dot-separated (`invalid_config`, `safety_reducing_action`)',
		type: 'string',
		example: 'property_id',
	})
	@Expose()
	field?: string;
}

/**
 * The result of validating a graph
 */
@ApiSchema({ name: 'AutomationsModuleDataGraphValidation' })
export class AutomationGraphValidationModel {
	@ApiProperty({
		description: 'Whether the graph could be saved: true when no issue is blocking',
		type: 'boolean',
		example: false,
	})
	@Expose()
	valid: boolean;

	@ApiProperty({
		description: 'Every issue found, blocking or not',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationGraphIssueModel) },
	})
	@Expose()
	@Type(() => AutomationGraphIssueModel)
	issues: AutomationGraphIssueModel[];
}

export const createAutomationGraphIssueModel = (issue: AutomationGraphSaveIssue): AutomationGraphIssueModel =>
	Object.assign(new AutomationGraphIssueModel(), issue);

export const createAutomationGraphValidationModel = (
	check: AutomationGraphSaveCheck,
): AutomationGraphValidationModel => {
	const model = new AutomationGraphValidationModel();
	model.valid = check.valid;
	model.issues = check.issues.map(createAutomationGraphIssueModel);

	return model;
};
