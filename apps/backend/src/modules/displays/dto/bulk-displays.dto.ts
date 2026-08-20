import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDefined, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * A bulk request replaces one HTTP round trip per item, so the cap is what
 * stops a single call from turning into unbounded work.
 */
export const BULK_DISPLAYS_MAX_IDS = 500;

@ApiSchema({ name: 'DisplaysModuleBulkRemoveDisplays' })
export class BulkRemoveDisplaysDto {
	@ApiProperty({
		description: 'Identifiers of the displays to remove',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one display identifier is required."}]' })
	@ArrayMaxSize(BULK_DISPLAYS_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_DISPLAYS_MAX_IDS} display identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', { each: true, message: '[{"field":"ids","reason":"Each display identifier must be a valid UUID."}]' })
	ids: string[];
}

@ApiSchema({ name: 'DisplaysModuleReqBulkRemoveDisplays' })
export class ReqBulkRemoveDisplaysDto {
	@ApiProperty({ description: 'Bulk removal data', type: () => BulkRemoveDisplaysDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk removal data is required."}]' })
	@ValidateNested()
	@Type(() => BulkRemoveDisplaysDto)
	data: BulkRemoveDisplaysDto;
}
