import { Expose, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsInt,
	IsMACAddress,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DisplaysModuleRegisterDisplay' })
export class RegisterDisplayDto {
	@ApiProperty({
		name: 'mac_address',
		description: 'MAC address of the device network interface',
		type: 'string',
		format: 'mac',
		example: '00:1A:2B:3C:4D:5E',
	})
	@Expose()
	@IsMACAddress({ message: '[{"field":"mac_address","reason":"MAC address must be a valid MAC address format."}]' })
	mac_address: string;

	@ApiProperty({
		description: 'Application version running on the display',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"version","reason":"Version must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"version","reason":"Version must be a string."}]' })
	version: string;

	@ApiPropertyOptional({
		description: 'Build number or identifier of the app',
		type: 'string',
		example: '42',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"build","reason":"Build must be a string."}]' })
	build?: string;

	@ApiPropertyOptional({
		name: 'screen_width',
		description: 'Display screen width in pixels',
		type: 'integer',
		example: 1920,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"screen_width","reason":"Screen width must be an integer."}]' })
	screen_width?: number;

	@ApiPropertyOptional({
		name: 'screen_height',
		description: 'Display screen height in pixels',
		type: 'integer',
		example: 1080,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"screen_height","reason":"Screen height must be an integer."}]' })
	screen_height?: number;

	@ApiPropertyOptional({
		name: 'pixel_ratio',
		description: 'Display pixel ratio',
		type: 'number',
		example: 1.5,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"pixel_ratio","reason":"Pixel ratio must be a number."}]' })
	pixel_ratio?: number;

	@ApiPropertyOptional({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'number',
		example: 8,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"unit_size","reason":"Unit size must be a number."}]' })
	unit_size?: number;

	@ApiPropertyOptional({
		description: 'Number of grid rows',
		type: 'integer',
		example: 12,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Rows must be an integer."}]' })
	rows?: number;

	@ApiPropertyOptional({
		description: 'Number of grid columns',
		type: 'integer',
		example: 24,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Cols must be an integer."}]' })
	cols?: number;

	@ApiPropertyOptional({
		name: 'audio_output_supported',
		description: 'Whether the display supports audio output (speakers)',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"audio_output_supported","reason":"Audio output supported must be a boolean."}]' })
	audio_output_supported?: boolean;

	@ApiPropertyOptional({
		name: 'audio_input_supported',
		description: 'Whether the display supports audio input (microphone)',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"audio_input_supported","reason":"Audio input supported must be a boolean."}]' })
	audio_input_supported?: boolean;
}

@ApiSchema({ name: 'DisplaysModuleReqRegisterDisplay' })
export class ReqRegisterDisplayDto {
	@ApiProperty({
		description: 'Display registration data',
		type: () => RegisterDisplayDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => RegisterDisplayDto)
	data: RegisterDisplayDto;
}
