import { Expose, Type } from 'class-transformer';
import { IsMACAddress, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import type { components } from '../../../openapi';
import { ValidateUserExists } from '../validators/user-exists-constraint.validator';

type ReqCreateDisplayInstance = components['schemas']['UsersModuleReqCreateDisplayInstance'];
type CreateDisplayInstance = components['schemas']['UsersModuleCreateDisplayInstance'];

@ApiSchema({ name: 'UsersModuleCreateDisplayInstance' })
export class CreateDisplayInstanceDto implements CreateDisplayInstance {
	@ApiPropertyOptional({
		description: 'Optional display instance ID (UUID v4)',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@ApiProperty({
		description: 'Unique identifier for the display instance',
		format: 'uuid',
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	})
	@Expose()
	@IsNotEmpty()
	@IsUUID('4', { message: '[{"field":"uid","reason":"UID must be a valid UUID (version 4)."}]' })
	uid: string;

	@ApiProperty({
		description: 'MAC address of the display device',
		type: 'string',
		example: '00:1B:44:11:3A:B7',
	})
	@Expose()
	@IsNotEmpty()
	@IsMACAddress({ message: '[{"field":"mac","reason":"Mac address must be a valid MAC string."}]' })
	mac: string;

	@ApiProperty({
		description: 'Semantic version of the display software',
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
		description: 'Build identifier for the display software',
		type: 'string',
		example: '20250124-1a2b3c4',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	build: string;

	@ApiProperty({
		description: 'User ID that owns this display instance',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"user","reason":"User must be a valid UUID (version 4)."}]' })
	@ValidateUserExists({ message: '[{"field":"user","reason":"The specified user does not exist."}]' })
	user: string;
}

@ApiSchema({ name: 'UsersModuleReqCreateDisplayInstance' })
export class ReqCreateDisplayInstanceDto implements ReqCreateDisplayInstance {
	@ApiProperty({
		description: 'Display instance creation data',
		type: () => CreateDisplayInstanceDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => CreateDisplayInstanceDto)
	data: CreateDisplayInstanceDto;
}
