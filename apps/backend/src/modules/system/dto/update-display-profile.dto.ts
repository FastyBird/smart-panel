import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';

type ReqUpdateDisplayProfile = components['schemas']['SystemModuleReqUpdateDisplayProfile'];
type UpdateDisplayProfile = components['schemas']['SystemModuleUpdateDisplayProfile'];

export class UpdateDisplayProfileDto implements UpdateDisplayProfile {
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"unit_size","reason":"Default unit size must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"unit_size","reason":"Default unit size must be at least 1."}]' })
	unit_size?: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"rows","reason":"Default row count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"rows","reason":"Default row count must be at least 1."}]' })
	rows?: number;

	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"cols","reason":"Default column count must be a valid integer."}]' })
	@Min(1, { message: '[{"field":"cols","reason":"Default column count must be at least 1."}]' })
	cols?: number;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"hidden","reason":"Primary attribute must be a valid true or false."}]' })
	primary?: boolean;
}

export class ReqUpdateDisplayProfileDto implements ReqUpdateDisplayProfile {
	@Expose()
	@ValidateNested()
	@Type(() => UpdateDisplayProfileDto)
	data: UpdateDisplayProfileDto;
}
