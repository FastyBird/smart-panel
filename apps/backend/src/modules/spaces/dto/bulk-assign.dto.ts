import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SpacesModuleBulkAssign' })
export class BulkAssignDto {
	@ApiPropertyOptional({
		name: 'device_ids',
		description: 'Array of device IDs to assign to the space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'device_ids' })
	@IsOptional()
	@IsArray({ message: '[{"field":"device_ids","reason":"Device IDs must be an array."}]' })
	@IsUUID('4', { each: true, message: '[{"field":"device_ids","reason":"Each device ID must be a valid UUID."}]' })
	@Transform(({ obj }: { obj: { device_ids?: string[]; deviceIds?: string[] } }) => obj.device_ids ?? obj.deviceIds, {
		toClassOnly: true,
	})
	deviceIds?: string[];

	@ApiPropertyOptional({
		name: 'display_ids',
		description: 'Array of display IDs to assign to the space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'display_ids' })
	@IsOptional()
	@IsArray({ message: '[{"field":"display_ids","reason":"Display IDs must be an array."}]' })
	@IsUUID('4', { each: true, message: '[{"field":"display_ids","reason":"Each display ID must be a valid UUID."}]' })
	@Transform(
		({ obj }: { obj: { display_ids?: string[]; displayIds?: string[] } }) => obj.display_ids ?? obj.displayIds,
		{ toClassOnly: true },
	)
	displayIds?: string[];
}

@ApiSchema({ name: 'SpacesModuleReqBulkAssign' })
export class ReqBulkAssignDto {
	@ApiProperty({
		description: 'Bulk assignment data',
		type: () => BulkAssignDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => BulkAssignDto)
	data: BulkAssignDto;
}
