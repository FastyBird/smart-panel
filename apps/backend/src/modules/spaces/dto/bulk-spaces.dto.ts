import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDefined, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * A bulk request replaces one HTTP round trip per item, so the cap is what
 * stops a single call from turning into unbounded work.
 */
export const BULK_SPACES_MAX_IDS = 500;

@ApiSchema({ name: 'SpacesModuleBulkRemoveSpaces' })
export class BulkRemoveSpacesDto {
	@ApiProperty({
		description: 'Identifiers of the spaces to remove',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one space identifier is required."}]' })
	@ArrayMaxSize(BULK_SPACES_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_SPACES_MAX_IDS} space identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', { each: true, message: '[{"field":"ids","reason":"Each space identifier must be a valid UUID."}]' })
	ids: string[];
}

@ApiSchema({ name: 'SpacesModuleReqBulkRemoveSpaces' })
export class ReqBulkRemoveSpacesDto {
	@ApiProperty({ description: 'Bulk removal data', type: () => BulkRemoveSpacesDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk removal data is required."}]' })
	@ValidateNested()
	@Type(() => BulkRemoveSpacesDto)
	data: BulkRemoveSpacesDto;
}
