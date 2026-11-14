import { Expose, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { AUTOMATION_IMPORT_MAX_LENGTH, AUTOMATION_IMPORT_MAX_MAPPINGS } from '../automations.constants';
import { AUTOMATION_NODE_REFERENCE_KINDS, AutomationNodeReferenceKind } from '../graph/node-type';

@ApiSchema({ name: 'AutomationsModuleImportReferenceMapping' })
export class AutomationImportReferenceMappingDto {
	@ApiProperty({
		description: 'The kind of the reference, as listed in `missing_references`',
		enum: AUTOMATION_NODE_REFERENCE_KINDS,
		example: 'property',
	})
	@Expose()
	@IsIn(AUTOMATION_NODE_REFERENCE_KINDS as unknown as string[], {
		message: `[{"field":"kind","reason":"Kind must be one of ${AUTOMATION_NODE_REFERENCE_KINDS.join(', ')}."}]`,
	})
	kind: AutomationNodeReferenceKind;

	@ApiProperty({
		description: 'The id the file refers to',
		type: 'string',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsString({ message: '[{"field":"id","reason":"The id of the reference must be a non-empty string."}]' })
	@IsNotEmpty({ message: '[{"field":"id","reason":"The id of the reference must be a non-empty string."}]' })
	@MaxLength(64, { message: '[{"field":"id","reason":"The id of the reference is too long."}]' })
	id: string;

	@ApiProperty({
		description:
			'The id of the entity of the same kind to refer to instead. For a property, its channel and device are taken over as well.',
		type: 'string',
		format: 'uuid',
		example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"to","reason":"The new reference must be a valid UUID (version 4)."}]' })
	to: string;
}

@ApiSchema({ name: 'AutomationsModulePrepareImport' })
export class PrepareAutomationImportDto {
	@ApiProperty({
		description: `The YAML document of the automation, as exported, at most ${AUTOMATION_IMPORT_MAX_LENGTH / 1024} KB`,
		type: 'string',
		maxLength: AUTOMATION_IMPORT_MAX_LENGTH,
		example:
			'version: 1\nkind: automation\nname: Hallway motion light\nmode: restart\ngraph:\n  nodes: []\n  edges: []\n',
	})
	@Expose()
	@IsString({ message: '[{"field":"yaml","reason":"The file must be given as text."}]' })
	@IsNotEmpty({ message: '[{"field":"yaml","reason":"The file is empty."}]' })
	@MaxLength(AUTOMATION_IMPORT_MAX_LENGTH, {
		message: `[{"field":"yaml","reason":"The file is larger than ${AUTOMATION_IMPORT_MAX_LENGTH / 1024} KB."}]`,
	})
	yaml: string;

	@ApiPropertyOptional({
		description:
			'References of the file to point at other entities of this installation, usually the missing ones a first preparation listed',
		type: 'array',
		maxItems: AUTOMATION_IMPORT_MAX_MAPPINGS,
		items: { $ref: getSchemaPath(AutomationImportReferenceMappingDto) },
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"mappings","reason":"Mappings must be a list."}]' })
	@ArrayMaxSize(AUTOMATION_IMPORT_MAX_MAPPINGS, {
		message: `[{"field":"mappings","reason":"At most ${AUTOMATION_IMPORT_MAX_MAPPINGS} references can be mapped."}]`,
	})
	@ValidateNested({ each: true })
	@Type(() => AutomationImportReferenceMappingDto)
	mappings?: AutomationImportReferenceMappingDto[];
}

@ApiSchema({ name: 'AutomationsModuleReqPrepareImport' })
export class ReqPrepareAutomationImportDto {
	@ApiProperty({
		description: 'The file to import and how to map its references',
		type: () => PrepareAutomationImportDto,
	})
	@Expose()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => PrepareAutomationImportDto)
	data: PrepareAutomationImportDto;
}
