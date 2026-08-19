import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * A bulk request replaces one HTTP round trip per item, so the cap is what
 * stops a single call from turning into unbounded work.
 */
export const BULK_EXTENSIONS_MAX_TYPES = 500;

@ApiSchema({ name: 'ExtensionsModuleBulkUpdateExtensions' })
export class BulkUpdateExtensionsDto {
	/**
	 * Extensions are addressed by their type, not by a generated id - the single
	 * update route is `PATCH /extensions/:type` - so the selection travels as
	 * types and the outcome is reported against the same strings.
	 */
	@ApiProperty({
		description: 'Types of the extensions to update',
		type: 'array',
		items: { type: 'string' },
		example: ['devices-shelly-ng-plugin'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"types","reason":"Types must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"types","reason":"At least one extension type is required."}]' })
	@ArrayMaxSize(BULK_EXTENSIONS_MAX_TYPES, {
		message: `[{"field":"types","reason":"At most ${BULK_EXTENSIONS_MAX_TYPES} extension types can be sent in one request."}]`,
	})
	@IsString({ each: true, message: '[{"field":"types","reason":"Each extension type must be a string."}]' })
	types: string[];

	@ApiProperty({
		description: 'Whether the listed extensions should be enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled: boolean;
}

@ApiSchema({ name: 'ExtensionsModuleReqBulkUpdateExtensions' })
export class ReqBulkUpdateExtensionsDto {
	@ApiProperty({ description: 'Bulk update data', type: () => BulkUpdateExtensionsDto })
	@Expose()
	@ValidateNested()
	@Type(() => BulkUpdateExtensionsDto)
	data: BulkUpdateExtensionsDto;
}
