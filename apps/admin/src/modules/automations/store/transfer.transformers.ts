import { logger } from '../../../common';
import { AutomationsValidationException } from '../automations.exceptions';

import { transformAutomationGraphIssues } from './automations.transformers';
import { AutomationExportSchema, AutomationImportIssueSchema, AutomationImportPreparationSchema } from './transfer.store.schemas';
import type {
	IAutomationExport,
	IAutomationExportRes,
	IAutomationImportIssue,
	IAutomationImportPreparation,
	IAutomationImportPreparationRes,
} from './transfer.store.types';

export const transformAutomationExportResponse = (response: IAutomationExportRes | Record<string, unknown>): IAutomationExport => {
	const data = response as IAutomationExportRes;

	const parsed = AutomationExportSchema.safeParse({ fileName: data.file_name, contentType: data.content_type, content: data.content });

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation export data.');
	}

	return parsed.data;
};

// The graph is kept as received: node configurations belong to the node types and are never case converted
export const transformAutomationImportPreparationResponse = (
	response: IAutomationImportPreparationRes | Record<string, unknown>
): IAutomationImportPreparation => {
	const data = response as IAutomationImportPreparationRes;

	const draft = data.draft as IAutomationImportPreparationRes['draft'] | undefined;

	const parsed = AutomationImportPreparationSchema.safeParse({
		draft: draft
			? {
					name: draft.name,
					description: draft.description,
					icon: draft.icon,
					mode: draft.mode,
					spaceId: draft.space_id,
					graph: draft.graph,
				}
			: undefined,
		missingReferences: Array.isArray(data.missing_references)
			? data.missing_references.map((reference) => ({
					kind: reference.kind,
					id: reference.id,
					usages: Array.isArray(reference.usages) ? reference.usages.map((usage) => ({ nodeId: usage.node_id, field: usage.field })) : [],
				}))
			: data.missing_references,
		issues: transformAutomationGraphIssues(data.issues),
	});

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new AutomationsValidationException('Failed to validate received automation import data.');
	}

	return parsed.data;
};

export const transformAutomationImportIssues = (issues: unknown): IAutomationImportIssue[] => {
	if (!Array.isArray(issues)) {
		return [];
	}

	return issues
		.map((issue) => AutomationImportIssueSchema.safeParse(issue))
		.filter((parsed) => parsed.success)
		.map((parsed) => parsed.data);
};
