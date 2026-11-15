import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsDefined,
	IsIn,
	IsObject,
	IsOptional,
	IsString,
	Length,
	Matches,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PROTECT_ID_PATTERN } from '../client/protect-endpoints';
import { PROTECT_STREAM_QUALITIES, ProtectStreamQuality } from '../devices-unifi-protect.constants';
import { PROTECT_MODEL_KEYS, ProtectModelKey } from '../mappings/mapping.types';

import { original } from './protect-original.transform';

export const PROTECT_ADOPT_BATCH_MAX = 50;

@ApiSchema({ name: 'DevicesUnifiProtectPluginAdoptStream' })
export class ProtectAdoptStreamDto {
	@ApiPropertyOptional({
		description: 'Whether adoption enables the camera streams on the console',
		type: 'boolean',
		default: true,
	})
	@Expose()
	@Transform(original('enabled'))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Stream quality to enable; the plugin default is used when omitted',
		enum: PROTECT_STREAM_QUALITIES,
	})
	@Expose()
	@Transform(original('quality'))
	@IsOptional()
	@IsIn(PROTECT_STREAM_QUALITIES, {
		message: '[{"field":"quality","reason":"Quality must be one of high, medium or low."}]',
	})
	quality?: ProtectStreamQuality;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginAdoptDevice' })
export class ProtectAdoptDeviceDto {
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

	@ApiProperty({ name: 'model_key', description: 'UniFi Protect device kind', enum: PROTECT_MODEL_KEYS })
	@Expose({ name: 'model_key' })
	@Transform(original('model_key'))
	@IsIn(PROTECT_MODEL_KEYS, {
		message: '[{"field":"model_key","reason":"Model key must be one of camera, sensor or light."}]',
	})
	modelKey: ProtectModelKey;

	@ApiPropertyOptional({
		description: 'Smart Panel display name; the console name is used when omitted',
		type: 'string',
		minLength: 1,
		maxLength: 255,
	})
	@Expose()
	@Transform(original('name'))
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	@Length(1, 255, { message: '[{"field":"name","reason":"Name must be 1 to 255 characters long."}]' })
	name?: string;

	@ApiPropertyOptional({ description: 'Stream options of a camera', type: () => ProtectAdoptStreamDto })
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"stream","reason":"Stream must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectAdoptStreamDto)
	stream?: ProtectAdoptStreamDto;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginReqAdoptDevice' })
export class ProtectReqAdoptDeviceDto {
	@ApiProperty({ description: 'Device to adopt', type: () => ProtectAdoptDeviceDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Adoption data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Adoption data must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectAdoptDeviceDto)
	data: ProtectAdoptDeviceDto;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginBatchAdoptDevices' })
export class ProtectBatchAdoptDevicesDto {
	@ApiProperty({
		description: 'Devices to adopt independently in request order',
		type: [ProtectAdoptDeviceDto],
		minItems: 1,
		maxItems: PROTECT_ADOPT_BATCH_MAX,
	})
	@Expose()
	@IsArray({ message: '[{"field":"devices","reason":"Devices must be an array."}]' })
	@ArrayMinSize(1, { message: '[{"field":"devices","reason":"At least one device is required."}]' })
	@ArrayMaxSize(PROTECT_ADOPT_BATCH_MAX, {
		message: `[{"field":"devices","reason":"At most ${PROTECT_ADOPT_BATCH_MAX} devices can be adopted at once."}]`,
	})
	@ValidateNested({ each: true })
	@Type(() => ProtectAdoptDeviceDto)
	devices: ProtectAdoptDeviceDto[];
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginReqBatchAdoptDevices' })
export class ProtectReqBatchAdoptDevicesDto {
	@ApiProperty({ description: 'Devices to adopt', type: () => ProtectBatchAdoptDevicesDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Adoption data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Adoption data must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectBatchAdoptDevicesDto)
	data: ProtectBatchAdoptDevicesDto;
}
