import { Expose, Type } from 'class-transformer';
import { IsMACAddress, IsNotEmpty, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqRegister = components['schemas']['AuthModuleReqRegisterDisplay'];
type Register = components['schemas']['AuthModuleRegisterDisplay'];

export class RegisterDisplayDto implements Register {
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
}

export class ReqRegisterDisplayDto implements ReqRegister {
	@Expose()
	@ValidateNested()
	@Type(() => RegisterDisplayDto)
	data: RegisterDisplayDto;
}
