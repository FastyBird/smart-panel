import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsDefined, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * A bulk request replaces one HTTP round trip per item, so the cap is what
 * stops a single call from turning into unbounded work. It is deliberately
 * generous - the point of these endpoints is that a selection of several
 * hundred devices goes through in one request.
 */
export const BULK_DEVICES_MAX_IDS = 500;

@ApiSchema({ name: 'DevicesModuleBulkRemoveDevices' })
export class BulkRemoveDevicesDto {
	@ApiProperty({
		description: 'Identifiers of the devices to remove',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one device identifier is required."}]' })
	@ArrayMaxSize(BULK_DEVICES_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_DEVICES_MAX_IDS} device identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', { each: true, message: '[{"field":"ids","reason":"Each device identifier must be a valid UUID."}]' })
	ids: string[];
}

@ApiSchema({ name: 'DevicesModuleReqBulkRemoveDevices' })
export class ReqBulkRemoveDevicesDto {
	@ApiProperty({ description: 'Bulk removal data', type: () => BulkRemoveDevicesDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk removal data is required."}]' })
	@ValidateNested()
	@Type(() => BulkRemoveDevicesDto)
	data: BulkRemoveDevicesDto;
}

@ApiSchema({ name: 'DevicesModuleBulkUpdateDevices' })
export class BulkUpdateDevicesDto {
	@ApiProperty({
		description: 'Identifiers of the devices to update',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	@IsArray({ message: '[{"field":"ids","reason":"Ids must be an array."}]' })
	@ArrayNotEmpty({ message: '[{"field":"ids","reason":"At least one device identifier is required."}]' })
	@ArrayMaxSize(BULK_DEVICES_MAX_IDS, {
		message: `[{"field":"ids","reason":"At most ${BULK_DEVICES_MAX_IDS} device identifiers can be sent in one request."}]`,
	})
	@IsUUID('4', { each: true, message: '[{"field":"ids","reason":"Each device identifier must be a valid UUID."}]' })
	ids: string[];

	@ApiProperty({
		description: 'Whether the listed devices should be enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean value."}]' })
	enabled: boolean;
}

@ApiSchema({ name: 'DevicesModuleReqBulkUpdateDevices' })
export class ReqBulkUpdateDevicesDto {
	@ApiProperty({ description: 'Bulk update data', type: () => BulkUpdateDevicesDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Bulk update data is required."}]' })
	@ValidateNested()
	@Type(() => BulkUpdateDevicesDto)
	data: BulkUpdateDevicesDto;
}
