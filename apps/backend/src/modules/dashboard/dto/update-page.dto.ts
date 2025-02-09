import { Expose } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

type UpdatePageBase = components['schemas']['DashboardUpdatePageBase'];
type UpdateCardsPage = components['schemas']['DashboardUpdateCardsPage'];
type UpdateTilesPage = components['schemas']['DashboardUpdateTilesPage'];
type UpdateDevicePage = components['schemas']['DashboardUpdateDevicePage'];

export abstract class UpdatePageDto implements UpdatePageBase {
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
}

export class UpdateCardsPageDto extends UpdatePageDto implements UpdateCardsPage {}

export class UpdateTilesPageDto extends UpdatePageDto implements UpdateTilesPage {}

export class UpdateDevicePageDto extends UpdatePageDto implements UpdateDevicePage {
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;
}
