import { Expose, Transform, Type } from 'class-transformer';
import { IsDefined, IsIn, IsObject, IsString, Matches, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { PROTECT_ID_PATTERN } from '../client/protect-endpoints';
import { PROTECT_MODEL_KEYS, ProtectModelKey } from '../mappings/mapping.types';

// Reads the original plain value: implicit conversion would otherwise turn a number or boolean into a string.
const original =
	(wireName: string) =>
	({ obj }: { obj: Record<string, unknown> }): unknown =>
		obj[wireName];

@ApiSchema({ name: 'DevicesUnifiProtectPluginMappingPreview' })
export class ProtectMappingPreviewDto {
	@ApiProperty({
		name: 'device_id',
		description: 'UniFi Protect device identifier',
		example: '600cefafd5f365d6f83c4ef3',
	})
	@Expose({ name: 'device_id' })
	@Transform(original('device_id'))
	@IsString({ message: '[{"field":"device_id","reason":"Device id must be a string."}]' })
	@Matches(PROTECT_ID_PATTERN, {
		message: '[{"field":"device_id","reason":"Device id must be a valid UniFi Protect identifier."}]',
	})
	deviceId: string;

	@ApiProperty({
		name: 'model_key',
		description: 'UniFi Protect device kind',
		enum: PROTECT_MODEL_KEYS,
	})
	@Expose({ name: 'model_key' })
	@Transform(original('model_key'))
	@IsIn(PROTECT_MODEL_KEYS, {
		message: '[{"field":"model_key","reason":"Model key must be one of camera, sensor or light."}]',
	})
	modelKey: ProtectModelKey;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginReqMappingPreview' })
export class ProtectReqMappingPreviewDto {
	@ApiProperty({ description: 'Device to preview', type: () => ProtectMappingPreviewDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Preview data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Preview data must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectMappingPreviewDto)
	data: ProtectMappingPreviewDto;
}
