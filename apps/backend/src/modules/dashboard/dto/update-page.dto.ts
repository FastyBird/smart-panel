import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ValidateDeviceExists } from '../validators/device-exists-constraint.validator';

type ReqUpdatePage = components['schemas']['DashboardReqUpdatePage'];
type UpdatePageBase = components['schemas']['DashboardUpdatePageBase'];
type UpdateCardsPage = components['schemas']['DashboardUpdateCardsPage'];
type UpdateTilesPage = components['schemas']['DashboardUpdateTilesPage'];
type UpdateDevicePage = components['schemas']['DashboardUpdateDevicePage'];

const determinePageDto = (obj: unknown): new () => object => {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		'data' in obj &&
		typeof obj.data === 'object' &&
		obj.data !== null &&
		'type' in obj.data
	) {
		switch ((obj.data as { type: string }).type) {
			case 'cards':
				return UpdateCardsPageDto;
			case 'tiles':
				return UpdateTilesPageDto;
			case 'device':
				return UpdateDevicePageDto;
			default:
				throw new Error(`Unknown type ${(obj.data as { type: string }).type}`);
		}
	}
	throw new Error('Invalid object format for determining page DTO');
};

export abstract class UpdatePageDto implements UpdatePageBase {
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
}

export class UpdateCardsPageDto extends UpdatePageDto implements UpdateCardsPage {
	readonly type: 'cards';
}

export class UpdateTilesPageDto extends UpdatePageDto implements UpdateTilesPage {
	readonly type: 'tiles';
}

export class UpdateDevicePageDto extends UpdatePageDto implements UpdateDevicePage {
	readonly type: 'device';

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;
}

export class ReqUpdatePageDto implements ReqUpdatePage {
	@Expose()
	@ValidateNested()
	@Type((options) => determinePageDto(options?.object ?? {}))
	data: UpdateCardsPageDto | UpdateTilesPageDto | UpdateDevicePageDto;
}
