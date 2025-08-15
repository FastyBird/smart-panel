import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDisplayInstance = components['schemas']['UsersModuleReqUpdateDisplayInstance'];
type UpdateDisplayInstance = components['schemas']['UsersModuleUpdateDisplayInstance'];

export class UpdateDisplayInstanceDto implements UpdateDisplayInstance {
	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"version","reason":"Version must be a non-empty string."}]' })
	@Matches(
		/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i,
		{
			message:
				'[{"field":"version","reason":"Version must follow full semantic versioning (e.g. 1.0.0, 1.0.0-beta+exp.sha.5114f85)."}]',
		},
	)
	version?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"build","reason":"Build must be a non-empty string."}]' })
	build?: string;

	@Expose()
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"display_profile","reason":"Display profile ID must be a valid UUID (version 4)."}]',
	})
	display_profile?: string;
}

export class ReqUpdateDisplayInstanceDto implements ReqUpdateDisplayInstance {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDisplayInstanceDto)
	data: UpdateDisplayInstanceDto;
}
