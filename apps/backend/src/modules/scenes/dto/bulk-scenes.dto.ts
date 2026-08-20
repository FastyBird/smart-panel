import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsDefined, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * A bulk request replaces one HTTP round trip per item, so the cap is what
 * stops a single call from turning into unbounded work.
 */
export const BULK_SCENES_MAX_IDS = 500;

@ApiSchema({ name: 'ScenesModuleBulkRemoveScenes' })
export class BulkRemoveScenesDto {
	@ApiProperty({
		description: 'Identifiers of the scenes to remove',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one scene identifier is required."}]' })
	@ArrayMaxSize(BULK_SCENES_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_SCENES_MAX_IDS} scene identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', { each: true, message: '[{"field":"ids","reason":"Each scene identifier must be a valid UUID."}]' })
	ids: string[];
}

@ApiSchema({ name: 'ScenesModuleReqBulkRemoveScenes' })
export class ReqBulkRemoveScenesDto {
	@ApiProperty({ description: 'Bulk removal data', type: () => BulkRemoveScenesDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk removal data is required."}]' })
	@ValidateNested()
	@Type(() => BulkRemoveScenesDto)
	data: BulkRemoveScenesDto;
}

@ApiSchema({ name: 'ScenesModuleBulkUpdateScenes' })
export class BulkUpdateScenesDto {
	@ApiProperty({
		description: 'Identifiers of the scenes to update',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one scene identifier is required."}]' })
	@ArrayMaxSize(BULK_SCENES_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_SCENES_MAX_IDS} scene identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', { each: true, message: '[{"field":"ids","reason":"Each scene identifier must be a valid UUID."}]' })
	ids: string[];

	@ApiProperty({
		description: 'Whether the listed scenes should be enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled: boolean;
}

@ApiSchema({ name: 'ScenesModuleReqBulkUpdateScenes' })
export class ReqBulkUpdateScenesDto {
	@ApiProperty({ description: 'Bulk update data', type: () => BulkUpdateScenesDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk update data is required."}]' })
	@ValidateNested()
	@Type(() => BulkUpdateScenesDto)
	data: BulkUpdateScenesDto;
}
