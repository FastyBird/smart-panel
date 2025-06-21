import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDisplay = components['schemas']['UsersModuleReqUpdateDisplay'];
type UpdateDisplay = components['schemas']['UsersModuleUpdateDisplay'];

export class UpdateDisplayDto implements UpdateDisplay {
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
}

export class ReqUpdateDisplayDto implements ReqUpdateDisplay {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDisplayDto)
	data: UpdateDisplayDto;
}
