import { Expose, Type } from 'class-transformer';
import { IsMACAddress, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateUserExists } from '../validators/user-exists-constraint.validator';

type ReqCreateDisplayInstance = components['schemas']['UsersModuleReqCreateDisplayInstance'];
type CreateDisplayInstance = components['schemas']['UsersModuleCreateDisplayInstance'];

export class CreateDisplayInstanceDto implements CreateDisplayInstance {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	id?: string;

	@Expose()
	@IsNotEmpty()
	@IsUUID('4', { message: '[{"field":"uid","reason":"UID must be a valid UUID (version 4)."}]' })
	uid: string;

	@Expose()
	@IsNotEmpty()
	@IsMACAddress({ message: '[{"field":"mac","reason":"Mac address must be a valid MAC string."}]' })
	mac: string;

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

	@Expose()
	@IsNotEmpty({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	build: string;

	@Expose()
	@IsUUID('4', { message: '[{"field":"user","reason":"User must be a valid UUID (version 4)."}]' })
	@ValidateUserExists({ message: '[{"field":"user","reason":"The specified user does not exist."}]' })
	user: string;
}

export class ReqCreateDisplayInstanceDto implements ReqCreateDisplayInstance {
	@Expose()
	@ValidateNested()
	@Type(() => CreateDisplayInstanceDto)
	data: CreateDisplayInstanceDto;
}
