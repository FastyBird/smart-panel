import { type ZodType, z } from 'zod';

import type {
	AutomationsModuleExportSchema,
	AutomationsModuleImportMissingReferenceSchema,
	AutomationsModuleImportPreparationSchema,
} from '../../../openapi.constants';
import { AUTOMATION_IMPORT_MAX_LENGTH, AutomationMode, AutomationReferenceKind } from '../automations.constants';

import { AutomationGraphIssueSchema, AutomationGraphSchema } from './automations.store.schemas';
import { ItemIdSchema } from './types';

type ApiExport = AutomationsModuleExportSchema;
type ApiMissingReference = AutomationsModuleImportMissingReferenceSchema;
type ApiPreparation = AutomationsModuleImportPreparationSchema;

// STORE STATE
// ===========

// An automation as a YAML file to save
export const AutomationExportSchema = z.object({
	fileName: z.string(),
	contentType: z.string(),
	content: z.string(),
});

export const AutomationImportReferenceUsageSchema = z.object({
	// The node holding the reference; null for the space of the automation itself
	nodeId: z.string().nullable(),
	field: z.string(),
});

// An entity the imported automation refers to that does not exist here
export const AutomationImportMissingReferenceSchema = z.object({
	kind: z.nativeEnum(AutomationReferenceKind),
	id: z.string(),
	usages: z.array(AutomationImportReferenceUsageSchema),
});

// What the new automation is created with
export const AutomationImportDraftSchema = z.object({
	name: z.string(),
	description: z.string().nullable(),
	icon: z.string().nullable(),
	mode: z.nativeEnum(AutomationMode),
	spaceId: z.string().nullable(),
	graph: AutomationGraphSchema,
});

export const AutomationImportPreparationSchema = z.object({
	draft: AutomationImportDraftSchema,
	missingReferences: z.array(AutomationImportMissingReferenceSchema),
	// What a save of the disabled automation reports; none of it is blocking
	issues: z.array(AutomationGraphIssueSchema),
});

// One problem of a refused import file (`error.details.issues` of the 422 response)
export const AutomationImportIssueSchema = z.object({
	field: z.string(),
	reason: z.string(),
});

export const AutomationImportReferenceMappingSchema = z.object({
	kind: z.nativeEnum(AutomationReferenceKind),
	id: z.string().nonempty(),
	to: ItemIdSchema,
});

export const AutomationTransferStateSemaphoreSchema = z.object({
	exporting: z.array(z.string()).default([]),
	preparing: z.boolean().default(false),
});

// STORE ACTIONS
// =============

export const AutomationTransferExportActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const AutomationTransferPrepareActionPayloadSchema = z.object({
	yaml: z.string().nonempty().max(AUTOMATION_IMPORT_MAX_LENGTH),
	mappings: z.array(AutomationImportReferenceMappingSchema).optional(),
});

// BACKEND API
// ===========

export const AutomationExportResSchema: ZodType<ApiExport> = z.object({
	file_name: z.string(),
	content_type: z.string(),
	content: z.string(),
});

export const AutomationImportMissingReferenceResSchema: ZodType<ApiMissingReference> = z.object({
	kind: z.nativeEnum(AutomationReferenceKind),
	id: z.string(),
	usages: z.array(z.object({ node_id: z.string().nullable(), field: z.string() })),
});

export const AutomationImportPreparationResSchema = z.object({
	draft: z.object({
		name: z.string(),
		description: z.string().nullable(),
		icon: z.string().nullable(),
		mode: z.nativeEnum(AutomationMode),
		space_id: z.string().nullable(),
		graph: AutomationGraphSchema,
	}),
	missing_references: z.array(AutomationImportMissingReferenceResSchema),
	issues: z.array(z.unknown()),
}) as unknown as ZodType<ApiPreparation>;
