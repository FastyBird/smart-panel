import { Expose, Type } from 'class-transformer';
import { IsMACAddress, IsNotEmpty, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'AuthModuleRegisterDisplay' })
export class RegisterDisplayDto {
	@ApiProperty({
		description: 'Unique identifier for the display device (e.g., UUID).',
		type: 'string',
		format: 'uuid',
		example: 'fcab917a-f889-47cf-9ace-ef085774864e',
	})
	@Expose()
	@IsNotEmpty()
	@IsUUID('4', { message: '[{"field":"uid","reason":"UID must be a valid UUID (version 4)."}]' })
	uid: string;

	@ApiProperty({
		description: 'MAC address of the device network interface.',
		type: 'string',
		format: 'mac',
		example: '00:1A:2B:3C:4D:5E',
	})
	@Expose()
	@IsNotEmpty()
	@IsMACAddress({ message: '[{"field":"mac","reason":"Mac address must be a valid MAC string."}]' })
	mac: string;

	@ApiProperty({
		description: 'Application version running on the display.',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"version","reason":"Version must be a non-empty string."}]' })
	@Matches(
		/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i,
		{
			message:
				'[{"field":"version","reason":"Version must follow full semantic versioning (e.g. 1.0.0, 1.0.0-beta+exp.sha.5114f85)."}]',
		},
	)
	version: string;

	@ApiProperty({
		description: 'Build number or identifier of the app.',
		type: 'string',
		example: '42',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	build: string;
}

@ApiSchema({ name: 'AuthModuleReqRegisterDisplay' })
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
