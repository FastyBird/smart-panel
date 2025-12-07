import { Expose, Transform } from 'class-transformer';
import { IsInt, IsMACAddress, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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
	@Expose({ name: 'mac_address' })
	@IsMACAddress({ message: '[{"field":"mac_address","reason":"MAC address must be a valid MAC address format."}]' })
	@Transform(({ obj }: { obj: { mac_address?: string; macAddress?: string } }) => obj.mac_address ?? obj.macAddress, {
		toClassOnly: true,
	})
	macAddress: string;

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
	@IsOptional()
	@IsString({ message: '[{"field":"build","reason":"Build must be a string."}]' })
	build?: string;

	@ApiPropertyOptional({
		name: 'screen_width',
		description: 'Display screen width in pixels',
		type: 'integer',
		example: 1920,
	})
	@Expose({ name: 'screen_width' })
	@IsOptional()
	@IsInt({ message: '[{"field":"screen_width","reason":"Screen width must be an integer."}]' })
	@Transform(
		({ obj }: { obj: { screen_width?: number; screenWidth?: number } }) => obj.screen_width ?? obj.screenWidth,
		{
			toClassOnly: true,
		},
	)
	screenWidth?: number;

	@ApiPropertyOptional({
		name: 'screen_height',
		description: 'Display screen height in pixels',
		type: 'integer',
		example: 1080,
	})
	@Expose({ name: 'screen_height' })
	@IsOptional()
	@IsInt({ message: '[{"field":"screen_height","reason":"Screen height must be an integer."}]' })
	@Transform(
		({ obj }: { obj: { screen_height?: number; screenHeight?: number } }) => obj.screen_height ?? obj.screenHeight,
		{ toClassOnly: true },
	)
	screenHeight?: number;

	@ApiPropertyOptional({
		name: 'pixel_ratio',
		description: 'Display pixel ratio',
		type: 'number',
		example: 1.5,
	})
	@Expose({ name: 'pixel_ratio' })
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"pixel_ratio","reason":"Pixel ratio must be a number."}]' })
	@Transform(({ obj }: { obj: { pixel_ratio?: number; pixelRatio?: number } }) => obj.pixel_ratio ?? obj.pixelRatio, {
		toClassOnly: true,
	})
	pixelRatio?: number;

	@ApiPropertyOptional({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'number',
		example: 8,
	})
	@Expose({ name: 'unit_size' })
	@IsOptional()
	@IsNumber({}, { message: '[{"field":"unit_size","reason":"Unit size must be a number."}]' })
	@Transform(({ obj }: { obj: { unit_size?: number; unitSize?: number } }) => obj.unit_size ?? obj.unitSize, {
		toClassOnly: true,
	})
	unitSize?: number;

	@ApiPropertyOptional({
		description: 'Number of grid rows',
		type: 'integer',
		example: 12,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Rows must be an integer."}]' })
	rows?: number;

	@ApiPropertyOptional({
		description: 'Number of grid columns',
		type: 'integer',
		example: 24,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Cols must be an integer."}]' })
	cols?: number;
}

@ApiSchema({ name: 'DisplaysModuleReqRegisterDisplay' })
export class ReqRegisterDisplayDto {
	@ApiProperty({
		description: 'Display registration data',
		type: () => RegisterDisplayDto,
	})
	@Expose()
	data: RegisterDisplayDto;
}
