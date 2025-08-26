import { Expose, Type } from 'class-transformer';
import {
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDisplayProfileExists } from '../../system/validators/display-profile-exists-constraint.validator';

type ReqUpdatePage = components['schemas']['DashboardModuleReqUpdatePage'];
type UpdatePage = components['schemas']['DashboardModuleUpdatePage'];

export abstract class UpdatePageDto implements UpdatePage {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	@IsString({ message: '[{"field":"type","reason":"Type must be one of the supported page type."}]' })
	readonly type: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Title must be a non-empty string."}]' })
	title?: string;

	@Expose()
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a valid icon name."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@Expose()
	@IsOptional()
	@IsNumber(
		{ allowNaN: false, allowInfinity: false },
		{ each: false, message: '[{"field":"order","reason":"Order must be a positive number greater than zero."}]' },
	)
	order?: number;

	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"show_top_bar","reason":"Show top bar attribute must be a valid true or false."}]' })
	show_top_bar?: boolean;

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"display","reason":"Display must be a valid UUID (version 4)."}]' })
	@ValidateDisplayProfileExists({ message: '[{"field":"display","reason":"The specified display does not exist."}]' })
	display?: string;
}

export class ReqUpdatePageDto implements ReqUpdatePage {
	@Expose()
	@ValidateNested()
	@Type(() => UpdatePageDto)
	data: UpdatePageDto;
}
